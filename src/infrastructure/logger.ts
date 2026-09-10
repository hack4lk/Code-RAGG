/**
 * Centralized logging utility with environment-based log levels
 */

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const LOG_LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const currentLogLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
const currentLogLevelValue = LOG_LEVELS[currentLogLevel];

const shouldLog = (level: LogLevel): boolean => {
  return LOG_LEVELS[level] <= currentLogLevelValue;
};

const formatLog = (level: LogLevel, message: string, data?: any): string => {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  if (data) {
    return `${prefix} ${message} ${JSON.stringify(data)}`;
  }
  return `${prefix} ${message}`;
};

export const logger = {
  error: (message: string, data?: any) => {
    if (shouldLog('error')) {
      console.error(formatLog('error', message, data));
    }
  },

  warn: (message: string, data?: any) => {
    if (shouldLog('warn')) {
      console.warn(formatLog('warn', message, data));
    }
  },

  info: (message: string, data?: any) => {
    if (shouldLog('info')) {
      console.log(formatLog('info', message, data));
    }
  },

  debug: (message: string, data?: any) => {
    if (shouldLog('debug')) {
      console.log(formatLog('debug', message, data));
    }
  },

  /** Formatted output for user-facing reports (not controlled by log level) */
  report: (message: string) => {
    console.log(message);
  },
};
