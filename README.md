# File Metadata AI Organizer (FMAO)

A comprehensive file metadata extraction and analysis tool optimized for AI/LLM context injection. Extracts detailed metadata from images, videos, audio files, documents, code, archives, and more.

## Features

### 🎯 Core Capabilities
- **Incremental Scanning**: Skip unchanged files for faster re-scans
- **Multi-format Support**: Images, videos, audio, PDFs, Office docs, code, archives, fonts, markdown
- **Dual Storage**: SQLite database + JSON export
- **LLM Optimization**: Token-aware context generation for AI models
- **Rich Metadata**: EXIF, ID3, GPS formatting, code metrics, perceptual hashes, and more
- **Magic Number Detection**: Standards-compliant MIME type detection

### 📸 Image Analysis
- Dimensions, color space, bit depth
- EXIF/IPTC/XMP extraction (camera, GPS, copyright)
- **GPS Coordinate Formatting**: DMS, decimal, Google Maps links, GeoJSON
- Dominant color extraction
- Thumbnail generation
- Perceptual hash for similarity detection
- Magic number MIME type detection

### 🎬 Video & Audio
- Duration, codec, bitrate, resolution
- Frame rate, aspect ratio
- Audio tracks and metadata
- ID3 tags (artist, album, genre)
- Embedded artwork detection

### 📄 Document Processing
- PDF metadata and text extraction
- Markdown parsing and analysis
- Page/word counts
- Front matter extraction
- Document summaries

### 📊 Office Document Support
- **Microsoft Office**: DOCX, XLSX, PPTX (and legacy DOC, XLS, PPT)
- Word document analysis (word count, page count, images, tables)
- Excel spreadsheet analysis (sheet names, formulas, cell statistics)
- PowerPoint presentation analysis (slide count, images)
- LibreOffice/OpenOffice compatible formats

### 💻 Code Analysis
- Lines of code (total, code, comments, blank)
- Language detection (35+ languages)
- Cyclomatic complexity
- Import/dependency extraction
- Function and class detection

### 📦 Archive Support
- ZIP, TAR, GZ, BZ2, 7Z formats
- File listing without extraction
- Compression ratio calculation
- Size analysis

### 🔤 Font File Support
- **Font Formats**: TTF, OTF, WOFF, WOFF2
- Font family, style, and weight detection
- Glyph count and character set analysis
- Language support detection
- OpenType feature extraction

### 🤖 LLM Integration
- Token-aware context generation
- Selective metadata inclusion
- Configurable context windows (4K-128K tokens)
- Priority-based file ranking
- Multiple output formats (Markdown, JSON)

### 📊 Visualizations
- ASCII directory trees
- Mermaid.js diagrams
- HTML interactive trees
- File type distributions
- Statistics and reports

## Installation

```bash
# Install dependencies
npm install

# Make CLI globally available (optional)
npm link
```

### System Requirements

- **Node.js** 16.0.0 or higher
- **ffprobe** (for video analysis) - Install via ffmpeg:
  ```bash
  # macOS
  brew install ffmpeg

  # Ubuntu/Debian
  sudo apt-get install ffmpeg

  # Windows
  # Download from https://ffmpeg.org/download.html
  ```

## Quick Start

```bash
# Analyze a directory
fmao analyze /path/to/directory

# Query files
fmao query --category image --limit 10

# Show statistics
fmao stats

# Generate directory tree
fmao tree --format ascii

# Generate LLM context
fmao llm --max-tokens 8000 --output context.md

# Find duplicates
fmao duplicates
```

## CLI Commands

### `analyze <directory>`

Analyze a directory and extract metadata from all files.

**Options:**
- `-i, --incremental` - Use incremental scanning (default: true)
- `--no-incremental` - Force full rescan
- `-d, --max-depth <depth>` - Maximum directory depth
- `-c, --concurrency <num>` - Concurrent processes

**Examples:**
```bash
# Basic analysis
fmao analyze ./my-project

# Full rescan
fmao analyze ./my-project --no-incremental

# Limit depth
fmao analyze ./my-project --max-depth 3
```

