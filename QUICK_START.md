# Quick Start Guide

## ✅ Installation Complete!

All dependencies are installed and the system is ready to use.

## 🚀 Basic Commands

### 1. Analyze a Directory
```bash
node cli.js analyze /path/to/directory

# Or just analyze current directory
node cli.js analyze .
```

### 2. View Statistics
```bash
node cli.js stats
```

Output example:
```
📊 File Statistics

Total files: 31
Total size: 379.83 KB

By category:
  code: 26
  document: 4
  other: 1
```

### 3. Query Files
```bash
# All code files
node cli.js query --category code

# Images
node cli.js query --category image

# Search
node cli.js query --search "test"

# Large files
node cli.js query --min-size 1000000
```

### 4. Directory Tree
```bash
# ASCII tree
node cli.js tree

# Mermaid diagram
node cli.js tree --format mermaid --output tree.mmd

# HTML interactive
node cli.js tree --format html --output tree.html
```

### 5. Generate LLM Context
```bash
# For GPT-4 (8K context)
node cli.js llm --max-tokens 8000 --output context.md

# For Claude (32K context)
node cli.js llm --max-tokens 32000 --output context.md

# Only code files
node cli.js llm --category code --max-tokens 16000
```

### 6. Find Duplicates
```bash
node cli.js duplicates
```

## 📊 What Data Gets Extracted?

### Images
- Dimensions, aspect ratio, color space
- EXIF data (camera, GPS, date/time)
- Dominant colors
- Perceptual hash (for duplicate detection)
- Thumbnails generated in `./thumbnails/`

### Videos
- Duration, resolution, frame rate
- Codec, bitrate, container format
- Audio/video stream information
- Metadata tags

### Audio
- Duration, bitrate, sample rate
- ID3 tags (artist, album, title, genre)
- Codec and format details
- Embedded artwork detection

### Documents (PDF, Markdown)
- Page/word/character counts
- Author, title, keywords
- Text content extraction
- Document summaries

### Code Files (35+ languages)
- Lines of code (total, code, comments, blank)
- Programming language detection
- Cyclomatic complexity
- Import/dependency extraction

### Archives
- File listing (without extraction)
- Compression ratio
- Total size (compressed/uncompressed)
- Format detection

## 💾 Where Data is Stored

- **SQLite Database**: `./data/metadata.db` (queryable)
- **JSON Export**: `./data/metadata.json` (portable)
- **Thumbnails**: `./thumbnails/` (image previews)
- **Logs**: `./logs/` (application logs)

## 🎯 Common Workflows

### Analyze Your Project for LLM Context
```bash
# Step 1: Analyze
node cli.js analyze .

# Step 2: Generate context for code review
node cli.js llm --category code --max-tokens 16000 > code-context.md

# Step 3: Use with Claude/GPT
# Copy code-context.md and paste into your LLM
```

### Organize Photo Library
```bash
# Analyze photos
node cli.js analyze ~/Pictures

# Find duplicates
node cli.js duplicates

# Find photos by camera
node cli.js query --category image --output json > photos.json

# Generate visual index
node cli.js tree --category image --format html > photo-index.html
```

### Code Quality Analysis
```bash
# Analyze codebase
node cli.js analyze ./my-project

# Get stats
node cli.js stats --category code

# Find complex files
node cli.js query --category code --output json | jq '.[] | select(.metadata.code.complexity > 10)'
```

## 🔧 Configuration

Create `config.json` to customize behavior:

```json
{
  "scanning": {
    "maxDepth": 5,
    "maxConcurrency": 8
  },
  "extractors": {
    "images": {
      "generateThumbnails": true,
      "thumbnailSizes": [150, 300]
    }
  }
}
```

## ⚙️ Requirements

- **Node.js** 16.0.0 or higher ✅
- **ffprobe** (for video analysis) - Install ffmpeg:
  ```bash
  # macOS
  brew install ffmpeg

  # Ubuntu
  sudo apt-get install ffmpeg
  ```

## 📚 More Information

- **Full Documentation**: [README.md](README.md)
- **Usage Examples**: [USAGE_EXAMPLES.md](USAGE_EXAMPLES.md)
- **Development Roadmap**: [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md)

## ✨ Features Highlights

- ✅ **Incremental Scanning** - Only processes new/changed files
- ✅ **50+ File Formats** - Images, videos, audio, PDFs, code, archives
- ✅ **LLM Optimized** - Token-aware context generation
- ✅ **Fast** - Parallel processing, efficient caching
- ✅ **Flexible** - Query API, multiple export formats
- ✅ **Visual** - ASCII/Mermaid/HTML tree diagrams

## 🎉 You're Ready!

The system is fully functional. Try it now:

```bash
node cli.js analyze .
node cli.js stats
node cli.js tree
```

Enjoy! 🚀
