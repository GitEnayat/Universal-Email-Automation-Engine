/*
MODULE: LinkRepository
---------------------------------------------------
Content Management System (CMS) Logic
Loads managed links from spreadsheet and injects
$LINK tags into template HTML.
FINAL VERSION: Dynamic Column Headers + Config Integration
---------------------------------------------------
*/

/**
 * 1. FETCH LINK DATABASE
 * Connects to the CMS Spreadsheet using the Config Class.
 * Dynamically finds columns by name.
 * @param {AppConfig} config - The configuration instance
 */
function loadLinkRepository(config) {
  const targetId = config.linkRepositorySheetId;
  const targetTab = config.linkRepositoryTabName;
  const colKeyName = config.linkKeyColumn;   // "Key"
  const colLinkName = config.linkUrlColumn;  // "URL"

  Logger.log(`🔌 CMS: Connecting to Sheet ID: [${targetId}] ...`);
  try {
    const ss = SpreadsheetApp.openById(targetId);
    if (!ss) throw new Error("Spreadsheet not found or permission denied.");

    const sheet = ss.getSheetByName(targetTab);
    if (!sheet) {
      Logger.log(`⚠️ CMS Warning: Tab '${targetTab}' not found.`);
      return {};
    }

    // 1. Fetch All Data
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      Logger.log("⚠️ CMS Warning: Sheet appears to be empty (only headers?).");
      return {};
    }

    // 2. Identify Column Indices from Header Row (Row 0)
    const headers = data.shift(); // Removes the first row to use as headers
    const keyIndex = headers.indexOf(colKeyName);
    const linkIndex = headers.indexOf(colLinkName);

    // Validate Headers
    if (keyIndex === -1) {
      Logger.log(`❌ CMS Error: Column '${colKeyName}' not found in headers: [${headers.join(", ")}]`);
      return {};
    }
    if (linkIndex === -1) {
      Logger.log(`❌ CMS Error: Column '${colLinkName}' not found in headers.`);
      return {};
    }

    const linkMap = {};
    let count = 0;

    // 3. Build the Map using the found indices
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      // Handle potential nulls/undefined safely
      const rawKey = row[keyIndex];
      const rawUrl = row[linkIndex];
      if (!rawKey) continue; // Skip empty keys

      const key = String(rawKey).trim();
      const url = String(rawUrl).trim();
      if (key && url) {
        linkMap[key] = url;
        count++;
      }
    }

    Logger.log(`✅ CMS: Successfully loaded ${count} links.`);
    return linkMap;

  } catch (e) {
    Logger.log(`❌ CMS CRITICAL ERROR: ${e.message}`);
    return {};
  }
}

/**
 * 2. PARSE LINK TAGS
 * Scans the body text for special $LINK...$ tags.
 * @param {string} bodyText - The HTML body text to process
 * @param {Object} linkMap - The map of link keys to URLs
 * @return {string} The processed HTML with links injected
 */
function injectManagedLinks(bodyText, linkMap) {
  if (!bodyText) return "";

  // HEALER: Strip HTML tags from within $LINK tags (fixes formatted content)
  // Example: $<b>LINK:Key</b>, TEXT:Label$ -> $LINK:Key, TEXT:Label$
  // Note: We need to handle HTML tags that might appear anywhere in the tag
  const healedText = bodyText.replace(/\$LINK:([\s\S]*?),\s*TEXT:([\s\S]*?)\$/g, (match, keyPart, textPart) => {
    const cleanKey = keyPart
      .replace(/<[^>]+>/g, "")      // Remove HTML tags
      .replace(/&nbsp;/g, " ")      // Remove Non-Breaking Spaces
      .replace(/\s+/g, " ")         // Collapse multiple spaces
      .trim();
    const cleanText = textPart
      .replace(/<[^>]+>/g, "")      // Remove HTML tags
      .replace(/&nbsp;/g, " ")      // Remove Non-Breaking Spaces
      .replace(/\s+/g, " ")         // Collapse multiple spaces
      .trim();
    return "$LINK:" + cleanKey + ", TEXT:" + cleanText + "$";
  });

  // Regex: Finds $LINK:Key, TEXT:Label$
  const regex = /\$LINK:(.*?),\s*TEXT:(.*?)\$/g;

  return healedText.replace(regex, function(match, rawKey, rawLabel) {
    const key = rawKey.trim();
    const label = rawLabel.trim();

    // 1. Try to find the key in the CMS Database
    let url = linkMap[key];

    // 2. If not in DB, check if the Key is already a URL (e.g. injected by Dictionary)
    if (!url && key.match(/^https?:\/\//i)) {
      url = key;
      Logger.log(`🔗 CMS Bypass: Using Direct URL for [${label}]`);
    }

    if (url) {
      // Return a clean, blue link
      return `<a href="${url}" style="color: #1155cc; text-decoration: underline;">${label}</a>`;
    } else {
      // Error State
      Logger.log(`⚠️ Missing Link Key: [${key}]`);
      return `<span style="background-color: #ffcccc; color: #cc0000; padding: 2px 5px; border-radius: 3px;">[MISSING LINK: ${key}]</span>`;
    }
  });
}

// ==========================================
// BACKWARD COMPATIBILITY ALIASES
// ==========================================
/**
 * Alias for loadLinkRepository - backward compatibility with old code
 * Connects to the CMS Spreadsheet using the Config Class
 * @param {AppConfig} config - The configuration instance
 * @return {Object} Map of link keys to URLs
 */
function getLinkDatabase(config) {
  return loadLinkRepository(config);
}

/**
 * Alias for injectManagedLinks - backward compatibility with old code
 * Scans the body text for special $LINK...$ tags
 * @param {string} bodyText - The HTML body text to process
 * @param {Object} linkMap - The map of link keys to URLs
 * @return {string} The processed HTML with links injected
 */
function parseLinkTags(bodyText, linkMap) {
  return injectManagedLinks(bodyText, linkMap);
}
