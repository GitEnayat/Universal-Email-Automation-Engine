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
      templateDocumentId: "PASTE_TEMPLATE_DOC_ID",

      // Spreadsheet containing recipient directory
      directorySheetId: "PASTE_DIRECTORY_SHEET_ID",
      recipientsTabName: "Recipients",
      senderProfilesTabName: "Senders",

      // Recipient directory columns
      recipientEmailColumn: "email",
      recipientTagColumns: ["role", "team"],

      // Link repository (centralised URLs)
      linkRepositorySheetId: "PASTE_LINK_SHEET_ID",
      linkRepositoryTabName: "links",
      linkKeyColumn: "Key",
      linkUrlColumn: "URL",

      // Branding / assets
      logoFileId: "PASTE_LOGO_FILE_ID",
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

}
