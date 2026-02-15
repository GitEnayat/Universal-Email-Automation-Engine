/*
MODULE: LoggerUtil
--------------------------------
Structured logging utility with timestamps, module names, and severity levels.
Provides consistent logging format across all modules.
--------------------------------
*/

/**
 * Log levels for structured logging
 */
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

/**
 * Current log level - adjust to control verbosity
 */
const CURRENT_LOG_LEVEL = LOG_LEVELS.INFO;

/**
 * Structured logging function
 * @param {string} level - Log level (DEBUG, INFO, WARN, ERROR)
 * @param {string} module - Module name (e.g., "MailOrchestrator", "TemplateService")
 * @param {string} message - Log message
 */
function log(level, module, message) {
  const levelUpper = level.toUpperCase();
  const levelValue = LOG_LEVELS[levelUpper] || LOG_LEVELS.INFO;
  
  // Skip if below current log level
  if (levelValue < CURRENT_LOG_LEVEL) return;
  
  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  const formatted = `[${timestamp}] [${levelUpper}] [${module}] ${message}`;
  
  Logger.log(formatted);
}

/**
 * Convenience methods for different log levels
 */
const Log = {
  debug: (module, message) => log('DEBUG', module, message),
  info: (module, message) => log('INFO', module, message),
  warn: (module, message) => log('WARN', module, message),
  error: (module, message) => log('ERROR', module, message)
};
