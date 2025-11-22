/**
 * Database Manager
 * Handles both SQLite and JSON storage for file metadata
 */

const Database = require('better-sqlite3');
const fs = require('fs').promises;
const path = require('path');
const { sqliteSchema, metadataSchema, fileMetadataTemplate } = require('./schema');
const logger = require('../utils/logger');

class DatabaseManager {
    constructor() {
        this.db = null;
        this.config = null;
        this.jsonData = null;
    }

    /**
     * Initialize database with configuration
     */
    async init(config) {
        this.config = config;

        if (config.type === 'sqlite' || config.type === 'both') {
            await this.initSQLite(config.dbPath);
        }

        if (config.type === 'json' || config.type === 'both') {
            await this.initJSON(config.jsonPath);
        }

        logger.info('Database initialized', { type: config.type });
    }

    /**
     * Initialize SQLite database
     */
    async initSQLite(dbPath) {
        const dbDir = path.dirname(dbPath);
        await fs.mkdir(dbDir, { recursive: true });

        this.db = new Database(dbPath);
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('foreign_keys = ON');

        // Create schema
        this.db.exec(sqliteSchema);

        logger.info('SQLite database initialized', { path: dbPath });
    }

    /**
     * Initialize JSON storage
     */
    async initJSON(jsonPath) {
        const jsonDir = path.dirname(jsonPath);
        await fs.mkdir(jsonDir, { recursive: true });

        try {
            const content = await fs.readFile(jsonPath, 'utf8');
            this.jsonData = JSON.parse(content);
        } catch (error) {
            this.jsonData = {
                ...metadataSchema,
                generatedAt: new Date().toISOString()
            };
        }

        logger.info('JSON storage initialized', { path: jsonPath });
    }

    /**
     * Insert or update file metadata
     */
    async upsertFile(fileData) {
        if (this.db) {
            await this.upsertFileSQL(fileData);
        }

        if (this.jsonData) {
            this.upsertFileJSON(fileData);
        }
    }

    /**
     * Insert/update file in SQLite
     */
    async upsertFileSQL(fileData) {
        const stmt = this.db.prepare(`
            INSERT INTO files (
                path, relative_path, name, extension, size,
                created, modified, accessed, mime_type, category,
                md5_hash, sha256_hash, processed_at, processing_time, version
            ) VALUES (
                @path, @relativePath, @name, @extension, @size,
                @created, @modified, @accessed, @mimeType, @category,
                @md5Hash, @sha256Hash, @processedAt, @processingTime, @version
            )
            ON CONFLICT(path) DO UPDATE SET
                size = @size,
                modified = @modified,
                accessed = @accessed,
                mime_type = @mimeType,
                category = @category,
                md5_hash = @md5Hash,
                sha256_hash = @sha256Hash,
                processed_at = @processedAt,
                processing_time = @processingTime
        `);

        const info = stmt.run({
            path: fileData.path,
            relativePath: fileData.relativePath,
            name: fileData.name,
            extension: fileData.extension,
            size: fileData.size,
            created: fileData.created,
            modified: fileData.modified,
            accessed: fileData.accessed,
            mimeType: fileData.mimeType,
            category: fileData.category,
            md5Hash: fileData.hash?.md5,
            sha256Hash: fileData.hash?.sha256,
            processedAt: fileData.processing?.processedAt,
            processingTime: fileData.processing?.processingTime,
            version: fileData.processing?.version
        });

        const fileId = info.lastInsertRowid || this.getFileId(fileData.path);

        // Insert type-specific metadata
        if (fileData.category === 'image' && fileData.metadata?.image) {
            this.upsertImageMetadata(fileId, fileData.metadata.image);
        } else if (fileData.category === 'video' && fileData.metadata?.video) {
            this.upsertVideoMetadata(fileId, fileData.metadata.video);
        } else if (fileData.category === 'audio' && fileData.metadata?.audio) {
            this.upsertAudioMetadata(fileId, fileData.metadata.audio);
        } else if (fileData.category === 'document' && fileData.metadata?.document) {
            this.upsertDocumentMetadata(fileId, fileData.metadata.document);
        } else if (fileData.category === 'code' && fileData.metadata?.code) {
            this.upsertCodeMetadata(fileId, fileData.metadata.code);
        } else if (fileData.category === 'archive' && fileData.metadata?.archive) {
            this.upsertArchiveMetadata(fileId, fileData.metadata.archive);
        }

        // Insert tags
        if (fileData.tags && fileData.tags.length > 0) {
            this.upsertTags(fileId, fileData.tags);
        }

        return fileId;
    }

    /**
     * Get file ID by path
     */
    getFileId(filePath) {
        const stmt = this.db.prepare('SELECT id FROM files WHERE path = ?');
        const row = stmt.get(filePath);
        return row ? row.id : null;
    }