### `query [options]`

Query the metadata database.

**Options:**
- `-c, --category <category>` - Filter by category (image, video, audio, document, code, archive)
- `-e, --extension <ext>` - Filter by extension
- `--min-size <bytes>` - Minimum file size
- `--max-size <bytes>` - Maximum file size
- `-l, --limit <num>` - Limit results
- `-s, --search <term>` - Search term
- `--sort <field>` - Sort by field
- `-o, --output <format>` - Output format (json, table, markdown)

**Examples:**
```bash
# Find all images
fmao query --category image

# Find large videos
fmao query --category video --min-size 100000000

# Search for files
fmao query --search "vacation"

# Output as JSON
fmao query --category code --output json
```

### `stats [options]`

Display file statistics.

**Options:**
- `-c, --category <category>` - Filter by category

**Examples:**
```bash
# Overall stats
fmao stats

# Image stats
fmao stats --category image
```

### `tree [options]`

Generate directory tree visualization.

**Options:**
- `-f, --format <format>` - Output format (ascii, mermaid, html)
- `-o, --output <file>` - Save to file
- `--no-size` - Hide file sizes
- `-c, --category <category>` - Filter by category

**Examples:**
```bash
# ASCII tree
fmao tree

# Mermaid diagram
fmao tree --format mermaid --output tree.mmd

# HTML interactive tree
fmao tree --format html --output tree.html

# Only show images
fmao tree --category image
```

### `llm [options]`

Generate LLM-optimized context.

**Options:**
- `-t, --max-tokens <num>` - Maximum tokens (default: 32000)
- `-f, --format <format>` - Output format (markdown, json)
- `-o, --output <file>` - Save to file
- `-c, --category <category>` - Filter by category
- `--recent` - Prioritize recent files

**Examples:**
```bash
# Generate context for GPT-4
fmao llm --max-tokens 8000 --output context.md

# JSON format for API
fmao llm --format json --output context.json

# Only code files
fmao llm --category code --max-tokens 32000
```

### `duplicates`

Find duplicate files based on content hash.

**Example:**
```bash
fmao duplicates
```

## Configuration

Configuration is loaded from multiple sources (in priority order):
1. Command-line arguments
2. Environment variables (prefix: `FMAO_`)
3. `config.json` (user config)
4. `config.default.json` (defaults)

### Example config.json

```json
{
  "scanning": {
    "maxDepth": -1,
    "respectGitignore": true,
    "maxConcurrency": 4
  },
  "storage": {
    "type": "both",
    "dbPath": "./data/metadata.db",
    "jsonPath": "./data/metadata.json"
  },
  "extractors": {
    "images": {
      "enabled": true,
      "extractExif": true,
      "generateThumbnails": true
    },
    "videos": {
      "enabled": true,
      "ffprobePath": "ffprobe"
    }
  },
  "llm": {
    "contextWindow": 32000,
    "tokenCountingModel": "gpt-4"
  }
}
```

### Environment Variables

```bash
# Logging level
export FMAO_LOGGING_LEVEL=debug

# Storage type
export FMAO_STORAGE_TYPE=sqlite

# Max concurrency
export FMAO_SCANNING_MAXCONCURRENCY=8
```

## Architecture

```
file-metadata-ai-organizer/
├── cli.js                      # CLI entry point
├── src/
│   ├── MetadataAnalyzer.js    # Main orchestrator
│   ├── processors/             # File type processors
│   │   ├── BaseProcessor.js
│   │   ├── ImageProcessor.js
│   │   ├── VideoProcessor.js
│   │   ├── AudioProcessor.js
│   │   ├── PDFProcessor.js
│   │   ├── CodeProcessor.js
│   │   ├── ArchiveProcessor.js
│   │   ├── MarkdownProcessor.js
│   │   ├── OfficeProcessor.js    # NEW: DOCX/XLSX/PPTX support
│   │   └── FontProcessor.js      # NEW: TTF/OTF/WOFF support
│   ├── storage/               # Data storage
│   │   ├── database.js
│   │   ├── schema.js
│   │   └── queryAPI.js
│   ├── formatters/            # Output formatters
│   │   └── LLMFormatter.js
│   ├── visualizers/           # Visualization tools
│   │   └── TreeVisualizer.js
│   └── utils/                 # Utilities
│       ├── config.js
│       ├── logger.js
│       ├── hash.js
│       ├── scanner.js
│       ├── progress.js
│       └── gps.js                # NEW: GPS coordinate utilities
├── data/                      # Generated data
│   ├── metadata.db           # SQLite database
│   └── metadata.json         # JSON export
├── thumbnails/               # Generated thumbnails
└── logs/                     # Application logs
```

