/**
 * Base File Processor
 * Abstract base class for all file type processors
 *
 * Implements Template Method pattern to eliminate code duplication
 * and ensure consistent processing across all file types.
 */

const logger = require('../utils/logger');
const fs = require('fs').promises;

class BaseProcessor {
    constructor(config = {}) {
        this.config = config;
        this.name = this.constructor.name;
        this.version = '1.0.0';
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
     * Template method for processing files
     * Handles common processing flow: validation, metadata initialization,
     * extraction, and completion tracking
     *
     * @param {Object} fileInfo - File information object
     * @returns {Promise<Object>} - Enhanced file information with metadata
     */
    async process(fileInfo) {
        const startTime = Date.now();
        this.logStart(fileInfo);

        try {
            // Validate file
            if (!await this.validate(fileInfo)) {
                return fileInfo;
            }

            // Initialize metadata structure
            this.initializeMetadata(fileInfo);

            // Perform actual metadata extraction (implemented by subclasses)
            await this.extractMetadata(fileInfo);

            // Record processing completion
            this.recordProcessing(fileInfo, startTime);

            this.logComplete(fileInfo, Date.now() - startTime);
            return fileInfo;

        } catch (error) {
            return this.handleError(fileInfo, error);
        }
    }

    /**
     * Extract metadata - must be implemented by subclasses
     * This is where the actual file-type-specific processing happens
     *
     * @param {Object} fileInfo - File information object
     * @returns {Promise<void>}
     */
    async extractMetadata(fileInfo) {
        throw new Error('extractMetadata() must be implemented by subclass');
    }

    /**
     * Initialize metadata structure for this file type
     * Subclasses can override to customize metadata structure
     *
     * @param {Object} fileInfo - File information object
     */
    initializeMetadata(fileInfo) {
        if (!fileInfo.metadata) {
            fileInfo.metadata = {};
        }
    }

    /**
     * Record processing metadata (timestamp, duration, version)
     *
     * @param {Object} fileInfo - File information object
     * @param {number} startTime - Processing start timestamp
     */
    recordProcessing(fileInfo, startTime) {
        fileInfo.processing = {
            processedAt: new Date().toISOString(),
            processingTime: Date.now() - startTime,
            version: this.version,
            errors: []
        };
    }

    /**
     * Validate file before processing
     * Checks file existence, type, and size constraints
     *
     * @param {Object} fileInfo - File information object
     * @returns {Promise<boolean>} - True if valid, false otherwise
     */
    async validate(fileInfo) {
        try {
            const stats = await fs.stat(fileInfo.path);

            if (!stats.isFile()) {
                throw new Error('Not a regular file');
            }

            if (this.config.maxFileSize && stats.size > this.config.maxFileSize) {
                throw new Error(`File exceeds size limit: ${this.formatFileSize(stats.size)}`);
            }

            return true;
        } catch (error) {
            logger.error(`Validation failed for ${fileInfo.path}`, error);
            return false;
        }
    }

    /**
     * Read file buffer (common operation for many processors)
     *
     * @param {string} filePath - Path to file
     * @returns {Promise<Buffer>} - File buffer
     */
    async readFileBuffer(filePath) {
        return await fs.readFile(filePath);
    }

    /**
     * Check if file exists
     *
     * @param {string} filePath - Path to file
     * @returns {Promise<boolean>} - True if exists, false otherwise
     */
    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
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
