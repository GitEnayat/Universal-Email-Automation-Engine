/*
MODULE: AppConfig
---------------------------------------------------
Central configuration layer.
Handles default settings + environment overrides.
---------------------------------------------------
*/

class AppConfig {

  constructor(overrides = {}) {

    const DEFAULTS = {

      // Google Doc containing email templates
      templateDocumentId: "1dKAx4H8ILn94JZiu3F3SOI7_aO9UXkRLmtFuF-iYOrY",

      // Spreadsheet containing recipient directory
      directorySheetId: "1gvsnS8F5EWnnWFcTPURnZbLkU7yHrE_IOGZOQ1qxP6g",
      recipientsTabName: "Combined_Long",
      senderProfilesTabName: "WFM_Emails",

      // Recipient directory columns
      recipientEmailColumn: "email",
      recipientTagColumns: ["Site_wise_role", "workflow_wise_role"],

      // Link repository (centralised URLs)
      linkRepositorySheetId: "1JSIsA4SVIxt0POLYn97t5sg_OhbSTVKEXB0fQc10zJk",
      linkRepositoryTabName: "current_files",
      linkKeyColumn: "Mapping",
      linkUrlColumn: "File_Link",

      // Branding / assets
      logoFileId: "1dmuO2-836NaE9HryutgDiMyuqb5X0nSv",
      signatureTemplateTab: "Signature_Template"

    };

    this.settings = { ...DEFAULTS, ...overrides };
  }

  // Template source
  get templateDocumentId() { return this.settings.templateDocumentId; }

  // Recipient directory
  get directorySheetId() { return this.settings.directorySheetId; }
  get recipientsTabName() { return this.settings.recipientsTabName; }
  get senderProfilesTabName() { return this.settings.senderProfilesTabName; }
  get recipientEmailColumn() { return this.settings.recipientEmailColumn; }
  get recipientTagColumns() { return this.settings.recipientTagColumns; }

  // Link repository
  get linkRepositorySheetId() { return this.settings.linkRepositorySheetId; }
  get linkRepositoryTabName() { return this.settings.linkRepositoryTabName; }
  get linkKeyColumn() { return this.settings.linkKeyColumn; }
  get linkUrlColumn() { return this.settings.linkUrlColumn; }

  // Branding / assets
  get logoFileId() { return this.settings.logoFileId; }
  get signatureTemplateTab() { return this.settings.signatureTemplateTab; }

  // ==========================================
  // BACKWARD COMPATIBILITY ALIASES (Lib_Config naming)
  // ==========================================
  // Template source
  get templateDocId() { return this.settings.templateDocumentId; }

  // Recipient directory (old naming)
  get distroSheetId() { return this.settings.directorySheetId; }
  get distroRecipientsTab() { return this.settings.recipientsTabName; }
  get distroSenderTab() { return this.settings.senderProfilesTabName; }
  get distroEmailCol() { return this.settings.recipientEmailColumn; }
  get distroTagCols() { return this.settings.recipientTagColumns; }

  // Link repository (old CMS naming)
  get cmsSheetId() { return this.settings.linkRepositorySheetId; }
  get cmsTabName() { return this.settings.linkRepositoryTabName; }
  get cmsKeyCol() { return this.settings.linkKeyColumn; }
  get cmsLinkCol() { return this.settings.linkUrlColumn; }

  // Signature (old naming)
  get sigTabName() { return this.settings.signatureTemplateTab; }

}

// ==========================================
// BACKWARD COMPATIBILITY CLASS ALIAS
// ==========================================
/**
 * Alias for AppConfig class - backward compatibility with old Lib_Config naming
 */
class Lib_Config extends AppConfig {
  constructor(overrides = {}) {
    super(overrides);
  }
}

// ==========================================
// CONFIG VALIDATION
// ==========================================
/**
 * Validates that all required configuration values are present and valid.
 * Call this at the start of generateEmailDraft() to fail fast with clear errors.
 * @param {AppConfig} config - The configuration instance to validate
 * @return {Object} { valid: boolean, errors: string[] }
 */
function validateConfig(config) {
  const errors = [];
  
  // Validate required Sheet IDs
  if (!config.templateDocumentId || config.templateDocumentId === "PASTE_TEMPLATE_DOC_ID") {
    errors.push("templateDocumentId is not set");
  }
  if (!config.directorySheetId || config.directorySheetId === "PASTE_DIRECTORY_SHEET_ID") {
    errors.push("directorySheetId is not set");
  }
  if (!config.linkRepositorySheetId || config.linkRepositorySheetId === "PASTE_LINK_SHEET_ID") {
    errors.push("linkRepositorySheetId is not set");
  }
  
  // Validate tab names are not empty
  if (!config.recipientsTabName) errors.push("recipientsTabName is empty");
  if (!config.senderProfilesTabName) errors.push("senderProfilesTabName is empty");
  if (!config.linkRepositoryTabName) errors.push("linkRepositoryTabName is empty");
  if (!config.signatureTemplateTab) errors.push("signatureTemplateTab is empty");
  
  // Validate column names are not empty
  if (!config.recipientEmailColumn) errors.push("recipientEmailColumn is empty");
  if (!config.linkKeyColumn) errors.push("linkKeyColumn is empty");
  if (!config.linkUrlColumn) errors.push("linkUrlColumn is empty");
  
  // Validate tag columns is an array with at least one element
  if (!config.recipientTagColumns || !Array.isArray(config.recipientTagColumns) || config.recipientTagColumns.length === 0) {
    errors.push("recipientTagColumns must be a non-empty array");
  }
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}
