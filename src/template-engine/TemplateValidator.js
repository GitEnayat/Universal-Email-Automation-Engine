/*
MODULE: TemplateValidator
--------------------------------
Validates templates before execution.
Implements "fail fast" principle for better developer experience.
--------------------------------
*/

/**
 * Validates a template for errors before execution.
 * Checks: tab existence, required tags, dictionary commands, table ranges.
 * @param {string} templateName - Name of the template tab to validate
 * @param {string} [documentId] - Optional document ID (uses config default if not provided)
 * @return {Object} Validation result { valid: boolean, errors: string[], warnings: string[] }
 */
function validateTemplate(templateName, documentId) {
  const errors = [];
  const warnings = [];
  
  Log.info("TemplateValidator", `Validating template: "${templateName}"`);
  
  // Get document ID from config if not provided
  if (!documentId) {
    const config = new AppConfig();
    documentId = config.templateDocumentId;
  }
  
  // 1. Check if document exists
  try {
    const doc = DocumentApp.openById(documentId);
    if (!doc) {
      errors.push(`Document not found: ${documentId}`);
      return { valid: false, errors, warnings };
    }
    
    // 2. Check if tab exists
    const tabs = doc.getTabs();
    const targetTab = findTabRecursive_(tabs, templateName);
    
    if (!targetTab) {
      errors.push(`Tab '${templateName}' not found in document`);
      // List available tabs for helpful error
      const availableTabs = getAllTabNames_(tabs);
      errors.push(`Available tabs: ${availableTabs.join(", ") || "None found"}`);
      return { valid: false, errors, warnings };
    }
    
    // 3. Parse template content
    const docTab = targetTab.asDocumentTab();
    const bodyElement = docTab.getBody();
    const numChildren = bodyElement.getNumChildren();
    
    let hasSubjectTag = false;
    let hasBodyTag = false;
    let subjectContent = "";
    let bodyContent = "";
    let mode = "none";
    
    // Extract content sections
    for (let i = 0; i < numChildren; i++) {
      const child = bodyElement.getChild(i);
      const text = child.getText().trim();
      
      if (text === "[SUBJECT]") { 
        mode = "subject"; 
        hasSubjectTag = true;
        continue; 
      }
      if (text === "[BODY]") { 
        mode = "body"; 
        hasBodyTag = true;
        continue; 
      }
      if (text === "[TO]") { mode = "to"; continue; }
      if (text === "[CC]") { mode = "cc"; continue; }
      
      if (mode === "subject" && text !== "") { 
        subjectContent += text + " "; 
        mode = "none"; 
      }
      else if (mode === "body") { 
        bodyContent += text + " "; 
      }
      else if (mode === "to" && text !== "") {
        // Validate TO recipients
        const toErrors = validateRecipients_(text);
        if (toErrors.length > 0) {
          errors.push(`[TO] section: ${toErrors.join(", ")}`);
        }
      }
      else if (mode === "cc" && text !== "") {
        // Validate CC recipients  
        const ccErrors = validateRecipients_(text);
        if (ccErrors.length > 0) {
          errors.push(`[CC] section: ${ccErrors.join(", ")}`);
        }
      }
    }
    
    // 4. Check required tags
    if (!hasSubjectTag) {
      errors.push("Missing required tag: [SUBJECT]");
    }
    if (!hasBodyTag) {
      errors.push("Missing required tag: [BODY]");
    }
    
    // 5. Validate subject content
    if (hasSubjectTag && !subjectContent.trim()) {
      errors.push("[SUBJECT] tag is present but empty");
    }
    
    // 6. Validate body content
    if (hasBodyTag && !bodyContent.trim()) {
      warnings.push("[BODY] tag is present but appears to be empty");
    }
    
    // 7. Check dictionary tags
    const allContent = subjectContent + " " + bodyContent;
    const dictErrors = validateDictionaryTags_(allContent);
    errors.push(...dictErrors);
    
    const dictWarnings = checkDeprecatedTags_(allContent);
    warnings.push(...dictWarnings);
    
    // 8. Check table tags
    const tableErrors = validateTableTags_(bodyContent);
    errors.push(...tableErrors);
    
    // 9. Check for common mistakes
    const commonMistakes = checkCommonMistakes_(allContent);
    warnings.push(...commonMistakes);
    
  } catch (e) {
    errors.push(`Validation error: ${e.message}`);
  }
  
  const valid = errors.length === 0;
  
  if (valid && warnings.length === 0) {
    Log.info("TemplateValidator", `✅ Template "${templateName}" is valid`);
  } else if (valid) {
    Log.warn("TemplateValidator", `⚠️ Template "${templateName}" has warnings: ${warnings.join(", ")}`);
  } else {
    Log.error("TemplateValidator", `❌ Template "${templateName}" has errors: ${errors.join(", ")}`);
  }
  
  return { valid, errors, warnings };
}

/**
 * Validates dictionary tags in content
 * @param {string} content - Template content to check
 * @return {string[]} Array of error messages
 */
function validateDictionaryTags_(content) {
  const errors = [];
  const validCommands = [
    "DATE", "RANGE", "TIME", "MONTHNAME", "RAMCO", 
    "DATE_FORMAT", "GREETING", "ACTIVE_SPREADSHEET_LINK", "THIS_SHEET"
  ];
  
  // Find all {{...}} tags
  const tagRegex = /\{\{([^}]+)\}\}/g;
  let match;
  
  while ((match = tagRegex.exec(content)) !== null) {
    const fullTag = match[1].trim();
    const parts = fullTag.split(":").map(p => p.trim());
    const command = parts[0].toUpperCase();
    
    // Clean command (remove HTML artifacts)
    const cleanCommand = command.replace(/<[^>]+>/g, "").trim();
    
    if (!validCommands.includes(cleanCommand)) {
      // Check if it looks like a variable placeholder (e.g., {{SENDER_NAME}})
      if (!/^[A-Z_]+$/.test(cleanCommand)) {
        errors.push(`Unknown dictionary command: "${cleanCommand}" in tag "{{${fullTag}}}"`);
      }
    }
    
    // Check for malformed tags
    if (fullTag.includes("{{") || fullTag.includes("}}")) {
      errors.push(`Malformed tag (nested braces): "{{${fullTag}}}"`);
    }
  }
  
  return errors;
}

