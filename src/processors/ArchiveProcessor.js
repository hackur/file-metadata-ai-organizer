/**
 * Archive Processor
 * Analyzes archive files (ZIP, TAR, GZ, etc.)
 */

const BaseProcessor = require('./BaseProcessor');
const unzipper = require('unzipper');
const tar = require('tar');
const fs = require('fs');
const path = require('path');

class ArchiveProcessor extends BaseProcessor {
    canProcess(fileInfo) {
        return fileInfo.category === 'archive';
    }

    async process(fileInfo) {
        const startTime = Date.now();
        this.logStart(fileInfo);

        try {
            if (!await this.validate(fileInfo)) {
                return fileInfo;
            }

            if (!fileInfo.metadata) fileInfo.metadata = {};
            fileInfo.metadata.archive = {};

            // Determine archive type and extract metadata
            const ext = fileInfo.extension.toLowerCase();

            if (['zip', 'jar', 'war', 'ear'].includes(ext)) {
                await this.extractZipMetadata(fileInfo);
            } else if (['tar', 'tgz', 'gz', 'bz2', 'xz'].includes(ext)) {
                await this.extractTarMetadata(fileInfo);
            }

            const duration = Date.now() - startTime;
            fileInfo.processing = {
                processedAt: new Date().toISOString(),
                processingTime: duration,
                version: '1.0.0',
                errors: []
            };

            this.logComplete(fileInfo, duration);
            return fileInfo;

        } catch (error) {
            return this.handleError(fileInfo, error);
        }
    }

    /**
     * Extract ZIP archive metadata
     */
    async extractZipMetadata(fileInfo) {
        return new Promise((resolve, reject) => {
            const files = [];
            let totalUncompressedSize = 0;
            let totalCompressedSize = 0;

            fs.createReadStream(fileInfo.path)
                .pipe(unzipper.Parse())
                .on('entry', (entry) => {
                    const fileName = entry.path;
                    const type = entry.type;
                    const size = entry.vars.uncompressedSize;
                    const compressedSize = entry.vars.compressedSize;

                    if (type === 'File') {
                        files.push({
                            path: fileName,
                            size: size,
                            compressedSize: compressedSize,
                            compressionMethod: entry.vars.compressionMethod
                        });

                        totalUncompressedSize += size;
                        totalCompressedSize += compressedSize;
                    }

                    entry.autodrain();
                })
                .on('finish', () => {
                    fileInfo.metadata.archive.format = fileInfo.extension.toUpperCase();
                    fileInfo.metadata.archive.compressed = true;
                    fileInfo.metadata.archive.fileCount = files.length;
                    fileInfo.metadata.archive.uncompressedSize = totalUncompressedSize;
                    fileInfo.metadata.archive.compressionRatio = totalUncompressedSize > 0
                        ? (1 - (totalCompressedSize / totalUncompressedSize)) * 100
                        : 0;

                    // Store file list (limited)
                    const maxFiles = this.config.maxFilesToList || 100;
                    fileInfo.metadata.archive.files = files.slice(0, maxFiles).map(f => f.path);

                    if (files.length > maxFiles) {
                        fileInfo.metadata.archive.filesListTruncated = true;
                    }

                    resolve();
                })
                .on('error', reject);
        });
    }

    /**
     * Extract TAR archive metadata
     */
    async extractTarMetadata(fileInfo) {
        const files = [];
        let totalSize = 0;

        try {
            await tar.list({
                file: fileInfo.path,
                onentry: (entry) => {
                    if (entry.type === 'File') {
                        files.push({
                            path: entry.path,
                            size: entry.size
                        });
                        totalSize += entry.size;
                    }
                }
            });

            fileInfo.metadata.archive.format = fileInfo.extension.toUpperCase();
            fileInfo.metadata.archive.compressed = ['tgz', 'gz', 'bz2', 'xz'].includes(fileInfo.extension);
            fileInfo.metadata.archive.fileCount = files.length;
            fileInfo.metadata.archive.uncompressedSize = totalSize;

            // Store file list (limited)
            const maxFiles = this.config.maxFilesToList || 100;
            fileInfo.metadata.archive.files = files.slice(0, maxFiles).map(f => f.path);

            if (files.length > maxFiles) {
                fileInfo.metadata.archive.filesListTruncated = true;
            }

        } catch (error) {
            throw new Error(`Failed to extract TAR metadata: ${error.message}`);
        }
    }

    getSupportedExtensions() {
        return ['zip', 'tar', 'gz', 'tgz', 'bz2', 'xz', '7z', 'rar', 'jar', 'war', 'ear'];
    }

    getSupportedMimeTypes() {
        return [
            'application/zip',
            'application/x-tar',
            'application/gzip',
            'application/x-gzip',
            'application/x-bzip2',
            'application/x-7z-compressed',
            'application/x-rar-compressed'
        ];
    }
}

module.exports = ArchiveProcessor;
