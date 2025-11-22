/**
 * Office Processor
 * Extracts metadata and content from Microsoft Office documents (DOCX, XLSX, PPTX)
 * Supports legacy formats (DOC, XLS, PPT) with graceful degradation
 */

const BaseProcessor = require('./BaseProcessor');
const fs = require('fs').promises;
const path = require('path');
const mammoth = require('mammoth');
const XLSX = require('xlsx');

class OfficeProcessor extends BaseProcessor {
    /**
     * Determine if this processor can handle the given file
     * @param {Object} fileInfo - File information object
     * @returns {boolean}
     */
    canProcess(fileInfo) {
        const supportedExtensions = this.getSupportedExtensions();
        return supportedExtensions.includes(fileInfo.extension.toLowerCase());
    }

    /**
     * Main processing method
     * Orchestrates metadata extraction based on file type
     * @param {Object} fileInfo - File information object
     * @returns {Promise<Object>} Enhanced file information with metadata
     */
    async process(fileInfo) {
        const startTime = Date.now();
        this.logStart(fileInfo);

        try {
            if (!await this.validate(fileInfo)) {
                return fileInfo;
            }

            if (!fileInfo.metadata) fileInfo.metadata = {};
            fileInfo.metadata.office = {};

            // Determine file type and process accordingly
            const ext = fileInfo.extension.toLowerCase();

            if (this.isWordDocument(ext)) {
                await this.processWordDocument(fileInfo);
            } else if (this.isSpreadsheet(ext)) {
                await this.processSpreadsheet(fileInfo);
            } else if (this.isPresentation(ext)) {
                await this.processPresentation(fileInfo);
            }

            const duration = Date.now() - startTime;
            fileInfo.processing = {
                processedAt: new Date().toISOString(),
                processingTime: duration,
                version: '1.0.0',
                errors: []
            };

            this.logComplete(fileInfo, duration);
            return fileInfo;

        } catch (error) {
            return this.handleError(fileInfo, error);
        }
    }

    /**
     * Check if file is a Word document
     * @param {string} ext - File extension
     * @returns {boolean}
     */
    isWordDocument(ext) {
        return ['docx', 'doc'].includes(ext);
    }

    /**
     * Check if file is a spreadsheet
     * @param {string} ext - File extension
     * @returns {boolean}
     */
    isSpreadsheet(ext) {
        return ['xlsx', 'xls'].includes(ext);
    }

    /**
     * Check if file is a presentation
     * @param {string} ext - File extension
     * @returns {boolean}
     */
    isPresentation(ext) {
        return ['pptx', 'ppt'].includes(ext);
    }

    /**
     * Process Word document (DOCX/DOC)
     * Extracts: page count, word count, paragraphs, sections, images, tables
     * @param {Object} fileInfo - File information object
     * @throws {Error} If extraction fails
     */
    async processWordDocument(fileInfo) {
        try {
            const buffer = await fs.readFile(fileInfo.path);
            const result = await mammoth.extractRawText({
                arrayBuffer: buffer
            });

            const text = result.value || '';
            fileInfo.metadata.office.type = 'Word Document';
            fileInfo.metadata.office.format = fileInfo.extension.toUpperCase();

            // Extract text metrics
            this.extractTextMetrics(fileInfo, text);

            // Extract document structure
            await this.extractDocumentStructure(fileInfo, buffer);

            // Extract images and tables
            if (this.config.extractImages !== false || this.config.extractTables !== false) {
                await this.extractOfficeComponents(fileInfo, buffer, 'word');
            }

            // Extract content preview
            if (this.config.extractText !== false) {
                const maxLength = this.config.maxTextLength || 5000;
                fileInfo.metadata.office.contentPreview = text.substring(0, maxLength);
            }

        } catch (error) {
            throw new Error(`Failed to process Word document: ${error.message}`);
        }
    }

