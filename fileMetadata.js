const fs = require('fs').promises;
const path = require('path');
const mime = require('mime-types');
const { createReadStream } = require('fs');
const readline = require('readline');

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
    let markdownContent = "# Directory Content Analysis\n\n";
    markdownContent += `Generated on: ${new Date().toLocaleString()}\n\n`;

    async function processDirectory(currentPath) {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });
        const relPath = path.relative(directory, currentPath);

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
            const stats = await fs.stat(filePath);
            const created = new Date(stats.birthtime).toLocaleString();
            const modified = new Date(stats.mtime).toLocaleString();
            const mimeType = mime.lookup(filePath) || 'unknown';

            markdownContent += `| ${file.name} | ${formatFileSize(stats.size)} | ${created} | ${modified} | ${mimeType} |\n`;
        }

        for (const entry of entries) {
            if (entry.isDirectory()) {
                await processDirectory(path.join(currentPath, entry.name));
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
        const outputFile = path.join(directory, 'directory_contents.md');

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
