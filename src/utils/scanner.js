/**
 * File Scanner with Incremental Support
 * Scans directories and detects file changes for incremental processing
 * Includes magic number detection via file-type package
 */

const fs = require('fs').promises;
const path = require('path');
const { createReadStream } = require('fs');
const mime = require('mime-types');
const FileType = require('file-type');
const hashUtil = require('./hash');
const logger = require('./logger');

class FileScanner {
    constructor(database, ignoreManager) {
        this.db = database;
        this.ignoreManager = ignoreManager;
        this.stats = {
            totalFiles: 0,
            newFiles: 0,
            modifiedFiles: 0,
            unchangedFiles: 0,
            errors: 0
        };
    }

    /**
     * Detect MIME type from file content using magic numbers
     * Falls back to extension-based detection if file-type cannot determine type
     *
     * @param {string} filePath - Path to the file
     * @returns {Promise<Object>} Object with mimeDetection details
     * @returns {string} mimeDetection.fromExtension - MIME type from file extension
     * @returns {string|null} mimeDetection.fromMagicNumber - MIME type from magic number detection
     * @returns {boolean} mimeDetection.confident - True if magic number detection succeeded
     * @example
     * const result = await scanner.detectMimeType('/path/to/file');
     * // { fromExtension: 'application/pdf', fromMagicNumber: 'application/pdf', confident: true }
     */
    async detectMimeType(filePath) {
        const fromExtension = mime.lookup(filePath) || 'application/octet-stream';
        let fromMagicNumber = null;
        let confident = false;

        try {
            const fileTypeResult = await FileType.fromFile(filePath);

            if (fileTypeResult) {
                fromMagicNumber = fileTypeResult.mime;
                confident = true;
            } else {
                // file-type couldn't detect the type, fall back to extension
                fromMagicNumber = fromExtension;
                confident = false;
            }
        } catch (error) {
            logger.warn(`Could not detect MIME type via magic numbers for ${filePath}`, error);
            // Fallback to extension-based detection
            fromMagicNumber = fromExtension;
            confident = false;
        }

        return {
            fromExtension,
            fromMagicNumber,
            confident
        };
    }

    /**
     * Scan directory recursively
     */
    async scan(directory, config = {}) {
        const {
            maxDepth = -1,
            followSymlinks = false,
            incrementalScanning = true
        } = config;

        this.stats = {
            totalFiles: 0,
            newFiles: 0,
            modifiedFiles: 0,
            unchangedFiles: 0,
            errors: 0
        };

        const files = [];
        await this.scanDirectory(directory, directory, files, 0, maxDepth, followSymlinks, incrementalScanning);

        return {
            files,
            stats: this.stats
        };
    }

    /**
     * Recursively scan a directory
     */
    async scanDirectory(baseDir, currentDir, files, depth, maxDepth, followSymlinks, incrementalScanning) {
        if (maxDepth >= 0 && depth > maxDepth) {
            return;
        }

        try {
            const entries = await fs.readdir(currentDir, { withFileTypes: true });
            const relativePath = path.relative(baseDir, currentDir);

            // Check if directory is ignored
            if (relativePath && this.ignoreManager && this.ignoreManager.ignores(relativePath)) {
                return;
            }

            for (const entry of entries) {
                const fullPath = path.join(currentDir, entry.name);
                const relPath = path.relative(baseDir, fullPath);

                // Check if file/directory is ignored
                if (this.ignoreManager && this.ignoreManager.ignores(relPath)) {
                    continue;
                }

                if (entry.isDirectory()) {
                    await this.scanDirectory(
                        baseDir,
                        fullPath,
                        files,
                        depth + 1,
                        maxDepth,
                        followSymlinks,
                        incrementalScanning
                    );
                } else if (entry.isFile() || (followSymlinks && entry.isSymbolicLink())) {
                    const fileInfo = await this.processFile(baseDir, fullPath, incrementalScanning);
                    if (fileInfo) {
                        files.push(fileInfo);
                    }
                }
            }
        } catch (error) {
            logger.error(`Error scanning directory ${currentDir}`, error);
            this.stats.errors++;
        }
    }

