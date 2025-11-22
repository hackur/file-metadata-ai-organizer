/**
 * File Hash Utility
 * Generates cryptographic hashes for files to detect changes
 */

const crypto = require('crypto');
const fs = require('fs');
const { pipeline } = require('stream/promises');

class HashUtil {
    /**
     * Calculate MD5 hash of a file
     */
    async md5(filePath) {
        return this.hashFile(filePath, 'md5');
    }

    /**
     * Calculate SHA256 hash of a file
     */
    async sha256(filePath) {
        return this.hashFile(filePath, 'sha256');
    }

    /**
     * Calculate hash using specified algorithm
     */
    async hashFile(filePath, algorithm = 'sha256') {
        const hash = crypto.createHash(algorithm);
        const stream = fs.createReadStream(filePath);

        try {
            await pipeline(stream, hash);
            return hash.digest('hex');
        } catch (error) {
            throw new Error(`Failed to hash file ${filePath}: ${error.message}`);
        }
    }

    /**
     * Calculate multiple hashes at once
     */
    async multiHash(filePath, algorithms = ['md5', 'sha256']) {
        const hashes = {};
        const stream = fs.createReadStream(filePath);
        const hashers = algorithms.map(alg => ({
            algorithm: alg,
            hash: crypto.createHash(alg)
        }));

        stream.on('data', (chunk) => {
            hashers.forEach(h => h.hash.update(chunk));
        });

        return new Promise((resolve, reject) => {
            stream.on('end', () => {
                hashers.forEach(h => {
                    hashes[h.algorithm] = h.hash.digest('hex');
                });
                resolve(hashes);
            });
            stream.on('error', reject);
        });
    }

    /**
     * Quick hash for large files (samples first, middle, last chunks)
     */
    async quickHash(filePath, chunkSize = 8192) {
        const fs = require('fs').promises;
        const stat = await fs.stat(filePath);
        const fileSize = stat.size;

        if (fileSize <= chunkSize * 3) {
            return this.sha256(filePath);
        }

        const hash = crypto.createHash('sha256');
        const fd = await fs.open(filePath, 'r');

        try {
            // Read first chunk
            const firstChunk = Buffer.alloc(chunkSize);
            await fd.read(firstChunk, 0, chunkSize, 0);
            hash.update(firstChunk);

            // Read middle chunk
            const middlePos = Math.floor(fileSize / 2) - Math.floor(chunkSize / 2);
            const middleChunk = Buffer.alloc(chunkSize);
            await fd.read(middleChunk, 0, chunkSize, middlePos);
            hash.update(middleChunk);

            // Read last chunk
            const lastPos = fileSize - chunkSize;
            const lastChunk = Buffer.alloc(chunkSize);
            await fd.read(lastChunk, 0, chunkSize, lastPos);
            hash.update(lastChunk);

            // Include file size in hash
            hash.update(Buffer.from(fileSize.toString()));

            return hash.digest('hex');
        } finally {
            await fd.close();
        }
    }

    /**
     * Compare two hashes
     */
    compare(hash1, hash2) {
        return hash1 === hash2;
    }

    /**
     * Create a content-based hash for deduplication
     */
    async contentHash(filePath) {
        return this.sha256(filePath);
    }
}

module.exports = new HashUtil();
