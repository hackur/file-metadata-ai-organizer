/**
 * Tree Visualizer
 * Generates directory tree visualizations
 */

class TreeVisualizer {
    /**
     * Generate ASCII tree
     */
    generateASCIITree(files, options = {}) {
        const { showSize = true, colorCode = false } = options;

        // Build tree structure
        const tree = this.buildTree(files);

        // Render tree
        return this.renderTree(tree, '', true, showSize);
    }

    /**
     * Generate Mermaid diagram
     */
    generateMermaidDiagram(files, options = {}) {
        const parts = ['graph TD'];
        const idMap = new Map();
        let idCounter = 0;

        // Build tree structure
        const tree = this.buildTree(files);

        // Generate node IDs
        const getNodeId = (path) => {
            if (!idMap.has(path)) {
                idMap.set(path, `node${idCounter++}`);
            }
            return idMap.get(path);
        };

        // Render nodes
        const renderNode = (node, parentId = null) => {
            const nodeId = getNodeId(node.path);
            const label = node.isDir ? `📁 ${node.name}` : `📄 ${node.name}`;

            parts.push(`  ${nodeId}["${label}"]`);

            if (parentId) {
                parts.push(`  ${parentId} --> ${nodeId}`);
            }

            if (node.children) {
                for (const child of node.children) {
                    renderNode(child, nodeId);
                }
            }
        };

        renderNode(tree);

        return parts.join('\n');
    }

    /**
     * Build tree structure from flat file list
     */
    buildTree(files) {
        const root = {
            name: 'root',
            path: '',
            isDir: true,
            children: []
        };

        for (const file of files) {
            const parts = file.relativePath.split('/');
            let current = root;

            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                const isLast = i === parts.length - 1;

                if (isLast) {
                    // Add file
                    current.children.push({
                        name: part,
                        path: file.relativePath,
                        isDir: false,
                        file: file
                    });
                } else {
                    // Add or find directory
                    let dir = current.children.find(c => c.name === part && c.isDir);

                    if (!dir) {
                        dir = {
                            name: part,
                            path: parts.slice(0, i + 1).join('/'),
                            isDir: true,
                            children: []
                        };
                        current.children.push(dir);
                    }

                    current = dir;
                }
            }
        }

        // Sort children (directories first, then alphabetically)
        this.sortTree(root);

        return root;
    }

    /**
     * Sort tree children
     */
    sortTree(node) {
        if (!node.children) return;

        node.children.sort((a, b) => {
            if (a.isDir && !b.isDir) return -1;
            if (!a.isDir && b.isDir) return 1;
            return a.name.localeCompare(b.name);
        });

        for (const child of node.children) {
            this.sortTree(child);
        }
    }

    /**
     * Render tree recursively
     */
    renderTree(node, prefix, isLast, showSize) {
        if (node.name === 'root') {
            // Render children only
            return node.children
                .map((child, i) => this.renderTree(
                    child,
                    '',
                    i === node.children.length - 1,
                    showSize
                ))
                .join('\n');
        }

        const lines = [];
        const connector = isLast ? '└── ' : '├── ';
        const extension = isLast ? '    ' : '│   ';

        let line = prefix + connector;

        if (node.isDir) {
            line += `📁 ${node.name}/`;
        } else {
            const icon = this.getFileIcon(node.file.category);
            line += `${icon} ${node.name}`;

            if (showSize && node.file.size) {
                line += ` (${this.formatSize(node.file.size)})`;
            }
        }

        lines.push(line);

        if (node.children && node.children.length > 0) {
            for (let i = 0; i < node.children.length; i++) {
                const child = node.children[i];
                const childLines = this.renderTree(
                    child,
                    prefix + extension,
                    i === node.children.length - 1,
                    showSize
                );
                lines.push(childLines);
            }
        }

        return lines.join('\n');
    }

    /**
     * Get file icon by category
     */
    getFileIcon(category) {
        const icons = {
            image: '🖼️',
            video: '🎬',
            audio: '🎵',
            document: '📄',
            code: '💻',
            archive: '📦',
            spreadsheet: '📊',
            other: '📄'
        };

        return icons[category] || '📄';
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

        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }

    /**
     * Generate HTML tree view
     */
    generateHTMLTree(files) {
        const tree = this.buildTree(files);

        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Directory Tree</title>
    <style>
        body {
            font-family: 'Courier New', monospace;
            padding: 20px;
            background: #1e1e1e;
            color: #d4d4d4;
        }
        .tree { list-style: none; padding-left: 0; }
        .tree ul { list-style: none; padding-left: 20px; }
        .tree li { margin: 3px 0; }
        .tree .dir { color: #569cd6; cursor: pointer; }
        .tree .file { color: #9cdcfe; }
        .tree .size { color: #6a9955; margin-left: 10px; }
        .tree .toggle {
            display: inline-block;
            width: 16px;
            text-align: center;
            cursor: pointer;
        }
    </style>
</head>
<body>
    <h1>Directory Tree</h1>
    ${this.renderHTMLNode(tree)}
    <script>
        document.querySelectorAll('.toggle').forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                const ul = e.target.parentElement.querySelector('ul');
                if (ul) {
                    ul.style.display = ul.style.display === 'none' ? 'block' : 'none';
                    e.target.textContent = ul.style.display === 'none' ? '▶' : '▼';
                }
            });
        });
    </script>
</body>
</html>`;

        return html;
    }

    /**
     * Render HTML tree node
     */
    renderHTMLNode(node) {
        if (node.name === 'root') {
            return `<ul class="tree">${node.children.map(c => this.renderHTMLNode(c)).join('')}</ul>`;
        }

        if (node.isDir) {
            const children = node.children && node.children.length > 0
                ? `<ul>${node.children.map(c => this.renderHTMLNode(c)).join('')}</ul>`
                : '';

            return `<li>
                <span class="toggle">▼</span>
                <span class="dir">📁 ${node.name}/</span>
                ${children}
            </li>`;
        } else {
            const icon = this.getFileIcon(node.file.category);
            const size = node.file.size ? `<span class="size">(${this.formatSize(node.file.size)})</span>` : '';

            return `<li>
                <span style="display: inline-block; width: 16px;"></span>
                <span class="file">${icon} ${node.name}</span>
                ${size}
            </li>`;
        }
    }
}

module.exports = new TreeVisualizer();
