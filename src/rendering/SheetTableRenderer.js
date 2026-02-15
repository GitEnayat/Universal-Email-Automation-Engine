/*
MODULE: SheetTableRenderer
--------------------------------
Parses [Table] tags and converts Sheet Ranges to HTML Tables.
FINAL VERSION (Formatted Text + Empty Row Fix + Safe Quoting)
*/

// ==========================================
// PUBLIC FUNCTION
// ==========================================
/**
 * Scans the body HTML for [Table] tags and replaces them with actual HTML tables.
 * @param {string} bodyHtml - The raw HTML of the Google Doc body.
 * @return {string} The HTML with tables inserted.
 */
function processTables(bodyHtml) {
  // REGEX: Looks for [Table] Sheet: <ID/Link>, range: <Range>
  // Uses non-greedy capture (.*?) and looks ahead for closing paragraph </p>
  const regex = /\[Table\]\s*Sheet:\s*(.*?),\s*range:\s(.*?)(?=<\/p>)/gi;

  return bodyHtml.replace(regex, function(match, urlPart, rawRange) {
    try {
      // 1. EXTRACT ID
      const ssId = getIdFromUrl_(urlPart);
      if (!ssId) {
        Logger.log("❌ Table Error: Could not find Sheet ID in: " + urlPart);
        return "<p style='color:red; background:#ffe6e6; padding:5px;'>[Table Error: Invalid Sheet Link]</p>";
      }

      // 2. CLEAN RANGE STRING
      // Remove HTML tags (in case user bolded the range text)
      let cleanRange = rawRange.replace(/<[^>]+>/g, "");

      // Nuclear Cleaning: Fix Smart Quotes, Non-Breaking Spaces, and HTML Entities
      cleanRange = cleanRange
        .replace(/[\u2018\u2019]/g, "'") // Smart Quotes -> '
        .replace(/\u00A0/g, " ")         // NBSP -> Space
        .replace(/&nbsp;/g, " ")         // HTML Space -> Space
        .trim();

      // Remove trailing punctuation (e.g. "range: A1:B10.")
      if (/[.,;]$/.test(cleanRange)) {
        cleanRange = cleanRange.slice(0, -1).trim();
      }

      // 3. AUTO-QUOTE FIX
      cleanRange = fixMissingQuotes_(cleanRange);

      Logger.log(`[TableHelper] Fetching: "${cleanRange}" from ID: ${ssId}`);
      return getHtmlTableFromSheet_(ssId, cleanRange);

    } catch (e) {
      Logger.log(`❌ [Table Error] ${e.message}`);
      return `<p style="color:red; background:#ffe6e6; padding:5px;">(Table Error: ${e.message})</p>`;
    }
  });
}

// ==========================================
// PRIVATE HELPERS
// ==========================================

function getIdFromUrl_(url) {
  // Extracts the ~44 char ID from a URL or Smart Chip
  const match = url.match(/[-\w]{25,}/);
  return match ? match[0] : null;
}

/**
 * QA FIX: Safely quotes sheet names.
 * Old logic only checked for spaces. New logic quotes everything to be safe.
 * Input:  Data!A1:B10      -> 'Data'!A1:B10
 * Input:  'My Sheet'!A1    -> 'My Sheet'!A1 (No change)
 */
function fixMissingQuotes_(rangeStr) {
  if (rangeStr.startsWith("'")) return rangeStr;

  const lastBang = rangeStr.lastIndexOf("!");
  if (lastBang === -1) return rangeStr; // Named Range? Return as is.

  const sheetName = rangeStr.substring(0, lastBang);
  const cellRange = rangeStr.substring(lastBang + 1);

  // Always wrap in quotes to handle spaces, dashes, or special chars safely
  return `'${sheetName}'!${cellRange}`;
}

