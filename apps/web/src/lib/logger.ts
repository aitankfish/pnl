/**
 * Logger Utility
 * Re-exports createClientLogger from shared, keeps server-side Winston logger local
 */

import { createClientLogger } from '@pnl/shared/utils';

// Re-export client logger from shared package
export { createClientLogger };

// Logger metadata type — accepts a structured record OR a raw value (caught
// error, response body, etc.) so callers can do `logger.error('msg', err)`
// without manually wrapping unknowns.
type LogMetadata = Record<string, unknown> | unknown;

// Winston logger type
interface WinstonLogger {
  debug: (message: string, meta?: LogMetadata) => void;
  info: (message: string, meta?: LogMetadata) => void;
  warn: (message: string, meta?: LogMetadata) => void;
  error: (message: string, meta?: LogMetadata) => void;
  add: (transport: unknown) => void;
}

// Check if we're on the server side
const isServer = typeof window === 'undefined';

// Server-side logger (Winston)
let serverLogger: WinstonLogger | null = null;

if (isServer) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const winston = require('winston');

    const logger: WinstonLogger = winston.createLogger({
      level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'plp-platform' },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        }),
      ],
    });

    if (process.env.NODE_ENV === 'production') {
      logger.add(
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
        })
      );
      logger.add(
        new winston.transports.File({
          filename: 'logs/combined.log',
        })
      );
    }

    serverLogger = logger;
  } catch (error) {
    console.error('Failed to initialize Winston logger:', error);
  }
}

const clientLogger = createClientLogger();

// Universal logger that works on both client and server
const logger = {
  debug: (message: string, meta?: LogMetadata) => {
    if (isServer && serverLogger) {
      serverLogger.debug(message, meta);
    } else {
      clientLogger.debug(message, meta);
    }
  },
  info: (message: string, meta?: LogMetadata) => {
    if (isServer && serverLogger) {
      serverLogger.info(message, meta);
    } else {
      clientLogger.info(message, meta);
    }
  },
  warn: (message: string, meta?: LogMetadata) => {
    if (isServer && serverLogger) {
      serverLogger.warn(message, meta);
    } else {
      clientLogger.warn(message, meta);
    }
  },
  error: (message: string, meta?: LogMetadata) => {
    if (isServer && serverLogger) {
      serverLogger.error(message, meta);
    } else {
      clientLogger.error(message, meta);
    }
  },
};

// Export the universal logger
export default logger;

// Convenience functions
export const logInfo = (message: string, meta?: LogMetadata) => logger.info(message, meta);
export const logError = (message: string, meta?: LogMetadata) => logger.error(message, meta);
export const logWarn = (message: string, meta?: LogMetadata) => logger.warn(message, meta);
export const logDebug = (message: string, meta?: LogMetadata) => logger.debug(message, meta);
