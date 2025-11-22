/**
 * Base File Processor
 * Abstract base class for all file type processors
 */

const logger = require('../utils/logger');

class BaseProcessor {
    constructor(config = {}) {
        this.config = config;
        this.name = this.constructor.name;
    }

    /**
     * Check if this processor can handle the given file
     * @param {Object} fileInfo - File information object
     * @returns {boolean}
     */
    canProcess(fileInfo) {
        throw new Error('canProcess() must be implemented by subclass');
    }

    /**
     * Process file and extract metadata
     * @param {Object} fileInfo - File information object
     * @returns {Promise<Object>} - Enhanced file information with metadata
     */
    async process(fileInfo) {
        throw new Error('process() must be implemented by subclass');
    }

    /**
     * Validate file before processing
     */
    async validate(fileInfo) {
        const fs = require('fs').promises;

        try {
            const stats = await fs.stat(fileInfo.path);

            // Check if file exists and is readable
            if (!stats.isFile()) {
                throw new Error('Not a regular file');
            }

            // Check file size limits if configured
            if (this.config.maxFileSize && stats.size > this.config.maxFileSize) {
                throw new Error(`File too large: ${stats.size} bytes`);
            }

            return true;
        } catch (error) {
            logger.error(`Validation failed for ${fileInfo.path}`, error);
            return false;
        }
    }

    /**
     * Handle processing errors
     */
    handleError(fileInfo, error) {
        logger.error(`Error processing ${fileInfo.path} with ${this.name}`, error);

        if (!fileInfo.processing) {
            fileInfo.processing = {};
        }

        if (!fileInfo.processing.errors) {
            fileInfo.processing.errors = [];
        }

        fileInfo.processing.errors.push({
            processor: this.name,
            message: error.message,
            timestamp: new Date().toISOString()
        });

        return fileInfo;
    }

    /**
     * Get supported file extensions
     */
    getSupportedExtensions() {
        return [];
    }

    /**
     * Get supported MIME types
     */
    getSupportedMimeTypes() {
        return [];
    }

    /**
     * Log processing start
     */
    logStart(fileInfo) {
        logger.debug(`${this.name} processing: ${fileInfo.relativePath}`);
    }

    /**
     * Log processing completion
     */
    logComplete(fileInfo, duration) {
        logger.debug(`${this.name} completed: ${fileInfo.relativePath} (${duration}ms)`);
    }

    /**
     * Format file size
     */
    formatFileSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let size = bytes;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }
}

module.exports = BaseProcessor;