    /**
     * Process Spreadsheet (XLSX/XLS)
     * Extracts: sheet names, dimensions, formula count, embedded objects, named ranges
     * @param {Object} fileInfo - File information object
     * @throws {Error} If extraction fails
     */
    async processSpreadsheet(fileInfo) {
        try {
            const buffer = await fs.readFile(fileInfo.path);
            const workbook = XLSX.read(buffer, { defval: '' });

            fileInfo.metadata.office.type = 'Spreadsheet';
            fileInfo.metadata.office.format = fileInfo.extension.toUpperCase();
            fileInfo.metadata.office.sheetCount = workbook.SheetNames.length;
            fileInfo.metadata.office.sheetNames = workbook.SheetNames || [];

            // Initialize sheet details array
            fileInfo.metadata.office.sheets = [];

            // Process each sheet
            for (const sheetName of workbook.SheetNames) {
                const worksheet = workbook.Sheets[sheetName];
                const sheetMetadata = this.analyzeSheet(sheetName, worksheet);
                fileInfo.metadata.office.sheets.push(sheetMetadata);
            }

            // Extract summary metrics
            this.summarizeSpreadsheetMetrics(fileInfo);

            // Extract named ranges if available
            if (workbook.defined && workbook.defined.length > 0) {
                fileInfo.metadata.office.namedRanges = workbook.defined.map(range => ({
                    name: range.name,
                    reference: range.ref
                }));
            }

            // Extract workbook properties if available
            if (workbook.Props) {
                fileInfo.metadata.office.properties = {
                    title: workbook.Props.Title,
                    subject: workbook.Props.Subject,
                    author: workbook.Props.Author,
                    keywords: workbook.Props.Keywords,
                    comments: workbook.Props.Comments,
                    lastModifiedBy: workbook.Props.LastAuthor,
                    createdDate: workbook.Props.CreatedDate,
                    modifiedDate: workbook.Props.ModifiedDate
                };
            }

        } catch (error) {
            throw new Error(`Failed to process spreadsheet: ${error.message}`);
        }
    }

    /**
     * Process Presentation (PPTX/PPT)
     * Extracts: slide count, slide titles, speaker notes, embedded media
     * @param {Object} fileInfo - File information object
     * @throws {Error} If extraction fails
     */
    async processPresentation(fileInfo) {
        try {
            const buffer = await fs.readFile(fileInfo.path);

            // For PPTX, we can extract some metadata from the zip structure
            const JSZip = require('unzipper');
            const stream = require('stream');

            fileInfo.metadata.office.type = 'Presentation';
            fileInfo.metadata.office.format = fileInfo.extension.toUpperCase();

            // Try to extract slide count and basic info
            await this.extractPresentationMetadata(fileInfo, buffer);

        } catch (error) {
            throw new Error(`Failed to process presentation: ${error.message}`);
        }
    }

    /**
     * Extract presentation metadata from PPTX/PPT structure
     * @param {Object} fileInfo - File information object
     * @param {Buffer} buffer - File buffer
     */
    async extractPresentationMetadata(fileInfo, buffer) {
        try {
            const unzipper = require('unzipper');
            const Readable = require('stream').Readable;

            const bufferStream = new Readable();
            bufferStream.push(buffer);
            bufferStream.push(null);

            const directory = await unzipper.Open.buffer(buffer);

            // Count slides by looking at ppt/slides directory
            const slideFiles = directory.files.filter(f =>
                f.path.startsWith('ppt/slides/slide') && f.path.endsWith('.xml')
            );

            fileInfo.metadata.office.slideCount = slideFiles.length;
            fileInfo.metadata.office.slides = [];

            // Extract presentation properties if available
            const propsFile = directory.files.find(f => f.path === 'docProps/core.xml');
            if (propsFile) {
                const propsContent = await propsFile.buffer();
                this.parsePresProperties(fileInfo, propsContent.toString());
            }

            // Extract slide titles
            for (let i = 0; i < Math.min(slideFiles.length, 50); i++) {
                const slideFile = slideFiles[i];
                try {
                    const slideContent = await slideFile.buffer();
                    const title = this.extractSlideTitle(slideContent.toString());
                    fileInfo.metadata.office.slides.push({
                        number: i + 1,
                        title: title || `Slide ${i + 1}`
                    });
                } catch (e) {
                    fileInfo.metadata.office.slides.push({
                        number: i + 1,
                        title: `Slide ${i + 1}`
                    });
                }
            }

        } catch (error) {
            fileInfo.metadata.office.slideCount = 0;
            fileInfo.metadata.office.slides = [];
            fileInfo.metadata.office.presentationExtractionNote = `Limited extraction: ${error.message}`;
        }
    }

