const fs = require('fs').promises;
const path = require('path');
const mime = require('mime-types');
const { createReadStream } = require('fs');
const readline = require('readline');
const ignore = require('ignore');
const os = require('os');
const { execSync } = require('child_process');

async function readFileIfExists(filepath) {
    try {
        return await fs.readFile(filepath, 'utf8');
    } catch (error) {
        return '';
    }
}

async function getGitIgnorePatterns() {
    const ig = ignore();

    // Get global gitignore
    const globalGitignorePath = path.join(os.homedir(), '.gitignore');
    const globalPatterns = await readFileIfExists(globalGitignorePath);

    // Get git core excludes
    let coreExcludesPath = '';
    try {
        coreExcludesPath = execSync('git config --get core.excludesfile', { encoding: 'utf8' }).trim();
    } catch (error) {
        // Git not installed or no core.excludesfile configured
    }
    const coreExcludePatterns = coreExcludesPath ? await readFileIfExists(coreExcludesPath) : '';

    // Default patterns that git uses
    const defaultPatterns = [
        '.git/',
        '.DS_Store',
        '*.swp',
        '*~'
    ].join('\n');

    // Combine all patterns
    ig.add(defaultPatterns);
    if (globalPatterns) ig.add(globalPatterns);
    if (coreExcludePatterns) ig.add(coreExcludePatterns);

    return ig;
}

async function getGitignore(directory) {
    const baseIgnore = await getGitIgnorePatterns();

    // Add local .gitignore patterns
    const localGitignorePath = path.join(directory, '.gitignore');
    const localPatterns = await readFileIfExists(localGitignorePath);
    if (localPatterns) {
        baseIgnore.add(localPatterns);
    }

    return baseIgnore;
}

function formatFileSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
}

async function getFileMetadata(directory) {
    const ig = await getGitignore(directory);
    let markdownContent = "# Directory Content Analysis\n\n";
    markdownContent += `Generated on: ${new Date().toLocaleString()}\n\n`;

    async function processDirectory(currentPath) {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });
        const relPath = path.relative(directory, currentPath);

        // Skip if the directory itself is ignored
        if (relPath !== '' && ig.ignores(relPath)) {
            return;
        }

        if (relPath !== '') {
            markdownContent += `\n## Directory: ${relPath}\n\n`;
        } else {
            markdownContent += "\n## Root Directory\n\n";
        }

        markdownContent += "| File | Size | Created | Modified | Type |\n";
        markdownContent += "|------|------|---------|-----------|------|\n";

        const files = entries.filter(entry => entry.isFile());

        for (const file of files.sort((a, b) => a.name.localeCompare(b.name))) {
            const filePath = path.join(currentPath, file.name);
            const relativePath = path.relative(directory, filePath);

            // Skip if file is ignored by gitignore
            if (ig.ignores(relativePath)) {
                continue;
            }

            const stats = await fs.stat(filePath);
            const created = new Date(stats.birthtime).toLocaleString();
            const modified = new Date(stats.mtime).toLocaleString();
            const mimeType = mime.lookup(filePath) || 'unknown';

            markdownContent += `| ${file.name} | ${formatFileSize(stats.size)} | ${created} | ${modified} | ${mimeType} |\n`;
        }

        for (const entry of entries) {
            if (entry.isDirectory()) {
                const dirPath = path.join(currentPath, entry.name);
                const relativePath = path.relative(directory, dirPath);

                // Skip if directory is ignored by gitignore
                if (!ig.ignores(relativePath)) {
                    await processDirectory(dirPath);
                }
            }
        }
    }

    await processDirectory(directory);
    return markdownContent;
}

async function main() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    try {
        const directory = await new Promise(resolve => {
            rl.question('Enter the directory path (press Enter for current directory): ', answer => {
                resolve(answer.trim() || '.');
            });
        });

        const output = await getFileMetadata(directory);
        const timestamp = new Date().toISOString().replace(/[:]/g, '-').replace(/\..+/, '');
        const outputFile = path.join(directory, `directory_contents_${timestamp}.md`);

        await fs.writeFile(outputFile, output, 'utf8');
        console.log(`Metadata has been written to: ${outputFile}`);

    } catch (error) {
        console.error(`An error occurred: ${error.message}`);
    } finally {
        rl.close();
    }
}

if (require.main === module) {
    main();
}