## Use Cases

### 1. LLM Context Generation

```bash
# Generate context for code review
fmao analyze ./my-project
fmao llm --category code --max-tokens 16000 > code-context.md

# Use with Claude/GPT
cat code-context.md | pbcopy  # Paste into LLM
```

### 2. Photo Organization

```bash
# Analyze photo library
fmao analyze ~/Photos

# Find photos by camera
fmao query --category image | grep "Canon"

# Find similar images (duplicates)
fmao duplicates

# Generate visual index
fmao tree --category image --format html --output photo-index.html
```

### 3. Project Documentation

```bash
# Analyze project
fmao analyze ./my-project

# Generate project overview
fmao stats > PROJECT_STATS.md
fmao tree --format markdown >> PROJECT_STATS.md

# Get code metrics
fmao query --category code --output json > code-metrics.json
```

### 4. Media Library Management

```bash
# Analyze media
fmao analyze ~/Media

# Find videos without metadata
fmao query --category video --output json | jq '.[] | select(.metadata.video.tags == null)'

# Generate catalog
fmao llm --max-tokens 50000 --output media-catalog.md
```

## Database Schema

### SQLite Tables

- `files` - Basic file information
- `image_metadata` - Image-specific data
- `video_metadata` - Video-specific data
- `audio_metadata` - Audio-specific data
- `document_metadata` - Document-specific data
- `code_metadata` - Code analysis data
- `archive_metadata` - Archive information
- `tags` - File tags
- `relationships` - File relationships
- `exif_data` - EXIF data (JSON)

### JSON Structure

```json
{
  "version": "1.0.0",
  "generatedAt": "2025-11-21T...",
  "summary": {
    "totalFiles": 1234,
    "totalSize": 123456789,
    "fileTypes": {...}
  },
  "files": [
    {
      "path": "/full/path/to/file.jpg",
      "relativePath": "photos/vacation.jpg",
      "category": "image",
      "metadata": {
        "image": {
          "width": 1920,
          "height": 1080,
          "exif": {...},
          "dominantColors": [...]
        }
      }
    }
  ]
}
```

## Performance

- **Incremental scanning** reduces re-scan time by 90%+
- **Parallel processing** utilizes multiple CPU cores
- **Streaming** for memory-efficient large file handling
- **Caching** for expensive operations
- **Hash-based** change detection

## Development

### Adding a New Processor

1. Create new processor in `src/processors/`:

```javascript
const BaseProcessor = require('./BaseProcessor');

class MyProcessor extends BaseProcessor {
    canProcess(fileInfo) {
        return fileInfo.extension === 'myext';
    }

    async process(fileInfo) {
        // Extract metadata
        return fileInfo;
    }
}
```

2. Register in `MetadataAnalyzer.js`

### Running Tests

```bash
npm test
```

## Roadmap

See [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) for the complete feature roadmap.

**Upcoming features:**
- Office document support (DOCX, XLSX)
- Machine learning-based image classification
- Audio waveform visualization
- Parallel processing with worker threads
- Advanced caching strategies
- Web UI for browsing metadata
- API server mode

## Troubleshooting

### ffprobe not found

Video analysis requires ffmpeg:
```bash
# macOS
brew install ffmpeg

# Ubuntu
sudo apt-get install ffmpeg
```

### Out of memory errors

For large directories, reduce concurrency:
```bash
fmao analyze /path --concurrency 2
```

### Slow analysis

