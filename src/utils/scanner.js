/**
 * File Scanner with Incremental Support
 * Scans directories and detects file changes for incremental processing
 */

const fs = require('fs').promises;
const path = require('path');
const { createReadStream } = require('fs');
const mime = require('mime-types');
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
     */
    async processFile(baseDir, filePath, incrementalScanning) {
        try {
            const stats = await fs.stat(filePath);
            this.stats.totalFiles++;

            const fileInfo = {
                path: filePath,
                relativePath: path.relative(baseDir, filePath),
                name: path.basename(filePath),
                extension: path.extname(filePath).slice(1).toLowerCase(),
                size: stats.size,
                created: stats.birthtime.toISOString(),
                modified: stats.mtime.toISOString(),
                accessed: stats.atime.toISOString(),
                mimeType: mime.lookup(filePath) || 'application/octet-stream',
                category: this.categorizeFile(filePath)
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
     * Categorize file by type
     */
    categorizeFile(filePath) {
        const ext = path.extname(filePath).slice(1).toLowerCase();
        const mimeType = mime.lookup(filePath) || '';

        // Image files
        if (mimeType.startsWith('image/')) {
            return 'image';
        }

        // Video files
        if (mimeType.startsWith('video/')) {
            return 'video';
        }

        // Audio files
        if (mimeType.startsWith('audio/')) {
            return 'audio';
        }

        // Document files
        const docExtensions = ['pdf', 'doc', 'docx', 'odt', 'rtf', 'txt', 'md', 'epub', 'mobi'];
        if (docExtensions.includes(ext) || mimeType.startsWith('application/pdf') ||
            mimeType.includes('document') || mimeType.includes('text')) {
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
        if (archiveExtensions.includes(ext) || mimeType.includes('zip') ||
            mimeType.includes('compressed') || mimeType.includes('archive')) {
            return 'archive';
        }

        // Spreadsheet files
        const spreadsheetExtensions = ['xls', 'xlsx', 'csv', 'ods'];
        if (spreadsheetExtensions.includes(ext) || mimeType.includes('spreadsheet')) {
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