    /**
     * Insert/update image metadata
     */
    upsertImageMetadata(fileId, imageData) {
        const stmt = this.db.prepare(`
            INSERT INTO image_metadata (
                file_id, width, height, aspect_ratio, color_space,
                dpi, bit_depth, has_alpha, dominant_colors,
                perceptual_hash, thumbnail_path
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(file_id) DO UPDATE SET
                width = excluded.width,
                height = excluded.height,
                aspect_ratio = excluded.aspect_ratio,
                color_space = excluded.color_space,
                dpi = excluded.dpi,
                bit_depth = excluded.bit_depth,
                has_alpha = excluded.has_alpha,
                dominant_colors = excluded.dominant_colors,
                perceptual_hash = excluded.perceptual_hash,
                thumbnail_path = excluded.thumbnail_path
        `);

        stmt.run(
            fileId,
            imageData.width,
            imageData.height,
            imageData.aspectRatio,
            imageData.colorSpace,
            imageData.dpi,
            imageData.bitDepth,
            imageData.hasAlpha ? 1 : 0,
            JSON.stringify(imageData.dominantColors || []),
            imageData.perceptualHash,
            imageData.thumbnail
        );

        // Store EXIF data if present
        if (imageData.exif && Object.keys(imageData.exif).length > 0) {
            this.upsertExifData(fileId, imageData.exif);
        }
    }

    /**
     * Insert/update video metadata
     */
    upsertVideoMetadata(fileId, videoData) {
        const stmt = this.db.prepare(`
            INSERT INTO video_metadata (
                file_id, duration, width, height, frame_rate,
                codec, bitrate, audio_codec, container
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(file_id) DO UPDATE SET
                duration = excluded.duration,
                width = excluded.width,
                height = excluded.height,
                frame_rate = excluded.frame_rate,
                codec = excluded.codec,
                bitrate = excluded.bitrate,
                audio_codec = excluded.audio_codec,
                container = excluded.container
        `);

        stmt.run(
            fileId,
            videoData.duration,
            videoData.width,
            videoData.height,
            videoData.frameRate,
            videoData.codec,
            videoData.bitrate,
            videoData.audioCodec,
            videoData.container
        );
    }

    /**
     * Insert/update audio metadata
     */
    upsertAudioMetadata(fileId, audioData) {
        const stmt = this.db.prepare(`
            INSERT INTO audio_metadata (
                file_id, duration, bitrate, sample_rate, channels,
                codec, format, title, artist, album, year, genre, track
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(file_id) DO UPDATE SET
                duration = excluded.duration,
                bitrate = excluded.bitrate,
                sample_rate = excluded.sample_rate,
                channels = excluded.channels,
                codec = excluded.codec,
                format = excluded.format,
                title = excluded.title,
                artist = excluded.artist,
                album = excluded.album,
                year = excluded.year,
                genre = excluded.genre,
                track = excluded.track
        `);

        stmt.run(
            fileId,
            audioData.duration,
            audioData.bitrate,
            audioData.sampleRate,
            audioData.channels,
            audioData.codec,
            audioData.format,
            audioData.tags?.title,
            audioData.tags?.artist,
            audioData.tags?.album,
            audioData.tags?.year,
            audioData.tags?.genre,
            audioData.tags?.track
        );
    }

    /**
     * Insert/update document metadata
     */
    upsertDocumentMetadata(fileId, docData) {
        const stmt = this.db.prepare(`
            INSERT INTO document_metadata (
                file_id, page_count, word_count, char_count,
                author, title, subject, language, format
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(file_id) DO UPDATE SET
                page_count = excluded.page_count,
                word_count = excluded.word_count,
                char_count = excluded.char_count,
                author = excluded.author,
                title = excluded.title,
                subject = excluded.subject,
                language = excluded.language,
                format = excluded.format
        `);

        stmt.run(
            fileId,
            docData.pageCount,
            docData.wordCount,
            docData.charCount,
            docData.author,
            docData.title,
            docData.subject,
            docData.language,
            docData.format
        );
    }

    /**
     * Insert/update code metadata
     */
    upsertCodeMetadata(fileId, codeData) {
        const stmt = this.db.prepare(`
            INSERT INTO code_metadata (
                file_id, language, lines_total, lines_code,
                lines_comment, lines_blank, complexity
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(file_id) DO UPDATE SET
                language = excluded.language,
                lines_total = excluded.lines_total,
                lines_code = excluded.lines_code,
                lines_comment = excluded.lines_comment,
                lines_blank = excluded.lines_blank,
                complexity = excluded.complexity
        `);

        stmt.run(
            fileId,
            codeData.language,
            codeData.linesTotal,
            codeData.linesCode,
            codeData.linesComment,
            codeData.linesBlank,
            codeData.complexity
        );
    }

