# Usage Examples

## Basic Usage

### 1. First Time Analysis

```bash
# Analyze your project directory
fmao analyze ./my-project

# This will:
# - Scan all files (respecting .gitignore)
# - Extract metadata based on file types
# - Store results in data/metadata.db and data/metadata.json
# - Generate thumbnails for images in thumbnails/
# - Create logs in logs/
```

### 2. Incremental Updates

```bash
# Run again - only processes new/modified files
fmao analyze ./my-project

# Force full rescan
fmao analyze ./my-project --no-incremental
```

## Query Examples

### Find Specific File Types

```bash
# All images
fmao query --category image

# All videos
fmao query --category video

# All JavaScript files
fmao query --extension js

# All Python code
fmao query --extension py
```

### Size-Based Queries

```bash
# Files larger than 10MB
fmao query --min-size 10485760

# Files between 1MB and 10MB
fmao query --min-size 1048576 --max-size 10485760

# Top 20 largest files
fmao query --sort size --limit 20
```

### Search

```bash
# Search by filename
fmao query --search "vacation"

# Search with category filter
fmao query --category document --search "report"
```

## Statistics & Analysis

### Overall Statistics

```bash
# Show all stats
fmao stats

# Output:
# 📊 File Statistics
#
# Total files: 1,234
# Total size: 15.67 GB
#
# By category:
#   image: 450
#   video: 23
#   audio: 156
#   document: 89
#   code: 512
#   archive: 4
```

### Category-Specific Stats

```bash
# Image statistics
fmao stats --category image

# Code statistics
fmao stats --category code
```

## Visualizations

### Directory Trees

```bash
# Simple ASCII tree
fmao tree

# Output:
# 📁 my-project/
# ├── 📁 src/
# │   ├── 💻 index.js (2.34 KB)
# │   └── 💻 utils.js (1.56 KB)
# ├── 📁 images/
# │   ├── 🖼️ logo.png (45.2 KB)
# │   └── 🖼️ banner.jpg (128 KB)
# └── 📄 README.md (3.21 KB)
```

```bash
# Mermaid diagram (for documentation)
fmao tree --format mermaid --output structure.mmd

# HTML interactive tree
fmao tree --format html --output tree.html
```

### Filtered Trees

```bash
# Only show images
fmao tree --category image

# Only show code files
fmao tree --category code
```

## LLM Context Generation

### For Code Review

```bash
# Generate context with code files
fmao llm --category code --max-tokens 16000 > code-context.md

# Use with Claude Code or ChatGPT
# Copy the contents and paste into your LLM conversation
```

### For Project Overview

```bash
# Generate comprehensive project context
fmao llm --max-tokens 32000 --output project-context.md

# The output will include:
# - File structure overview
# - Code metrics
# - Document summaries
# - Image information
# - All organized within token limits
```

### For Specific Analysis

```bash
# Only documents (PDFs, Markdown, etc.)
fmao llm --category document --max-tokens 8000 --output docs-context.md

# Only images with metadata
fmao llm --category image --max-tokens 4000 --output images-context.md

# JSON format for API integration
fmao llm --format json --output context.json
```

## Finding Duplicates

### Find Duplicate Files

```bash
fmao duplicates

# Output:
# Found 3 sets of duplicates:
#
# 📦 2 files (256.34 KB total):
#    photos/img_001.jpg
#    backup/img_001.jpg
#
# 📦 3 files (1.45 MB total):
#    docs/report.pdf
#    archive/old/report.pdf
#    backup/report.pdf
```

## Advanced Workflows

### 1. Photo Library Organization

```bash
# Step 1: Analyze photos
fmao analyze ~/Pictures

# Step 2: Find photos by camera
fmao query --category image --output json | \
  jq '.[] | select(.metadata.image.exif.make == "Canon")'

# Step 3: Find photos from specific date
fmao query --category image --output json | \
  jq '.[] | select(.metadata.image.exif.dateTime | startswith("2024"))'

# Step 4: Find duplicates
fmao duplicates

# Step 5: Generate visual catalog
fmao tree --category image --format html --output photo-catalog.html
```

### 2. Code Project Analysis

```bash
# Step 1: Analyze project
fmao analyze ./my-app

# Step 2: Get code statistics
fmao stats --category code

# Step 3: Find complex files
fmao query --category code --output json | \
  jq '.[] | select(.metadata.code.complexity > 10)'

# Step 4: Generate LLM context for code review
fmao llm --category code --max-tokens 32000 > code-review.md

# Step 5: Find large files that might need refactoring
fmao query --category code --min-size 10000 --sort size
```

### 3. Media Library Management