Enable incremental scanning (default) and ensure you're not rescanning unchanged files.

## Library Usage

FMAO can be used as a library in your Node.js applications:

### Basic Usage

```javascript
const MetadataAnalyzer = require('./src/MetadataAnalyzer');

async function main() {
    const analyzer = new MetadataAnalyzer({
        storage: {
            type: 'both',  // 'sqlite', 'json', or 'both'
            dbPath: './data/metadata.db',
            jsonPath: './data/metadata.json'
        },
        scanning: {
            maxDepth: -1,  // -1 for unlimited
            incremental: true,
            maxConcurrency: 4
        }
    });

    // Initialize
    await analyzer.init();

    // Analyze directory
    const result = await analyzer.analyze('/path/to/directory');
    console.log(`Processed ${result.filesProcessed} files`);

    // Query files
    const images = await analyzer.query({
        category: 'image',
        minSize: 1000000,
        limit: 10
    });

    // Close connections
    await analyzer.close();
}

main().catch(console.error);
```

### Query API

```javascript
const queryAPI = require('./src/storage/queryAPI');

// Initialize database
await queryAPI.init({
    type: 'sqlite',
    dbPath: './data/metadata.db'
});

// Query by category
const images = await queryAPI.query({ category: 'image' });

// Query by extension
const jpegs = await queryAPI.query({ extension: 'jpg' });

// Size filters
const largeFiles = await queryAPI.query({
    minSize: 10000000,  // 10MB
    maxSize: 100000000  // 100MB
});

// Full-text search
const results = await queryAPI.search('vacation photos');

// Statistics
const stats = await queryAPI.getStatistics();
console.log(`Total files: ${stats.totalFiles}`);
console.log(`Total size: ${stats.totalSize} bytes`);

// Find duplicates
const dupes = await queryAPI.findDuplicates();
dupes.forEach(group => {
    console.log(`Hash: ${group.hash}`);
    group.files.forEach(f => console.log(`  - ${f.path}`));
});
```

### Individual Processors

```javascript
const ImageProcessor = require('./src/processors/ImageProcessor');
const FontProcessor = require('./src/processors/FontProcessor');

// Process an image
const imageProc = new ImageProcessor({
    thumbnailDir: './thumbnails',
    thumbnailSizes: [150, 300, 600],
    extractExif: true,
    perceptualHash: true
});

const fileInfo = {
    path: '/photos/IMG_001.jpg',
    name: 'IMG_001.jpg',
    category: 'image',
    metadata: {}
};

await imageProc.process(fileInfo);
console.log(`Image: ${fileInfo.metadata.image.width}x${fileInfo.metadata.image.height}`);
console.log(`GPS: ${fileInfo.metadata.image.exif?.gps?.formatted}`);

// Process a font
const fontProc = new FontProcessor();
const fontInfo = {
    path: '/fonts/Roboto-Regular.ttf',
    name: 'Roboto-Regular.ttf',
    category: 'font',
    metadata: {}
};

await fontProc.process(fontInfo);
console.log(`Font: ${fontInfo.metadata.font.family}`);
console.log(`Weight: ${fontInfo.metadata.font.weight}`);
console.log(`Glyphs: ${fontInfo.metadata.font.glyphCount}`);
```

### GPS Utilities

```javascript
const gpsUtils = require('./src/utils/gps');

// Convert decimal to DMS
const dms = gpsUtils.decimalToDMS(43.467, 'N');
// Result: { degrees: 43, minutes: 28, seconds: 1.2, direction: 'N' }

// Format coordinates
const formatted = gpsUtils.formatCoordinates(43.467, 11.885, { format: 'DMS' });
// Result: '43°28\'1.2"N 11°53\'6.0"E'

// Generate map links
const googleMaps = gpsUtils.generateGoogleMapsLink(43.467, 11.885);
const osm = gpsUtils.generateOpenStreetMapLink(43.467, 11.885);

// GeoJSON
const geojson = gpsUtils.toGeoJSON(43.467, 11.885);
// Result: { type: 'Feature', geometry: { type: 'Point', coordinates: [11.885, 43.467] } }

// Calculate distance
const distance = gpsUtils.calculateDistance(43.467, 11.885, 43.500, 11.900);
console.log(`Distance: ${distance} km`);
```

