/**
 * Query API
 * Provides flexible querying interface for file metadata
 */

const database = require('./database');

class QueryAPI {
    /**
     * Query files with advanced filters
     */
    async query(filters = {}) {
        let results = database.queryFiles(filters);

        // Apply additional filters
        if (filters.tags && filters.tags.length > 0) {
            results = this.filterByTags(results, filters.tags);
        }

        if (filters.dateRange) {
            results = this.filterByDateRange(results, filters.dateRange);
        }

        if (filters.search) {
            results = this.filterBySearch(results, filters.search);
        }

        // Apply sorting
        if (filters.sortBy) {
            results = this.sortResults(results, filters.sortBy, filters.sortOrder);
        }

        // Apply pagination
        if (filters.page && filters.pageSize) {
            results = this.paginate(results, filters.page, filters.pageSize);
        }

        return results;
    }

    /**
     * Filter by tags
     */
    filterByTags(results, tags) {
        return results.filter(file => {
            if (!file.tags || file.tags.length === 0) return false;
            return tags.some(tag => file.tags.includes(tag));
        });
    }

    /**
     * Filter by date range
     */
    filterByDateRange(results, dateRange) {
        const { start, end, field = 'modified' } = dateRange;
        const startDate = start ? new Date(start) : null;
        const endDate = end ? new Date(end) : null;

        return results.filter(file => {
            const fileDate = new Date(file[field]);

            if (startDate && fileDate < startDate) return false;
            if (endDate && fileDate > endDate) return false;

            return true;
        });
    }

    /**
     * Filter by text search
     */
    filterBySearch(results, searchTerm) {
        const term = searchTerm.toLowerCase();

        return results.filter(file => {
            // Search in file name, path, and basic metadata
            if (file.name && file.name.toLowerCase().includes(term)) return true;
            if (file.path && file.path.toLowerCase().includes(term)) return true;
            if (file.relativePath && file.relativePath.toLowerCase().includes(term)) return true;

            // Search in tags
            if (file.tags && file.tags.some(tag => tag.toLowerCase().includes(term))) return true;

            // Search in document content
            if (file.metadata?.document?.textContent &&
                file.metadata.document.textContent.toLowerCase().includes(term)) {
                return true;
            }

            return false;
        });
    }

    /**
     * Sort results
     */
    sortResults(results, sortBy, sortOrder = 'asc') {
        const sorted = [...results].sort((a, b) => {
            let aVal = this.getNestedValue(a, sortBy);
            let bVal = this.getNestedValue(b, sortBy);

            if (aVal === null || aVal === undefined) return 1;
            if (bVal === null || bVal === undefined) return -1;

            if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }

            if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        return sorted;
    }

    /**
     * Get nested value from object
     */
    getNestedValue(obj, path) {
        const keys = path.split('.');
        let value = obj;

        for (const key of keys) {
            if (value && key in value) {
                value = value[key];
            } else {
                return null;
            }
        }

        return value;
    }

    /**
     * Paginate results
     */
    paginate(results, page, pageSize) {
        const start = (page - 1) * pageSize;
        const end = start + pageSize;

        return {
            results: results.slice(start, end),
            page,
            pageSize,
            totalResults: results.length,
            totalPages: Math.ceil(results.length / pageSize)
        };
    }

    /**
     * Get file statistics
     */
    async getStats(filters = {}) {
        const files = await this.query(filters);

        const stats = {
            totalFiles: files.length,
            totalSize: 0,
            byCategory: {},
            byExtension: {},
            byDateRange: {
                today: 0,
                thisWeek: 0,
                thisMonth: 0,
                thisYear: 0
            }
        };

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const thisYear = new Date(now.getFullYear(), 0, 1);

        for (const file of files) {
            stats.totalSize += file.size || 0;

            // By category
            stats.byCategory[file.category] = (stats.byCategory[file.category] || 0) + 1;

            // By extension
            stats.byExtension[file.extension] = (stats.byExtension[file.extension] || 0) + 1;

            // By date
            const modifiedDate = new Date(file.modified);
            if (modifiedDate >= today) stats.byDateRange.today++;
            if (modifiedDate >= thisWeek) stats.byDateRange.thisWeek++;
            if (modifiedDate >= thisMonth) stats.byDateRange.thisMonth++;
            if (modifiedDate >= thisYear) stats.byDateRange.thisYear++;
        }

        return stats;
    }

    /**
     * Find similar files (by perceptual hash for images)
     */
    async findSimilar(filePath, threshold = 5) {
        const file = database.getFile(filePath);
        if (!file || !file.metadata?.image?.perceptualHash) {
            return [];
        }

        const allFiles = database.queryFiles({ category: 'image' });
        const similar = [];

        for (const otherFile of allFiles) {
            if (otherFile.path === filePath) continue;
            if (!otherFile.metadata?.image?.perceptualHash) continue;

            const distance = this.hammingDistance(
                file.metadata.image.perceptualHash,
                otherFile.metadata.image.perceptualHash
            );

            if (distance <= threshold) {
                similar.push({
                    file: otherFile,
                    similarity: 1 - (distance / 64) // Normalized similarity score
                });
            }
        }

        return similar.sort((a, b) => b.similarity - a.similarity);
    }

    /**
     * Calculate Hamming distance between two hashes
     */
    hammingDistance(hash1, hash2) {
        if (!hash1 || !hash2 || hash1.length !== hash2.length) return Infinity;

        let distance = 0;
        for (let i = 0; i < hash1.length; i++) {
            const val1 = parseInt(hash1[i], 16);
            const val2 = parseInt(hash2[i], 16);
            const xor = val1 ^ val2;

            // Count set bits
            let bits = xor;
            while (bits > 0) {
                distance += bits & 1;
                bits >>= 1;
            }
        }

        return distance;
    }

    /**
     * Get duplicate files (by hash)
     */
    async findDuplicates() {
        const allFiles = database.queryFiles({});
        const hashMap = {};
        const duplicates = [];

        for (const file of allFiles) {
            const hash = file.hash?.sha256;
            if (!hash) continue;

            if (hashMap[hash]) {
                hashMap[hash].push(file);
            } else {
                hashMap[hash] = [file];
            }
        }

        for (const [hash, files] of Object.entries(hashMap)) {
            if (files.length > 1) {
                duplicates.push({
                    hash,
                    count: files.length,
                    files,
                    totalSize: files.reduce((sum, f) => sum + (f.size || 0), 0)
                });
            }
        }

        return duplicates.sort((a, b) => b.totalSize - a.totalSize);
    }
}

module.exports = new QueryAPI();
