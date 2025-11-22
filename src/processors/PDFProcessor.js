/**
 * PDF Processor
 * Extracts metadata and content from PDF files
 */

const BaseProcessor = require('./BaseProcessor');
const pdf = require('pdf-parse');
const fs = require('fs').promises;

class PDFProcessor extends BaseProcessor {
    canProcess(fileInfo) {
        return fileInfo.extension === 'pdf' || fileInfo.mimeType === 'application/pdf';
    }

    async process(fileInfo) {
        const startTime = Date.now();
        this.logStart(fileInfo);

        try {
            if (!await this.validate(fileInfo)) {
                return fileInfo;
            }

            if (!fileInfo.metadata) fileInfo.metadata = {};
            fileInfo.metadata.document = {};

            // Extract PDF metadata
            await this.extractPDFMetadata(fileInfo);

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
     * Extract PDF metadata and content
     */
    async extractPDFMetadata(fileInfo) {
        try {
            const dataBuffer = await fs.readFile(fileInfo.path);
            const data = await pdf(dataBuffer);

            // Extract basic information
            fileInfo.metadata.document.pageCount = data.numpages;

            // Extract metadata
            if (data.info) {
                fileInfo.metadata.document.title = data.info.Title;
                fileInfo.metadata.document.author = data.info.Author;
                fileInfo.metadata.document.subject = data.info.Subject;
                fileInfo.metadata.document.keywords = data.info.Keywords ? data.info.Keywords.split(/[,;]/).map(k => k.trim()) : [];
                fileInfo.metadata.document.creator = data.info.Creator;
                fileInfo.metadata.document.producer = data.info.Producer;
                fileInfo.metadata.document.creationDate = data.info.CreationDate;
                fileInfo.metadata.document.modificationDate = data.info.ModDate;
            }

            // Extract metadata from PDF metadata field
            if (data.metadata) {
                fileInfo.metadata.document.pdfVersion = data.metadata._metadata?.['pdf:PDFVersion'];
                fileInfo.metadata.document.pdfProducer = data.metadata._metadata?.['pdf:Producer'];
            }

            // Extract text content (limited)
            if (this.config.extractText !== false && data.text) {
                const maxTextLength = this.config.maxTextLength || 10000;
                fileInfo.metadata.document.textContent = data.text.substring(0, maxTextLength);
                fileInfo.metadata.document.wordCount = data.text.split(/\s+/).length;
                fileInfo.metadata.document.charCount = data.text.length;

                // Extract first paragraph as summary
                const firstParagraph = data.text.split('\n\n')[0];
                if (firstParagraph) {
                    fileInfo.metadata.document.summary = firstParagraph.substring(0, 500);
                }
            }

            fileInfo.metadata.document.format = 'PDF';

        } catch (error) {
            throw new Error(`Failed to extract PDF metadata: ${error.message}`);
        }
    }

    getSupportedExtensions() {
        return ['pdf'];
    }

    getSupportedMimeTypes() {
        return ['application/pdf'];
    }
}

module.exports = PDFProcessor;
