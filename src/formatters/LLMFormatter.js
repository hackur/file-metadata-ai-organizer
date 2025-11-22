/**
 * LLM Formatter
 * Formats metadata for optimal LLM context injection
 */

const { encoding_for_model } = require('tiktoken');

class LLMFormatter {
    constructor(config = {}) {
        this.config = config;
        this.contextWindow = config.contextWindow || 32000;
        this.model = config.tokenCountingModel || 'gpt-4';

        try {
            this.encoder = encoding_for_model(this.model);
        } catch (error) {
            // Fallback to cl100k_base encoding
            this.encoder = encoding_for_model('gpt-4');
        }
    }

    /**
     * Format files for LLM context
     */
    formatForLLM(files, options = {}) {
        const {
            maxTokens = this.contextWindow,
            prioritizeRecent = true,
            includeSummaries = true,
            format = 'markdown'
        } = options;

        // Sort and prioritize files
        let sortedFiles = this.prioritizeFiles(files, prioritizeRecent);

        // Build context within token limit
        const context = this.buildContext(sortedFiles, maxTokens, includeSummaries, format);

        return context;
    }

    /**
     * Prioritize files for inclusion
     */
    prioritizeFiles(files, prioritizeRecent) {
        const scored = files.map(file => ({
            file,
            score: this.calculateImportanceScore(file, prioritizeRecent)
        }));

        return scored
            .sort((a, b) => b.score - a.score)
            .map(item => item.file);
    }

    /**
     * Calculate importance score for file
     */
    calculateImportanceScore(file, prioritizeRecent) {
        let score = 0;

        // Recency bonus
        if (prioritizeRecent) {
            const daysSinceModified = (Date.now() - new Date(file.modified).getTime()) / (1000 * 60 * 60 * 24);
            score += Math.max(0, 100 - daysSinceModified);
        }

        // Category weights
        const categoryWeights = {
            document: 10,
            code: 8,
            image: 5,
            video: 3,
            audio: 3,
            archive: 2,
            other: 1
        };
        score += categoryWeights[file.category] || 1;

        // Has content bonus
        if (file.metadata?.document?.textContent) score += 20;
        if (file.metadata?.code?.imports?.length > 0) score += 10;

        // Manual importance
        if (file.llm?.importance) score += file.llm.importance * 10;

        return score;
    }

    /**
     * Build context string within token limit
     */
    buildContext(files, maxTokens, includeSummaries, format) {
        const parts = [];
        let totalTokens = 0;

        // Add header
        const header = this.formatHeader(files.length, format);
        const headerTokens = this.countTokens(header);
        parts.push(header);
        totalTokens += headerTokens;

        // Reserve tokens for footer
        const footerReserve = 100;
        const availableTokens = maxTokens - totalTokens - footerReserve;

        // Add files
        for (const file of files) {
            const fileContent = this.formatFile(file, includeSummaries, format);
            const fileTokens = this.countTokens(fileContent);

            if (totalTokens + fileTokens > availableTokens) {
                parts.push(this.formatTruncationNotice(files.length - parts.length + 1, format));
                break;
            }

            parts.push(fileContent);
            totalTokens += fileTokens;
        }

        // Add footer with statistics
        const footer = this.formatFooter(parts.length - 1, files.length, totalTokens, format);
        parts.push(footer);

        return parts.join('\n\n');
    }

    /**
     * Format header
     */
    formatHeader(totalFiles, format) {
        if (format === 'json') {
            return JSON.stringify({ type: 'file_metadata', totalFiles });
        }

        return `# File Metadata Context\n\nTotal files available: ${totalFiles}`;
    }

    /**
     * Format footer
     */
    formatFooter(includedFiles, totalFiles, tokens, format) {
        if (format === 'json') {
            return JSON.stringify({ included: includedFiles, total: totalFiles, tokens });
        }

        return `---\nIncluded: ${includedFiles} of ${totalFiles} files (${tokens} tokens)`;
    }

    /**
     * Format truncation notice
     */
    formatTruncationNotice(remainingCount, format) {
        if (format === 'json') {
            return JSON.stringify({ truncated: true, remaining: remainingCount });
        }

        return `\n... (${remainingCount} more files omitted due to token limit)`;
    }

