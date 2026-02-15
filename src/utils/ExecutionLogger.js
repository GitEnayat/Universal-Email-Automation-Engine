/*
MODULE: ExecutionLogger
--------------------------------
Logs execution history to a Google Sheet for observability.
Provides audit trail and debugging information.
Enhanced with structured data and API metrics.
--------------------------------
*/

/**
 * Execution context for tracking API calls and metrics within a single execution.
 * Use startExecutionContext() and endExecutionContext() to track operations.
 */
const EXECUTION_CONTEXT = {
  apiCalls: 0,
  startTime: null,
  templateName: null,
  operations: []
};

/**
 * Starts tracking an execution context.
 * Call this at the beginning of generateEmailDraft().
 * @param {string} templateName - Name of the template being processed
 */
function startExecutionContext(templateName) {
  EXECUTION_CONTEXT.apiCalls = 0;
  EXECUTION_CONTEXT.startTime = Date.now();
  EXECUTION_CONTEXT.templateName = templateName;
  EXECUTION_CONTEXT.operations = [];
}

/**
 * Tracks an API call in the execution context.
 * Call this after each external API operation.
 * @param {string} operation - Name of the operation (e.g., "fetchTemplate", "createDraft")
 * @param {number} [duration] - Optional duration of the operation in ms
 */
function trackApiCall(operation, duration) {
  EXECUTION_CONTEXT.apiCalls++;
  EXECUTION_CONTEXT.operations.push({
    operation: operation,
    duration: duration || 0,
    timestamp: Date.now()
  });
}

/**
 * Ends the execution context and returns metrics.
 * @return {Object} Execution metrics { totalCalls, totalDuration, operations: [] }
 */
function endExecutionContext() {
  const duration = Date.now() - EXECUTION_CONTEXT.startTime;
  return {
    totalCalls: EXECUTION_CONTEXT.apiCalls,
    totalDuration: duration,
    operations: EXECUTION_CONTEXT.operations,
    templateName: EXECUTION_CONTEXT.templateName
  };
}

/**
 * Logs an execution event to the System_Logs sheet.
 * Creates the sheet and headers if they don't exist.
 * Enhanced with API metrics and structured JSON data.
 * @param {string} status - Status: "CREATED", "UPDATED", "ERROR", "DRY_RUN", "BATCH_COMPLETE"
 * @param {string} templateName - Name of the template processed
 * @param {Object} details - Additional details object
 * @param {string} [details.draftId] - Gmail draft ID (if created)
 * @param {string} [details.error] - Error message (if failed)
 * @param {boolean} [details.dryRun] - Whether this was a dry run
 * @param {boolean} [details.testMode] - Whether test mode was active
 * @param {string} [details.recipientsTo] - TO recipients
 * @param {number} [details.duration] - Execution duration in ms
 * @param {Object} [details.metrics] - Execution metrics { apiCalls, operations }
 */
function logExecution(status, templateName, details = {}) {
  try {
    const spreadsheet = getLogSpreadsheet_();
    if (!spreadsheet) {
      Log.warn("ExecutionLogger", "Could not access log spreadsheet, skipping execution log");
      return;
    }
    
    let sheet = spreadsheet.getSheetByName("System_Logs");
    
    // Create sheet if it doesn't exist
    if (!sheet) {
      sheet = createLogSheet_(spreadsheet);
    }
    
    // Prepare log row
    const timestamp = new Date();
    const user = Session.getActiveUser().getEmail();
    const draftId = details.draftId || "";
    const error = details.error || "";
    const isDryRun = details.dryRun ? "YES" : "NO";
    const isTestMode = details.testMode ? "YES" : "NO";
    const duration = details.duration || "";
    const recipients = details.recipientsTo || "";
    const apiCalls = details.metrics ? details.metrics.apiCalls : "";
    
    // Create structured JSON data for advanced analysis
    const jsonData = JSON.stringify({
      timestamp: timestamp.toISOString(),
      user: user,
      template: templateName,
      status: status,
      draftId: draftId,
      dryRun: isDryRun === "YES",
      testMode: isTestMode === "YES",
      duration: duration,
      apiCalls: apiCalls,
      recipients: recipients,
      error: error,
      operations: details.metrics ? details.metrics.operations : []
    });
    
    const row = [
      timestamp,        // A: Timestamp
      user,             // B: User
      templateName,     // C: Template Name
      status,           // D: Status
      draftId,          // E: Draft ID
      isDryRun,         // F: Dry Run
      isTestMode,       // G: Test Mode
      duration,         // H: Duration (ms)
      apiCalls,         // I: API Calls
      recipients,       // J: Recipients
      error.substring(0, 500), // K: Error Message (truncated)
      jsonData.substring(0, 49000) // L: JSON Data (for structured analysis)
    ];
    
    // Append to sheet
    sheet.appendRow(row);
    
    // Keep only last 1000 rows (prevent sheet bloat)
    const maxRows = 1000;
    const currentRows = sheet.getLastRow() - 1; // Exclude header
    if (currentRows > maxRows) {
      // Delete oldest rows (keep header + last 1000)
      const rowsToDelete = currentRows - maxRows;
      sheet.deleteRows(2, rowsToDelete);
    }
    
    Log.debug("ExecutionLogger", `Execution logged: ${status} - ${templateName} (${apiCalls} API calls, ${duration}ms)`);
    
  } catch (e) {
    // Don't let logging failures break the main flow
    Log.warn("ExecutionLogger", `Failed to log execution: ${e.message}`);
  }
}