### Tree Visualization

```javascript
const TreeVisualizer = require('./src/visualizers/TreeVisualizer');

const visualizer = new TreeVisualizer({
    showSize: true,
    maxDepth: 5,
    categoryFilter: 'image'
});

// ASCII tree
const ascii = await visualizer.generateASCII('/path/to/dir');
console.log(ascii);

// Mermaid diagram
const mermaid = await visualizer.generateMermaid('/path/to/dir');
await fs.writeFile('tree.mmd', mermaid);

// HTML interactive tree
const html = await visualizer.generateHTML('/path/to/dir');
await fs.writeFile('tree.html', html);
```

### LLM Context Generation

```javascript
const LLMFormatter = require('./src/formatters/LLMFormatter');

const formatter = new LLMFormatter({
    maxTokens: 8000,
    format: 'markdown',  // 'markdown' or 'json'
    prioritize: 'recent',  // 'recent', 'size', or 'complexity'
    includeContent: false
});

// Generate context from query results
const files = await queryAPI.query({ category: 'code' });
const context = formatter.format(files);

// Save for LLM
await fs.writeFile('context.md', context);
```

## Advanced Features

### Perceptual Hashing for Image Similarity

Find visually similar images using perceptual hashes:

```javascript
const dbManager = require('./src/storage/database');

// Get all images with perceptual hashes
const images = await queryAPI.query({ category: 'image' });

// Calculate Hamming distance between images
function hammingDistance(hash1, hash2) {
    let distance = 0;
    for (let i = 0; i < hash1.length; i++) {
        const val1 = parseInt(hash1[i], 16);
        const val2 = parseInt(hash2[i], 16);
        const xor = val1 ^ val2;
        distance += xor.toString(2).split('1').length - 1;
    }
    return distance;
}

// Find similar images
const targetImage = images[0];
const similar = images.filter(img => {
    if (img.id === targetImage.id) return false;
    const distance = hammingDistance(
        targetImage.metadata.image.perceptualHash,
        img.metadata.image.perceptualHash
    );
    return distance <= 5;  // Very similar
});

console.log(`Found ${similar.length} similar images`);
```

### Custom File Processors

Create a custom processor for a new file type:

```javascript
const BaseProcessor = require('./src/processors/BaseProcessor');

class SVGProcessor extends BaseProcessor {
    canProcess(fileInfo) {
        return fileInfo.extension === 'svg' ||
               fileInfo.mimeType === 'image/svg+xml';
    }

    async extractMetadata(fileInfo) {
        const fs = require('fs').promises;
        const content = await fs.readFile(fileInfo.path, 'utf8');

        // Parse SVG
        const widthMatch = content.match(/width="(\d+)"/);
        const heightMatch = content.match(/height="(\d+)"/);
        const viewBoxMatch = content.match(/viewBox="([\d\s.]+)"/);

        fileInfo.metadata.svg = {
            width: widthMatch ? parseInt(widthMatch[1]) : null,
            height: heightMatch ? parseInt(heightMatch[1]) : null,
            viewBox: viewBoxMatch ? viewBoxMatch[1] : null,
            hasAnimations: content.includes('<animate'),
            elementCount: (content.match(/<(circle|rect|path|line|polygon)/g) || []).length
        };
    }

    getSupportedExtensions() {
        return ['svg', 'svgz'];
    }

    getSupportedMimeTypes() {
        return ['image/svg+xml'];
    }
}

module.exports = SVGProcessor;
```

Then register it in your analyzer:

```javascript
const analyzer = new MetadataAnalyzer(config);
const SVGProcessor = require('./processors/SVGProcessor');
analyzer.registerProcessor(new SVGProcessor());
```

### Database Schema Access

Direct database access for advanced queries:

