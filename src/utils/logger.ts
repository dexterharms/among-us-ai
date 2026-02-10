/**
 * Production-ready logger utility
 *
 * Log levels:
 * - DEBUG: Detailed diagnostic information for development/debugging
 * - INFO: General informational messages about normal operation
 * - WARN: Warning messages for potentially harmful situations
 * - ERROR: Error messages for error events that might still allow the application to continue
 *
 * Environment configuration:
 * Set LOG_LEVEL environment variable to control verbosity (default: INFO)
 * - DEBUG: All logs
 * - INFO: INFO, WARN, ERROR
 * - WARN: WARN, ERROR
 * - ERROR: ERROR only
 * - NONE: Disable all logs
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

export interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private level: LogLevel;
  private prefix = '[AmongUsAI]';

  constructor() {
    // Read from environment or default to INFO
    const envLevel = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
    this.level = this.parseLogLevel(envLevel);
  }

  private parseLogLevel(level: string): LogLevel {
    switch (level) {
      case 'DEBUG':
        return LogLevel.DEBUG;
      case 'INFO':
        return LogLevel.INFO;
      case 'WARN':
      case 'WARNING':
        return LogLevel.WARN;
      case 'ERROR':
        return LogLevel.ERROR;
      case 'NONE':
        return LogLevel.NONE;
      default:
        return LogLevel.INFO;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.level && this.level !== LogLevel.NONE;
  }

  private formatMessage(level: string, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `${timestamp} ${this.prefix} [${level}] ${message}${contextStr}`;
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(this.formatMessage('DEBUG', message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(this.formatMessage('INFO', message, context));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage('WARN', message, context));
    }
  }

  error(message: string, context?: LogContext, error?: Error | unknown): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage('ERROR', message, context), error || '');
    }
  }

  // Structured logging for key game events
  logStateTransition(fromPhase: string, toPhase: string, context?: LogContext): void {
    this.info(`State transition: ${fromPhase} -> ${toPhase}`, {
      type: 'STATE_TRANSITION',
      fromPhase,
      toPhase,
      ...context,
    });
  }

  logGameEvent(eventType: string, context?: LogContext): void {
    this.info(`Game event: ${eventType}`, {
      type: 'GAME_EVENT',
      eventType,
      timestamp: Date.now(),
      ...context,
    });
  }

  logError(message: string, error: Error | unknown, context?: LogContext): void {
    this.error(message, {
      type: 'ERROR',
      ...context,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : error,
    });
  }
}

// Singleton instance
export const logger = new Logger();