    /**
     * Process a single file
     * Performs both extension-based and magic number-based MIME type detection
     */
    async processFile(baseDir, filePath, incrementalScanning) {
        try {
            const stats = await fs.stat(filePath);
            this.stats.totalFiles++;

            // Detect MIME type using both extension and magic numbers
            const mimeDetection = await this.detectMimeType(filePath);

            // Categorize file using detected MIME types
            const category = await this.categorizeFile(filePath, mimeDetection);

            const fileInfo = {
                path: filePath,
                relativePath: path.relative(baseDir, filePath),
                name: path.basename(filePath),
                extension: path.extname(filePath).slice(1).toLowerCase(),
                size: stats.size,
                created: stats.birthtime.toISOString(),
                modified: stats.mtime.toISOString(),
                accessed: stats.atime.toISOString(),
                mimeType: mimeDetection.fromMagicNumber || mimeDetection.fromExtension,
                mimeDetection: mimeDetection,
                category: category
            };

            // Check if file needs processing
            if (incrementalScanning) {
                const needsProcessing = await this.needsProcessing(fileInfo);
                if (!needsProcessing) {
                    this.stats.unchangedFiles++;
                    return null; // Skip unchanged file
                }

                if (needsProcessing === 'modified') {
                    this.stats.modifiedFiles++;
                } else {
                    this.stats.newFiles++;
                }
            } else {
                this.stats.newFiles++;
            }

            // Calculate hash for change detection
            try {
                const hashes = await hashUtil.multiHash(filePath, ['md5', 'sha256']);
                fileInfo.hash = hashes;
            } catch (error) {
                logger.warn(`Could not hash file ${filePath}`, error);
            }

            return fileInfo;

        } catch (error) {
            logger.error(`Error processing file ${filePath}`, error);
            this.stats.errors++;
            return null;
        }
    }

    /**
     * Determine if file needs processing
     */
    async needsProcessing(fileInfo) {
        const existingFile = this.db.getFile(fileInfo.path);

        if (!existingFile) {
            return 'new';
        }

        // Compare modification time and size
        if (existingFile.modified !== fileInfo.modified || existingFile.size !== fileInfo.size) {
            return 'modified';
        }

        return false;
    }

    /**
     * Categorize file by type using both extension and MIME type detection
     * Considers both extension-based and magic number-based MIME types
     *
     * @param {string} filePath - Path to the file
     * @param {Object} [mimeDetection] - Optional mimeDetection object from detectMimeType
     * @returns {string} Category: 'image', 'video', 'audio', 'document', 'code', 'archive', 'spreadsheet', or 'other'
     */
    async categorizeFile(filePath, mimeDetection = null) {
        const ext = path.extname(filePath).slice(1).toLowerCase();

        // Use provided mimeDetection or detect it
        if (!mimeDetection) {
            mimeDetection = await this.detectMimeType(filePath);
        }

        // Use magic number detection first if confident, otherwise use extension detection
        const mimeType = mimeDetection.confident ?
            mimeDetection.fromMagicNumber :
            mimeDetection.fromExtension;

        // Image files
        if (mimeType && mimeType.startsWith('image/')) {
            return 'image';
        }

        // Video files
        if (mimeType && mimeType.startsWith('video/')) {
            return 'video';
        }

        // Audio files
        if (mimeType && mimeType.startsWith('audio/')) {
            return 'audio';
        }

        // Document files
        const docExtensions = ['pdf', 'doc', 'docx', 'odt', 'rtf', 'txt', 'md', 'epub', 'mobi'];
        if (docExtensions.includes(ext) || (mimeType && (mimeType.startsWith('application/pdf') ||
            mimeType.includes('document') || mimeType.includes('text')))) {
            return 'document';
        }

        // Code files
        const codeExtensions = [
            'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp', 'h', 'hpp',
            'cs', 'rb', 'go', 'rs', 'php', 'swift', 'kt', 'scala', 'sh', 'bash',
            'html', 'css', 'scss', 'sass', 'less', 'xml', 'json', 'yaml', 'yml',
            'sql', 'r', 'lua', 'pl', 'vim', 'asm'
        ];
        if (codeExtensions.includes(ext)) {
            return 'code';
        }

        // Archive files
        const archiveExtensions = ['zip', 'tar', 'gz', 'bz2', 'xz', '7z', 'rar', 'tgz'];
        if (archiveExtensions.includes(ext) || (mimeType && (mimeType.includes('zip') ||
            mimeType.includes('compressed') || mimeType.includes('archive')))) {
            return 'archive';
        }

        // Spreadsheet files
        const spreadsheetExtensions = ['xls', 'xlsx', 'csv', 'ods'];
        if (spreadsheetExtensions.includes(ext) || (mimeType && mimeType.includes('spreadsheet'))) {
            return 'spreadsheet';
        }

        return 'other';
    }

    /**
     * Get scan statistics
     */
    getStats() {
        return this.stats;
    }
}

module.exports = FileScanner;
