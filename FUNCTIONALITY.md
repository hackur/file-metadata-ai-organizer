# File Metadata AI Organizer - Functionality Summary

## Overview
A comprehensive utility for extracting, storing, and querying metadata from various file types. Designed to be used as a library, CLI tool, or integrated into other applications.

## Supported File Types & Extracted Metadata

### Images (JPEG, PNG, HEIC, WebP, TIFF, etc.)
**Processor:** ImageProcessor
**Metadata Extracted:**
- **Dimensions:** width, height, aspect ratio
- **Technical:** color space, bit depth, DPI, has alpha channel
- **EXIF Data** (comprehensive):
  - Camera make, model
  - Date/time taken
  - Exposure settings (ISO, f-number, shutter speed, focal length)
  - Flash status
  - Software used
  - GPS coordinates (if available):
    - Latitude/longitude (decimal and DMS format)
    - Formatted coordinates
    - Google Maps link
    - OpenStreetMap link
    - GeoJSON format
- **Colors:** Dominant color (RGB + hex)
- **Perceptual Hash:** For duplicate/similar image detection

**Example GPS Data:**
```json
{
  "latitude": 43.467,
  "longitude": 11.885,
  "formatted": "43°28'2.8\"N 11°53'6.5\"E",
  "googleMapsLink": "https://maps.google.com/...",
  "openStreetMapLink": "https://www.openstreetmap.org/..."
}
```

### Fonts (TTF, OTF, WOFF, WOFF2, TTC)
**Processor:** FontProcessor (uses fontkit library)
**Metadata Extracted:**
- **Identity:** family name, subfamily, full name, PostScript name
- **Properties:** weight (100-900), style (normal/italic/oblique), stretch
- **Technical:** format, glyph count, units per em
- **Features:** OpenType features, variations (for variable fonts)
- **Character Coverage:** Detects support for:
  - Basic Latin, Latin supplements/extensions
  - Greek, Cyrillic, Arabic, Hebrew, Devanagari
  - Hangul, CJK, Emoji
- **Languages:** Inferred from character set coverage
- **Typography:** Monospace detection, serif detection

**Example:**
```
Family: Geneva
Format: TrueType (TTF)
Weight: 400
Glyph Count: 3,742
```

### Code Files (JS, TS, Python, Java, C/C++, Go, Rust, etc.)
**Processor:** CodeProcessor
**Metadata Extracted:**
- **Language:** Detected from extension
- **Line Counts:**
  - Total lines
  - Code lines
  - Comment lines
  - Blank lines
- **Complexity:** Code complexity metrics

**Example:**
```
Language: JavaScript
Lines: 60 total (39 code, 9 comments, 12 blank)
Complexity: 5
```

### Archives (ZIP, TAR, GZ, 7Z, RAR)
**Processor:** ArchiveProcessor
**Metadata Extracted:**
- **Format:** ZIP, GZ, TAR, etc.
- **Compression:** Is compressed, compression ratio
- **Contents:** File count, uncompressed size
- **Security:** Encryption status

**Example:**
```
Format: ZIP
Compressed: Yes
File Count: 8
Uncompressed Size: 1.05 MB
Compression Ratio: 100%
```

### Audio (MP3, FLAC, WAV, M4A, OGG)
**Processor:** AudioProcessor
**Metadata Extracted:**
- **Technical:** duration, bitrate, sample rate, channels, codec
- **ID3 Tags:** title, artist, album, year, genre, track number
- **Format:** Audio format type

### Video (MP4, MKV, AVI, MOV, WebM)
**Processor:** VideoProcessor
**Metadata Extracted:**
- **Technical:** duration, resolution (width x height), frame rate, bitrate
- **Codecs:** Video codec, audio codec, container format

### Documents & PDF
**Processor:** PDFProcessor / DocumentProcessor
**Metadata Extracted:**
- **Content:** page count, word count, character count
- **Author Info:** author, title, subject
- **Technical:** language, format

### Office Documents (DOCX, XLSX, PPTX)
**Processor:** OfficeProcessor
**Metadata Extracted:**
- **Type:** document, spreadsheet, presentation
- **Dimensions:** page count, sheet count, slide count, word count
- **Features:** has images, has tables, has formulas