/**
 * Validates table tags and their ranges
 * @param {string} content - Body content to check
 * @return {string[]} Array of error messages
 */
function validateTableTags_(content) {
  const errors = [];
  
  // Find all [Table] tags
  const tableRegex = /\[Table\]\s*Sheet:\s*([^,]+),\s*range:\s*([^\$]+?)(?:\$|<\/p>|\n|$)/gi;
  let match;
  
  while ((match = tableRegex.exec(content)) !== null) {
    const sheetRef = match[1].trim();
    const rangeRef = match[2].trim();
    
    // Check if sheet reference looks like a URL or ID
    if (!sheetRef.match(/[-\w]{25,}/) && !sheetRef.match(/^https?:\/\//)) {
      errors.push(`Table tag: Invalid sheet reference "${sheetRef}"`);
    }
    
    // Validate A1 notation (basic check)
    // Pattern: SheetName!A1:B10 or 'Sheet Name'!A1:B10
    const rangePattern = /^['"]?[^!'"]+['"]?![A-Z]+\d+:[A-Z]+\d+$/;
    const cleanRange = rangeRef.replace(/<[^>]+>/g, "").trim();
    
    if (!rangePattern.test(cleanRange)) {
      errors.push(`Table tag: Invalid range "${cleanRange}". Expected format: 'Sheet'!A1:D10`);
    }
  }
  
  return errors;
}

/**
 * Validates recipient entries
 * @param {string} recipients - Comma-separated recipient list
 * @return {string[]} Array of error messages
 */
function validateRecipients_(recipients) {
  const errors = [];
  const items = recipients.split(",").map(s => s.trim()).filter(s => s);
  
  if (items.length === 0) {
    errors.push("No recipients specified");
    return errors;
  }
  
  items.forEach(item => {
    // Check if it's an email
    if (item.includes("@")) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const cleanEmail = item.replace(/[\('"\)\s]/g, "");
      if (!emailPattern.test(cleanEmail)) {
        errors.push(`Invalid email format: "${item}"`);
      }
    }
    // Tags (no @) are always valid - resolved at runtime
  });
  
  return errors;
}

/**
 * Checks for deprecated or problematic tags
 * @param {string} content - Template content
 * @return {string[]} Array of warning messages
 */
function checkDeprecatedTags_(content) {
  const warnings = [];
  
  // Check for old-style tags that might be typos
  if (content.includes("{DATE:") && !content.includes("{{DATE:")) {
    warnings.push("Found single-brace {DATE:...} - did you mean {{DATE:...}}?");
  }
  
  if (content.includes("$LINK") && !content.match(/\$LINK:[^,]+,\s*TEXT:/)) {
    warnings.push("$LINK tag found but may be malformed. Expected format: $LINK:Key, TEXT:Label$");
  }
  
  return warnings;
}

/**
 * Checks for common mistakes
 * @param {string} content - Template content
 * @return {string[]} Array of warning messages
 */
function checkCommonMistakes_(content) {
  const warnings = [];
  
  // Check for empty paragraphs in body (excessive whitespace)
  if (content.match(/\n\s*\n\s*\n/)) {
    warnings.push("Multiple consecutive empty lines detected");
  }
  
  // Check for potential missing signature
  if (!content.toLowerCase().includes("signature") && 
      !content.toLowerCase().includes("{{sender_name}}")) {
    warnings.push("No signature placeholder detected - signature will still be added automatically");
  }
  
  // Check for very long subject lines
  const subjectMatch = content.match(/\[SUBJECT\]\s*([^{]+)/);
  if (subjectMatch && subjectMatch[1].length > 100) {
    warnings.push("Subject line is very long (>100 chars) - may be truncated in email clients");
  }
  
  return warnings;
}

/**
 * Helper to get all tab names recursively
 * @param {Tab[]} tabsList - Array of tabs
 * @return {string[]} Array of tab names
 */
function getAllTabNames_(tabsList) {
  const names = [];
  for (const tab of tabsList) {
    names.push(tab.getTitle());
    const childTabs = tab.getChildTabs();
    if (childTabs.length > 0) {
      names.push(...getAllTabNames_(childTabs));
    }
  }
  return names;
}

/**
 * Batch validates multiple templates
 * @param {string[]} templateNames - Array of template names to validate
 * @param {string} [documentId] - Optional document ID
 * @return {Object} Summary of validation results
 */
function validateTemplatesBatch(templateNames, documentId) {
  Log.info("TemplateValidator", `Batch validating ${templateNames.length} templates...`);
  
  const results = {
    valid: [],
    invalid: [],
    total: templateNames.length
  };
  
  templateNames.forEach(name => {
    const result = validateTemplate(name, documentId);
    if (result.valid) {
      results.valid.push({ name, warnings: result.warnings });
    } else {
      results.invalid.push({ name, errors: result.errors, warnings: result.warnings });
    }
  });
  
  Log.info("TemplateValidator", `Validation complete: ${results.valid.length} valid, ${results.invalid.length} invalid`);
  
  return results;
}
