# Architecture Documentation

## System Overview

The File Metadata AI Organizer is a modular, extensible system for extracting, storing, and querying metadata from various file types. It follows a processor-based architecture with clear separation of concerns.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLI Interface                            │
│                     (Commander.js based)                         │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MetadataAnalyzer                              │
│              (Orchestrates the entire workflow)                  │
└─────┬───────────────────────────────┬──────────────────────────┘
      │                               │
      ▼                               ▼
┌────────────────┐            ┌────────────────────────┐
│  FileScanner   │            │  ProcessorManager      │
│  - Recursive   │            │  - 9 Processors        │
│  - Incremental │            │  - Template Method     │
│  - MIME detect │            │  - Parallel execution  │
└────────┬───────┘            └──────────┬─────────────┘
         │                               │
         ▼                               ▼
┌────────────────────────────────────────────────────────┐
│              Database Manager (SQLite)                  │
│  - Normalized schema (12 tables)                       │
│  - Transactions                                         │
│  - Full-text search (FTS5)                             │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                   Query API                              │
│  - Filter, search, sort                                 │
│  - Multiple export formats                              │
└─────────────────────────────────────────────────────────┘
```

## Component Diagrams

### 1. Processor Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                      BaseProcessor                              │
│  (Abstract template method pattern)                            │
│                                                                 │
│  + validate(fileInfo): boolean                                 │
│  + process(fileInfo): Promise<Object>                          │
│  # initializeMetadata(fileInfo): void                          │
│  # logStart(fileInfo): void                                    │
│  # logComplete(fileInfo, duration): void                       │
│  # handleError(fileInfo, error): Object                        │
└────┬───────────────────────────────────────────────────────────┘
     │
     │ Inherits
     ├──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┐
     │      │      │      │      │      │      │      │      │
     ▼      ▼      ▼      ▼      ▼      ▼      ▼      ▼      ▼
┌────────┐┌────┐┌──────┐┌─────┐┌──────┐┌────┐┌───────┐┌─────┐┌────────┐
│Image   ││Video││Audio ││Code ││Archive││PDF ││Office ││Font ││Markdown│
│Processor││    ││      ││     ││       ││    ││       ││     ││        │
└────────┘└────┘└──────┘└─────┘└──────┘└────┘└───────┘└─────┘└────────┘
```

