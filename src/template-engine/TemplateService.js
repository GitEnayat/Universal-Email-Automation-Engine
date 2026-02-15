/*
MODULE: TemplateService
--------------------------------
Loads templates from Google Docs and parses:
- Subject / Body / To / CC
- Dictionary engine
- Date engine
- HTML conversion
- Table injection
--------------------------------
*/


// ==========================================
// MAIN PUBLIC FUNCTION
// ==========================================
function fetchTemplate(tabName, documentId) {

  if (!documentId) {
    Logger.log("❌ [Library] Critical Error: No Doc ID provided to getTemplate.");
    return null;
  }

  const doc = DocumentApp.openById(documentId);
  const tabs = doc.getTabs();

  const targetTab = findTabRecursive_(tabs, tabName);

  if (!targetTab) {
    const errorMsg = `Tab '${tabName}' not found in Doc: https://docs.google.com/document/d/${documentId}`;
    Logger.log(`❌ [Library] Error: ${errorMsg}`);
    try {
      SpreadsheetApp.getUi().alert(
        "❌ Tab Search Failed", errorMsg, SpreadsheetApp.getUi().ButtonSet.OK);
    } catch (e) {
      // UI not available in some contexts
    }
    return null;
  }

  const bodyElement = targetTab.asDocumentTab().getBody();
  const numChildren = bodyElement.getNumChildren();

  let result = { subject: "", body: "", to: "", cc: "" };
  let mode = "none";
  let currentListId = null;  // Track current list ID for proper nesting
  let currentListType = null; // 'ul' or 'ol'

  for (let i = 0; i < numChildren; i++) {

    const child = bodyElement.getChild(i);
    const text = child.getText().trim();

    if (text === "[SUBJECT]") { mode = "subject"; continue; }
    if (text === "[BODY]") { mode = "body"; continue; }
    if (text === "[TO]") { mode = "to"; continue; }
    if (text === "[CC]") { mode = "cc"; continue; }

    if (mode === "subject" && text !== "") { result.subject = text; mode = "none"; }
    else if (mode === "to" && text !== "") result.to += text + ",";
    else if (mode === "cc" && text !== "") result.cc += text + ",";
    else if (mode === "body") {
      const isListItem = child.getType() === DocumentApp.ElementType.LIST_ITEM;
      
      // Enhanced list handling with proper list ID tracking
      if (isListItem) {
        const listItem = child.asListItem();
        const listId = listItem.getListId();
        const glyphType = listItem.getGlyphType();
        const isOrdered = glyphType === DocumentApp.GlyphType.NUMBER || 
                         glyphType === DocumentApp.GlyphType.ROMAN_NUMERAL ||
                         glyphType === DocumentApp.GlyphType.ROMAN_UPPER;
        const newListType = isOrdered ? 'ol' : 'ul';
        
        if (listId !== currentListId) {
          // Different list - close previous if exists, start new one
          if (currentListId !== null) {
            result.body += `</${currentListType}>`;
          }
          result.body += `<${newListType}>`;
          currentListId = listId;
          currentListType = newListType;
        }
      } else if (currentListId !== null) {
        // End of list
        result.body += `</${currentListType}>`;
        currentListId = null;
        currentListType = null;
      }
      
      result.body += convertElementToHtml_(child);
    }

  }
  
  // Close any open list at end of body
  if (currentListId !== null) {
    result.body += `</${currentListType}>`;
  }
  
  // P2 §3.5: Remove trailing commas from to/cc strings
  if (result.to.endsWith(",")) {
    result.to = result.to.slice(0, -1);
  }
  if (result.cc.endsWith(",")) {
    result.cc = result.cc.slice(0, -1);
  }

  const processedSubject = applyDictionary_(result.subject);
  let processedBody = applyDictionary_(result.body);

  processedBody = processTables(processedBody);

  return {
    subject: processedSubject,
    body: processedBody,
    to: result.to,
    cc: result.cc
  };

}

