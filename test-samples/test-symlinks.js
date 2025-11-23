#!/usr/bin/env node

/**
 * Test script for symlink handling
 */

const FileScanner = require('../src/utils/scanner');
const path = require('path');

async function testSymlinks() {
    console.log('Testing symlink handling...\n');

    // Create a mock database object
    const mockDb = {
        getFile: () => null  // Always return null to force scanning
    };

    const scanner = new FileScanner(mockDb, null);

    const testDir = path.join(__dirname, 'symlink-test');

    // Test 1: Without followSymlinks (default)
    console.log('Test 1: Scanning without followSymlinks...');
    const result1 = await scanner.scan(testDir, {
        followSymlinks: false,
        incrementalScanning: false
    });
    console.log(`  Found ${result1.files.length} files`);
    console.log(`  Stats:`, result1.stats);
    console.log('');

    // Test 2: With followSymlinks
    console.log('Test 2: Scanning with followSymlinks enabled...');
    const result2 = await scanner.scan(testDir, {
        followSymlinks: true,
        incrementalScanning: false
    });
    console.log(`  Found ${result2.files.length} files`);
    console.log(`  Stats:`, result2.stats);
    console.log('');

    // Verify results
    if (result2.stats.skippedSymlinks > 0) {
        console.log('✓ Circular symlink detection working! Skipped', result2.stats.skippedSymlinks, 'circular symlinks');
    } else {
        console.log('✗ Warning: No circular symlinks detected');
    }

    // List found files
    console.log('\nFiles found:');
    result2.files.forEach(file => {
        console.log(`  - ${file.relativePath}`);
    });
}

testSymlinks().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
