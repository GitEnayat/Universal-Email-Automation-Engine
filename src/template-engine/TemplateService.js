/**
 * @fileoverview Template parsing and processing.
 * Responsible for fetching Google Docs, replacing tokens ({{KEY}}), and converting to Gmail-friendly HTML.
 */


// ==========================================
// MAIN PUBLIC FUNCTION
// ==========================================
function fetchTemplate(tabName, documentId) {

  if (!documentId) {
    Logger.log("No document ID provided.");
    return null;
  }

  const doc = DocumentApp.openById(documentId);
  const tabs = doc.getTabs();

  const targetTab = findTabRecursive_(tabs, tabName);

  if (!targetTab) {
    Logger.log("Template tab not found: " + tabName);
    return null;
  }

  const bodyElement = targetTab.asDocumentTab().getBody();
  const numChildren = bodyElement.getNumChildren();

  let result = { subject: "", body: "", to: "", cc: "" };
  let mode = "none";

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
    else if (mode === "body") result.body += convertElementToHtml_(child);

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
  return rawString.split(",").map(x => x.trim()).filter(x => x !== "");
}


function applyDictionary_(text) {
  if (!text) return "";

  // 1. HARDEN REGEX & PRE-CLEANING
  // First, strip HTML tags from INSIDE the brackets: {{ <b>DATE</b> }} -> {{DATE}}
  const healedText = text.replace(/\{\{(.*?)\}\}/g, (match, inner) => {
    const cleanInner = inner
      .replace(/<[^>]+>/g, "")      // Strip HTML
      .replace(/&nbsp;/g, " ")      // NBSP -> space
      .replace(/\s+/g, " ")         // Collapse spaces
      .trim();
    return "{{" + cleanInner + "}}";
  });

  // 2. PARSE CLEAN TAGS
  return healedText.replace(/\{\{(.*?)\}\}/g, function (match, content) {
    try {
      const parts = content.split(":").map(p => p.trim());
      const command = parts[0].toUpperCase();
      const param1 = parts[1] || "Today";
      const param2 = parts[2] || "Today";

      switch (command) {
        case "DATE": return formatDate_(parseDateToken_(param1));
        case "RANGE": return formatDate_(parseDateToken_(param1)) + " - " + formatDate_(parseDateToken_(param2));

        case "TIME":
          if (param1 === "BKK") return getRoundedTime_("Asia/Bangkok", "ICT");
          return getRoundedTime_("Asia/Kuala_Lumpur", "MYT");

        case "MONTHNAME":
          let d = new Date();
          if (!isNaN(Number(param1))) {
            d.setDate(1);
            d.setMonth(d.getMonth() + parseInt(param1, 10));
          } else {
            d = parseDateToken_(param1);
          }
          return Utilities.formatDate(d, Session.getScriptTimeZone(), "MMMM yyyy");

        case "DATE_FORMAT":
          const dateObj = parseDateToken_(param1);
          const formatStr = parts[2] || "dd-MMM-yyyy";
          return Utilities.formatDate(dateObj, Session.getScriptTimeZone(), formatStr.trim());

        case "ACTIVE_SPREADSHEET_LINK":
          return SpreadsheetApp.getActiveSpreadsheet().getUrl();

        case "GREETING":
          const h = new Date().getHours();
          if (h < 12) return "Good Morning";
          if (h < 17) return "Good Afternoon";
          return "Good Evening";

        default: return match; // Unknown tag, leave as is
      }
    } catch (e) {
      return "ERROR";
    }
  });
}

