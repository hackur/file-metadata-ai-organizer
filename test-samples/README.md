# Test Samples Directory

This directory contains sample files for testing the metadata extraction capabilities of the file organizer.

## Directory Structure

### images/
Sample image files for testing ImageProcessor:
- **Needed:** JPEG with EXIF data (camera info, exposure, ISO)
- **Needed:** JPEG with GPS coordinates
- **Needed:** PNG with metadata
- **Needed:** HEIC/HEIF images
- **Needed:** RAW format (CR2, NEF, ARW)
- **Needed:** Multi-page TIFF
- **Needed:** Animated GIF
- **Needed:** WebP images
- **Needed:** Very large images (>50MB) for memory testing
- **Needed:** Corrupted image files for error handling

### videos/
Sample video files for testing VideoProcessor:
- **Needed:** MP4 with metadata (duration, resolution, codec)
- **Needed:** Video with multiple audio tracks
- **Needed:** Video with subtitle tracks
- **Needed:** MKV, AVI, MOV formats
- **Needed:** 4K video for performance testing
- **Needed:** Very long duration video (>1 hour)
- **Needed:** Corrupted video file

### audio/
Sample audio files for testing AudioProcessor:
- **Needed:** MP3 with ID3 tags (artist, album, year)
- **Needed:** FLAC with metadata
- **Needed:** WAV files
- **Needed:** M4A/AAC formats
- **Needed:** OGG Vorbis
- **Needed:** Audio with album artwork
- **Needed:** Very long audio file (>1 hour)

### documents/
Sample document files for testing PDFProcessor:
- **Needed:** PDF with metadata (author, title, subject)
- **Needed:** Multi-page PDF
- **Needed:** PDF with forms
- **Needed:** Encrypted/password-protected PDF
- **Needed:** Scanned PDF (image-only)
- **Needed:** PDF with annotations
- **Needed:** Very large PDF (100+ pages)

### office/
Sample Office documents for testing OfficeProcessor:
- **Needed:** DOCX with metadata (author, title, dates)
- **Needed:** XLSX with multiple sheets
- **Needed:** PPTX with slides
- **Needed:** Password-protected DOCX
- **Needed:** Document with macros
- **Needed:** Document with embedded objects
- **Needed:** Legacy formats (DOC, XLS, PPT)
- **Needed:** Very large spreadsheet (10k+ rows)

### fonts/
Sample font files for testing FontProcessor:
- **Needed:** TTF (TrueType) font
- **Needed:** OTF (OpenType) font
- **Needed:** WOFF/WOFF2 web fonts
- **Needed:** Font collection (TTC, OTC)
- **Needed:** Variable font
- **Needed:** Font with complete metadata (family, style, version)

### archives/
Sample archive files for testing ArchiveProcessor:
- **Needed:** ZIP archive
- **Needed:** TAR.GZ archive
- **Needed:** RAR archive
- **Needed:** 7Z archive
- **Needed:** Nested archive (ZIP containing ZIPs)
- **Needed:** Encrypted archive
- **Needed:** Corrupted archive
- **Needed:** Very large archive (>100MB)

### code/
Sample code files for testing CodeProcessor:
- **Needed:** JavaScript/TypeScript files
- **Needed:** Python files
- **Needed:** Java files
- **Needed:** C/C++ files
- **Needed:** Go files
- **Needed:** Rust files
- **Needed:** Files with different encodings (UTF-8, UTF-16)
- **Needed:** Very large source file (>10k lines)
- **Needed:** Minified JavaScript

### markdown/
Sample markdown files for testing MarkdownProcessor:
- **Needed:** Standard markdown with headers
- **Needed:** Markdown with frontmatter
- **Needed:** Markdown with tables
- **Needed:** Markdown with code blocks
- **Needed:** Very long markdown document

## Test Scenarios

### Edge Cases to Test
1. **Symlinks:** Create symlinks to test circular reference detection
2. **Special Characters:** Files with unicode, emoji, spaces in names
3. **Permissions:** Files with restricted read permissions
4. **Size Extremes:** Very small (<1KB) and very large (>1GB) files
5. **Corruption:** Intentionally corrupted files for error handling
6. **Empty Files:** Zero-byte files
7. **Binary Masquerading:** Binary files with text extensions

### Performance Tests
1. **Large File Processing:** Test with 100MB, 500MB, 1GB files
2. **Concurrent Processing:** Multiple files being processed simultaneously
3. **Memory Usage:** Monitor memory with large files
4. **Hash Calculation:** Test different hash algorithms on various sizes

### Integration Tests
1. **Full Scan:** Scan entire test-samples directory
2. **Incremental Scan:** Modify files and verify incremental detection
3. **Export:** Test JSON, HTML, CSV exports with all metadata
4. **Query:** Test filtering and searching across all metadata types
5. **Duplicate Detection:** Test with identical and similar files

## Adding Samples

When adding test samples:
1. Use freely licensed or public domain files
2. Include files with rich metadata when possible
3. Document any special characteristics in a separate file
4. Keep individual files under 100MB (except for specific large-file tests)
5. Ensure no sensitive or personal information in metadata