```javascript
const Database = require('better-sqlite3');
const db = new Database('./data/metadata.db');

// Complex query with joins
const results = db.prepare(`
    SELECT
        f.path,
        f.name,
        f.size,
        i.width,
        i.height,
        e.data as exif
    FROM files f
    LEFT JOIN image_metadata i ON f.id = i.file_id
    LEFT JOIN exif_data e ON f.id = e.file_id
    WHERE f.category = 'image'
    AND i.width > 1920
    ORDER BY f.size DESC
    LIMIT 10
`).all();

// Aggregate statistics
const stats = db.prepare(`
    SELECT
        category,
        COUNT(*) as count,
        SUM(size) as total_size,
        AVG(size) as avg_size,
        MIN(size) as min_size,
        MAX(size) as max_size
    FROM files
    GROUP BY category
`).all();

// Full-text search
const searchResults = db.prepare(`
    SELECT * FROM files_fts
    WHERE files_fts MATCH ?
    ORDER BY rank
    LIMIT 20
`).all('vacation photos beach');
```

## API Reference

### MetadataAnalyzer

Main class for analyzing directories.

#### Constructor

```javascript
new MetadataAnalyzer(config)
```

**Parameters:**
- `config.storage` - Storage configuration
  - `type` - 'sqlite', 'json', or 'both'
  - `dbPath` - Path to SQLite database
  - `jsonPath` - Path to JSON file
- `config.scanning` - Scanning options
  - `maxDepth` - Maximum directory depth (-1 for unlimited)
  - `incremental` - Enable incremental scanning
  - `maxConcurrency` - Number of concurrent processors
  - `followSymlinks` - Follow symbolic links
  - `ignorePatterns` - Array of glob patterns to ignore

#### Methods

**`async init()`**
Initialize the analyzer and database connections.

**`async analyze(directory, options)`**
Analyze a directory and extract metadata.

**`async query(filters)`**
Query stored metadata with filters.

**`async close()`**
Close database connections and save data.

### Processors

All processors extend `BaseProcessor` and implement:

- `canProcess(fileInfo)` - Returns true if processor can handle the file
- `async process(fileInfo)` - Extract metadata and populate fileInfo.metadata
- `getSupportedExtensions()` - Return array of supported extensions
- `getSupportedMimeTypes()` - Return array of supported MIME types

Available processors:
- `ImageProcessor` - Images (JPEG, PNG, HEIC, WebP, TIFF, etc.)
- `VideoProcessor` - Videos (MP4, MKV, AVI, MOV, WebM)
- `AudioProcessor` - Audio (MP3, FLAC, WAV, M4A, OGG)
- `PDFProcessor` - PDF documents
- `CodeProcessor` - Source code (JS, TS, Python, Java, C++, etc.)
- `ArchiveProcessor` - Archives (ZIP, TAR, GZ, 7Z, RAR)
- `MarkdownProcessor` - Markdown files
- `OfficeProcessor` - Office documents (DOCX, XLSX, PPTX)
- `FontProcessor` - Fonts (TTF, OTF, WOFF, WOFF2)

### Storage API

**Database Manager** (`src/storage/database.js`)

```javascript
const dbManager = require('./src/storage/database');

// Initialize
await dbManager.init({
    type: 'both',
    dbPath: './data/metadata.db',
    jsonPath: './data/metadata.json'
});

// Upsert file
await dbManager.upsertFile(fileData);

// Get file by path
const file = dbManager.getFile('/path/to/file.jpg');

// Query files
const files = dbManager.queryFiles({
    category: 'image',
    extension: 'jpg',
    minSize: 1000000,
    limit: 100
});

// Save JSON to disk
await dbManager.saveJSON();

// Close
await dbManager.close();
```

## Testing

The project includes comprehensive tests for all major components.

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- tests/image-processor.test.js

# Run with coverage
npm run test:coverage

# Watch mode for development
npm test -- --watch
```

### Test Coverage

Tests cover:
- ✅ Image metadata extraction (EXIF, GPS, colors)
- ✅ Font metadata extraction (glyphs, features, character sets)
- ✅ Archive processing
- ✅ Code analysis
- ✅ GPS coordinate conversion and formatting
- ✅ Perceptual hashing
- ✅ Special character filenames (Unicode, emoji, spaces)
- ✅ Symlink handling with circular reference detection
- ✅ Database operations (SQLite and JSON)
- ✅ Query API
- ✅ Incremental scanning

### Writing Tests

```javascript
const ImageProcessor = require('../src/processors/ImageProcessor');
const fs = require('fs').promises;

