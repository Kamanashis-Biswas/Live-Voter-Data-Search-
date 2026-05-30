'use strict';

/**
 * Production-Grade Centralized Logger Utility
 * Supports leveled logging (INFO, WARN, ERROR) with request ID tracing context.
 */

function formatMessage(level, message, reqId = null) {
  const timestamp = new Date().toISOString();
  const trace = reqId ? ` [ReqID: ${reqId}]` : '';
  return `[${timestamp}] [${level}]${trace}: ${message}`;
}

const logger = {
  info(message, reqId = null) {
    console.log(formatMessage('INFO', message, reqId));
  },
  
  warn(message, reqId = null) {
    console.warn(formatMessage('WARN', message, reqId));
  },
  
  error(message, errorDetails = null, reqId = null) {
    let msg = message;
    if (errorDetails) {
      msg += ` - Details: ${errorDetails.message || errorDetails}`;
      if (errorDetails.stack) {
        msg += `\nStack: ${errorDetails.stack}`;
      }
    }
    console.error(formatMessage('ERROR', msg, reqId));
  }
};

module.exports = logger;
