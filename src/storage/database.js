/**
 * Database Manager
 *
 * Manages dual storage backends (SQLite and JSON) for file metadata.
 * Provides a unified API for storing and querying file information
 * regardless of storage backend.
 *
 * Features:
 * - SQLite: Structured relational database with full-text search
 * - JSON: Flat file storage for portability and easy inspection
 * - Dual mode: Write to both simultaneously for redundancy
 * - Automatic schema management
 * - Type-specific metadata tables (image, video, audio, document, etc.)
 *
 * Storage modes:
 * - 'sqlite': Use only SQLite database (best performance for queries)
 * - 'json': Use only JSON file (portable, human-readable)
 * - 'both': Write to both backends (redundancy, flexibility)
 *
 * @see https://github.com/WiseLibs/better-sqlite3 - SQLite library
 */

const Database = require('better-sqlite3');
const fs = require('fs').promises;
const path = require('path');
const { sqliteSchema, metadataSchema, fileMetadataTemplate } = require('./schema');
const logger = require('../utils/logger');

class DatabaseManager {
    /**
     * Create a DatabaseManager instance
     *
     * Initializes storage properties to null.
     * Call init() to set up the actual storage backends.
     *
     * @example
     * const dbManager = require('./storage/database');
     * await dbManager.init({
     *   type: 'sqlite',
     *   dbPath: './data/metadata.db'
     * });
     */
    constructor() {
        this.db = null;
        this.config = null;
        this.jsonData = null;
    }

    /**
     * Initialize database with configuration
     *
     * Sets up one or both storage backends based on config.type.
     * Creates necessary directories and initializes schemas.
     *
     * @param {Object} config - Database configuration
     * @param {string} config.type - Storage type: 'sqlite', 'json', or 'both'
     * @param {string} [config.dbPath] - Path to SQLite database file (required if type includes 'sqlite')
     * @param {string} [config.jsonPath] - Path to JSON data file (required if type includes 'json')
     * @returns {Promise<void>} Resolves when initialization is complete
     *
     * @example
     * // SQLite only
     * await dbManager.init({
     *   type: 'sqlite',
     *   dbPath: './data/metadata.db'
     * });
     *
     * @example
     * // Both backends for redundancy
     * await dbManager.init({
     *   type: 'both',
     *   dbPath: './data/metadata.db',
     *   jsonPath: './data/metadata.json'
     * });
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
     *
     * Creates or opens an SQLite database file and configures it for optimal
     * performance and data integrity. Executes the full schema creation script
     * to set up all tables, indexes, and triggers.
     *
     * SQLite pragmas configured:
     * - WAL mode: Write-Ahead Logging for better concurrency and crash recovery
     * - Foreign keys: Enabled for referential integrity (CASCADE deletes)
     *
     * Schema includes:
     * - Main files table with FTS5 full-text search index
     * - Type-specific metadata tables (image, video, audio, code, etc.)
     * - EXIF data table (JSON storage for flexibility)
     * - Tags table for categorization
     *
     * @param {string} dbPath - Absolute or relative path to SQLite database file
     * @returns {Promise<void>} Resolves when database is initialized
     *
     * @see https://www.sqlite.org/wal.html - Write-Ahead Logging
     * @see https://www.sqlite.org/foreignkeys.html - Foreign key support
     *
     * @example
     * await dbManager.initSQLite('./data/metadata.db');
     * // Database created with full schema at ./data/metadata.db
     *
     * @private
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
     *
     * Main method for storing file metadata to the configured storage backend(s).
     * Handles both new files (INSERT) and existing files (UPDATE) automatically
     * using SQL UPSERT or array replacement for JSON.
     *
     * For SQLite:
     * - Inserts into main files table
     * - Routes type-specific metadata to appropriate tables
     * - Stores EXIF data as JSON
     * - Manages tags in separate table
     * - Uses transactions for atomicity
     *
     * For JSON:
     * - Adds or replaces file in files array
     * - Updates summary statistics
     * - Keeps data in memory (call saveJSON() to persist)
     *
     * @param {Object} fileData - Complete file information object
     * @param {string} fileData.path - Absolute file path (unique identifier)
     * @param {string} fileData.name - Filename with extension
     * @param {string} fileData.category - File category ('image', 'video', 'audio', etc.)
     * @param {Object} [fileData.metadata] - Type-specific metadata (image, video, font, etc.)
     * @param {Object} [fileData.hash] - File hashes (md5, sha256)
     * @param {string[]} [fileData.tags] - User tags for categorization
     * @returns {Promise<void>} Resolves when file is stored
     *
     * @example
     * await dbManager.upsertFile({
     *   path: '/photos/IMG_001.jpg',
     *   name: 'IMG_001.jpg',
     *   category: 'image',
     *   size: 2048576,
     *   metadata: {
     *     image: {
     *       width: 1920,
     *       height: 1080,
     *       exif: { make: 'Canon', ... }
     *     }
     *   },
     *   hash: { md5: '...', sha256: '...' },
     *   tags: ['vacation', '2024']
     * });
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

        // Store office document metadata if present (can be combined with document category)
        if (fileData.metadata?.office) {
            this.upsertOfficeMetadata(fileId, fileData.metadata.office);
        }

        // Store font metadata if present
        if (fileData.metadata?.font) {
            this.upsertFontMetadata(fileId, fileData.metadata.font);
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
     * Insert/update office document metadata
     */
    upsertOfficeMetadata(fileId, officeData) {
        const stmt = this.db.prepare(`
            INSERT INTO office_metadata (
                file_id, doc_type, page_count, word_count,
                sheet_count, slide_count, has_images, has_tables, has_formulas
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(file_id) DO UPDATE SET
                doc_type = excluded.doc_type,
                page_count = excluded.page_count,
                word_count = excluded.word_count,
                sheet_count = excluded.sheet_count,
                slide_count = excluded.slide_count,
                has_images = excluded.has_images,
                has_tables = excluded.has_tables,
                has_formulas = excluded.has_formulas
        `);

        stmt.run(
            fileId,
            officeData.docType,
            officeData.pageCount,
            officeData.wordCount,
            officeData.sheetCount,
            officeData.slideCount,
            officeData.hasImages ? 1 : 0,
            officeData.hasTables ? 1 : 0,
            officeData.hasFormulas ? 1 : 0
        );
    }

