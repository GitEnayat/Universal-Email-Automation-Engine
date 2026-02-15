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
      templateDocumentId: "INSERT_TEMPLATE_DOC_ID",

      // Spreadsheet containing recipient directory
      directorySheetId: "INSERT_DIRECTORY_SHEET_ID",
      recipientsTabName: "Recipients_Master",
      senderProfilesTabName: "Sender_Profiles",

      // Recipient directory columns
      recipientEmailColumn: "Email",
      recipientTagColumns: ["Role", "Team", "Department"],

      // Link repository (centralised URLs)
      linkRepositorySheetId: "INSERT_LINK_SHEET_ID",
      linkRepositoryTabName: "Link_Registry",
      linkKeyColumn: "Link_Key",
      linkUrlColumn: "Target_URL",

      // Branding / assets
      logoFileId: "INSERT_LOGO_FILE_ID",
      signatureTemplateTab: "Signature_Template",

      // System Logging
      logsTabName: "System_Logs"

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
  get logsTabName() { return this.settings.logsTabName; }

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