    /**
     * Format single file
     */
    formatFile(file, includeSummary, format) {
        if (format === 'json') {
            return JSON.stringify(this.getFileForJSON(file, includeSummary), null, 2);
        }

        // Markdown format
        const parts = [];

        parts.push(`## ${file.relativePath}`);
        parts.push(`- **Type**: ${file.category} (${file.extension})`);
        parts.push(`- **Size**: ${file.sizeFormatted || this.formatSize(file.size)}`);
        parts.push(`- **Modified**: ${new Date(file.modified).toLocaleDateString()}`);

        // Add type-specific metadata
        if (file.category === 'image' && file.metadata?.image) {
            const img = file.metadata.image;
            parts.push(`- **Dimensions**: ${img.width}x${img.height}`);
            if (img.exif?.make) parts.push(`- **Camera**: ${img.exif.make} ${img.exif.model || ''}`);
        }

        if (file.category === 'video' && file.metadata?.video) {
            const vid = file.metadata.video;
            parts.push(`- **Duration**: ${this.formatDuration(vid.duration)}`);
            parts.push(`- **Resolution**: ${vid.width}x${vid.height}`);
        }

        if (file.category === 'audio' && file.metadata?.audio) {
            const aud = file.metadata.audio;
            if (aud.tags?.title) parts.push(`- **Title**: ${aud.tags.title}`);
            if (aud.tags?.artist) parts.push(`- **Artist**: ${aud.tags.artist}`);
            parts.push(`- **Duration**: ${this.formatDuration(aud.duration)}`);
        }

        if (file.category === 'document' && file.metadata?.document) {
            const doc = file.metadata.document;
            if (doc.pageCount) parts.push(`- **Pages**: ${doc.pageCount}`);
            if (doc.wordCount) parts.push(`- **Words**: ${doc.wordCount}`);
            if (doc.title) parts.push(`- **Title**: ${doc.title}`);
            if (doc.author) parts.push(`- **Author**: ${doc.author}`);

            if (includeSummary && doc.summary) {
                parts.push(`\n**Summary**: ${doc.summary}`);
            }
        }

        if (file.category === 'code' && file.metadata?.code) {
            const code = file.metadata.code;
            parts.push(`- **Language**: ${code.language}`);
            parts.push(`- **Lines**: ${code.linesCode} code, ${code.linesComment} comments`);
            if (code.complexity) parts.push(`- **Complexity**: ${code.complexity}`);
        }

        if (file.tags && file.tags.length > 0) {
            parts.push(`- **Tags**: ${file.tags.join(', ')}`);
        }

        return parts.join('\n');
    }

    /**
     * Get file data for JSON format
     */
    getFileForJSON(file, includeSummary) {
        const data = {
            path: file.relativePath,
            category: file.category,
            size: file.size,
            modified: file.modified
        };

        if (file.metadata) {
            data.metadata = this.selectRelevantMetadata(file.metadata, includeSummary);
        }

        if (file.tags) {
            data.tags = file.tags;
        }

        return data;
    }

    /**
     * Select relevant metadata fields
     */
    selectRelevantMetadata(metadata, includeSummary) {
        const relevant = {};

        if (metadata.image) {
            relevant.image = {
                width: metadata.image.width,
                height: metadata.image.height,
                dominantColors: metadata.image.dominantColors
            };
        }

        if (metadata.video) {
            relevant.video = {
                duration: metadata.video.duration,
                width: metadata.video.width,
                height: metadata.video.height
            };
        }

        if (metadata.audio) {
            relevant.audio = {
                duration: metadata.audio.duration,
                tags: metadata.audio.tags
            };
        }

        if (metadata.document) {
            relevant.document = {
                pageCount: metadata.document.pageCount,
                wordCount: metadata.document.wordCount,
                title: metadata.document.title,
                author: metadata.document.author
            };

            if (includeSummary) {
                relevant.document.summary = metadata.document.summary;
            }
        }

        if (metadata.code) {
            relevant.code = {
                language: metadata.code.language,
                linesCode: metadata.code.linesCode,
                complexity: metadata.code.complexity
            };
        }

        return relevant;
    }

    /**
     * Count tokens in text
     */
    countTokens(text) {
        try {
            const tokens = this.encoder.encode(text);
            return tokens.length;
        } catch (error) {
            // Fallback: rough approximation
            return Math.ceil(text.length / 4);
        }
    }

    /**
     * Format file size
     */
    formatSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }

    /**
     * Format duration in seconds
     */
    formatDuration(seconds) {
        if (!seconds) return 'Unknown';

        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    }

    /**
     * Clean up encoder
     */
    dispose() {
        if (this.encoder) {
            this.encoder.free();
        }
    }
}

module.exports = LLMFormatter;
