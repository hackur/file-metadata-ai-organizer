/**
 * Metadata Analyzer
 * Main orchestrator for file metadata analysis
 */

const FileScanner = require('./utils/scanner');
const database = require('./storage/database');
const logger = require('./utils/logger');
const ProgressTracker = require('./utils/progress');

// Processors
const ImageProcessor = require('./processors/ImageProcessor');
const VideoProcessor = require('./processors/VideoProcessor');
const AudioProcessor = require('./processors/AudioProcessor');
const PDFProcessor = require('./processors/PDFProcessor');
const CodeProcessor = require('./processors/CodeProcessor');
const ArchiveProcessor = require('./processors/ArchiveProcessor');
const MarkdownProcessor = require('./processors/MarkdownProcessor');

class MetadataAnalyzer {
    constructor(config) {
        this.config = config;
        this.processors = [];
        this.progress = new ProgressTracker();
    }

    /**
     * Initialize analyzer
     */
    async init() {
        // Initialize logger
        await logger.init(this.config.logging);

        // Initialize database
        await database.init(this.config.storage);

        // Initialize processors
        this.initializeProcessors();

        logger.info('Metadata Analyzer initialized');
    }

    /**
     * Initialize file processors
     */
    initializeProcessors() {
        const extractorConfig = this.config.extractors || {};

        if (extractorConfig.images?.enabled !== false) {
            this.processors.push(new ImageProcessor({
                ...extractorConfig.images,
                thumbnailDir: './thumbnails'
            }));
        }

        if (extractorConfig.videos?.enabled !== false) {
            this.processors.push(new VideoProcessor(extractorConfig.videos));
        }

        if (extractorConfig.audio?.enabled !== false) {
            this.processors.push(new AudioProcessor(extractorConfig.audio));
        }

        if (extractorConfig.documents?.enabled !== false) {
            this.processors.push(new PDFProcessor(extractorConfig.documents));
            this.processors.push(new MarkdownProcessor(extractorConfig.documents));
        }

        if (extractorConfig.code?.enabled !== false) {
            this.processors.push(new CodeProcessor(extractorConfig.code));
        }

        if (extractorConfig.archives?.enabled !== false) {
            this.processors.push(new ArchiveProcessor(extractorConfig.archives));
        }

        logger.info(`Initialized ${this.processors.length} file processors`);
    }

    /**
     * Analyze directory
     */
    async analyze(directory) {
        const startTime = Date.now();
        logger.info(`Starting analysis of: ${directory}`);

        try {
            // Get ignore patterns
            const ignoreManager = await this.getIgnoreManager(directory);

            // Scan directory
            const scanner = new FileScanner(database, ignoreManager);
            const { files, stats } = await scanner.scan(directory, this.config.scanning);

            logger.info(`Scanned ${stats.totalFiles} files (${stats.newFiles} new, ${stats.modifiedFiles} modified, ${stats.unchangedFiles} unchanged)`);

            if (files.length === 0) {
                logger.info('No files to process');
                return {
                    duration: Date.now() - startTime,
                    stats: scanner.getStats()
                };
            }

            // Process files
            this.progress.start(files.length);

            for (const file of files) {
                await this.processFile(file);
                this.progress.update(file.relativePath);
            }

            this.progress.complete();

            // Save database
            await database.saveJSON();

            const duration = Date.now() - startTime;
            logger.info(`Analysis complete in ${duration}ms`);

            return {
                duration,
                stats: scanner.getStats(),
                filesProcessed: files.length
            };

        } catch (error) {
            logger.error('Analysis failed', error);
            throw error;
        }
    }

    /**
     * Process a single file
     */
    async processFile(fileInfo) {
        try {
            // Find appropriate processor
            const processor = this.processors.find(p => p.canProcess(fileInfo));

            if (processor) {
                // Process file
                const processed = await processor.process(fileInfo);

                // Store in database
                await database.upsertFile(processed);
            } else {
                // Store basic metadata without processing
                await database.upsertFile(fileInfo);
            }

        } catch (error) {
            logger.error(`Failed to process ${fileInfo.path}`, error);
        }
    }

    /**
     * Get ignore manager
     */
    async getIgnoreManager(directory) {
        if (this.config.scanning.respectGitignore !== false) {
            // Reuse the gitignore logic from original file
            const path = require('path');
            const fs = require('fs').promises;
            const ignore = require('ignore');
            const os = require('os');
            const { execSync } = require('child_process');

            const ig = ignore();

            // Read global gitignore
            const globalGitignorePath = path.join(os.homedir(), '.gitignore');
            try {
                const globalPatterns = await fs.readFile(globalGitignorePath, 'utf8');
                ig.add(globalPatterns);
            } catch (error) {
                // No global gitignore
            }

            // Read local gitignore
            const localGitignorePath = path.join(directory, '.gitignore');
            try {
                const localPatterns = await fs.readFile(localGitignorePath, 'utf8');
                ig.add(localPatterns);
            } catch (error) {
                // No local gitignore
            }

            // Default patterns
            ig.add('.git/\n.DS_Store\nnode_modules/');

            return ig;
        }
        return null;
    }

    /**
     * Set up progress callback
     */
    onProgress(callback) {
        this.progress.on('progress', callback);
    }

    /**
     * Close analyzer
     */
    async close() {
        await database.close();
        logger.close();
    }
}

module.exports = MetadataAnalyzer;
