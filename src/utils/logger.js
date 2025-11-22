/**
 * Logger Utility
 * Provides structured logging with multiple transports
 * Supports console and file output with rotation
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

class Logger {
    constructor() {
        this.logger = null;
        this.logDir = path.join(__dirname, '../../logs');
    }

    /**
     * Initialize logger with configuration
     */
    async init(config = {}) {
        const {
            level = 'info',
            outputFile = path.join(this.logDir, 'app.log'),
            enableConsole = true,
            maxFileSize = 10485760,
            maxFiles = 5
        } = config;

        // Ensure log directory exists
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }

        const transports = [];

        // Console transport
        if (enableConsole) {
            transports.push(
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                        winston.format.printf(({ timestamp, level, message, ...meta }) => {
                            const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
                            return `${timestamp} [${level}]: ${message} ${metaStr}`;
                        })
                    )
                })
            );
        }

        // File transport with rotation
        transports.push(
            new winston.transports.File({
                filename: outputFile,
                maxsize: maxFileSize,
                maxFiles: maxFiles,
                format: winston.format.combine(
                    winston.format.timestamp(),
                    winston.format.json()
                )
            })
        );

        // Error log file
        transports.push(
            new winston.transports.File({
                filename: path.join(this.logDir, 'error.log'),
                level: 'error',
                maxsize: maxFileSize,
                maxFiles: maxFiles,
                format: winston.format.combine(
                    winston.format.timestamp(),
                    winston.format.json()
                )
            })
        );

        this.logger = winston.createLogger({
            level,
            transports
        });

        this.info('Logger initialized');
    }

    /**
     * Log debug message
     */
    debug(message, meta = {}) {
        if (this.logger) {
            this.logger.debug(message, meta);
        } else {
            console.debug(`[DEBUG] ${message}`, meta);
        }
    }

    /**
     * Log info message
     */
    info(message, meta = {}) {
        if (this.logger) {
            this.logger.info(message, meta);
        } else {
            console.info(`[INFO] ${message}`, meta);
        }
    }

    /**
     * Log warning message
     */
    warn(message, meta = {}) {
        if (this.logger) {
            this.logger.warn(message, meta);
        } else {
            console.warn(`[WARN] ${message}`, meta);
        }
    }

    /**
     * Log error message
     */
    error(message, error = null, meta = {}) {
        const errorInfo = error ? {
            message: error.message,
            stack: error.stack,
            ...meta
        } : meta;

        if (this.logger) {
            this.logger.error(message, errorInfo);
        } else {
            console.error(`[ERROR] ${message}`, errorInfo);
        }
    }

    /**
     * Create child logger with additional context
     */
    child(context) {
        if (this.logger) {
            return this.logger.child(context);
        }
        return this;
    }

    /**
     * Log with custom level
     */
    log(level, message, meta = {}) {
        if (this.logger) {
            this.logger.log(level, message, meta);
        } else {
            console.log(`[${level.toUpperCase()}] ${message}`, meta);
        }
    }

    /**
     * Close logger and flush pending logs
     */
    close() {
        if (this.logger) {
            this.logger.close();
        }
    }
}

module.exports = new Logger();
