#!/usr/bin/env node

/**
 * CLI for File Metadata AI Organizer
 */

const { Command } = require('commander');
const path = require('path');
const fs = require('fs').promises;
const config = require('./src/utils/config');
const MetadataAnalyzer = require('./src/MetadataAnalyzer');
const queryAPI = require('./src/storage/queryAPI');
const LLMFormatter = require('./src/formatters/LLMFormatter');
const treeVisualizer = require('./src/visualizers/TreeVisualizer');

const program = new Command();

program
    .name('fmao')
    .description('File Metadata AI Organizer - Extract and analyze file metadata')
    .version('1.0.0');

/**
 * Analyze command
 */
program
    .command('analyze')
    .description('Analyze a directory and extract file metadata')
    .argument('<directory>', 'Directory to analyze')
    .option('-i, --incremental', 'Use incremental scanning (skip unchanged files)', true)
    .option('--no-incremental', 'Disable incremental scanning')
    .option('-d, --max-depth <depth>', 'Maximum directory depth', parseInt)
    .option('-c, --concurrency <num>', 'Number of concurrent processes', parseInt)
    .action(async (directory, options) => {
        try {
            // Load configuration
            await config.load(options);

            // Override config with CLI options
            if (options.maxDepth) {
                config.set('scanning.maxDepth', options.maxDepth);
            }
            if (options.concurrency) {
                config.set('scanning.maxConcurrency', options.concurrency);
            }
            if (options.incremental !== undefined) {
                config.set('storage.incrementalScanning', options.incremental);
            }

            // Initialize analyzer
            const analyzer = new MetadataAnalyzer(config.getAll());
            await analyzer.init();

            // Set up progress reporting
            analyzer.onProgress((progress) => {
                const bar = createProgressBar(progress.percentage);
                process.stdout.write(`\r${bar} ${progress.percentage}% (${progress.current}/${progress.total}) - ${progress.currentFile || ''}`);
            });

            // Run analysis
            const result = await analyzer.analyze(path.resolve(directory));

            console.log('\n\n✓ Analysis complete!');
            console.log(`  Duration: ${(result.duration / 1000).toFixed(2)}s`);
            console.log(`  Files processed: ${result.filesProcessed}`);
            console.log(`  New: ${result.stats.newFiles}, Modified: ${result.stats.modifiedFiles}, Unchanged: ${result.stats.unchangedFiles}`);

            await analyzer.close();

        } catch (error) {
            console.error('✗ Analysis failed:', error.message);
            process.exit(1);
        }
    });

/**
 * Query command
 */
program
    .command('query')
    .description('Query file metadata')
    .option('-c, --category <category>', 'Filter by category (image, video, audio, document, code, archive)')
    .option('-e, --extension <ext>', 'Filter by file extension')
    .option('--min-size <bytes>', 'Minimum file size', parseInt)
    .option('--max-size <bytes>', 'Maximum file size', parseInt)
    .option('-l, --limit <num>', 'Limit number of results', parseInt)
    .option('-s, --search <term>', 'Search term')
    .option('--sort <field>', 'Sort by field')
    .option('-o, --output <format>', 'Output format (json, table, markdown)', 'table')
    .action(async (options) => {
        try {
            await config.load();
            const analyzer = new MetadataAnalyzer(config.getAll());
            await analyzer.init();

            const results = await queryAPI.query({
                category: options.category,
                extension: options.extension,
                minSize: options.minSize,
                maxSize: options.maxSize,
                limit: options.limit,
                search: options.search,
                sortBy: options.sort
            });

            if (options.output === 'json') {
                console.log(JSON.stringify(results, null, 2));
            } else if (options.output === 'markdown') {
                printMarkdownTable(results);
            } else {
                printTable(results);
            }

            await analyzer.close();

        } catch (error) {
            console.error('✗ Query failed:', error.message);
            process.exit(1);
        }
    });

/**
 * Stats command
 */
program
    .command('stats')
    .description('Show statistics about analyzed files')
    .option('-c, --category <category>', 'Filter by category')
    .action(async (options) => {
        try {
            await config.load();
            const analyzer = new MetadataAnalyzer(config.getAll());
            await analyzer.init();

            const stats = await queryAPI.getStats({ category: options.category });

            console.log('\n📊 File Statistics\n');
            console.log(`Total files: ${stats.totalFiles}`);
            console.log(`Total size: ${formatSize(stats.totalSize)}\n`);

            console.log('By category:');
            for (const [category, count] of Object.entries(stats.byCategory)) {
                console.log(`  ${category}: ${count}`);
            }

            console.log('\nTop extensions:');
            const topExtensions = Object.entries(stats.byExtension)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10);
            for (const [ext, count] of topExtensions) {
                console.log(`  .${ext}: ${count}`);
            }

            await analyzer.close();

        } catch (error) {
            console.error('✗ Stats failed:', error.message);
            process.exit(1);
        }
    });

