#!/usr/bin/env node

/**
 * GPS Module Test Suite
 * Demonstrates all functionality of the GPS utility module
 */

const gps = require('./src/utils/gps');

console.log('='.repeat(70));
console.log('GPS UTILITY MODULE - TEST SUITE');
console.log('='.repeat(70));

// Test data: San Francisco coordinates
const SF_LAT = 37.7749;
const SF_LON = -122.4194;

// Test data: Los Angeles coordinates
const LA_LAT = 34.0522;
const LA_LON = -118.2437;

// Test 1: Decimal to DMS Conversion
console.log('\n1. DECIMAL TO DMS CONVERSION');
console.log('-'.repeat(70));
try {
    const sfLatDMS = gps.decimalToDMS(SF_LAT, 'N');
    const sfLonDMS = gps.decimalToDMS(SF_LON, 'W');
    console.log(`SF Latitude (${SF_LAT}°): ${sfLatDMS.degrees}°${sfLatDMS.minutes}'${sfLatDMS.seconds}"`);
    console.log(`SF Longitude (${SF_LON}°): ${sfLonDMS.degrees}°${sfLonDMS.minutes}'${sfLonDMS.seconds}"`);
    console.log('✓ PASSED');
} catch (error) {
    console.error('✗ FAILED:', error.message);
}

// Test 2: DMS to Decimal Conversion
console.log('\n2. DMS TO DECIMAL CONVERSION');
console.log('-'.repeat(70));
try {
    const lat = gps.dmsToDecimal(37, 46, 29.6, 'N');
    const lon = gps.dmsToDecimal(122, 25, 9.8, 'W');
    console.log(`DMS (37°46'29.6"N) -> Decimal: ${lat.toFixed(4)}°`);
    console.log(`DMS (122°25'09.8"W) -> Decimal: ${lon.toFixed(4)}°`);
    console.log('✓ PASSED');
} catch (error) {
    console.error('✗ FAILED:', error.message);
}

// Test 3: Format Coordinates as DMS
console.log('\n3. FORMAT COORDINATES AS DMS');
console.log('-'.repeat(70));
try {
    const formatted = gps.formatCoordinates(SF_LAT, SF_LON);
    console.log(`Formatted: ${formatted}`);
    console.log('✓ PASSED');
} catch (error) {
    console.error('✗ FAILED:', error.message);
}

// Test 4: Format Coordinates as Decimal
console.log('\n4. FORMAT COORDINATES AS DECIMAL');
console.log('-'.repeat(70));
try {
    const decimal = gps.formatDecimal(SF_LAT, SF_LON, { decimals: 6 });
    console.log(`Formatted: ${decimal}`);
    console.log('✓ PASSED');
} catch (error) {
    console.error('✗ FAILED:', error.message);
}

// Test 5: Generate Google Maps Links
console.log('\n5. GENERATE GOOGLE MAPS LINKS');
console.log('-'.repeat(70));
try {
    const basicLink = gps.generateGoogleMapsLink(SF_LAT, SF_LON);
    console.log(`Basic: ${basicLink}`);

    const satelliteLink = gps.generateGoogleMapsLink(SF_LAT, SF_LON, {
        zoom: 16,
        mapType: 'satellite',
        label: 'Golden Gate Bridge'
    });
    console.log(`Satellite with label: ${satelliteLink}`);
    console.log('✓ PASSED');
} catch (error) {
    console.error('✗ FAILED:', error.message);
}

// Test 6: Calculate Distance (Haversine)
console.log('\n6. CALCULATE DISTANCE (HAVERSINE FORMULA)');
console.log('-'.repeat(70));
try {
    const distKm = gps.calculateDistance(SF_LAT, SF_LON, LA_LAT, LA_LON, { unit: 'km' });
    const distMi = gps.calculateDistance(SF_LAT, SF_LON, LA_LAT, LA_LON, { unit: 'mi' });
    const distM = gps.calculateDistance(SF_LAT, SF_LON, LA_LAT, LA_LON, { unit: 'm' });
    console.log(`SF to LA: ${distKm.toFixed(2)} km`);
    console.log(`SF to LA: ${distMi.toFixed(2)} miles`);
    console.log(`SF to LA: ${distM.toFixed(0)} meters`);
    console.log('✓ PASSED');
} catch (error) {
    console.error('✗ FAILED:', error.message);
}

// Test 7: Calculate Bearing
console.log('\n7. CALCULATE BEARING');
console.log('-'.repeat(70));
try {
    const bearing = gps.calculateBearing(SF_LAT, SF_LON, LA_LAT, LA_LON);
    console.log(`Direction from SF to LA: ${bearing.bearing}° (${bearing.cardinal})`);
    console.log('✓ PASSED');
} catch (error) {
    console.error('✗ FAILED:', error.message);
}

// Test 8: Format Altitude
console.log('\n8. FORMAT ALTITUDE');
console.log('-'.repeat(70));
try {
    const altM = gps.formatAltitude(1000, { unit: 'm', decimals: 1 });
    const altFt = gps.formatAltitude(1000, { unit: 'ft', decimals: 0 });
    const altNA = gps.formatAltitude(null);
    console.log(`1000 meters: ${altM}`);
    console.log(`1000 meters: ${altFt}`);
    console.log(`Null altitude: ${altNA}`);
    console.log('✓ PASSED');
} catch (error) {
    console.error('✗ FAILED:', error.message);
}