### Markdown
**Processor:** MarkdownProcessor
**Metadata Extracted:**
- **Structure:** heading count, word count
- **Content:** frontmatter (if present)

## Core Features

### 1. File Scanning
- **Recursive directory scanning** with depth control
- **Incremental scanning:** Only processes new/modified files
- **Symlink handling:** Circular reference detection
- **Ignore patterns:** .gitignore-style file exclusion
- **MIME type detection:** Extension-based + magic number detection
- **Special character support:** Unicode, emoji, spaces in filenames

### 2. Hashing & Deduplication
- **Multiple hash algorithms:** MD5, SHA-256
- **Perceptual hashing:** For finding similar images
- **Duplicate detection:** Identify identical files

### 3. Database Storage
**SQLite database** with normalized schema:
- Main files table
- Category-specific metadata tables (image, video, audio, etc.)
- EXIF data (stored as JSON for flexibility)
- Tags and relationships
- Full-text search index

### 4. Query API
```javascript
// Query by category
query({ category: 'image' })

// Query by extension
query({ extension: 'jpg' })

// Size filters
query({ minSize: 1000000, maxSize: 10000000 })

// Search
query({ search: 'vacation' })

// Sorting and limits
query({ sort: 'size', limit: 10 })
```

### 5. Export Formats
- **JSON:** Complete metadata export
- **CSV:** Tabular data export
- **HTML:** Tree visualization
- **LLM Context:** Optimized for AI/LLM consumption

### 6. CLI Commands
```bash
# Analyze directory
node cli.js analyze <directory> [--incremental] [--max-depth N]

# Query files
node cli.js query [--category image] [--extension jpg]

# Statistics
node cli.js stats

# Tree visualization
node cli.js tree [--format html] [--output index.html]

# LLM context
node cli.js llm [--category code]

# Find duplicates
node cli.js duplicates
```

## Performance Features

- **Concurrent processing:** Configurable parallelism (maxConcurrency)
- **Memory efficient:** Streaming for large files
- **Progress tracking:** Real-time progress updates
- **Incremental scanning:** Skip unchanged files

## Data Integrity

- **Transaction support:** Database operations in transactions
- **Error handling:** Graceful degradation on processing failures
- **Validation:** Input validation and sanitization
- **Foreign key constraints:** Automatic cleanup of orphaned records

## Use Cases

1. **Digital Asset Management:** Organize large photo/video libraries
2. **Code Analysis:** Understand codebase composition
3. **Font Management:** Catalog font collections
4. **Archive Management:** Track compressed file contents
5. **LLM Training Data:** Generate context for AI/ML applications
6. **Duplicate Finder:** Identify and remove duplicate files
7. **Metadata Search:** Find files by metadata criteria

## Integration Examples

### As a Library
```javascript
const MetadataAnalyzer = require('./src/MetadataAnalyzer');

const analyzer = new MetadataAnalyzer(config);
await analyzer.init();

const result = await analyzer.analyze('/path/to/directory');
console.log(`Processed ${result.filesProcessed} files`);

await analyzer.close();
```

### Query API
```javascript
const queryAPI = require('./src/storage/queryAPI');

const images = await queryAPI.query({
  category: 'image',
  minSize: 1000000
});
```

## Current Test Coverage

- ✅ 18 test files across all major categories
- ✅ GPS EXIF data extraction
- ✅ Font metadata (family, glyphs, format)
- ✅ Archive metadata
- ✅ Code analysis
- ✅ Special character filenames (spaces, unicode, emoji)
- ✅ Symlink handling with circular reference detection
- ✅ Perceptual hashing for images

## Bugs Fixed
1. ✅ Missing GPS utils functions (generateOpenStreetMapLink, toGeoJSON)
2. ✅ Image color extraction array/object mismatch
3. ✅ Font categorization (fonts were marked as "other")
4. ✅ Font metadata extraction (naming, format, glyphs)
5. ✅ Unused imports cleaned up
6. ✅ Circular symlink detection implemented

## Next Steps for Production Use

1. Add video/audio sample files for testing
2. Add Office document samples
3. Add PDF samples
4. Performance optimization for very large directories (1M+ files)
5. Optional: Add web UI for browsing/querying
6. Optional: Add watch mode for real-time file monitoring