/**
 * Gets or creates the logging spreadsheet.
 * Tries to use active spreadsheet first, then creates new one.
 * @return {Spreadsheet|null} The spreadsheet to use for logging
 */
function getLogSpreadsheet_() {
  try {
    // Try to use active spreadsheet (if container-bound)
    const activeSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (activeSpreadsheet) {
      return activeSpreadsheet;
    }
  } catch (e) {
    // Not container-bound, create standalone
  }
  
  try {
    // Create or open standalone log spreadsheet
    const logSheetName = "Email_Engine_Logs";
    const files = DriveApp.getFilesByName(logSheetName);
    
    if (files.hasNext()) {
      const file = files.next();
      return SpreadsheetApp.openById(file.getId());
    } else {
      // Create new spreadsheet
      const spreadsheet = SpreadsheetApp.create(logSheetName);
      Log.info("ExecutionLogger", `Created new log spreadsheet: ${spreadsheet.getUrl()}`);
      return spreadsheet;
    }
  } catch (e) {
    Log.error("ExecutionLogger", `Failed to create/access log spreadsheet: ${e.message}`);
    return null;
  }
}

/**
 * Creates the System_Logs sheet with proper headers.
 * Enhanced with API metrics and JSON data columns.
 * @param {Spreadsheet} spreadsheet - The spreadsheet to add sheet to
 * @return {Sheet} The created sheet
 */
function createLogSheet_(spreadsheet) {
  const sheet = spreadsheet.insertSheet("System_Logs");
  
  // Add headers - Enhanced with API metrics
  const headers = [
    "Timestamp",
    "User",
    "Template Name",
    "Status",
    "Draft ID",
    "Dry Run",
    "Test Mode",
    "Duration (ms)",
    "API Calls",
    "Recipients (TO)",
    "Error Message",
    "JSON Data"
  ];
  
  sheet.appendRow(headers);
  
  // Format header row
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight("bold");
  headerRange.setBackground("#4285f4");
  headerRange.setFontColor("white");
  
  // Set column widths
  sheet.setColumnWidth(1, 150);  // Timestamp
  sheet.setColumnWidth(2, 200);  // User
  sheet.setColumnWidth(3, 200);  // Template Name
  sheet.setColumnWidth(4, 100);  // Status
  sheet.setColumnWidth(5, 200);  // Draft ID
  sheet.setColumnWidth(6, 70);   // Dry Run
  sheet.setColumnWidth(7, 80);   // Test Mode
  sheet.setColumnWidth(8, 90);   // Duration
  sheet.setColumnWidth(9, 70);   // API Calls
  sheet.setColumnWidth(10, 200); // Recipients
  sheet.setColumnWidth(11, 300); // Error Message
  sheet.setColumnWidth(12, 300); // JSON Data
  
  // Freeze header row
  sheet.setFrozenRows(1);
  
  // Add data validation for Status column
  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["CREATED", "UPDATED", "ERROR", "DRY_RUN", "BATCH_CREATED", "BATCH_ERROR", "BATCH_COMPLETE"], true)
    .setHelpText("Select a valid status")
    .build();
  sheet.getRange("D2:D1000").setDataValidation(statusRule);
  
  Log.info("ExecutionLogger", "Created System_Logs sheet with enhanced headers and API metrics");
  return sheet;
}

/**
 * Retrieves recent execution logs.
 * Useful for debugging and monitoring.
 * Enhanced to parse JSON data column.
 * @param {number} [limit=50] - Number of recent entries to retrieve
 * @param {Object} [filter] - Optional filter criteria
 * @param {string} [filter.status] - Filter by status
 * @param {string} [filter.templateName] - Filter by template name
 * @param {boolean} [filter.includeJson] - Whether to parse JSON data column
 * @return {Array} Array of log entries
 */
function getRecentLogs(limit = 50, filter = {}) {
  try {
    const spreadsheet = getLogSpreadsheet_();
    if (!spreadsheet) return [];
    
    const sheet = spreadsheet.getSheetByName("System_Logs");
    if (!sheet) return [];
    
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return []; // Only header or empty
    
    const startRow = Math.max(2, lastRow - limit + 1);
    const numRows = lastRow - startRow + 1;
    
    const data = sheet.getRange(startRow, 1, numRows, 12).getValues();
    
    let logs = data.map(row => {
      const logEntry = {
        timestamp: row[0],
        user: row[1],
        templateName: row[2],
        status: row[3],
        draftId: row[4],
        dryRun: row[5],
        testMode: row[6],
        duration: row[7],
        apiCalls: row[8],
        recipients: row[9],
        error: row[10]
      };
      
      // Parse JSON data if requested
      if (filter.includeJson && row[11]) {
        try {
          logEntry.jsonData = JSON.parse(row[11]);
        } catch (e) {
          logEntry.jsonData = null;
        }
      }
      
      return logEntry;
    });
    
    // Apply filters
    if (filter.status) {
      logs = logs.filter(l => l.status === filter.status);
    }
    if (filter.templateName) {
      logs = logs.filter(l => l.templateName.includes(filter.templateName));
    }
    
    return logs;
    
  } catch (e) {
    Log.error("ExecutionLogger", `Failed to retrieve logs: ${e.message}`);
    return [];
  }
}