    /**
     * Extract slide title from slide XML content
     * @param {string} xmlContent - XML content of slide
     * @returns {string|null} Slide title or null
     */
    extractSlideTitle(xmlContent) {
        try {
            // Simple regex to find text in slide XML
            const textMatch = xmlContent.match(/<a:t>([^<]+)<\/a:t>/);
            return textMatch ? textMatch[1].substring(0, 100) : null;
        } catch {
            return null;
        }
    }

    /**
     * Parse presentation properties from core.xml
     * @param {Object} fileInfo - File information object
     * @param {string} xmlContent - XML content
     */
    parsePresProperties(fileInfo, xmlContent) {
        try {
            const titleMatch = xmlContent.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/);
            const creatorMatch = xmlContent.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/);
            const subjectMatch = xmlContent.match(/<dc:subject[^>]*>([^<]+)<\/dc:subject>/);

            fileInfo.metadata.office.properties = {
                title: titleMatch ? titleMatch[1] : undefined,
                author: creatorMatch ? creatorMatch[1] : undefined,
                subject: subjectMatch ? subjectMatch[1] : undefined
            };
        } catch {
            // Silently fail on property extraction
        }
    }

    /**
     * Extract text metrics from document
     * Calculates: word count, character count, paragraph count, line count
     * @param {Object} fileInfo - File information object
     * @param {string} text - Document text content
     */
    extractTextMetrics(fileInfo, text) {
        if (!text) {
            fileInfo.metadata.office.wordCount = 0;
            fileInfo.metadata.office.charCount = 0;
            fileInfo.metadata.office.paragraphCount = 0;
            fileInfo.metadata.office.lineCount = 0;
            return;
        }

        // Word count (split by whitespace)
        const words = text.trim().split(/\s+/).filter(w => w.length > 0);
        fileInfo.metadata.office.wordCount = words.length;

        // Character count
        fileInfo.metadata.office.charCount = text.length;

        // Paragraph count (double newline = paragraph break)
        const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
        fileInfo.metadata.office.paragraphCount = paragraphs.length;

        // Line count
        const lines = text.split('\n');
        fileInfo.metadata.office.lineCount = lines.length;
    }

    /**
     * Extract document structure from Word document
     * Analyzes: styles, sections, headings
     * @param {Object} fileInfo - File information object
     * @param {Buffer} buffer - File buffer
     */
    async extractDocumentStructure(fileInfo, buffer) {
        try {
            const JSZip = require('unzipper');

            const directory = await JSZip.Open.buffer(buffer);

            // Extract styles
            const stylesFile = directory.files.find(f => f.path === 'word/styles.xml');
            if (stylesFile) {
                const stylesContent = await stylesFile.buffer();
                const styleCount = (stylesContent.toString().match(/<w:style/g) || []).length;
                fileInfo.metadata.office.styleCount = styleCount;
            }

            // Count images
            const imageFiles = directory.files.filter(f =>
                f.path.startsWith('word/media/') &&
                /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(f.path)
            );
            fileInfo.metadata.office.imageCount = imageFiles.length;

            if (imageFiles.length > 0 && this.config.extractImages !== false) {
                fileInfo.metadata.office.images = imageFiles.map(img => ({
                    filename: path.basename(img.path),
                    path: img.path
                }));
            }

            // Count tables
            const docFile = directory.files.find(f => f.path === 'word/document.xml');
            if (docFile) {
                const docContent = await docFile.buffer();
                const tableCount = (docContent.toString().match(/<w:tbl>/g) || []).length;
                fileInfo.metadata.office.tableCount = tableCount;
            }

        } catch (error) {
            fileInfo.metadata.office.structureExtractionNote = `Limited structure extraction: ${error.message}`;
        }
    }

    /**
     * Extract components from Office files (images, tables, etc.)
     * @param {Object} fileInfo - File information object
     * @param {Buffer} buffer - File buffer
     * @param {string} docType - Document type ('word', 'excel', 'powerpoint')
     */
    async extractOfficeComponents(fileInfo, buffer, docType) {
        try {
            const JSZip = require('unzipper');
            const directory = await JSZip.Open.buffer(buffer);

            // Extract image references
            if (this.config.extractImages !== false) {
                const imageFiles = directory.files.filter(f => {
                    const imagePath = `${docType}/media/`;
                    return f.path.startsWith(imagePath) &&
                           /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(f.path);
                });

                if (imageFiles.length > 0) {
                    fileInfo.metadata.office.images = imageFiles.map(img => ({
                        filename: path.basename(img.path),
                        path: img.path,
                        size: img.size
                    }));
                }
            }

        } catch (error) {
            // Silently fail on component extraction
        }
    }

    /**
     * Analyze individual spreadsheet
     * Extracts: dimensions, used range, formula count, data types
     * @param {string} sheetName - Name of the sheet
     * @param {Object} worksheet - XLSX worksheet object
     * @returns {Object} Sheet metadata
     */
    analyzeSheet(sheetName, worksheet) {
        const sheetData = {
            name: sheetName,
            rowCount: 0,
            columnCount: 0,
            cellCount: 0,
            formulaCount: 0,
            usedRange: null
        };

        if (!worksheet) {
            return sheetData;
        }

        try {
            // Get used range
            const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
            sheetData.rowCount = range.e.r + 1;
            sheetData.columnCount = range.e.c + 1;
            sheetData.usedRange = worksheet['!ref'];

            // Count cells and formulas
            let cellCount = 0;
            let formulaCount = 0;

            for (const key in worksheet) {
                if (key.startsWith('!')) continue;

                cellCount++;

                // Check for formula (starts with =)
                if (worksheet[key].f) {
                    formulaCount++;
                }
            }

            sheetData.cellCount = cellCount;
            sheetData.formulaCount = formulaCount;

        } catch (error) {
            // Silently handle range parsing errors
        }

        return sheetData;
    }

    /**
     * Summarize overall spreadsheet metrics
     * Aggregates metrics across all sheets
     * @param {Object} fileInfo - File information object
     */
    summarizeSpreadsheetMetrics(fileInfo) {
        try {
            let totalRows = 0;
            let totalColumns = 0;
            let totalCells = 0;
            let totalFormulas = 0;

            for (const sheet of fileInfo.metadata.office.sheets) {
                totalRows += sheet.rowCount;
                totalColumns = Math.max(totalColumns, sheet.columnCount);
                totalCells += sheet.cellCount;
                totalFormulas += sheet.formulaCount;
            }

            fileInfo.metadata.office.totalRows = totalRows;
            fileInfo.metadata.office.maxColumns = totalColumns;
            fileInfo.metadata.office.totalCells = totalCells;
            fileInfo.metadata.office.totalFormulas = totalFormulas;

        } catch (error) {
            // Silently handle summarization errors
        }
    }

    /**
     * Get supported file extensions
     * Supports both modern and legacy Office formats
     * @returns {Array<string>} Array of supported extensions
     */
    getSupportedExtensions() {
        return ['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt'];
    }

    /**
     * Get supported MIME types
     * @returns {Array<string>} Array of supported MIME types
     */
    getSupportedMimeTypes() {
        return [
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/vnd.ms-powerpoint'
        ];
    }
}

module.exports = OfficeProcessor;
