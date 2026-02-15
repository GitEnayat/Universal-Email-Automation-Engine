/*
MODULE: TemplateService
---------------------------------------------------
Fetches templates from Google Docs and converts them
into structured email data (subject, body, recipients).
Includes the template scripting engine.
---------------------------------------------------
*/


// ==========================================
// PUBLIC API
// ==========================================

/**
 * Fetch and parse an email template from Google Docs
 */
function fetchTemplate(templateTabName, templateDocId) {

  if (!templateDocId) {
    Logger.log("TemplateService: Missing template document ID");
    return null;
  }

  const doc = DocumentApp.openById(templateDocId);
  const tabs = doc.getTabs();

  const targetTab = findTabRecursive_(tabs, templateTabName);
  if (!targetTab) {
    Logger.log(`TemplateService: Tab '${templateTabName}' not found.`);
    return null;
  }

  const docTab = targetTab.asDocumentTab();
  const bodyElement = docTab.getBody();

  let result = { subject: "", body: "", to: "", cc: "" };
  let mode = "none";

  for (let i = 0; i < bodyElement.getNumChildren(); i++) {

    const child = bodyElement.getChild(i);
    const text = child.getText().trim();

    if (text === "[SUBJECT]") { mode = "subject"; continue; }
    if (text === "[BODY]")    { mode = "body"; continue; }
    if (text === "[TO]")      { mode = "to"; continue; }
    if (text === "[CC]")      { mode = "cc"; continue; }

    if (mode === "subject" && text !== "") result.subject = text;
    else if (mode === "to" && text !== "") result.to += text + ",";
    else if (mode === "cc" && text !== "") result.cc += text + ",";
    else if (mode === "body") result.body += convertElementToHtml_(child);
  }

  // Apply template scripting engine
  const processedSubject = applyTemplateDictionary_(result.subject);
  let processedBody = applyTemplateDictionary_(result.body);

  // Inject tables from Sheets
  processedBody = processTables(processedBody);

  return {
    subject: processedSubject,
    body: processedBody,
    to: result.to,
    cc: result.cc
  };
}


/**
 * Parse comma-separated recipient keys
 */
function parseRecipientKeys(rawString) {
  if (!rawString) return [];
  return rawString.split(",")
    .map(x => x.trim().replace(/^[\('"]+|[\)'"]+$/g, ""))
    .filter(Boolean);
}