```bash
# Step 1: Analyze media
fmao analyze ~/Media

# Step 2: Find videos without metadata
fmao query --category video --output json | \
  jq '.[] | select(.metadata.video.tags == null)'

# Step 3: Find music by artist
fmao query --category audio --output json | \
  jq '.[] | select(.metadata.audio.tags.artist == "The Beatles")'

# Step 4: Generate catalog
fmao llm --max-tokens 50000 --output media-catalog.md
```

### 4. Documentation Generation

```bash
# Step 1: Analyze project
fmao analyze ./my-project

# Step 2: Generate project stats
fmao stats > docs/PROJECT_STATS.md

# Step 3: Add directory structure
fmao tree --format markdown >> docs/PROJECT_STATS.md

# Step 4: Extract all markdown docs
fmao query --extension md --output json | \
  jq '.[] | {path: .relativePath, title: .metadata.document.title}'

# Step 5: Generate comprehensive context
fmao llm --max-tokens 64000 --output docs/PROJECT_CONTEXT.md
```

## Output Format Examples

### JSON Query Output

```bash
fmao query --category image --limit 1 --output json
```

```json
[
  {
    "path": "/full/path/vacation.jpg",
    "relativePath": "photos/vacation.jpg",
    "name": "vacation.jpg",
    "extension": "jpg",
    "size": 2456789,
    "created": "2024-01-15T10:30:00.000Z",
    "modified": "2024-01-15T10:30:00.000Z",
    "mimeType": "image/jpeg",
    "category": "image",
    "metadata": {
      "image": {
        "width": 4032,
        "height": 3024,
        "aspectRatio": 1.33,
        "exif": {
          "make": "Canon",
          "model": "EOS R5",
          "dateTime": "2024-01-15T10:30:00",
          "iso": 400,
          "fNumber": 5.6
        },
        "dominantColors": [
          {"r": 135, "g": 206, "b": 235, "hex": "#87CEEB"}
        ]
      }
    }
  }
]
```

### Markdown LLM Output

```bash
fmao llm --category code --max-tokens 8000 --format markdown
```

```markdown
# File Metadata Context

Total files available: 45

## src/index.js
- **Type**: code (js)
- **Size**: 2.34 KB
- **Modified**: 11/20/2025
- **Language**: JavaScript
- **Lines**: 87 code, 12 comments
- **Complexity**: 5

## src/utils.js
- **Type**: code (js)
- **Size**: 1.56 KB
- **Modified**: 11/19/2025
- **Language**: JavaScript
- **Lines**: 65 code, 8 comments
- **Complexity**: 3

---
Included: 2 of 45 files (1,245 tokens)
```

## Configuration Examples

### Custom config.json

```json
{
  "scanning": {
    "maxDepth": 5,
    "respectGitignore": true,
    "maxConcurrency": 8
  },
  "storage": {
    "type": "both",
    "dbPath": "./custom-data/files.db",
    "jsonPath": "./custom-data/files.json"
  },
  "extractors": {
    "images": {
      "enabled": true,
      "extractExif": true,
      "generateThumbnails": true,
      "thumbnailSizes": [150, 300, 600]
    },
    "videos": {
      "enabled": true,
      "ffprobePath": "/usr/local/bin/ffprobe"
    },
    "code": {
      "enabled": true,
      "calculateComplexity": true,
      "extractImports": true
    }
  },
  "llm": {
    "contextWindow": 128000,
    "tokenCountingModel": "gpt-4"
  }
}
```

### Environment Variables

```bash
# Set logging to debug
export FMAO_LOGGING_LEVEL=debug

# Use only JSON storage
export FMAO_STORAGE_TYPE=json

# Increase concurrency
export FMAO_SCANNING_MAXCONCURRENCY=16

# Then run
fmao analyze ./my-project
```

## Integration Examples

### With Git Hooks

```bash
# .git/hooks/post-commit
#!/bin/bash
fmao analyze . --no-incremental
git add data/metadata.json
git commit -m "Update file metadata" --no-verify
```

### With CI/CD

```yaml
# .github/workflows/analyze.yml
name: Analyze Files
on: [push]
jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: fmao analyze .
      - run: fmao stats > file-stats.md
      - uses: actions/upload-artifact@v2
        with:
          name: metadata
          path: data/
```

### With Node.js Scripts

```javascript
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function analyzeProject() {
  // Run analysis
  await execAsync('fmao analyze .');

  // Get stats as JSON
  const { stdout } = await execAsync('fmao query --output json');
  const files = JSON.parse(stdout);

  // Process results
  console.log(`Analyzed ${files.length} files`);
}

analyzeProject();
```
