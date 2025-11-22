/**
 * Database Schema Definitions
 * Defines the structure for storing file metadata in JSON and SQLite
 */

/**
 * JSON Schema for metadata storage
 */
const metadataSchema = {
    version: '1.0.0',
    generatedAt: null,
    directory: null,
    summary: {
        totalFiles: 0,
        totalSize: 0,
        fileTypes: {},
        scannedAt: null,
        scanDuration: 0
    },
    files: []
};

/**
 * File metadata structure
 */
const fileMetadataTemplate = {
    // Basic info
    path: null,
    relativePath: null,
    name: null,
    extension: null,
    size: 0,
    sizeFormatted: null,

    // Timestamps
    created: null,
    modified: null,
    accessed: null,

    // File identification
    mimeType: null,
    category: null, // 'image', 'video', 'audio', 'document', 'code', 'archive', 'other'
    hash: {
        md5: null,
        sha256: null
    },

    // Type-specific metadata
    metadata: {
        // For images
        image: {
            width: null,
            height: null,
            aspectRatio: null,
            colorSpace: null,
            dpi: null,
            bitDepth: null,
            hasAlpha: null,
            dominantColors: [],
            exif: {},
            iptc: {},
            xmp: {},
            perceptualHash: null,
            thumbnail: null
        },

        // For videos
        video: {
            duration: null,
            width: null,
            height: null,
            frameRate: null,
            codec: null,
            bitrate: null,
            audioCodec: null,
            container: null,
            streams: [],
            keyframes: []
        },

        // For audio
        audio: {
            duration: null,
            bitrate: null,
            sampleRate: null,
            channels: null,
            codec: null,
            format: null,
            tags: {
                title: null,
                artist: null,
                album: null,
                year: null,
                genre: null,
                track: null,
                albumArtist: null,
                composer: null
            },
            artwork: null
        },

        // For documents
        document: {
            pageCount: null,
            wordCount: null,
            charCount: null,
            author: null,
            title: null,
            subject: null,
            keywords: [],
            createdBy: null,
            modifiedBy: null,
            textContent: null,
            language: null,
            format: null
        },

        // For code files
        code: {
            language: null,
            linesTotal: null,
            linesCode: null,
            linesComment: null,
            linesBlank: null,
            complexity: null,
            functions: [],
            classes: [],
            imports: [],
            exports: []
        },

        // For archives
        archive: {
            format: null,
            compressed: null,
            uncompressedSize: null,
            compressionRatio: null,
            fileCount: null,
            encrypted: null,
            files: []
        }
    },

    // Analysis results
    analysis: {
        readability: null,
        sentiment: null,
        keywords: [],
        entities: [],
        summary: null
    },

    // Relationships
    relationships: {
        dependencies: [],
        references: [],
        similarFiles: []
    },

    // Tags and classification
    tags: [],
    labels: [],

    // LLM-specific
    llm: {
        embedding: null,
        summary: null,
        context: null,
        importance: 0
    },

    // Processing metadata
    processing: {
        processedAt: null,
        processingTime: null,
        version: '1.0.0',
        errors: []
    }
};

/**
 * SQLite schema
 */
const sqliteSchema = `
-- Main files table
CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT UNIQUE NOT NULL,
    relative_path TEXT NOT NULL,
    name TEXT NOT NULL,
    extension TEXT,
    size INTEGER,
    created TEXT,
    modified TEXT,
    accessed TEXT,
    mime_type TEXT,
    category TEXT,
    md5_hash TEXT,
    sha256_hash TEXT,
    processed_at TEXT,
    processing_time REAL,
    version TEXT,
    UNIQUE(path)
);

-- Image metadata
CREATE TABLE IF NOT EXISTS image_metadata (
    file_id INTEGER PRIMARY KEY,
    width INTEGER,
    height INTEGER,
    aspect_ratio REAL,
    color_space TEXT,
    dpi INTEGER,
    bit_depth INTEGER,
    has_alpha BOOLEAN,
    dominant_colors TEXT,
    perceptual_hash TEXT,
    thumbnail_path TEXT,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

-- Video metadata
CREATE TABLE IF NOT EXISTS video_metadata (
    file_id INTEGER PRIMARY KEY,
    duration REAL,
    width INTEGER,
    height INTEGER,
    frame_rate REAL,
    codec TEXT,
    bitrate INTEGER,
    audio_codec TEXT,
    container TEXT,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

-- Audio metadata
CREATE TABLE IF NOT EXISTS audio_metadata (
    file_id INTEGER PRIMARY KEY,
    duration REAL,
    bitrate INTEGER,
    sample_rate INTEGER,
    channels INTEGER,
    codec TEXT,
    format TEXT,
    title TEXT,
    artist TEXT,
    album TEXT,
    year INTEGER,
    genre TEXT,
    track INTEGER,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

-- Document metadata
CREATE TABLE IF NOT EXISTS document_metadata (
    file_id INTEGER PRIMARY KEY,
    page_count INTEGER,
    word_count INTEGER,
    char_count INTEGER,
    author TEXT,
    title TEXT,
    subject TEXT,
    language TEXT,
    format TEXT,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

-- Code metadata
CREATE TABLE IF NOT EXISTS code_metadata (
    file_id INTEGER PRIMARY KEY,
    language TEXT,
    lines_total INTEGER,
    lines_code INTEGER,
    lines_comment INTEGER,
    lines_blank INTEGER,
    complexity INTEGER,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

-- Archive metadata
CREATE TABLE IF NOT EXISTS archive_metadata (
    file_id INTEGER PRIMARY KEY,
    format TEXT,
    compressed BOOLEAN,
    uncompressed_size INTEGER,
    compression_ratio REAL,
    file_count INTEGER,
    encrypted BOOLEAN,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

-- Tags
CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER,
    tag TEXT NOT NULL,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

-- Relationships
CREATE TABLE IF NOT EXISTS relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER,
    related_file_id INTEGER,
    relationship_type TEXT,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
    FOREIGN KEY (related_file_id) REFERENCES files(id) ON DELETE CASCADE
);

-- EXIF data (stored as JSON)
CREATE TABLE IF NOT EXISTS exif_data (
    file_id INTEGER PRIMARY KEY,
    data TEXT,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

-- Full text search virtual table
CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(
    name,
    path,
    content,
    tags,
    content=files,
    content_rowid=id
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_files_category ON files(category);
CREATE INDEX IF NOT EXISTS idx_files_extension ON files(extension);
CREATE INDEX IF NOT EXISTS idx_files_mime_type ON files(mime_type);
CREATE INDEX IF NOT EXISTS idx_files_modified ON files(modified);
CREATE INDEX IF NOT EXISTS idx_files_size ON files(size);
CREATE INDEX IF NOT EXISTS idx_tags_tag ON tags(tag);
CREATE INDEX IF NOT EXISTS idx_relationships_type ON relationships(relationship_type);
`;

module.exports = {
    metadataSchema,
    fileMetadataTemplate,
    sqliteSchema
};