function parseDateToken_(token) {
  const now = new Date();
  const lowerToken = token.toLowerCase().trim();

  // 1. RELATIVE WORDS
  if (lowerToken === "today") return now;
  if (lowerToken === "yesterday") { now.setDate(now.getDate() - 1); return now; }
  if (lowerToken === "tomorrow") { now.setDate(now.getDate() + 1); return now; }

  if (lowerToken === "monthstart") {
    now.setDate(1);
    return now;
  }
  if (lowerToken.includes("weekstart")) {
    const day = now.getDay(); // 0 (Sun) - 6 (Sat)
    const diff = now.getDate() - day; // Adjust to Sunday
    now.setDate(diff);
    return now;
  }

  // 2. DAY ARITHMETIC (Today+7, Today-3)
  if (lowerToken.startsWith("today")) {
    const operator = lowerToken.includes("+") ? 1 : (lowerToken.includes("-") ? -1 : 0);
    if (operator !== 0) {
      const numPart = lowerToken.replace(/[^0-9]/g, "");
      const days = parseInt(numPart, 10);
      if (!isNaN(days)) {
        now.setDate(now.getDate() + (days * operator));
        return now;
      }
    }
  }

  // 3. WEEKDAY LOGIC (Monday, Next Friday, Last Sunday)
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  let targetDay = -1;
  for (let i = 0; i < days.length; i++) {
    if (lowerToken.includes(days[i])) { targetDay = i; break; }
  }

  if (targetDay !== -1) {
    const currentDay = now.getDay();
    let diff = targetDay - currentDay;

    // "Next Monday"
    if (lowerToken.includes("next")) {
      diff += 7;
    }
    // "Last Monday"
    else if (lowerToken.includes("last")) {
      diff -= 7;
    }
    // "Monday" (Assuming coming occurrence or today)
    else {
      // If we want "This coming Monday" logic:
      if (diff < 0) diff += 7; // e.g. Today is Fri(5), Target is Mon(1). Diff = -4 -> +3 days.
    }

    now.setDate(now.getDate() + diff);
    return now;
  }

  return now; // Fallback to Today
}

function formatDate_(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "dd-MMM-yyyy");
}

function convertElementToHtml_(element) {

  if (element.getType() === DocumentApp.ElementType.PARAGRAPH) {
    let text = element.getText();
    if (text === "") return "<br>";
    return "<p style='margin:0;padding:0;'>" + getFormattedText_(element) + "</p>";
  }

  if (element.getType() === DocumentApp.ElementType.LIST_ITEM) {
    return "<li>" + getFormattedText_(element) + "</li>";
  }

  if (element.getType() === DocumentApp.ElementType.HORIZONTAL_RULE) {
    return "<hr style='border:0;border-top:1px solid #ccc;margin:15px 0;'>";
  }

  if (element.getType() === DocumentApp.ElementType.TABLE) {
    return processTableHTML_(element);
  }

  return "";

}


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

// ==========================================
// RESTORED HELPER FUNCTIONS
// ==========================================

function getFormattedText_(element) {
  const textObj = element.editAsText();
  const text = textObj.getText();
  if (!text) return "";

  const indices = textObj.getTextAttributeIndices();
  let html = "";

  for (let i = 0; i < indices.length; i++) {
    const start = indices[i];
    const end = (i + 1 < indices.length) ? indices[i + 1] : text.length;
    let chunk = text.substring(start, end);

    // Escape HTML special chars
    chunk = chunk
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    if (textObj.isBold(start)) chunk = "<b>" + chunk + "</b>";
    if (textObj.isItalic(start)) chunk = "<i>" + chunk + "</i>";
    if (textObj.isUnderline(start)) chunk = "<u>" + chunk + "</u>";

    // Color
    const color = textObj.getForegroundColor(start);
    if (color && color !== "#000000") {
      chunk = `<span style="color:${color}">${chunk}</span>`;
    }

    // Link
    const url = textObj.getLinkUrl(start);
    if (url) {
      chunk = `<a href="${url}">${chunk}</a>`;
    }

    html += chunk;
  }
  return html;
}

function processTableHTML_(table) {
  let html = '<table style="border-collapse: collapse; width: 100%; border: 1px solid #ccc;">';
  const numRows = table.getNumRows();

  for (let r = 0; r < numRows; r++) {
    const row = table.getRow(r);
    html += "<tr>";
    const numCells = row.getNumCells();

    for (let c = 0; c < numCells; c++) {
      const cell = row.getCell(c);
      let cellHtml = "";

      // Process cell contents (paragraphs usually)
      for (let k = 0; k < cell.getNumChildren(); k++) {
        cellHtml += convertElementToHtml_(cell.getChild(k));
      }

      html += `<td style="border: 1px solid #ccc; padding: 8px;">${cellHtml}</td>`;
    }
    html += "</tr>";
  }

  html += "</table>";
  return html;
}

function getRoundedTime_(timeZone, label) {
  return Utilities.formatDate(new Date(), timeZone, "HH:mm") + (label ? " " + label : "");
}