**Template Method Pattern Benefits:**
- Consistent error handling across all processors
- Standardized logging and timing
- Extensible: new processors inherit common functionality
- Reference: [Template Method Pattern - GoF Design Patterns](https://en.wikipedia.org/wiki/Template_method_pattern)

### 2. Data Flow Diagram

```
User Input (Directory Path)
        │
        ▼
┌──────────────────┐
│  Configuration   │  ← Config file (.fmaorc)
│  Validation      │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│           FileScanner                        │
│                                              │
│  1. readdir() recursive traversal           │
│  2. Check .ignore patterns                  │
│  3. Detect MIME (extension + magic number)  │
│  4. Categorize (image/video/audio/etc.)     │
│  5. Check if needs processing (incremental) │
│  6. Calculate hashes (MD5, SHA256)          │
└────────┬─────────────────────────────────────┘
         │
         ▼
   [File Queue]
         │
         ▼
┌──────────────────────────────────────────────┐
│      ProcessorManager                        │
│                                              │
│  - Select appropriate processor by category  │
│  - Execute with concurrency control          │
│  - Collect results                           │
└────────┬─────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│      Individual Processor                    │
│                                              │
│  Examples:                                   │
│  • ImageProcessor                            │
│    - sharp: dimensions, color space          │
│    - exifr: EXIF, GPS, camera info          │
│    - perceptual hash for similarity         │
│                                              │
│  • FontProcessor                             │
│    - fontkit: family, glyphs, features      │
│    - character coverage analysis            │
│                                              │
│  • AudioProcessor                            │
│    - music-metadata: ID3, duration, codec   │
└────────┬─────────────────────────────────────┘
         │
         │ Metadata Object
         ▼
┌──────────────────────────────────────────────┐
│      Database Manager                        │
│                                              │
│  1. Begin transaction                        │
│  2. Insert/update main files table          │
│  3. Insert/update category-specific metadata│
│  4. Insert/update EXIF data (JSON blob)     │
│  5. Update FTS index                         │
│  6. Commit transaction                       │
└────────┬─────────────────────────────────────┘
         │
         ▼
    [SQLite DB]
         │
         ▼
┌──────────────────────────────────────────────┐
│         Query API / Export                   │
│                                              │
│  - Filtering, searching, sorting            │
│  - JSON/CSV/HTML export                     │
│  - LLM context generation                   │
└──────────────────────────────────────────────┘
```

### 3. Database Schema

```
┌──────────────────┐
│      files       │  ← Main table
│──────────────────│
│ id (PK)          │
│ path (UNIQUE)    │
│ name             │
│ extension        │
│ size             │
│ created          │
│ modified         │
│ mime_type        │
│ category         │
│ md5_hash         │
│ sha256_hash      │
│ processed_at     │
└────────┬─────────┘
         │
         │ 1:1 relationships (file_id FK)
         ├─────────────────┬─────────────────┬──────────────┐
         │                 │                 │              │
         ▼                 ▼                 ▼              ▼
┌────────────────┐ ┌────────────────┐ ┌──────────┐ ┌────────────┐
│image_metadata  │ │video_metadata  │ │  ...     │ │exif_data   │
│────────────────│ │────────────────│ │──────────│ │────────────│
│file_id (PK,FK) │ │file_id (PK,FK) │ │file_id   │ │file_id (PK)│
│width           │ │duration        │ │...       │ │data (JSON) │
│height          │ │width           │ │          │ └────────────┘
│aspect_ratio    │ │height          │ │          │
│color_space     │ │frame_rate      │ └──────────┘
│dominant_colors │ │codec           │
│perceptual_hash │ │...             │
└────────────────┘ └────────────────┘

         ┌─────────────────┐
         │  files_fts      │  ← Full-text search (FTS5)
         │─────────────────│
         │ name            │
         │ path            │
         │ content         │
         │ tags            │
         └─────────────────┘

         ┌─────────────────┐        ┌─────────────────┐
         │     tags        │        │ relationships   │
         │─────────────────│        │─────────────────│
         │ file_id (FK)    │        │ file_id (FK)    │
         │ tag             │        │ related_id (FK) │
         └─────────────────┘        │ type            │
                                    └─────────────────┘
```

**Schema Design Principles:**
- **Normalization:** Separate tables for each file type's metadata (3NF)
- **Foreign Keys:** CASCADE DELETE ensures orphaned records are cleaned up
- **Indexes:** Created on frequently queried columns (category, extension, modified)
- **JSON Storage:** Complex nested data (EXIF, features) stored as JSON TEXT
- **FTS5:** Full-text search without external dependencies
- Reference: [SQLite FTS5](https://www.sqlite.org/fts5.html)

### 4. File Processing State Machine

```
                    START
                      │
                      ▼
             ┌────────────────┐
             │ Scan Directory │
             └────────┬───────┘
                      │
                      ▼
            ┌──────────────────┐
            │ Check Incremental│────► [File unchanged]──► SKIP
            └────────┬─────────┘
                     │
                     │ [New or Modified]
                     ▼
            ┌──────────────────┐
            │  Calculate Hash  │
            └────────┬─────────┘
                     │
                     ▼
            ┌──────────────────┐
            │ Detect MIME Type │
            │ & Categorize     │
            └────────┬─────────┘
                     │
                     ▼
            ┌──────────────────┐
            │ Select Processor │
            └────────┬─────────┘
                     │
                     ▼
          ┌────────────────────────┐
          │   Processor.validate() │
          └────────┬───────────────┘
                   │
          ┌────────┴────────┐
          │                 │
     [Invalid]         [Valid]
          │                 │
          ▼                 ▼
       ERROR      ┌──────────────────┐
                  │Processor.process()│
                  └────────┬─────────┘
                           │
                  ┌────────┴─────────┐
                  │                  │
              [Success]          [Error]
                  │                  │
                  ▼                  ▼
         ┌─────────────────┐  ┌──────────────┐
         │ Store in DB     │  │ Log Error    │
         │ (Transaction)   │  │ Continue     │
         └────────┬────────┘  └──────────────┘
                  │
                  ▼
                 DONE
```

## Module Descriptions

### Core Modules

#### 1. MetadataAnalyzer (`src/MetadataAnalyzer.js`)
**Purpose:** Main orchestrator that coordinates the entire metadata extraction workflow.

**Responsibilities:**
- Initialize database and processors
- Coordinate scanning and processing
- Manage concurrency and progress reporting
- Handle errors and rollback on failures

**Key Methods:**
- `init()`: Initialize database connection and load processors
- `analyze(directory, options)`: Main entry point for analysis
- `onProgress(callback)`: Register progress callback
- `close()`: Cleanup and close connections

**Dependencies:**
- Database Manager
- File Scanner
- All Processors (9)

#### 2. FileScanner (`src/utils/scanner.js`)
**Purpose:** Recursively scan directories and collect file information.

**Responsibilities:**
- Traverse directory tree with depth control
- Apply ignore patterns (.gitignore-style)
- Detect MIME types (extension + magic numbers via file-type library)
- Calculate file hashes
- Detect circular symlinks
- Incremental scanning (skip unchanged files)

**Key Methods:**
- `scan(directory, config)`: Main scanning method
- `detectMimeType(filePath)`: Dual MIME detection
- `categorizeFile(filePath, mimeDetection)`: File categorization

**MIME Detection Strategy:**
1. **Extension-based:** Fast, uses `mime-types` library
2. **Magic number-based:** Accurate, uses `file-type` library to read file headers
3. **Confidence scoring:** Prefers magic number when available

Reference: [MIME Types - IANA](https://www.iana.org/assignments/media-types/media-types.xhtml)

#### 3. Database Manager (`src/storage/database.js`)
**Purpose:** Manage all database operations with transaction support.

**Responsibilities:**
- Schema initialization and migrations
- CRUD operations for all tables
- Transaction management
- Query preparation and execution

**Key Methods:**
- `init()`: Create tables and indexes
- `storeFile(fileData)`: Store file and all metadata
- `upsert*Metadata()`: Type-specific metadata storage
- `getFile(path)`: Retrieve file information

**Transaction Pattern:**
```javascript
const transaction = db.transaction(() => {
    // Multiple operations
    insertFile();
    insertMetadata();
    updateFTS();
});
transaction(); // Executes atomically
```

Reference: [SQLite Transactions](https://www.sqlite.org/lang_transaction.html)

### Processor Modules

#### BaseProcessor (`src/processors/BaseProcessor.js`)
**Purpose:** Abstract base class implementing Template Method pattern.

**Template Method:**
```javascript
async process(fileInfo) {
    const startTime = Date.now();
    this.logStart(fileInfo);

    try {
        if (!await this.validate(fileInfo)) {
            return fileInfo;
        }

        this.initializeMetadata(fileInfo);
        await this.extractMetadata(fileInfo); // Subclass implements

        const duration = Date.now() - startTime;
        this.logComplete(fileInfo, duration);
        return fileInfo;
    } catch (error) {
        return this.handleError(fileInfo, error);
    }
}
```

**All processors inherit:**
- Consistent error handling
- Standardized logging
- Processing time tracking
- Metadata structure initialization

#### ImageProcessor (`src/processors/ImageProcessor.js`)
**Libraries Used:**
- **sharp** (v0.33.x): High-performance image processing
  - Dimensions, color space, bit depth
  - Color extraction
  - Thumbnail generation
  - Perceptual hashing
  - Reference: https://sharp.pixelplumbing.com/

- **exifr** (v7.x): EXIF/GPS/IPTC/XMP extraction
  - Camera make/model
  - Exposure settings
  - GPS coordinates with DMS conversion
  - Reference: https://github.com/MikeKovarik/exifr

**GPS Coordinate Formats:**
- Decimal degrees (43.467, 11.885)
- DMS format (43°28'2.8"N 11°53'6.5"E)
- Google Maps URL
- OpenStreetMap URL
- GeoJSON Point feature

Reference: [GeoJSON RFC 7946](https://tools.ietf.org/html/rfc7946)

#### FontProcessor (`src/processors/FontProcessor.js`)
**Library:** fontkit (v2.x)
- TrueType, OpenType, WOFF, WOFF2 parsing
- Glyph count and metrics
- OpenType feature detection (liga, kern, etc.)
- Character coverage analysis (Unicode ranges)
- Variable font axes

**Character Coverage Detection:**
Analyzes cmap table to detect support for:
- Basic Latin (U+0000-007F)
- Extended Latin, Greek, Cyrillic
- CJK, Hangul, Arabic, Hebrew, Devanagari
- Emoji

Reference: [OpenType Specification](https://docs.microsoft.com/en-us/typography/opentype/spec/)

#### AudioProcessor (`src/processors/AudioProcessor.js`)
**Library:** music-metadata (v8.x)
- ID3v1/v2/v3 tag parsing
- Vorbis comments
- iTunes metadata
- Duration, bitrate, codec detection

Reference: [ID3v2.4 Specification](https://id3.org/id3v2.4.0-structure)

## Concurrency Model

```
User specifies maxConcurrency (default: 4)
                │
                ▼
┌───────────────────────────────────┐
│    File Queue (from scanner)      │
│  [file1, file2, ..., fileN]      │
└────────────┬──────────────────────┘
             │
             ▼
     ┌───────────────────┐
     │  Worker Pool      │
     │  (p-limit based)  │
     │                   │
     │  ┌──────────┐    │
     │  │ Worker 1 │────┼──► Process file → Store in DB
     │  └──────────┘    │
     │  ┌──────────┐    │
     │  │ Worker 2 │────┼──► Process file → Store in DB
     │  └──────────┘    │
     │  ┌──────────┐    │
     │  │ Worker 3 │────┼──► Process file → Store in DB
     │  └──────────┘    │
     │  ┌──────────┐    │
     │  │ Worker 4 │────┼──► Process file → Store in DB
     │  └──────────┘    │
     └───────────────────┘
             │
             ▼
    Progress Updates
```

**Benefits:**
- CPU-bound tasks (image processing, hashing) run in parallel
- I/O-bound tasks (file reading) don't block each other
- Configurable to match system resources
- Prevents memory exhaustion on large directories

## Error Handling Strategy

```
Error occurs in processor
        │
        ▼
Caught by BaseProcessor.process()
        │
        ├─► Log error details
        │   (file path, error message, stack trace)
        │
        ├─► Add to processing.errors array
        │
        ├─► Set processing.status = 'error'
        │
        └─► Return partial fileInfo
                │
                ▼
        Continue processing next file
        (Fail gracefully, not globally)
```

**Philosophy:**
- **Fail-safe:** One file error doesn't stop entire scan
- **Detailed logging:** All errors captured for debugging
- **Partial success:** Store what metadata was successfully extracted
- **User notification:** Summary of errors in final report

## Performance Characteristics

| Operation | Time Complexity | Space Complexity | Notes |
|-----------|----------------|------------------|-------|
| File scan | O(n) | O(n) | n = number of files |
| Hash calculation | O(m) | O(1) | m = file size, streaming |
| MIME detection | O(1) | O(1) | Reads first 4KB only |
| Image processing | O(p) | O(p) | p = pixel count |
| Font parsing | O(g) | O(g) | g = glyph count |
| Database insert | O(log n) | O(1) | B-tree index |
| FTS search | O(log n + k) | O(k) | k = results |

**Optimization Techniques:**
1. **Incremental scanning:** Skip unchanged files (O(1) per file check)
2. **Streaming hashing:** Constant memory for any file size
3. **Image resizing:** Process 100x100 for color extraction (not full size)
4. **Lazy loading:** Modules loaded on-demand (fontkit, music-metadata)
5. **Prepared statements:** Reuse SQL queries
6. **Batch inserts:** Transaction wraps all file operations

## Security Considerations

### Path Traversal Prevention
```javascript
// All paths resolved to absolute
const safePath = path.resolve(userInput);

// Verify within allowed directory
if (!safePath.startsWith(allowedDirectory)) {
    throw new Error('Path traversal detected');
}
```

### SQL Injection Prevention
- **Parameterized queries only:** Never string concatenation
```javascript
// Safe
db.prepare('SELECT * FROM files WHERE id = ?').get(userId);

// NEVER do this
db.prepare(`SELECT * FROM files WHERE id = ${userId}`).get();
```

### Symlink Bomb Prevention
- **Inode tracking:** Detect circular symlinks
- **Depth limits:** Prevent infinite recursion
- **Timeout protection:** Per-file processing timeout (optional)

## Extension Points

### Adding a New Processor

1. **Create processor class:**
```javascript
class MyProcessor extends BaseProcessor {
    canProcess(fileInfo) {
        return fileInfo.category === 'mytype';
    }

    async extractMetadata(fileInfo) {
        // Implementation
    }
}
```

2. **Register in MetadataAnalyzer:**
```javascript
const processors = [
    new MyProcessor(config),
    // ... other processors
];
```

3. **Add database schema** (if needed):
```sql
CREATE TABLE my_metadata (
    file_id INTEGER PRIMARY KEY,
    custom_field TEXT,
    FOREIGN KEY (file_id) REFERENCES files(id)
);
```

4. **Add category detection** in scanner:
```javascript
if (ext === 'myext') {
    return 'mytype';
}
```

### Adding a New Export Format

```javascript
class MyExporter {
    export(files, options) {
        // Transform files data
        return formatted;
    }
}
```

## Testing Strategy

```
Unit Tests (per module)
    ├─ Processors: Mock file I/O, test metadata extraction
    ├─ Scanner: Test categorization, MIME detection
    ├─ Database: Test CRUD, transactions
    └─ GPS Utils: Test coordinate conversion

Integration Tests
    ├─ Full workflow: scan → process → store
    ├─ Sample files: Real files with known metadata
    └─ Error scenarios: Corrupted files, missing deps

Performance Tests
    ├─ Large directory: 10K+ files
    ├─ Large files: 1GB+ individual files
    └─ Memory profiling: Ensure no leaks
```

## Dependencies

### Production Dependencies
| Package | Version | Purpose | License |
|---------|---------|---------|---------|
| better-sqlite3 | ^9.x | SQLite driver | MIT |
| sharp | ^0.33.x | Image processing | Apache-2.0 |
| exifr | ^7.x | EXIF extraction | MIT |
| fontkit | ^2.x | Font parsing | MIT |
| music-metadata | ^8.x | Audio metadata | MIT |
| file-type | ^18.x | MIME detection | MIT |
| commander | ^11.x | CLI framework | MIT |
| p-limit | ^5.x | Concurrency control | MIT |

### Development Dependencies
- eslint: Code quality
- mocha/chai: Testing
- nyc: Code coverage

## Future Architecture Improvements

1. **Worker Threads:** For true parallel processing
2. **Streaming Pipeline:** Process files as they're found
3. **Cache Layer:** Redis for distributed deployments
4. **Plugin System:** Load processors dynamically
5. **Web API:** REST/GraphQL interface
6. **Event Streaming:** Kafka/RabbitMQ for real-time updates