/**
 * Generates execution statistics and analytics.
 * @param {Object} [options] - Analysis options
 * @param {number} [options.days=7] - Number of days to analyze
 * @param {string} [options.templateName] - Filter by specific template
 * @return {Object} Statistics summary
 */
function getExecutionStats(options = {}) {
  try {
    const days = options.days || 7;
    const since = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
    
    const logs = getRecentLogs(1000, { templateName: options.templateName });
    const filteredLogs = logs.filter(l => l.timestamp >= since);
    
    const stats = {
      period: `${days} days`,
      totalExecutions: filteredLogs.length,
      successful: filteredLogs.filter(l => !l.error).length,
      failed: filteredLogs.filter(l => l.error).length,
      dryRuns: filteredLogs.filter(l => l.dryRun === "YES").length,
      testModes: filteredLogs.filter(l => l.testMode === "YES").length,
      averageDuration: 0,
      totalApiCalls: 0,
      templatesUsed: [...new Set(filteredLogs.map(l => l.templateName))],
      topErrors: {}
    };
    
    if (filteredLogs.length > 0) {
      const durations = filteredLogs.filter(l => l.duration).map(l => parseInt(l.duration) || 0);
      stats.averageDuration = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
      
      const apiCalls = filteredLogs.filter(l => l.apiCalls).map(l => parseInt(l.apiCalls) || 0);
      stats.totalApiCalls = apiCalls.reduce((a, b) => a + b, 0);
      
      // Count top errors
      filteredLogs.filter(l => l.error).forEach(l => {
        const errorType = l.error.split(":")[0] || "Unknown";
        stats.topErrors[errorType] = (stats.topErrors[errorType] || 0) + 1;
      });
    }
    
    return stats;
    
  } catch (e) {
    Log.error("ExecutionLogger", `Failed to generate stats: ${e.message}`);
    return null;
  }
}

/**
 * Displays execution statistics in a dialog.
 * Only works in container-bound context.
 */
function showExecutionStatsDialog() {
  try {
    if (!SpreadsheetApp.getActiveSpreadsheet) {
      Logger.log("❌ This function requires a container-bound script");
      return;
    }
    
    const stats = getExecutionStats({ days: 7 });
    if (!stats) {
      Logger.log("❌ Failed to generate statistics");
      return;
    }
    
    const ui = SpreadsheetApp.getUi();
    
    let message = `📊 Execution Statistics (Last ${stats.period})\n\n`;
    message += `Total Executions: ${stats.totalExecutions}\n`;
    message += `✅ Successful: ${stats.successful}\n`;
    message += `❌ Failed: ${stats.failed}\n`;
    message += `🧪 Dry Runs: ${stats.dryRuns}\n`;
    message += `🧪 Test Modes: ${stats.testModes}\n\n`;
    message += `⚡ Average Duration: ${stats.averageDuration}ms\n`;
    message += `📡 Total API Calls: ${stats.totalApiCalls}\n\n`;
    message += `📋 Templates Used: ${stats.templatesUsed.length}\n`;
    message += stats.templatesUsed.slice(0, 10).map(t => `  - ${t}`).join("\n`);
    
    if (Object.keys(stats.topErrors).length > 0) {
      message += `\n\n⚠️ Top Errors:\n`;
      Object.entries(stats.topErrors)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .forEach(([error, count]) => {
          message += `  ${error}: ${count}\n`;
        });
    }
    
    ui.alert("📊 Execution Statistics", message, ui.ButtonSet.OK);
    
  } catch (e) {
    Logger.log("❌ Error: " + e.message);
  }
}

/**
 * Clears all execution logs (use with caution).
 * Requires confirmation.
 */
function clearAllLogs() {
  try {
    const ui = SpreadsheetApp.getUi();
    const response = ui.alert(
      "⚠️ Clear All Logs",
      "This will permanently delete all execution history. Are you sure?",
      ui.ButtonSet.YES_NO
    );
    
    if (response === ui.Button.YES) {
      const spreadsheet = getLogSpreadsheet_();
      if (spreadsheet) {
        const sheet = spreadsheet.getSheetByName("System_Logs");
        if (sheet && sheet.getLastRow() > 1) {
          // Delete all data rows (keep header)
          sheet.deleteRows(2, sheet.getLastRow() - 1);
          Log.info("ExecutionLogger", "All execution logs cleared");
          ui.alert("✅ Logs Cleared", "All execution history has been deleted.", ui.ButtonSet.OK);
        }
      }
    }
  } catch (e) {
    Log.error("ExecutionLogger", `Failed to clear logs: ${e.message}`);
  }
}
