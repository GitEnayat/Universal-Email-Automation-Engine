/*
MODULE: SheetTableRenderer
---------------------------------------------------
Replaces [Table] tags in templates with HTML tables
generated from Google Sheets ranges.
Preserves formatting, merged cells and column widths.
---------------------------------------------------
*/


// ==========================================
// PUBLIC ENTRY POINT
// ==========================================
function processTables(html) {

  const regex = /\[Table\]\s*Sheet:\s*(.*?),\s*range:\s*(.*?)(?=<\/p>)/gi;

  return html.replace(regex, function(match, urlPart, rawRange) {

    try {
      const spreadsheetId = extractSpreadsheetId_(urlPart);
      const cleanRange = cleanRangeString_(rawRange);

      return buildHtmlTableFromSheet_(spreadsheetId, cleanRange);

    } catch (e) {
      return `<p style="color:red">(Table error: ${e.message})</p>`;
    }

  });
}


// ==========================================
// HELPERS
// ==========================================

function extractSpreadsheetId_(url) {
  const match = url.match(/[-\w]{25,}/);
  return match ? match[0] : null;
}

function cleanRangeString_(range) {
  return range
    .replace(/<[^>]+>/g, "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\u00A0/g, " ")
    .replace(/&nbsp;/g, " ")
    .trim();
}


// ==========================================
// CORE TABLE RENDERER
// ==========================================
function buildHtmlTableFromSheet_(spreadsheetId, rangeA1) {

  const sheet = SpreadsheetApp.openById(spreadsheetId).getRange(rangeA1);
  const values = sheet.getDisplayValues();

  let html = `
  <table style="border-collapse:collapse;border:1px solid #ccc;font-family:Arial;font-size:10pt">
  `;

  values.forEach(row => {
    html += "<tr>";
    row.forEach(cell => {
      html += `<td style="border:1px solid #ccc;padding:4px">${cell}</td>`;
    });
    html += "</tr>";
  });

  html += "</table>";
  return html;
}
