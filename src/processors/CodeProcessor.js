/**
 * Code Processor
 * Analyzes source code files
 */

const BaseProcessor = require('./BaseProcessor');
const fs = require('fs').promises;

class CodeProcessor extends BaseProcessor {
    canProcess(fileInfo) {
        return fileInfo.category === 'code';
    }

    async process(fileInfo) {
        const startTime = Date.now();
        this.logStart(fileInfo);

        try {
            if (!await this.validate(fileInfo)) {
                return fileInfo;
            }

            if (!fileInfo.metadata) fileInfo.metadata = {};
            fileInfo.metadata.code = {};

            // Read file content
            const content = await fs.readFile(fileInfo.path, 'utf8');

            // Extract code metrics
            this.analyzeCode(fileInfo, content);

            // Detect language
            this.detectLanguage(fileInfo);

            // Extract imports/dependencies
            if (this.config.extractImports !== false) {
                this.extractImports(fileInfo, content);
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
     * Analyze code metrics
     */
    analyzeCode(fileInfo, content) {
        const lines = content.split('\n');

        fileInfo.metadata.code.linesTotal = lines.length;
        fileInfo.metadata.code.linesCode = 0;
        fileInfo.metadata.code.linesComment = 0;
        fileInfo.metadata.code.linesBlank = 0;

        const ext = fileInfo.extension;
        const commentPatterns = this.getCommentPatterns(ext);

        let inBlockComment = false;

        for (const line of lines) {
            const trimmed = line.trim();

            if (!trimmed) {
                fileInfo.metadata.code.linesBlank++;
                continue;
            }

            // Check for block comments
            if (commentPatterns.blockStart && trimmed.includes(commentPatterns.blockStart)) {
                inBlockComment = true;
            }

            if (inBlockComment) {
                fileInfo.metadata.code.linesComment++;
                if (commentPatterns.blockEnd && trimmed.includes(commentPatterns.blockEnd)) {
                    inBlockComment = false;
                }
                continue;
            }

            // Check for line comments
            let isComment = false;
            if (commentPatterns.line) {
                for (const pattern of commentPatterns.line) {
                    if (trimmed.startsWith(pattern)) {
                        isComment = true;
                        break;
                    }
                }
            }

            if (isComment) {
                fileInfo.metadata.code.linesComment++;
            } else {
                fileInfo.metadata.code.linesCode++;
            }
        }

        // Calculate cyclomatic complexity (simple approximation)
        if (this.config.calculateComplexity !== false) {
            fileInfo.metadata.code.complexity = this.calculateComplexity(content);
        }
    }

    /**
     * Get comment patterns for language
     */
    getCommentPatterns(ext) {
        const patterns = {
            js: { line: ['//', '#'], blockStart: '/*', blockEnd: '*/' },
            jsx: { line: ['//', '#'], blockStart: '/*', blockEnd: '*/' },
            ts: { line: ['//', '#'], blockStart: '/*', blockEnd: '*/' },
            tsx: { line: ['//', '#'], blockStart: '/*', blockEnd: '*/' },
            java: { line: ['//'], blockStart: '/*', blockEnd: '*/' },
            c: { line: ['//'], blockStart: '/*', blockEnd: '*/' },
            cpp: { line: ['//'], blockStart: '/*', blockEnd: '*/' },
            cs: { line: ['//'], blockStart: '/*', blockEnd: '*/' },
            php: { line: ['//', '#'], blockStart: '/*', blockEnd: '*/' },
            py: { line: ['#'], blockStart: '"""', blockEnd: '"""' },
            rb: { line: ['#'], blockStart: '=begin', blockEnd: '=end' },
            sh: { line: ['#'], blockStart: null, blockEnd: null },
            bash: { line: ['#'], blockStart: null, blockEnd: null },
            html: { line: null, blockStart: '<!--', blockEnd: '-->' },
            css: { line: null, blockStart: '/*', blockEnd: '*/' },
            sql: { line: ['--'], blockStart: '/*', blockEnd: '*/' },
            go: { line: ['//'], blockStart: '/*', blockEnd: '*/' },
            rs: { line: ['//'], blockStart: '/*', blockEnd: '*/' },
            swift: { line: ['//'], blockStart: '/*', blockEnd: '*/' }
        };

        return patterns[ext] || { line: ['//'], blockStart: '/*', blockEnd: '*/' };
    }

    /**
     * Detect programming language
     */
    detectLanguage(fileInfo) {
        const languageMap = {
            js: 'JavaScript',
            jsx: 'JavaScript (React)',
            ts: 'TypeScript',
            tsx: 'TypeScript (React)',
            py: 'Python',
            java: 'Java',
            c: 'C',
            cpp: 'C++',
            h: 'C/C++ Header',
            hpp: 'C++ Header',
            cs: 'C#',
            rb: 'Ruby',
            go: 'Go',
            rs: 'Rust',
            php: 'PHP',
            swift: 'Swift',
            kt: 'Kotlin',
            scala: 'Scala',
            sh: 'Shell',
            bash: 'Bash',
            html: 'HTML',
            css: 'CSS',
            scss: 'SCSS',
            sass: 'Sass',
            less: 'Less',
            xml: 'XML',
            json: 'JSON',
            yaml: 'YAML',
            yml: 'YAML',
            sql: 'SQL',
            r: 'R',
            lua: 'Lua',
            pl: 'Perl',
            vim: 'VimScript',
            asm: 'Assembly'
        };

        fileInfo.metadata.code.language = languageMap[fileInfo.extension] || 'Unknown';
    }

    /**
     * Extract imports and dependencies
     */
    extractImports(fileInfo, content) {
        const imports = [];
        const lines = content.split('\n');

        const ext = fileInfo.extension;
        const importPatterns = this.getImportPatterns(ext);

        for (const line of lines) {
            const trimmed = line.trim();

            for (const pattern of importPatterns) {
                const match = trimmed.match(pattern);
                if (match) {
                    imports.push(match[1] || match[0]);
                }
            }
        }

        fileInfo.metadata.code.imports = [...new Set(imports)];
    }

    /**
     * Get import patterns for language
     */
    getImportPatterns(ext) {
        const patterns = {
            js: [/^import\s+.*from\s+['"](.+)['"]/, /^require\(['"](.+)['"]\)/],
            jsx: [/^import\s+.*from\s+['"](.+)['"]/, /^require\(['"](.+)['"]\)/],
            ts: [/^import\s+.*from\s+['"](.+)['"]/, /^require\(['"](.+)['"]\)/],
            tsx: [/^import\s+.*from\s+['"](.+)['"]/, /^require\(['"](.+)['"]\)/],
            py: [/^import\s+(.+)/, /^from\s+(.+)\s+import/],
            java: [/^import\s+(.+);/],
            go: [/^import\s+['"](.+)['"]/],
            rs: [/^use\s+(.+);/],
            php: [/^use\s+(.+);/, /^require\(['"](.+)['"]\)/],
            rb: [/^require\s+['"](.+)['"]/, /^require_relative\s+['"](.+)['"]/]
        };

        return patterns[ext] || [];
    }

    /**
     * Calculate cyclomatic complexity (simple approximation)
     */
    calculateComplexity(content) {
        // Count decision points
        const patterns = [
            /\bif\b/g,
            /\belse\b/g,
            /\bfor\b/g,
            /\bwhile\b/g,
            /\bcase\b/g,
            /\bcatch\b/g,
            /\b&&\b/g,
            /\b\|\|\b/g,
            /\?\s*.*\s*:/g // ternary operator
        ];

        let complexity = 1; // Base complexity

        for (const pattern of patterns) {
            const matches = content.match(pattern);
            if (matches) {
                complexity += matches.length;
            }
        }

        return complexity;
    }

    getSupportedExtensions() {
        return [
            'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp', 'h', 'hpp',
            'cs', 'rb', 'go', 'rs', 'php', 'swift', 'kt', 'scala', 'sh', 'bash',
            'html', 'css', 'scss', 'sass', 'less', 'xml', 'json', 'yaml', 'yml',
            'sql', 'r', 'lua', 'pl', 'vim', 'asm'
        ];
    }
}

module.exports = CodeProcessor;
