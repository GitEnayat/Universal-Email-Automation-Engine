/*
MODULE: TemplateValidator
---------------------------------------------------
Pre-flight verification tools for templates.
Ensures templates are valid before execution.
---------------------------------------------------
*/

/**
 * Validates a template for required structure and syntax.
 * @param {string} templateName - The name of the Doc tab to validate.
 * @param {string} [docId] - Optional Doc ID (uses AppConfig default if omitted).
 * @return {Object} Validation result { valid: boolean, errors: string[], warnings: string[] }
 */
function validateTemplate(templateName, docId) {
    const errors = [];
    const warnings = [];

    // 1. Check if Template Exists
    const config = new AppConfig();
    const targetDocId = docId || config.templateDocumentId;

    let template = null;
    try {
        // We use the existing fetchTemplate logic but we need to ensure it doesn't throw
        template = fetchTemplate(templateName, targetDocId);
        if (!template) {
            errors.push(`Template tab '${templateName}' not found in Doc ID: ${targetDocId}`);
            return { valid: false, errors, warnings };
        }
    } catch (e) {
        errors.push(`Error fetching template: ${e.message}`);
        return { valid: false, errors, warnings };
    }

    // 2. Check Required Sections
    if (!template.subject) warnings.push("Missing [SUBJECT] tag or subject is empty.");
    if (!template.body) errors.push("Missing [BODY] tag or body is empty.");
    if (!template.to && !template.cc) warnings.push("No [TO] or [CC] recipients defined.");

    // 3. Syntax Checks

    // Check for malformed tags (e.g., {{DATE:Today)
    const openBraces = (template.body.match(/\{\{/g) || []).length;
    const closeBraces = (template.body.match(/\}\}/g) || []).length;
    if (openBraces !== closeBraces) {
        warnings.push(`Mismatch in dictionary tags: ${openBraces} opening '{{' vs ${closeBraces} closing '}}'. Check for typo.`);
    }

    // Check for broken Table tags
    const tableTags = template.body.match(/\[Table\].*?(?=<\/p>|$)/gi) || [];
    tableTags.forEach(tag => {
        if (!tag.includes("Sheet:") || !tag.includes("range:")) {
            errors.push(`Clientside Error: Malformed [Table] tag found: "${tag.substring(0, 50)}..."`);
        }
    });

    // Check for potentially broken Link tags
    const linkTags = template.body.match(/\$LINK:.*?\$/g) || [];
    // (LinkRepository has its own healer, but let's check basic structure)
    linkTags.forEach(tag => {
        if (!tag.includes("TEXT:")) {
            warnings.push(`Link tag might be missing TEXT label: "${tag.substring(0, 50)}..."`);
        }
    });

    return {
        valid: errors.length === 0,
        errors: errors,
        warnings: warnings
    };
}
