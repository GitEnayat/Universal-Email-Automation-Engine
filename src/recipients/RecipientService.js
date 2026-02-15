/*
MODULE: RecipientService
---------------------------------------------------
Recipient directory + signature generator.
Includes caching and Base64 logo embedding.
---------------------------------------------------
*/

// ==========================================
// 1. DISTRIBUTION LIST HELPER (With Caching)
// ==========================================
// Global variables to cache data within a single execution
let _DISTRO_CACHE_DATA = null;
let _DISTRO_CACHE_ID = null;

/**
 * Fetches emails based on tags or direct email strings.
 * Uses caching to prevent re-fetching the sheet multiple times in one run.
 * @param {AppConfig} config - The configuration instance.
 * @param {...string} args - Tags or Emails.
 */
function resolveRecipients(config, ...args) {
  if (args.length === 0) return [];

  const sheetId = config.directorySheetId;
  const tabName = config.recipientsTabName;
  const targetEmailCol = config.recipientEmailColumn;
  const targetTagCols = config.recipientTagColumns;

  // ----------------------------------------
  // A. CACHE CHECK
  // ----------------------------------------
  // If we haven't fetched data yet, OR if the Sheet ID has changed (due to override), fetch it.
  if (!_DISTRO_CACHE_DATA || _DISTRO_CACHE_ID !== sheetId) {
    Logger.log(`🔄 Distro: Fetching fresh data from [${tabName}]...`);
    try {
      const sheet = SpreadsheetApp.openById(sheetId).getSheetByName(tabName);
      if (!sheet) throw new Error(`Distro Tab '${tabName}' not found in ID: ${sheetId}`);

      const data = sheet.getDataRange().getValues();
      const headers = data.shift(); // Remove header row

      // Map Columns
      const emailColIndex = headers.indexOf(targetEmailCol);
      const tagIndices = targetTagCols
        .map(col => headers.indexOf(col))
        .filter(i => i !== -1);

      // Validation
      if (emailColIndex === -1) throw new Error(`Column '${targetEmailCol}' not found.`);
      if (tagIndices.length === 0) throw new Error(`None of the tag columns ${targetTagCols} were found.`);

      // Save to Cache Structure: { data: [...], emailIdx: 0, tagIdxs: [...] }
      _DISTRO_CACHE_DATA = {
        rows: data,
        emailIndex: emailColIndex,
        tagIndices: tagIndices
      };
      _DISTRO_CACHE_ID = sheetId; // Mark this ID as cached
      Logger.log('✅ Distro: Data cached successfully.');
    } catch (e) {
      Logger.log(`❌ Distro Error: ${e.message}`);
      return [];
    }
  }

  // ----------------------------------------
  // B. PROCESS REQUEST
  // ----------------------------------------
  const { rows, emailIndex, tagIndices } = _DISTRO_CACHE_DATA;

  // Separate inputs
  const directEmails = args.filter(a => a.includes("@"));
  const lookups = args.filter(a => !a.includes("@"));

  // Filter rows based on cached indices
  const foundEmails = rows.filter(row => {
    // Check if ANY of the tag columns match one of our lookup tags
    return tagIndices.some(i => lookups.includes(row[i]));
  }).map(row => row[emailIndex]);

  // Return unique list
  return [...new Set([...foundEmails, ...directEmails])];
}

// ==========================================
// 2. SIGNATURE HELPER
// ==========================================
/**
 * Generates the HTML signature for the current user.
 * @param {AppConfig} config - The configuration instance.
 */
function generateUserSignature(config) {
  const currentUserEmail = Session.getActiveUser().getEmail();

  // 1. Fetch User Data
  let userDetails = { name: "Automation Team", role: "Automation", email1: "", email2: "" };
  try {
    const sheet = SpreadsheetApp.openById(config.directorySheetId).getSheetByName(config.senderProfilesTabName);
    if (sheet) {
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const colMap = {};
      headers.forEach((h, i) => colMap[h.trim()] = i);

      for (let i = 1; i < data.length; i++) {
        if (data[i][colMap['UserEmail']] == currentUserEmail) {
          userDetails.name = data[i][colMap['Name']] || "Automation Team";
          userDetails.role = data[i][colMap['Role']] || "Automation";
          userDetails.email1 = data[i][colMap['PrimaryEmail']] || "";
          userDetails.email2 = data[i][colMap['SecondaryEmail']] || "";
          break;
        }
      }
    } else {
      Logger.log(`⚠️ Sig Warning: Tab '${config.senderProfilesTabName}' not found.`);
    }
  } catch (e) {
    Logger.log("❌ Sig Data Error: " + e.message);
  }

  // 2. Fetch Logo (Cached Base64)
  let imgTag = "";
  try {
    if (config.logoFileId) {
      const cache = CacheService.getScriptCache();
      let b64 = cache.get("SIG_LOGO_B64");
      let mime = cache.get("SIG_LOGO_MIME");

      if (!b64) {
        const blob = DriveApp.getFileById(config.logoFileId).getBlob();
        b64 = Utilities.base64Encode(blob.getBytes());
        mime = blob.getContentType();
        // P2 §3.8: CacheService has 100KB limit - check size before caching
        const b64Size = b64.length;
        if (b64Size > 75000) { // ~75KB limit to be safe (base64 inflates ~33%)
          Logger.log(`⚠️ Logo size (${Math.round(b64Size/1024)}KB) exceeds cache limit, skipping cache. Consider using a smaller logo.`);
        } else {
          cache.put("SIG_LOGO_B64", b64, 21600);
          cache.put("SIG_LOGO_MIME", mime, 21600);
          Logger.log(`✅ Logo cached successfully (${Math.round(b64Size/1024)}KB)`);
        }
      }
      imgTag = `<img src="data:${mime};base64,${b64}" width="200" style="display:block; height:auto;">`;
    }
  } catch (e) {
    Logger.log("⚠️ Sig Logo Error: " + e.message);
    imgTag = "";
  }

  // 3. REUSE TEMPLATE LOGIC
  // Pass the Doc ID explicitly from the config
  const sigTemplate = fetchTemplate(config.signatureTemplateTab, config.templateDocumentId);
  let html = sigTemplate ? sigTemplate.body : "{{Sender_Name}}<br>{{Sender_Role}}<br>{{Signature_Logo}}";

  // 4. Final Swap
  return {
    html: html
      .replace(/\{\{Sender_Name\}\}/g,   userDetails.name)
      .replace(/\{\{Sender_Role\}\}/g,   userDetails.role)
      .replace(/\{\{First_Email\}\}/g,   userDetails.email1)
      .replace(/\{\{Second_Email\}\}/g,  userDetails.email2)
      .replace(/\{\{Signature_Logo\}\}/g, imgTag)
  };
}

// ==========================================
// BACKWARD COMPATIBILITY ALIASES
// ==========================================
/**
 * Alias for resolveRecipients - backward compatibility with old code
 * Fetches emails based on tags or direct email strings
 * @param {AppConfig} config - The configuration instance
 * @param {...string} args - Tags or Emails
 * @return {string[]} Array of resolved email addresses
 */
function getDistroEmails(config, ...args) {
  return resolveRecipients(config, ...args);
}

/**
 * Alias for generateUserSignature - backward compatibility with old code
 * Generates the HTML signature for the current user
 * @param {AppConfig} config - The configuration instance
 * @return {Object} Object containing the HTML signature
 */
function getUserGmailSignature(config) {
  return generateUserSignature(config);
}