    /**
     * Insert/update archive metadata
     */
    upsertArchiveMetadata(fileId, archiveData) {
        const stmt = this.db.prepare(`
            INSERT INTO archive_metadata (
                file_id, format, compressed, uncompressed_size,
                compression_ratio, file_count, encrypted
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(file_id) DO UPDATE SET
                format = excluded.format,
                compressed = excluded.compressed,
                uncompressed_size = excluded.uncompressed_size,
                compression_ratio = excluded.compression_ratio,
                file_count = excluded.file_count,
                encrypted = excluded.encrypted
        `);

        stmt.run(
            fileId,
            archiveData.format,
            archiveData.compressed ? 1 : 0,
            archiveData.uncompressedSize,
            archiveData.compressionRatio,
            archiveData.fileCount,
            archiveData.encrypted ? 1 : 0
        );
    }

    /**
     * Insert/update EXIF data
     */
    upsertExifData(fileId, exifData) {
        const stmt = this.db.prepare(`
            INSERT INTO exif_data (file_id, data)
            VALUES (?, ?)
            ON CONFLICT(file_id) DO UPDATE SET data = excluded.data
        `);

        stmt.run(fileId, JSON.stringify(exifData));
    }

    /**
     * Insert/update tags
     */
    upsertTags(fileId, tags) {
        // Delete existing tags
        const deleteStmt = this.db.prepare('DELETE FROM tags WHERE file_id = ?');
        deleteStmt.run(fileId);

        // Insert new tags
        const insertStmt = this.db.prepare('INSERT INTO tags (file_id, tag) VALUES (?, ?)');
        const insertMany = this.db.transaction((tags) => {
            for (const tag of tags) {
                insertStmt.run(fileId, tag);
            }
        });

        insertMany(tags);
    }

    /**
     * Insert/update file in JSON
     */
    upsertFileJSON(fileData) {
        const existingIndex = this.jsonData.files.findIndex(f => f.path === fileData.path);

        if (existingIndex >= 0) {
            this.jsonData.files[existingIndex] = fileData;
        } else {
            this.jsonData.files.push(fileData);
        }

        // Update summary
        this.updateJSONSummary();
    }

    /**
     * Update JSON summary statistics
     */
    updateJSONSummary() {
        this.jsonData.summary.totalFiles = this.jsonData.files.length;
        this.jsonData.summary.totalSize = this.jsonData.files.reduce((sum, f) => sum + (f.size || 0), 0);

        const fileTypes = {};
        this.jsonData.files.forEach(f => {
            const ext = f.extension || 'unknown';
            fileTypes[ext] = (fileTypes[ext] || 0) + 1;
        });
        this.jsonData.summary.fileTypes = fileTypes;
        this.jsonData.summary.scannedAt = new Date().toISOString();
    }

    /**
     * Get file by path
     */
    getFile(filePath) {
        if (this.db) {
            const stmt = this.db.prepare('SELECT * FROM files WHERE path = ?');
            return stmt.get(filePath);
        }

        if (this.jsonData) {
            return this.jsonData.files.find(f => f.path === filePath);
        }

        return null;
    }

    /**
     * Query files with filters
     */
    queryFiles(filters = {}) {
        if (this.db) {
            return this.queryFilesSQL(filters);
        }

        if (this.jsonData) {
            return this.queryFilesJSON(filters);
        }

        return [];
    }

    /**
     * Query files from SQLite
     */
    queryFilesSQL(filters) {
        let query = 'SELECT * FROM files WHERE 1=1';
        const params = [];

        if (filters.category) {
            query += ' AND category = ?';
            params.push(filters.category);
        }

        if (filters.extension) {
            query += ' AND extension = ?';
            params.push(filters.extension);
        }

        if (filters.minSize) {
            query += ' AND size >= ?';
            params.push(filters.minSize);
        }

        if (filters.maxSize) {
            query += ' AND size <= ?';
            params.push(filters.maxSize);
        }

        if (filters.limit) {
            query += ' LIMIT ?';
            params.push(filters.limit);
        }

        const stmt = this.db.prepare(query);
        return stmt.all(...params);
    }

    /**
     * Query files from JSON
     */
    queryFilesJSON(filters) {
        let results = this.jsonData.files;

        if (filters.category) {
            results = results.filter(f => f.category === filters.category);
        }

        if (filters.extension) {
            results = results.filter(f => f.extension === filters.extension);
        }

        if (filters.minSize) {
            results = results.filter(f => f.size >= filters.minSize);
        }

        if (filters.maxSize) {
            results = results.filter(f => f.size <= filters.maxSize);
        }

        if (filters.limit) {
            results = results.slice(0, filters.limit);
        }

        return results;
    }

    /**
     * Save JSON data to file
     */
    async saveJSON() {
        if (this.jsonData && this.config.jsonPath) {
            const content = JSON.stringify(this.jsonData, null, 2);
            await fs.writeFile(this.config.jsonPath, content, 'utf8');
            logger.info('JSON data saved', { path: this.config.jsonPath });
        }
    }

    /**
     * Close database connections
     */
    async close() {
        if (this.db) {
            this.db.close();
            logger.info('SQLite database closed');
        }

        await this.saveJSON();
    }
}

module.exports = new DatabaseManager();