function parseRecipientKeys(rawString) {
  if (!rawString) return [];
  return rawString.split(",").map(item => {
    return item.trim().replace(/^[\('"]+|[\)'"]+$/g, "");
  }).filter(item => item !== "");
}


function applyDictionary_(text) {

  if (!text) return "";

  const healedText = text.replace(/\{\{(.*?)\}\}/g, (match, inner) => {
    const cleanInner = inner
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return "{{" + cleanInner + "}}";
  });

  return healedText.replace(/\{\{(.*?)\}\}/g, function (match, content) {

    try {

      const parts = content.split(":").map(p => p.trim());
      const command = parts[0].toUpperCase();
      const param1 = parts[1] && parts[1] !== "" ? parts[1] : "Today";
      const param2 = parts[2] && parts[2] !== "" ? parts[2] : "Today";

      switch (command) {

        case "DATE": return formatDate_(parseDateToken_(param1));
        case "RANGE": return formatDate_(parseDateToken_(param1)) + " - " + formatDate_(parseDateToken_(param2));

        case "TIME":
          if (param1.toUpperCase() === "BKK") return getRoundedTime_("Asia/Bangkok", "ICT");
          return getRoundedTime_("Asia/Kuala_Lumpur", "MYT");

        case "MONTHNAME":
          let dName = new Date();
          if (!isNaN(Number(param1))) {
            dName.setDate(1);
            dName.setMonth(dName.getMonth() + parseInt(param1, 10));
          } else {
            dName = parseDateToken_(param1);
          }
          return Utilities.formatDate(dName, Session.getScriptTimeZone(), "MMMM yyyy");

        case "RAMCO":
          return getRamcoCycle_(param1.toUpperCase() === "PREVIOUS" ? -1 : 0);

        case "DATE_FORMAT":
          const dateObj = parseDateToken_(param1);
          const formatStr = parts[2] || "dd-MMM-yyyy";
          return Utilities.formatDate(dateObj, Session.getScriptTimeZone(), formatStr.trim());

        case "GREETING":
          return getGreeting_();

        case "ACTIVE_SPREADSHEET_LINK":
        case "THIS_SHEET":
          try {
            return SpreadsheetApp.getActiveSpreadsheet().getUrl();
          } catch (e) {
            Logger.log("⚠️ Dictionary Warning: Could not get Active Sheet URL (Standalone mode?)");
            return "#";
          }

        default: return match;

      }

    } catch (e) {
      Logger.log(`❌ Dictionary Error processing [${content}]: ${e.message}`);
      return "ERROR";
    }

  });

}

// ==========================================
// PRIVATE HELPERS
// ==========================================

function findTabRecursive_(tabsList, targetName) {
  for (const tab of tabsList) {
    if (tab.getTitle() === targetName) return tab;
    const childTabs = tab.getChildTabs();
    if (childTabs.length > 0) {
      const found = findTabRecursive_(childTabs, targetName);
      if (found) return found;
    }
  }
  return null;
}

function convertElementToHtml_(element) {
  if (element.getType() === DocumentApp.ElementType.PARAGRAPH) {
    let text = element.getText();
    if (text === "") return "<br>";
    return "<p style='margin: 0; padding: 0;'>" + getFormattedText_(element) + "</p>";
  }
  else if (element.getType() === DocumentApp.ElementType.LIST_ITEM) {
    return "<li>" + getFormattedText_(element) + "</li>";
  }
  else if (element.getType() === DocumentApp.ElementType.HORIZONTAL_RULE) {
    return "<hr style='border: 0; border-top: 1px solid #cccccc; margin: 15px 0;'>";
  }
  else if (element.getType() === DocumentApp.ElementType.TABLE) {
    return processTableHTML_(element);
  }
  return "";
}

function getFormattedText_(element) {
  const textObj = element.editAsText();
  const str = textObj.getText();
  let html = "";
  let lastConfig = { url: null, fg: null, bg: null, bold: false };

  const getOpenTags = (c) => {
    let tags = "";
    if (c.url) tags += "<a href='" + c.url + "'>";
    let style = "";
    if (c.fg && c.fg !== "#000000") style += "color:" + c.fg + ";";
    if (c.bg && c.bg !== "#ffffff") style += "background-color:" + c.bg + ";";
    if (style) tags += "<span style='" + style + "'>";
    if (c.bold) tags += "<b>";
    return tags;
  };

  const getCloseTags = (c) => {
    let tags = "";
    if (c.bold) tags += "</b>";
    if ((c.fg && c.fg !== "#000000") || (c.bg && c.bg !== "#ffffff")) tags += "</span>";
    if (c.url) tags += "</a>";
    return tags;
  };

  for (let i = 0; i < str.length; i++) {
    const currentConfig = {
      url: textObj.getLinkUrl(i),
      fg:  textObj.getForegroundColor(i),
      bg:  textObj.getBackgroundColor(i),
      bold: textObj.isBold(i)
    };

    if (i === 0) {
      html += getOpenTags(currentConfig);
    } else {
      if (JSON.stringify(currentConfig) !== JSON.stringify(lastConfig)) {
        html += getCloseTags(lastConfig) + getOpenTags(currentConfig);
      }
    }

    html += str.charAt(i);
    lastConfig = currentConfig;
  }

  if (str.length > 0) {
    html += getCloseTags(lastConfig);
  }

  return html;
}

function processTableHTML_(tableElement) {
  let html = "<table style='border-collapse: collapse; border: 1px solid #cccccc; margin: 10px 0;'>";
  for (let r = 0; r < tableElement.getNumRows(); r++) {
    const row = tableElement.getRow(r);
    html += "<tr>";
    for (let c = 0; c < row.getNumCells(); c++) {
      const cell = row.getCell(c);
      const colWidth = tableElement.getColumnWidth(c);
      const bgColor = cell.getBackgroundColor() || "#ffffff";
      const vertAlign = cell.getVerticalAlignment();
      let vAlignStyle = "top";
      if (vertAlign === DocumentApp.VerticalAlignment.CENTER) vAlignStyle = "middle";
      if (vertAlign === DocumentApp.VerticalAlignment.BOTTOM) vAlignStyle = "bottom";
      html += `<td style="border: 1px solid #cccccc; padding: 8px; background-color: ${bgColor}; vertical-align: ${vAlignStyle}; width: ${colWidth}pt;">`;
      for (let i = 0; i < cell.getNumChildren(); i++) {
        html += convertElementToHtml_(cell.getChild(i));
      }
      html += "</td>";
    }
    html += "</tr>";
  }
  html += "</table>";
  return html;
}

function parseDateToken_(token) {
  let now = new Date();
  const text = token.toLowerCase().replace(/\s+/g, "");
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  let dayIndex = -1;
  let mode = "dynamic";

  for (let i = 0; i < days.length; i++) {
    if (text.includes(days[i])) { dayIndex = i; break; }
  }

  if (dayIndex === -1) {
    if (text.includes("weekstart")) { dayIndex = 0; mode = "dynamic"; }
    else if (text.includes("yesterday")) { now.setDate(now.getDate() - 1); mode = "today"; }
    else if (text.includes("tomorrow"))  { now.setDate(now.getDate() + 1); mode = "today"; }
    else if (text.includes("monthstart")) mode = "monthstart";
    else if (text.includes("month")) mode = "month";
    else if (text.includes("year")) mode = "year";
    else mode = "today";
  }

  let shift = 0;
  const nextCount = (text.match(/next/g) || []).length;
  const lastCount = (text.match(/last|previous/g) || []).length;
  shift += nextCount;
  shift -= lastCount;

  const mathMatch = text.match(/[-+]\d+/);
  if (mathMatch) shift += parseInt(mathMatch[0], 10);

  if (mode === "year") {
    now.setFullYear(now.getFullYear() + shift);
  } else if (mode === "month") {
    now.setMonth(now.getMonth() + shift);
  } else if (mode === "monthstart") {
    now.setDate(1);
    now.setMonth(now.getMonth() + shift);
  } else if (mode === "today") {
    const multiplier = text.includes("week") ? 7 : 1;
    now.setDate(now.getDate() + (shift * multiplier));
  } else {
    const currentDay = now.getDay();
    now.setDate(now.getDate() + (0 - currentDay));
    now.setDate(now.getDate() + dayIndex);
    now.setDate(now.getDate() + (shift * 7));
  }

  return now;
}

function formatDate_(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "dd-MMM-yyyy");
}

function getRamcoCycle_(monthOffset) {
  const d = new Date();
  let m = d.getDate() >= 16 ? d.getMonth() : d.getMonth() - 1;
  m += monthOffset;
  const s = new Date(d.getFullYear(), m, 16);
  const e = new Date(s.getFullYear(), s.getMonth() + 1, 15);
  return formatDate_(s) + " - " + formatDate_(e);
}

function getRoundedTime_(timeZone, suffix) {
  let date = new Date();
  let ms = 1000 * 60 * 15;
  let roundedDate = new Date(Math.round(date.getTime() / ms) * ms);
  return Utilities.formatDate(roundedDate, timeZone, "h:mm a") + " " + suffix;
}

function getGreeting_() {
  const hour = parseInt(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "HH"));
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

// ==========================================
// BACKWARD COMPATIBILITY ALIASES
// ==========================================
/**
 * Alias for fetchTemplate - backward compatibility with old code
 * @param {string} tabName - The exact name of the tab in the Google Doc
 * @param {string} documentId - The ID of the Google Doc
 * @return {Object|null} Processed template object
 */
function getTemplate(tabName, documentId) {
  return fetchTemplate(tabName, documentId);
}

/**
 * Alias for parseRecipientKeys - backward compatibility with old code
 * @param {string} rawString - Comma-separated list of keys
 * @return {string[]} Cleaned array of keys
 */
function parseDistroKeys(rawString) {
  return parseRecipientKeys(rawString);
}
