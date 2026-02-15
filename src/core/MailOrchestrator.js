/*
MODULE: MailOrchestrator
--------------------------------
The Engine that orchestrates fetching, parsing, and drafting.
FINAL VERSION: Integrated with AppConfig Class
*/

/**
 * Orchestrates the report generation.
 * @param {string} templateTabName - The tab in the Doc.
 * @param {Object} [userOverrides] - Optional dictionary (e.g., { templateDocumentId: "...", dryRun: true, testMode: true })
 * @return {Object} Execution result { success: boolean, draftId: string|null, simulation: object|null }
 */
function generateEmailDraft(templateTabName, userOverrides = {}) {
  const startTime = Date.now();
  
  // Extract mode flags before merging with config
  const dryRun = userOverrides.dryRun === true;
  const testMode = userOverrides.testMode === true;
  
  // Remove mode flags from overrides before creating config
  const cleanOverrides = { ...userOverrides };
  delete cleanOverrides.dryRun;
  delete cleanOverrides.testMode;
  
  // 1. INITIALIZE CONFIGURATION
  // This merges your Master Defaults with any User Overrides automatically.
  const config = new AppConfig(cleanOverrides);
  
  // Log mode status
  if (dryRun) {
    Log.info("MailOrchestrator", "🧪 DRY RUN MODE: No drafts will be created");
  }
  if (testMode) {
    Log.info("MailOrchestrator", "🧪 TEST MODE: All emails will be sent to current user only");
  }
  
  // Enhancement 6.1: Structured Logging
  Log.info("MailOrchestrator", `Starting Report Generation for: "${templateTabName}"`);
  Log.info("MailOrchestrator", `Doc Source: ${config.templateDocumentId}`);

  // 2. FETCH TEMPLATE
  // Pass the ID explicitly from the Config object
  const template = fetchTemplate(templateTabName, config.templateDocumentId);
  if (!template) {
    Log.error("MailOrchestrator", `Runner Stopped: Template '${templateTabName}' returned null.`);
    
    // Log failed execution
    const duration = Date.now() - startTime;
    logExecution("ERROR", templateTabName, {
      error: "Template not found",
      dryRun: dryRun,
      testMode: testMode,
      duration: duration
    });
    
    return { success: false, draftId: null, simulation: null };
  }

  // ============================================================
  // 🧠 STEP 2.5: CMS LINK PARSING
  // ============================================================
  // 1. Fetch the Link Map (Pass the full config object)
  const linkMap = loadLinkRepository(config);
  // 2. Resolve $LINK...$ tags in the body
  const processedBody = injectManagedLinks(template.body, linkMap);

  // ============================================================
  // 3. RESOLVE RECIPIENTS & SIGNATURE
  const toKeys = parseRecipientKeys(template.to);
  const ccKeys = parseRecipientKeys(template.cc);

  // Pass 'config' as the first argument to Distro Helper
  let recipientsTo = toKeys.length > 0 ? resolveRecipients(config, ...toKeys).join(",") : "";
  let recipientsCc = ccKeys.length > 0 ? resolveRecipients(config, ...ccKeys).join(",") : "";
  
  // TEST MODE: Override recipients to current user only
  const currentUserEmail = Session.getActiveUser().getEmail();
  if (testMode) {
    const originalTo = recipientsTo;
    const originalCc = recipientsCc;
    recipientsTo = currentUserEmail;
    recipientsCc = "";
    Log.warn("MailOrchestrator", `TEST MODE: Recipients overridden from "${originalTo}" to "${recipientsTo}"`);
  }

  // Pass 'config' to Signature Helper
  const sigObj = generateUserSignature(config);
  // Combine processed body + Signature
  const finalHtmlBody = processedBody + "<br><br>" + sigObj.html;
  
  // Generate plaintext version for accessibility (P1 §3.1 fix)
  const plainTextBody = htmlToPlainText_(finalHtmlBody);
  
  // DRY RUN: Log simulation and return early
  if (dryRun) {
    const simulation = {
      templateName: templateTabName,
      subject: template.subject,
      recipientsTo: recipientsTo,
      recipientsCc: recipientsCc,
      bodyPreview: finalHtmlBody.substring(0, 200) + "...",
      actions: []
    };
    
    // Check what would happen
    try {
      const existingDrafts = GmailApp.getDrafts();
      for (const draft of existingDrafts) {
        const draftMessage = draft.getMessage();
        const draftSubject = draftMessage.getSubject();
        if (draftSubject && draftSubject.indexOf(template.subject) !== -1) {
          simulation.actions.push(`Would UPDATE existing draft: "${draftSubject}"`);
          Log.info("MailOrchestrator", `DRY RUN: Would update existing draft for "${template.subject}"`);
          return { success: true, draftId: null, simulation };
        }
      }
      
      const threads = GmailApp.search(`subject:"${template.subject}"`, 0, 5);
      if (threads.length > 0) {
        simulation.actions.push(`Would CREATE reply draft on thread: "${threads[0].getFirstMessageSubject()}"`);
        Log.info("MailOrchestrator", "DRY RUN: Would create reply draft on existing thread");
      } else {
        simulation.actions.push(`Would CREATE new draft to: ${recipientsTo}`);
        Log.info("MailOrchestrator", "DRY RUN: Would create new draft");
      }
      
    } catch (e) {
      simulation.actions.push(`Error during simulation: ${e.message}`);
      Log.error("MailOrchestrator", `DRY RUN Error: ${e.message}`);
    }
    
    // Log dry run execution
    const duration = Date.now() - startTime;
    logExecution("DRY_RUN", templateTabName, {
      dryRun: true,
      testMode: testMode,
      duration: duration,
      recipientsTo: recipientsTo
    });
    
    return { success: true, draftId: null, simulation };
  }

  // ============================================================
  // 🛡️ STEP 4: SAFE DRAFT RECYCLING
  // ============================================================
  try {
    const existingDrafts = GmailApp.getDrafts();
    for (const draft of existingDrafts) {
      const draftMessage = draft.getMessage();
      const draftSubject = draftMessage.getSubject();
      // Check for subject match (with null-safety guard)
      if (draftSubject && draftSubject.indexOf(template.subject) !== -1) {
        Log.info("MailOrchestrator", `Found existing draft for "${template.subject}". Updating...`);
        draft.update(recipientsTo, template.subject, plainTextBody, {
          htmlBody: finalHtmlBody,
          cc: recipientsCc
        });
        Log.info("MailOrchestrator", "Draft Updated Successfully.");
        
        // Log successful execution
        const duration = Date.now() - startTime;
        logExecution("UPDATED", templateTabName, {
          draftId: draft.getId(),
          dryRun: dryRun,
          testMode: testMode,
          duration: duration,
          recipientsTo: recipientsTo
        });
        
        return { success: true, draftId: draft.getId(), simulation: null }; // 🛑 EXIT: Work is done.
      }
    }
  } catch (e) {
    Log.warn("MailOrchestrator", `Draft Recycle Warning: ${e.message}`);
  }

  // ============================================================
  // 5. THREAD SEARCH (If no draft was updated)
  // ============================================================
  const threads = GmailApp.search(`subject:"${template.subject}"`, 0, 5);
  let targetThread = null;
  for (const thread of threads) {
    const originalSubject = thread.getFirstMessageSubject();
    if (originalSubject.match(/^(Automatic reply|OOO|Out of Office|Absence Notice):/i)) continue;
    targetThread = thread;
    break;
  }

  // ============================================================
  // 6. CREATE NEW DRAFT
  // ============================================================
  let draftId = null;
  
  try {
    if (targetThread) {
      // P1 §3.3: Reply-all inherits thread's original recipients, template's TO is ignored
      if (recipientsTo) {
        Log.warn("MailOrchestrator", `Reply-all mode active. Template TO recipients (${recipientsTo}) will be ignored in favor of thread participants.`);
      }
      const draft = targetThread.createDraftReplyAll(plainTextBody, {
        htmlBody: finalHtmlBody,
        cc: recipientsCc
      });
      draftId = draft.getId();
      Log.info("MailOrchestrator", "New Draft Created (Reply Mode) on existing thread.");
    } else {
      const draft = GmailApp.createDraft(recipientsTo, template.subject, plainTextBody, {
        cc: recipientsCc,
        htmlBody: finalHtmlBody
      });
      draftId = draft.getId();
      Log.info("MailOrchestrator", "New Draft Created (New Thread).");
    }
    
    // Log successful execution
    const duration = Date.now() - startTime;
    logExecution("CREATED", templateTabName, {
      draftId: draftId,
      dryRun: dryRun,
      testMode: testMode,
      duration: duration,
      recipientsTo: recipientsTo
    });
    
    return { success: true, draftId: draftId, simulation: null };
    
  } catch (e) {
    // Log error execution
    const duration = Date.now() - startTime;
    logExecution("ERROR", templateTabName, {
      error: e.message,
      dryRun: dryRun,
      testMode: testMode,
      duration: duration,
      recipientsTo: recipientsTo
    });
    
    Log.error("MailOrchestrator", `Failed to create draft: ${e.message}`);
    throw e; // Re-throw to allow caller to handle
  }
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================
/**
 * Converts HTML to plain text for accessibility (P1 §3.1)
 * Strips tags and converts common HTML entities.
 * @param {string} html - HTML content
 * @return {string} Plain text version
 */
function htmlToPlainText_(html) {
  if (!html) return "";
  
  return html
    // Replace <br>, <p> with newlines
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    // Replace <li> with bullet points
    .replace(/<li>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    // Replace <tr> with newlines for tables
    .replace(/<\/tr>/gi, "\n")
    // Replace <td>, <th> with tabs
    .replace(/<td[^>]*>/gi, "\t")
    .replace(/<th[^>]*>/gi, "\t")
    // Remove all remaining HTML tags
    .replace(/<[^>]+>/g, "")
    // Decode common HTML entities
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    // Collapse multiple newlines
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ==========================================
// BACKWARD COMPATIBILITY ALIASES
// ==========================================
/**
 * Alias for generateEmailDraft - backward compatibility with old code
 * @param {string} templateTabName - The tab in the Doc
 * @param {Object} [userOverrides] - Optional configuration overrides
 */
function createReportDraft(templateTabName, userOverrides = {}) {
  return generateEmailDraft(templateTabName, userOverrides);
}

// ==========================================
// BATCH ORCHESTRATION (Enhancement 6.6)
// ==========================================
/**
 * Generates multiple email drafts in a batch with shared config.
 * Reuses link repository and caches across calls for efficiency.
 * @param {string[]} templateNames - Array of template tab names to process
 * @param {Object} [sharedOverrides] - Optional config overrides applied to all templates
 * @return {Object} Summary of results { successful: number, failed: number, errors: string[] }
 */
function generateBatchDrafts(templateNames, sharedOverrides = {}) {
  const config = new AppConfig(sharedOverrides);
  const MAX_EXECUTION_TIME = 300000; // 5 minutes (safety margin before 6-min limit)
  const RATE_LIMIT_DELAY = 500; // 500ms delay between drafts
  const startTime = Date.now();
  
  // Pre-load shared resources
  Log.info("MailOrchestrator", `Batch Processing: ${templateNames.length} templates`);
  const linkMap = loadLinkRepository(config);
  Log.info("MailOrchestrator", `Pre-loaded link repository with ${Object.keys(linkMap).length} entries`);
  
  let successful = 0;
  let failed = 0;
  let skipped = 0;
  const errors = [];
  
  for (let i = 0; i < templateNames.length; i++) {
    const templateName = templateNames[i];
    
    // Check execution time limit
    const elapsedTime = Date.now() - startTime;
    if (elapsedTime > MAX_EXECUTION_TIME) {
      Log.warn("MailOrchestrator", `Approaching execution time limit. Skipping remaining ${templateNames.length - i} templates.`);
      skipped = templateNames.length - i;
      break;
    }
    
    const batchStartTime = Date.now();
    
    try {
      Log.info("MailOrchestrator", `--- Processing ${i + 1}/${templateNames.length}: ${templateName} ---`);
      
      // Fetch template
      const template = fetchTemplate(templateName, config.templateDocumentId);
      if (!template) {
        throw new Error(`Template '${templateName}' not found`);
      }
      
      // Process with pre-loaded link map
      const processedBody = injectManagedLinks(template.body, linkMap);
      
      // Resolve recipients
      const toKeys = parseRecipientKeys(template.to);
      const ccKeys = parseRecipientKeys(template.cc);
      const recipientsTo = toKeys.length > 0 ? resolveRecipients(config, ...toKeys).join(",") : "";
      const recipientsCc = ccKeys.length > 0 ? resolveRecipients(config, ...ccKeys).join(",") : "";
      
      // Generate signature
      const sigObj = generateUserSignature(config);
      const finalHtmlBody = processedBody + "<br><br>" + sigObj.html;
      const plainTextBody = htmlToPlainText_(finalHtmlBody);
      
      // Check for existing draft (simplified - no recycling in batch)
      const threads = GmailApp.search(`subject:"${template.subject}"`, 0, 1);
      let draftId = null;
      
      if (threads.length > 0) {
        const draft = threads[0].createDraftReplyAll(plainTextBody, {
          htmlBody: finalHtmlBody,
          cc: recipientsCc
        });
        draftId = draft.getId();
        Log.info("MailOrchestrator", `Created reply draft for "${templateName}"`);
      } else {
        const draft = GmailApp.createDraft(recipientsTo, template.subject, plainTextBody, {
          cc: recipientsCc,
          htmlBody: finalHtmlBody
        });
        draftId = draft.getId();
        Log.info("MailOrchestrator", `Created new draft for "${templateName}"`);
      }
      
      // Log successful batch item
      const batchDuration = Date.now() - batchStartTime;
      logExecution("BATCH_CREATED", templateName, {
        draftId: draftId,
        dryRun: false,
        testMode: false,
        duration: batchDuration,
        recipientsTo: recipientsTo
      });
      
      successful++;
      
      // Rate limiting: Small delay between iterations (except last)
      if (i < templateNames.length - 1) {
        Utilities.sleep(RATE_LIMIT_DELAY);
      }
      
    } catch (e) {
      // Log failed batch item
      const batchDuration = Date.now() - batchStartTime;
      logExecution("BATCH_ERROR", templateName, {
        error: e.message,
        dryRun: false,
        testMode: false,
        duration: batchDuration
      });
      
      Log.error("MailOrchestrator", `Failed to process "${templateName}": ${e.message}`);
      errors.push(`${templateName}: ${e.message}`);
      failed++;
    }
  }
  
  // Log batch completion summary
  const totalDuration = Date.now() - startTime;
  logExecution("BATCH_COMPLETE", "BATCH_SUMMARY", {
    dryRun: false,
    testMode: false,
    duration: totalDuration,
    error: `Batch: ${successful} success, ${failed} failed, ${skipped} skipped`
  });
  
  Log.info("MailOrchestrator", `Batch Complete: ${successful} successful, ${failed} failed, ${skipped} skipped (time limit)`);
  return { successful, failed, skipped, errors };
}

// ==========================================
// UI MENU REGISTRATION (Enhancement 6.8)
// ==========================================
/**
 * Creates custom menu in Google Sheets UI.
 * Add this function to your spreadsheet-bound script.
 */
function onOpen() {
  try {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('📧 Email Engine')
      .addItem('🚀 Generate Draft', 'showTemplatePicker')
      .addSeparator()
      .addItem('⚙️ Configuration', 'showConfigDialog')
      .addToUi();
    Log.info("MailOrchestrator", "UI Menu registered successfully");
  } catch (e) {
    // Silently fail if not in container-bound context
    Log.warn("MailOrchestrator", `onOpen failed (not in Sheets context): ${e.message}`);
  }
}

/**
 * Checks if running in a valid UI context (container-bound script)
 * @return {boolean}
 */
function isUiContextAvailable_() {
  try {
    SpreadsheetApp.getUi();
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Shows a simple dialog to pick a template.
 * Users can customize this to show available templates.
 */
function showTemplatePicker() {
  // Check UI context availability
  if (!isUiContextAvailable_()) {
    Log.error("MailOrchestrator", "UI functions require a container-bound script (attached to Sheets/Doc)");
    Logger.log("❌ UI Error: This function must be run from a Google Sheets/Docs container-bound script");
    return;
  }
  
  try {
    const ui = SpreadsheetApp.getUi();
    const response = ui.prompt(
      'Generate Email Draft',
      'Enter template name (tab name from Google Doc):',
      ui.ButtonSet.OK_CANCEL
    );
    
    if (response.getSelectedButton() === ui.Button.OK) {
      const templateName = response.getResponseText().trim();
      if (templateName) {
        try {
          generateEmailDraft(templateName);
          ui.alert('✅ Success', `Draft created for template: ${templateName}`, ui.ButtonSet.OK);
        } catch (e) {
          ui.alert('❌ Error', `Failed to create draft: ${e.message}`, ui.ButtonSet.OK);
        }
      }
    }
  } catch (e) {
    Log.error("MailOrchestrator", `showTemplatePicker error: ${e.message}`);
    Logger.log("❌ Error: " + e.message);
  }
}

/**
 * Shows configuration dialog.
 * Displays current config values for verification.
 */
function showConfigDialog() {
  // Check UI context availability
  if (!isUiContextAvailable_()) {
    Log.error("MailOrchestrator", "UI functions require a container-bound script (attached to Sheets/Doc)");
    Logger.log("❌ UI Error: This function must be run from a Google Sheets/Docs container-bound script");
    return;
  }
  
  try {
    const ui = SpreadsheetApp.getUi();
    const config = new AppConfig();
    
    const message = `Current Configuration:\n\n` +
      `Template Doc: ${config.templateDocumentId.substring(0, 20)}...\n` +
      `Directory Sheet: ${config.directorySheetId.substring(0, 20)}...\n` +
      `Link Repository: ${config.linkRepositorySheetId.substring(0, 20)}...\n\n` +
      `To customize, call generateEmailDraft() with overrides.`;
    
    ui.alert('⚙️ Email Engine Configuration', message, ui.ButtonSet.OK);
  } catch (e) {
    Log.error("MailOrchestrator", `showConfigDialog error: ${e.message}`);
    Logger.log("❌ Error: " + e.message);
  }
}