    /**
     * Insert/update font metadata
     */
    upsertFontMetadata(fileId, fontData) {
        const stmt = this.db.prepare(`
            INSERT INTO font_metadata (
                file_id, family, style, weight, format,
                glyph_count, languages
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(file_id) DO UPDATE SET
                family = excluded.family,
                style = excluded.style,
                weight = excluded.weight,
                format = excluded.format,
                glyph_count = excluded.glyph_count,
                languages = excluded.languages
        `);

        stmt.run(
            fileId,
            fontData.family,
            fontData.style,
            fontData.weight,
            fontData.format,
            fontData.glyphCount,
            JSON.stringify(fontData.languages || [])
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
     *
     * Retrieves complete file information for a single file by its path.
     * Returns the file record with all associated metadata.
     *
     * @param {string} filePath - Absolute file path to look up
     * @returns {Object|null} File object with metadata, or null if not found
     *
     * @example
     * const file = dbManager.getFile('/photos/IMG_001.jpg');
     * if (file) {
     *   console.log(`${file.name}: ${file.metadata.image.width}x${file.metadata.image.height}`);
     * }
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
     *
     * Searches for files matching the specified criteria.
     * Supports filtering by category, extension, size range, and result limits.
     *
     * Available filters:
     * - category: File type ('image', 'video', 'audio', 'code', etc.)
     * - extension: File extension without dot ('jpg', 'mp4', 'ttf')
     * - minSize: Minimum file size in bytes
     * - maxSize: Maximum file size in bytes
     * - limit: Maximum number of results to return
     *
     * For SQLite: Executes parameterized SQL query
     * For JSON: Filters in-memory array
     *
     * @param {Object} [filters={}] - Query filters
     * @param {string} [filters.category] - Filter by file category
     * @param {string} [filters.extension] - Filter by file extension
     * @param {number} [filters.minSize] - Minimum file size in bytes
     * @param {number} [filters.maxSize] - Maximum file size in bytes
     * @param {number} [filters.limit] - Maximum number of results
     * @returns {Object[]} Array of matching file objects with metadata
     *
     * @example
     * // Find large JPEGs
     * const largeImages = dbManager.queryFiles({
     *   category: 'image',
     *   extension: 'jpg',
     *   minSize: 1000000,
     *   limit: 100
     * });
     *
     * @example
     * // Find all fonts
     * const fonts = dbManager.queryFiles({ category: 'font' });
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
        const results = stmt.all(...params);

        // Transform snake_case to camelCase
        return results.map(row => this.transformSQLRow(row));
    }

    /**
     * Transform SQL row from snake_case to camelCase
     */
    transformSQLRow(row) {
        const file = {
            id: row.id,
            path: row.path,
            relativePath: row.relative_path,
            name: row.name,
            extension: row.extension,
            size: row.size,
            created: row.created,
            modified: row.modified,
            accessed: row.accessed,
            mimeType: row.mime_type,
            category: row.category,
            hash: {
                md5: row.md5_hash,
                sha256: row.sha256_hash
            },
            processing: {
                processedAt: row.processed_at,
                processingTime: row.processing_time,
                version: row.version
            }
        };

        // Fetch related metadata
        file.metadata = this.getFileMetadata(row.id, row.category);

        return file;
    }

    /**
     * Get metadata for a file based on category
     *
     * Retrieves type-specific metadata from the appropriate table(s)
     * and transforms database column names (snake_case) to JavaScript
     * property names (camelCase).
     *
     * Fetches from category-specific tables:
     * - code: language, line counts, complexity
     * - image: dimensions, color space, EXIF data
     * - video: duration, resolution, codecs
     * - audio: duration, bitrate, ID3 tags
     * - document: page count, word count, author
     * - archive: format, compression, file count
     *
     * Additionally checks for:
     * - office: Office document metadata (can coexist with document)
     * - font: Font metadata (family, glyphs, languages)
     *
     * @param {number} fileId - Database file ID
     * @param {string} category - File category ('image', 'video', 'code', etc.)
     * @returns {Object|null} Metadata object with category-specific properties, or null if no metadata found
     *
     * @example
     * const metadata = dbManager.getFileMetadata(123, 'image');
     * // Returns:
     * // {
     * //   image: {
     * //     width: 1920,
     * //     height: 1080,
     * //     aspectRatio: 1.777,
     * //     ...
     * //   }
     * // }
     *
     * @private
     */
    getFileMetadata(fileId, category) {
        const metadata = {};

        if (category === 'code') {
            const stmt = this.db.prepare('SELECT * FROM code_metadata WHERE file_id = ?');
            const codeData = stmt.get(fileId);
            if (codeData) {
                metadata.code = {
                    language: codeData.language,
                    linesTotal: codeData.lines_total,
                    linesCode: codeData.lines_code,
                    linesComment: codeData.lines_comment,
                    linesBlank: codeData.lines_blank,
                    complexity: codeData.complexity
                };
            }
        } else if (category === 'image') {
            const stmt = this.db.prepare('SELECT * FROM image_metadata WHERE file_id = ?');
            const imgData = stmt.get(fileId);
            if (imgData) {
                metadata.image = {
                    width: imgData.width,
                    height: imgData.height,
                    aspectRatio: imgData.aspect_ratio,
                    colorSpace: imgData.color_space,
                    bitDepth: imgData.bit_depth,
                    hasAlpha: imgData.has_alpha === 1,
                    perceptualHash: imgData.perceptual_hash
                };

                // Parse dominant colors if present
                if (imgData.dominant_colors) {
                    try {
                        metadata.image.dominantColors = JSON.parse(imgData.dominant_colors);
                    } catch (error) {
                        // Ignore malformed JSON
                    }
                }

                // Fetch EXIF data if available
                const exifStmt = this.db.prepare('SELECT data FROM exif_data WHERE file_id = ?');
                const exifRow = exifStmt.get(fileId);
                if (exifRow && exifRow.data) {
                    try {
                        metadata.image.exif = JSON.parse(exifRow.data);
                    } catch (error) {
                        // Ignore malformed JSON
                    }
                }
            }
        } else if (category === 'video') {
            const stmt = this.db.prepare('SELECT * FROM video_metadata WHERE file_id = ?');
            const vidData = stmt.get(fileId);
            if (vidData) {
                metadata.video = {
                    duration: vidData.duration,
                    width: vidData.width,
                    height: vidData.height,
                    frameRate: vidData.frame_rate,
                    bitrate: vidData.bitrate,
                    codec: vidData.codec,
                    format: vidData.format
                };
            }
        } else if (category === 'audio') {
            const stmt = this.db.prepare('SELECT * FROM audio_metadata WHERE file_id = ?');
            const audData = stmt.get(fileId);
            if (audData) {
                metadata.audio = {
                    duration: audData.duration,
                    bitrate: audData.bitrate,
                    sampleRate: audData.sample_rate,
                    channels: audData.channels,
                    codec: audData.codec,
                    tags: audData.tags ? JSON.parse(audData.tags) : null
                };
            }
        } else if (category === 'document') {
            const stmt = this.db.prepare('SELECT * FROM document_metadata WHERE file_id = ?');
            const docData = stmt.get(fileId);
            if (docData) {
                metadata.document = {
                    pageCount: docData.page_count,
                    wordCount: docData.word_count,
                    charCount: docData.char_count,
                    author: docData.author,
                    title: docData.title,
                    subject: docData.subject,
                    language: docData.language,
                    format: docData.format
                };
            }
        } else if (category === 'archive') {
            const stmt = this.db.prepare('SELECT * FROM archive_metadata WHERE file_id = ?');
            const archData = stmt.get(fileId);
            if (archData) {
                metadata.archive = {
                    format: archData.format,
                    compressed: archData.compressed === 1,
                    uncompressedSize: archData.uncompressed_size,
                    compressionRatio: archData.compression_ratio,
                    fileCount: archData.file_count,
                    encrypted: archData.encrypted === 1
                };
            }
        }

        // Check for office metadata (can exist alongside document metadata)
        const officeStmt = this.db.prepare('SELECT * FROM office_metadata WHERE file_id = ?');
        const officeData = officeStmt.get(fileId);
        if (officeData) {
            metadata.office = {
                docType: officeData.doc_type,
                pageCount: officeData.page_count,
                wordCount: officeData.word_count,
                sheetCount: officeData.sheet_count,
                slideCount: officeData.slide_count,
                hasImages: officeData.has_images === 1,
                hasTables: officeData.has_tables === 1,
                hasFormulas: officeData.has_formulas === 1
            };
        }

        // Check for font metadata
        const fontStmt = this.db.prepare('SELECT * FROM font_metadata WHERE file_id = ?');
        const fontData = fontStmt.get(fileId);
        if (fontData) {
            metadata.font = {
                family: fontData.family,
                style: fontData.style,
                weight: fontData.weight,
                format: fontData.format,
                glyphCount: fontData.glyph_count,
                languages: fontData.languages ? JSON.parse(fontData.languages) : []
            };
        }

        return Object.keys(metadata).length > 0 ? metadata : null;
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
     *
     * Writes the in-memory JSON data to disk with pretty-printing (2-space indentation).
     * Only executes if JSON storage is configured.
     *
     * @returns {Promise<void>} Resolves when file is written
     *
     * @example
     * // After making changes to JSON data
     * await dbManager.saveJSON();
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
     *
     * Properly shuts down all storage backends:
     * - Closes SQLite database connection (flushes WAL)
     * - Saves JSON data to disk
     *
     * Always call this method before application exit to ensure:
     * - All pending writes are flushed
     * - Database file is not corrupted
     * - JSON changes are persisted
     *
     * @returns {Promise<void>} Resolves when all storage is closed
     *
     * @example
     * // At application shutdown
     * await dbManager.close();
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