function getHtmlTableFromSheet_(ssId, rangeA1) {
  const ss = SpreadsheetApp.openById(ssId);
  const range = ss.getRange(rangeA1);
  const sheet = range.getSheet();

  // 1. FETCH DATA & TRIM
  let values = range.getDisplayValues();

  // Logic: Scan from bottom up. Stop at first non-empty row.
  let lastRowIndex = values.length - 1;
  while (lastRowIndex >= 0) {
    const isRowEmpty = values[lastRowIndex].every(cell => cell.trim() === "");
    if (!isRowEmpty) break;
    lastRowIndex--;
  }

  if (lastRowIndex < 0) return "<p><i>(Table contains no data)</i></p>";

  const newRowCount = lastRowIndex + 1;
  values = values.slice(0, newRowCount);

  // 2. FETCH FORMATTING (Sliced to newRowCount)
  const backgrounds = range.getBackgrounds().slice(0, newRowCount);
  const fontWeights = range.getFontWeights().slice(0, newRowCount);
  const fontColors = range.getFontColors().slice(0, newRowCount);
  const fontSizes = range.getFontSizes().slice(0, newRowCount);
  const horizontalAligns = range.getHorizontalAlignments().slice(0, newRowCount);
  const verticalAligns = range.getVerticalAlignments().slice(0, newRowCount);
  const fontFamilies = range.getFontFamilies().slice(0, newRowCount);

  // 3. FETCH COLUMN WIDTHS
  const startCol = range.getColumn();
  const numCols = values[0].length;
  const colWidths = [];
  let totalTableWidth = 0;

  for (let c = 0; c < numCols; c++) {
    // Note: getColumnWidth is 1-based index
    const colIndex = startCol + c;
    let w = sheet.getColumnWidth(colIndex);
    
    // P2 §3.6: Check if column is hidden by user
    if (sheet.isColumnHiddenByUser && sheet.isColumnHiddenByUser(colIndex)) {
      w = 100; // Default width for hidden columns
      Logger.log(`⚠️ Table Warning: Column ${c} is hidden, using default 100px`);
    } else if (!w || w === 0 || w === null || w === undefined) {
      // Fallback for any other unexpected values
      w = 100;
      Logger.log(`⚠️ Table Warning: Column ${c} has no width, using default 100px`);
    }
    colWidths.push(w);
    totalTableWidth += w;
  }

  // 4. HANDLE MERGED RANGES
  const mergedRanges = range.getMergedRanges();
  const numRows = values.length;

  // Metadata matrix to track spans
  let cellMeta = Array.from({ length: numRows }, () =>
    Array.from({ length: numCols }, () => ({ rowSpan: 1, colSpan: 1, skip: false }))
  );

  const startRowIndex = range.getRow();
  const startColIndex = range.getColumn();

  mergedRanges.forEach(merge => {
    const mergeStartRow = merge.getRow() - startRowIndex;
    const mergeStartCol = merge.getColumn() - startColIndex;
    const mergeNumRows = merge.getNumRows();
    const mergeNumCols = merge.getNumColumns();

    for (let r = 0; r < mergeNumRows; r++) {
      for (let c = 0; c < mergeNumCols; c++) {
        const targetRow = mergeStartRow + r;
        const targetCol = mergeStartCol + c;

        // Ensure we are inside the trimmed bounds
        if (targetRow >= 0 && targetRow < numRows && targetCol >= 0 && targetCol < numCols) {
          if (r === 0 && c === 0) {
            cellMeta[targetRow][targetCol].rowSpan = mergeNumRows;
            cellMeta[targetRow][targetCol].colSpan = mergeNumCols;
          } else {
            cellMeta[targetRow][targetCol].skip = true;
          }
        }
      }
    }
  });

  // 5. BUILD HTML
  // table-layout: fixed enforces exact column widths
  let html = `<table style="table-layout: fixed; width: ${totalTableWidth}px; border-collapse: collapse; border: 1px solid #cccccc; font-family: Arial, sans-serif; font-size: 10pt;">`;

  // COLGROUP for rendering stability in Gmail
  html += '<colgroup>';
  colWidths.forEach(w => { html += `<col style="width: ${w}px;">`; });
  html += '</colgroup>';

  for (let i = 0; i < numRows; i++) {
    // Note: getRowHeight is an API call per row.
    // If table is >50 rows, this might slow down execution slightly but preserves look.
    const rHeight = sheet.getRowHeight(startRowIndex + i);
    html += `<tr style="height: ${rHeight}px;">`;

    for (let j = 0; j < numCols; j++) {
      if (cellMeta[i][j].skip) continue;

      const cellText = values[i][j];

      // Calculate width for merged cells
      let cellWidth = colWidths[j];
      if (cellMeta[i][j].colSpan > 1) {
        cellWidth = 0;
        for (let k = 0; k < cellMeta[i][j].colSpan; k++) {
          cellWidth += colWidths[j + k];
        }
      }

      // Attributes
      const rowSpanAttr = cellMeta[i][j].rowSpan > 1 ? ` rowspan="${cellMeta[i][j].rowSpan}"` : "";
      const colSpanAttr = cellMeta[i][j].colSpan > 1 ? ` colspan="${cellMeta[i][j].colSpan}"` : "";

      // Styles
      const styles = [
        `border: 1px solid #cccccc`,
        `padding: 4px 6px`,
        `overflow: hidden`,
        `width: ${cellWidth}px`,
        `min-width: ${cellWidth}px`, // Enforce strict width
        `max-width: ${cellWidth}px`,
        `background-color: ${backgrounds[i][j]}`,
        `color: ${fontColors[i][j]}`,
        `font-weight: ${fontWeights[i][j]}`,
        `font-size: ${fontSizes[i][j]}pt`,
        `font-family: ${fontFamilies[i][j] || 'Arial'}, sans-serif`,
        `text-align: ${horizontalAligns[i][j]}`,
        `vertical-align: ${verticalAligns[i][j]}`,
        `white-space: pre-wrap` // Preserves line breaks inside cell
      ].join(";");

      html += `<td${rowSpanAttr}${colSpanAttr} style="${styles}">${cellText}</td>`;
    }

    html += '</tr>';
  }

  html += '</table>';
  return html;
}