/**
 * Tree command
 */
program
    .command('tree')
    .description('Generate directory tree visualization')
    .option('-f, --format <format>', 'Output format (ascii, mermaid, html)', 'ascii')
    .option('-o, --output <file>', 'Output file (default: stdout)')
    .option('--no-size', 'Hide file sizes')
    .option('-c, --category <category>', 'Filter by category')
    .action(async (options) => {
        try {
            await config.load();
            const analyzer = new MetadataAnalyzer(config.getAll());
            await analyzer.init();

            const files = await queryAPI.query({ category: options.category });

            let output;
            if (options.format === 'ascii') {
                output = treeVisualizer.generateASCIITree(files, { showSize: options.size });
            } else if (options.format === 'mermaid') {
                output = treeVisualizer.generateMermaidDiagram(files);
            } else if (options.format === 'html') {
                output = treeVisualizer.generateHTMLTree(files);
            }

            if (options.output) {
                await fs.writeFile(options.output, output);
                console.log(`✓ Tree saved to ${options.output}`);
            } else {
                console.log(output);
            }

            await analyzer.close();

        } catch (error) {
            console.error('✗ Tree generation failed:', error.message);
            process.exit(1);
        }
    });

/**
 * LLM command
 */
program
    .command('llm')
    .description('Generate LLM-optimized context')
    .option('-t, --max-tokens <num>', 'Maximum tokens', parseInt, 32000)
    .option('-f, --format <format>', 'Output format (markdown, json)', 'markdown')
    .option('-o, --output <file>', 'Output file (default: stdout)')
    .option('-c, --category <category>', 'Filter by category')
    .option('--recent', 'Prioritize recent files', true)
    .action(async (options) => {
        try {
            await config.load();
            const analyzer = new MetadataAnalyzer(config.getAll());
            await analyzer.init();

            const files = await queryAPI.query({ category: options.category });

            const formatter = new LLMFormatter({
                contextWindow: options.maxTokens,
                tokenCountingModel: 'gpt-4'
            });

            const context = formatter.formatForLLM(files, {
                maxTokens: options.maxTokens,
                prioritizeRecent: options.recent,
                format: options.format
            });

            if (options.output) {
                await fs.writeFile(options.output, context);
                console.log(`✓ LLM context saved to ${options.output}`);
            } else {
                console.log(context);
            }

            formatter.dispose();
            await analyzer.close();

        } catch (error) {
            console.error('✗ LLM context generation failed:', error.message);
            process.exit(1);
        }
    });

/**
 * Duplicates command
 */
program
    .command('duplicates')
    .description('Find duplicate files')
    .action(async () => {
        try {
            await config.load();
            const analyzer = new MetadataAnalyzer(config.getAll());
            await analyzer.init();

            const duplicates = await queryAPI.findDuplicates();

            if (duplicates.length === 0) {
                console.log('✓ No duplicates found');
            } else {
                console.log(`\n Found ${duplicates.length} sets of duplicates:\n`);

                for (const dup of duplicates) {
                    console.log(`📦 ${dup.count} files (${formatSize(dup.totalSize)} total):`);
                    for (const file of dup.files) {
                        console.log(`   ${file.relativePath}`);
                    }
                    console.log();
                }
            }

            await analyzer.close();

        } catch (error) {
            console.error('✗ Duplicate search failed:', error.message);
            process.exit(1);
        }
    });

/**
 * Helper functions
 */

function createProgressBar(percentage) {
    const width = 30;
    const filled = Math.floor((percentage / 100) * width);
    const empty = width - filled;
    return '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';
}

function formatSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
}

function printTable(results) {
    if (results.length === 0) {
        console.log('No results found');
        return;
    }

    console.log('\n');
    console.log('Path'.padEnd(50) + 'Category'.padEnd(15) + 'Size'.padEnd(15) + 'Modified');
    console.log('-'.repeat(95));

    for (const file of results.slice(0, 50)) {
        const path = file.relativePath.padEnd(50).substring(0, 50);
        const category = file.category.padEnd(15);
        const size = formatSize(file.size).padEnd(15);
        const modified = new Date(file.modified).toLocaleDateString();

        console.log(path + category + size + modified);
    }

    if (results.length > 50) {
        console.log(`\n... and ${results.length - 50} more`);
    }
}

function printMarkdownTable(results) {
    console.log('\n| Path | Category | Size | Modified |');
    console.log('|------|----------|------|----------|');

    for (const file of results.slice(0, 50)) {
        console.log(`| ${file.relativePath} | ${file.category} | ${formatSize(file.size)} | ${new Date(file.modified).toLocaleDateString()} |`);
    }
}

program.parse();