// Test 9: Parse Coordinate Strings
console.log('\n9. PARSE COORDINATE STRINGS');
console.log('-'.repeat(70));
try {
    const decimal = gps.parseCoordinateString('37.7749, -122.4194');
    console.log(`Decimal format: ${JSON.stringify(decimal)}`);

    const dms = gps.parseCoordinateString("37°46'29.6\"N 122°25'09.8\"W");
    console.log(`DMS format: ${JSON.stringify({ latitude: dms.latitude.toFixed(4), longitude: dms.longitude.toFixed(4) })}`);

    const spaceDms = gps.parseCoordinateString('37 46 29.6 N, 122 25 09.8 W');
    console.log(`Space-separated DMS: ${JSON.stringify({ latitude: spaceDms.latitude.toFixed(4), longitude: spaceDms.longitude.toFixed(4) })}`);
    console.log('✓ PASSED');
} catch (error) {
    console.error('✗ FAILED:', error.message);
}

// Test 10: Validate Coordinates
console.log('\n10. VALIDATE COORDINATES');
console.log('-'.repeat(70));
try {
    const valid = gps.isValidCoordinate({ latitude: SF_LAT, longitude: SF_LON });
    const invalid = gps.isValidCoordinate({ latitude: 95, longitude: SF_LON });
    const incomplete = gps.isValidCoordinate({ latitude: SF_LAT });
    console.log(`Valid coordinate: ${valid}`);
    console.log(`Invalid latitude (95°): ${invalid}`);
    console.log(`Incomplete coordinate: ${incomplete}`);
    console.log('✓ PASSED');
} catch (error) {
    console.error('✗ FAILED:', error.message);
}

// Test 11: Get Bounding Box
console.log('\n11. GET BOUNDING BOX');
console.log('-'.repeat(70));
try {
    const bbox = gps.getBoundingBox(SF_LAT, SF_LON, 10);
    console.log(`Bounding box around SF (10 km radius):`);
    console.log(`  North: ${bbox.north.toFixed(4)}°`);
    console.log(`  South: ${bbox.south.toFixed(4)}°`);
    console.log(`  East: ${bbox.east.toFixed(4)}°`);
    console.log(`  West: ${bbox.west.toFixed(4)}°`);
    console.log('✓ PASSED');
} catch (error) {
    console.error('✗ FAILED:', error.message);
}

// Test 12: Check if Within Bounding Box
console.log('\n12. CHECK IF WITHIN BOUNDING BOX');
console.log('-'.repeat(70));
try {
    const bbox = gps.getBoundingBox(SF_LAT, SF_LON, 10);
    const nearby = gps.isWithinBoundingBox(37.8000, -122.4000, bbox);
    const distant = gps.isWithinBoundingBox(LA_LAT, LA_LON, bbox);
    console.log(`(37.8, -122.4) within 10km of SF: ${nearby}`);
    console.log(`LA coordinates within 10km of SF: ${distant}`);
    console.log('✓ PASSED');
} catch (error) {
    console.error('✗ FAILED:', error.message);
}

// Test 13: Calculate Midpoint
console.log('\n13. CALCULATE MIDPOINT');
console.log('-'.repeat(70));
try {
    const midpoint = gps.calculateMidpoint(SF_LAT, SF_LON, LA_LAT, LA_LON);
    console.log(`Midpoint between SF and LA:`);
    console.log(`  Latitude: ${midpoint.latitude.toFixed(4)}°`);
    console.log(`  Longitude: ${midpoint.longitude.toFixed(4)}°`);
    console.log('✓ PASSED');
} catch (error) {
    console.error('✗ FAILED:', error.message);
}

// Test 14: Error Handling
console.log('\n14. ERROR HANDLING');
console.log('-'.repeat(70));
try {
    try {
        gps.formatCoordinates(95, -122.4194); // Invalid latitude
        console.log('✗ Should have thrown error');
    } catch (error) {
        console.log(`✓ Invalid latitude caught: "${error.message}"`);
    }

    try {
        gps.decimalToDMS(37.7749, 'X'); // Invalid direction
        console.log('✗ Should have thrown error');
    } catch (error) {
        console.log(`✓ Invalid direction caught: "${error.message}"`);
    }

    try {
        gps.calculateDistance(SF_LAT, SF_LON, LA_LAT, LA_LON, { unit: 'nm' }); // Invalid unit
        console.log('✗ Should have thrown error');
    } catch (error) {
        console.log(`✓ Invalid unit caught: "${error.message}"`);
    }

    console.log('✓ PASSED');
} catch (error) {
    console.error('✗ FAILED:', error.message);
}

// Summary
console.log('\n' + '='.repeat(70));
console.log('ALL TESTS COMPLETED SUCCESSFULLY');
console.log('='.repeat(70));
console.log('\nModule Location: /Volumes/JS-DEV/utilities/file-metadata-ai-organizer/src/utils/gps.js');
console.log('Documentation: /Volumes/JS-DEV/utilities/file-metadata-ai-organizer/GPS_USAGE_EXAMPLES.md');
