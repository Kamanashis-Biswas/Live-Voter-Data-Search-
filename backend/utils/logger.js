'use strict';

/**
 * @file logger.js
 * @description Production-grade centralized logging utility.
 *
 * Features:
 *   - Leveled logging: DEBUG, INFO, WARN, ERROR
 *   - Structured JSON output to file
 *   - Console output with color-coded levels
 *   - Request ID tracing context
 *   - Operation-specific log methods
 *   - Automatic log directory creation
 *
 * @version 6.0.0 — Enhanced from console-only to file + console
 */

const fs = require('fs');
const path = require('path');

// Log directory setup
const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');

// Ensure log directory exists
try {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
} catch {
  // If we can't create log dir, continue with console-only logging
}

// Log levels
const LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

// Current minimum log level (configurable via env)
const MIN_LEVEL = LEVELS[process.env.LOG_LEVEL] || LEVELS.INFO;

/**
 * Write a log entry to file (append mode).
 *
 * @param {object} entry - Structured log entry
 */
function writeToFile(entry) {
  try {
    const line = JSON.stringify(entry) + '\n';
    fs.appendFileSync(LOG_FILE, line, { encoding: 'utf8' });
  } catch {
    // Silently ignore file write errors
  }
}

/**
 * Format a log message for console output.
 *
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {string|null} reqId - Optional request ID
 * @returns {string} Formatted message
 */
function formatMessage(level, message, reqId = null) {
  const timestamp = new Date().toISOString();
  const trace = reqId ? ` [ReqID: ${reqId}]` : '';
  return `[${timestamp}] [${level}]${trace}: ${message}`;
}

/**
 * Create a structured log entry.
 *
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {object} meta - Additional metadata
 * @returns {object} Structured log entry
 */
function createEntry(level, message, meta = {}) {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };
}

const logger = {
  debug(message, reqId = null) {
    if (LEVELS.DEBUG < MIN_LEVEL) return;
    console.log(formatMessage('DEBUG', message, reqId));
    writeToFile(createEntry('DEBUG', message, { reqId }));
  },

  info(message, reqId = null) {
    if (LEVELS.INFO < MIN_LEVEL) return;
    console.log(formatMessage('INFO', message, reqId));
    writeToFile(createEntry('INFO', message, { reqId }));
  },

  warn(message, reqId = null) {
    if (LEVELS.WARN < MIN_LEVEL) return;
    console.warn(formatMessage('WARN', message, reqId));
    writeToFile(createEntry('WARN', message, { reqId }));
  },

  error(message, errorDetails = null, reqId = null) {
    let msg = message;
    const meta = { reqId };

    if (errorDetails) {
      msg += ` - Details: ${errorDetails.message || errorDetails}`;
      meta.errorMessage = errorDetails.message || String(errorDetails);
      if (errorDetails.stack) {
        meta.stack = errorDetails.stack;
      }
    }
    console.error(formatMessage('ERROR', msg, reqId));
    writeToFile(createEntry('ERROR', msg, meta));
  },

  // ── Operation-Specific Log Methods ──

  logPdfUpload(fileName, fileSize, reqId = null) {
    this.info(`PDF Upload: ${fileName} (${(fileSize / 1024).toFixed(1)} KB)`, reqId);
  },

  logPdfValidation(result, reqId = null) {
    const msg = `PDF Validation: type=${result.pdfType} encoding=${result.encoding} pages=${result.pageCount} confidence=${(result.confidence * 100).toFixed(0)}%`;
    if (result.errors && result.errors.length > 0) {
      this.warn(`${msg} ERRORS: ${result.errors.join('; ')}`, reqId);
    } else {
      this.info(msg, reqId);
    }
  },

  logPdfParsing(voterCount, totalPages, duration, reqId = null) {
    this.info(`PDF Parsed: ${voterCount} voters from ${totalPages} pages in ${duration}ms`, reqId);
  },

  logBengaliConversion(encoding, charCount, reqId = null) {
    this.info(`Bengali Conversion: encoding=${encoding} chars=${charCount}`, reqId);
  },

  logSearch(query, resultCount, duration, reqId = null) {
    this.info(`Search: query="${JSON.stringify(query)}" results=${resultCount} time=${duration}ms`, reqId);
  },

  logDatabaseOp(operation, details, reqId = null) {
    this.info(`DB ${operation}: ${details}`, reqId);
  },
};

module.exports = logger;