describe('ImageProcessor', () => {
    let processor;

    beforeEach(() => {
        processor = new ImageProcessor({
            extractExif: true,
            perceptualHash: true
        });
    });

    test('should extract basic image metadata', async () => {
        const fileInfo = {
            path: './test-samples/images/sample.jpg',
            name: 'sample.jpg',
            category: 'image',
            metadata: {}
        };

        await processor.process(fileInfo);

        expect(fileInfo.metadata.image.width).toBeGreaterThan(0);
        expect(fileInfo.metadata.image.height).toBeGreaterThan(0);
        expect(fileInfo.metadata.image.format).toBe('jpeg');
    });
});
```

## Performance Optimization

### Incremental Scanning

Incremental scanning dramatically reduces re-scan time by only processing new or modified files:

```bash
# First scan: processes all files
fmao analyze ./project

# Second scan: only processes changed files
fmao analyze ./project  # 90%+ faster
```

The system uses a combination of:
- File modification time (mtime)
- File size
- Path-based tracking

### Concurrency Tuning

Adjust concurrency based on your system:

```bash
# Low-end systems
fmao analyze ./project --concurrency 2

# High-end systems with SSDs
fmao analyze ./project --concurrency 8

# Auto (default: 4)
fmao analyze ./project
```

### Memory Management

For very large directories (100K+ files):

```javascript
const analyzer = new MetadataAnalyzer({
    scanning: {
        maxConcurrency: 2,      // Reduce parallelism
        batchSize: 100,         // Process in batches
        incremental: true       // Skip unchanged files
    },
    storage: {
        type: 'sqlite'          // Use only SQLite (no in-memory JSON)
    }
});
```

### Selective Processing

Disable expensive operations if not needed:

```javascript
const analyzer = new MetadataAnalyzer({
    processors: {
        image: {
            generateThumbnails: false,  // Skip thumbnails
            perceptualHash: false,      // Skip p-hash
            extractColors: false        // Skip color analysis
        },
        video: {
            enabled: false              // Skip video processing entirely
        }
    }
});
```

## Troubleshooting

### ffprobe not found

Video analysis requires ffmpeg:
```bash
# macOS
brew install ffmpeg

# Ubuntu
sudo apt-get install ffmpeg
```

### Out of memory errors

For large directories, reduce concurrency:
```bash
fmao analyze /path --concurrency 2
```

### Slow analysis

Enable incremental scanning (default) and ensure you're not rescanning unchanged files.

### Permission errors

Ensure read permissions for all files:
```bash
# Check permissions
ls -la /path/to/directory

# Fix permissions (if appropriate)
chmod -R +r /path/to/directory
```

### Database locked errors

Close other connections to the database:
```javascript
// Always close when done
await analyzer.close();
```

### Missing dependencies

Install all required dependencies:
```bash
npm install
```

For optional features:
```bash
# Font processing
npm install fontkit

# Advanced image formats
npm install sharp
```

## License

ISC

## Contributing

Contributions welcome! Please see [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) for planned features and architecture.

### Development Setup

```bash
# Clone repository
git clone <repository-url>
cd file-metadata-ai-organizer

# Install dependencies
npm install

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

### Pull Request Process

1. Create a feature branch
2. Write tests for new functionality
3. Ensure all tests pass
4. Update documentation
5. Submit pull request

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

## Acknowledgments

Built with:
- [sharp](https://sharp.pixelplumbing.com/) - High-performance image processing
- [exifr](https://github.com/MikeKovarik/exifr) - EXIF metadata extraction
- [fontkit](https://github.com/foliojs/fontkit) - Font parsing and analysis
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) - Fast SQLite database
- [music-metadata](https://github.com/borewit/music-metadata) - Audio metadata extraction
