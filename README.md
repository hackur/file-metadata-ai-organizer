# File Metadata AI Organizer (FMAO)

A comprehensive file metadata extraction and analysis tool optimized for AI/LLM context injection. Extracts detailed metadata from images, videos, audio files, documents, code, archives, and more.

## Features

### 🎯 Core Capabilities
- **Incremental Scanning**: Skip unchanged files for faster re-scans
- **Multi-format Support**: Images, videos, audio, PDFs, code, archives, markdown
- **Dual Storage**: SQLite database + JSON export
- **LLM Optimization**: Token-aware context generation for AI models
- **Rich Metadata**: EXIF, ID3, code metrics, perceptual hashes, and more

### 📸 Image Analysis
- Dimensions, color space, bit depth
- EXIF/IPTC/XMP extraction (camera, GPS, copyright)
- Dominant color extraction
- Thumbnail generation
- Perceptual hash for similarity detection

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
│   │   └── MarkdownProcessor.js
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
│       └── progress.js
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

## License

ISC

## Contributing

Contributions welcome! Please see [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) for planned features and architecture.
