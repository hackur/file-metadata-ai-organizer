/**
 * Markdown Processor
 * Analyzes markdown documents
 */

const BaseProcessor = require('./BaseProcessor');
const fs = require('fs').promises;
const marked = require('marked');

class MarkdownProcessor extends BaseProcessor {
    canProcess(fileInfo) {
        return fileInfo.extension === 'md' || fileInfo.extension === 'markdown';
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

            // Read markdown content
            const content = await fs.readFile(fileInfo.path, 'utf8');

            // Analyze markdown structure
            this.analyzeMarkdown(fileInfo, content);

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
     * Analyze markdown content
     */
    analyzeMarkdown(fileInfo, content) {
        // Extract front matter if present
        const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (frontMatterMatch) {
            try {
                const frontMatter = this.parseFrontMatter(frontMatterMatch[1]);
                fileInfo.metadata.document.frontMatter = frontMatter;
                fileInfo.metadata.document.title = frontMatter.title;
                fileInfo.metadata.document.author = frontMatter.author;
                fileInfo.metadata.document.keywords = frontMatter.tags || frontMatter.keywords;
            } catch (error) {
                // Front matter parsing failed, ignore
            }

            // Remove front matter from content for further analysis
            content = content.substring(frontMatterMatch[0].length);
        }

        // Count words and characters
        const words = content.split(/\s+/).filter(w => w.length > 0);
        fileInfo.metadata.document.wordCount = words.length;
        fileInfo.metadata.document.charCount = content.length;

        // Extract headings
        const headings = [];
        const headingMatches = content.matchAll(/^(#{1,6})\s+(.+)$/gm);
        for (const match of headingMatches) {
            headings.push({
                level: match[1].length,
                text: match[2]
            });
        }
        fileInfo.metadata.document.headings = headings;
        fileInfo.metadata.document.headingCount = headings.length;

        // Get title from first heading if not in front matter
        if (!fileInfo.metadata.document.title && headings.length > 0) {
            fileInfo.metadata.document.title = headings[0].text;
        }

        // Count links
        const links = [...content.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)];
        fileInfo.metadata.document.linkCount = links.length;

        const externalLinks = links.filter(l => l[2].startsWith('http'));
        const internalLinks = links.filter(l => !l[2].startsWith('http'));

        fileInfo.metadata.document.externalLinkCount = externalLinks.length;
        fileInfo.metadata.document.internalLinkCount = internalLinks.length;

        // Count code blocks
        const codeBlocks = [...content.matchAll(/```[\s\S]*?```/g)];
        fileInfo.metadata.document.codeBlockCount = codeBlocks.length;

        // Extract code block languages
        const languages = [];
        for (const block of codeBlocks) {
            const langMatch = block[0].match(/```(\w+)/);
            if (langMatch) {
                languages.push(langMatch[1]);
            }
        }
        fileInfo.metadata.document.codeLanguages = [...new Set(languages)];

        // Count lists
        const unorderedLists = content.match(/^[\*\-\+]\s+/gm);
        const orderedLists = content.match(/^\d+\.\s+/gm);
        fileInfo.metadata.document.unorderedListItems = unorderedLists ? unorderedLists.length : 0;
        fileInfo.metadata.document.orderedListItems = orderedLists ? orderedLists.length : 0;

        // Count images
        const images = [...content.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)];
        fileInfo.metadata.document.imageCount = images.length;

        // Extract first paragraph as summary
        const paragraphs = content.split(/\n\n+/);
        const firstParagraph = paragraphs.find(p => p.trim().length > 50 && !p.startsWith('#'));
        if (firstParagraph) {
            fileInfo.metadata.document.summary = firstParagraph.substring(0, 500);
        }

        fileInfo.metadata.document.format = 'Markdown';
        fileInfo.metadata.document.language = 'en'; // Default, could use language detection
    }

    /**
     * Parse YAML front matter
     */
    parseFrontMatter(yaml) {
        const result = {};
        const lines = yaml.split('\n');

        for (const line of lines) {
            const match = line.match(/^(\w+):\s*(.+)$/);
            if (match) {
                const key = match[1];
                let value = match[2];

                // Parse arrays
                if (value.startsWith('[') && value.endsWith(']')) {
                    value = value.slice(1, -1).split(',').map(v => v.trim());
                }

                result[key] = value;
            }
        }

        return result;
    }

    getSupportedExtensions() {
        return ['md', 'markdown', 'mdown', 'mkd'];
    }

    getSupportedMimeTypes() {
        return ['text/markdown', 'text/x-markdown'];
    }
}

module.exports = MarkdownProcessor;
