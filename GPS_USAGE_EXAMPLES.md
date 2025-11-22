# GPS Utility Module - Usage Examples

The GPS utility module provides comprehensive GPS coordinate utilities for file metadata organization. This document demonstrates all available functions.

## Module Import

```javascript
const gps = require('./src/utils/gps');
```

---

## 1. Decimal to DMS Conversion

Convert decimal coordinates to Degrees, Minutes, Seconds format.

### Example
```javascript
// Convert latitude 37.7749 to DMS format
const latDMS = gps.decimalToDMS(37.7749, 'N');
console.log(latDMS);
// Output: { degrees: 37, minutes: 46, seconds: 29.6, direction: 'N' }

// Convert longitude -122.4194 to DMS format
const lonDMS = gps.decimalToDMS(-122.4194, 'W');
console.log(lonDMS);
// Output: { degrees: 122, minutes: 25, seconds: 9.8, direction: 'W' }
```

---

## 2. DMS to Decimal Conversion

Convert DMS coordinates back to decimal format.

### Example
```javascript
// Convert DMS to decimal
const latitude = gps.dmsToDecimal(37, 46, 29.6, 'N');
console.log(latitude); // 37.7749

const longitude = gps.dmsToDecimal(122, 25, 9.8, 'W');
console.log(longitude); // -122.4194
```

---

## 3. Format Coordinates for Display

Display GPS coordinates in human-readable DMS format.

### Example
```javascript
// Format as DMS with directions
const formatted = gps.formatCoordinates(37.7749, -122.4194);
console.log(formatted);
// Output: "37°46'29.6\"N 122°25'09.8\"W"

// Format with custom decimal places
const precise = gps.formatCoordinates(37.7749, -122.4194, { decimalPlaces: 2 });
console.log(precise);
// Output: "37°46'29.64\"N 122°25'09.84\"W"

// Format without direction indicators
const noDir = gps.formatCoordinates(37.7749, -122.4194, { includeDirection: false });
console.log(noDir);
// Output: "37°46'29.6\" 122°25'09.8\""
```

---

## 4. Format Decimal Coordinates

Display coordinates in decimal format with specified precision.

### Example
```javascript
// Format decimal coordinates
const decimal = gps.formatDecimal(37.7749, -122.4194);
console.log(decimal);
// Output: "37.774900, -122.419400"

// Format with custom decimal places
const custom = gps.formatDecimal(37.7749, -122.4194, { decimals: 4 });
console.log(custom);
// Output: "37.7749, -122.4194"
```

---

## 5. Generate Google Maps Links

Create Google Maps URLs from GPS coordinates.

### Example
```javascript
// Basic Google Maps link
const basicLink = gps.generateGoogleMapsLink(37.7749, -122.4194);
console.log(basicLink);
// Output: "https://maps.google.com/?q=37.7749,-122.4194&z=15&t=roadmap"

// Link with custom zoom level
const zoomed = gps.generateGoogleMapsLink(37.7749, -122.4194, { zoom: 18 });
console.log(zoomed);
// Output: "https://maps.google.com/?q=37.7749,-122.4194&z=18&t=roadmap"

// Link with satellite view and marker label
const satellite = gps.generateGoogleMapsLink(37.7749, -122.4194, {
    zoom: 16,
    mapType: 'satellite',
    label: 'Golden Gate Bridge',
    title: 'Iconic Bridge in San Francisco'
});
console.log(satellite);
// Output: "https://maps.google.com/maps?q=loc:37.7749,-122.4194&z=16&t=satellite&marker=Golden+Gate+Bridge&title=Iconic+Bridge+in+San+Francisco"

// Map types: 'roadmap', 'satellite', 'terrain', 'hybrid'
```

---

## 6. Calculate Distance Between Points (Haversine Formula)

Calculate distance between two GPS coordinates.

### Example
```javascript
// Distance in kilometers (default)
const distKm = gps.calculateDistance(37.7749, -122.4194, 34.0522, -118.2437);
console.log(distKm); // ~559.1 km (San Francisco to Los Angeles)

// Distance in miles
const distMi = gps.calculateDistance(37.7749, -122.4194, 34.0522, -118.2437, { unit: 'mi' });
console.log(distMi); // ~347.2 miles

// Distance in meters
const distM = gps.calculateDistance(37.7749, -122.4194, 34.0522, -118.2437, { unit: 'm' });
console.log(distM); // ~559,100 meters
```

---

## 7. Calculate Bearing Between Points

Calculate direction (bearing) between two coordinates.

### Example
```javascript
// Calculate bearing from SF to LA
const bearing = gps.calculateBearing(37.7749, -122.4194, 34.0522, -118.2437);
console.log(bearing);
// Output: { bearing: 137.45, cardinal: 'SE' }

// The bearing is in degrees (0-360) where:
// 0° = North, 90° = East, 180° = South, 270° = West
```

---

## 8. Format Altitude

Format altitude values with unit conversion.

### Example
```javascript
// Format altitude in meters
const altM = gps.formatAltitude(1000);
console.log(altM); // "1000.0 m"

// Format altitude in feet
const altFt = gps.formatAltitude(1000, { unit: 'ft' });
console.log(altFt); // "3280.8 ft"

// Custom decimal places
const altCustom = gps.formatAltitude(1000, { unit: 'ft', decimals: 0 });
console.log(altCustom); // "3281 ft"

// Handle null/undefined altitude
const altNA = gps.formatAltitude(null);
console.log(altNA); // "N/A"
```

---

## 9. Parse Coordinate Strings

Parse various coordinate formats and convert to standardized decimal format.

### Example
```javascript
// Parse decimal format
const coord1 = gps.parseCoordinateString('37.7749, -122.4194');
console.log(coord1); // { latitude: 37.7749, longitude: -122.4194 }

// Parse DMS format with symbols
const coord2 = gps.parseCoordinateString("37°46'29.6\"N 122°25'09.8\"W");
console.log(coord2); // { latitude: 37.7749, longitude: -122.4194 }

// Parse space-separated DMS format
const coord3 = gps.parseCoordinateString('37 46 29.6 N, 122 25 09.8 W');
console.log(coord3); // { latitude: 37.7749, longitude: -122.4194 }

// Supported formats:
// - Decimal: "37.7749, -122.4194"
// - DMS: "37°46'29.6\"N 122°25'09.8\"W"
// - Space-separated: "37 46 29.6 N, 122 25 09.8 W"
```

---

## 10. Validate Coordinates

Check if a coordinate object is valid.

### Example
```javascript
// Valid coordinate
const valid = gps.isValidCoordinate({ latitude: 37.7749, longitude: -122.4194 });
console.log(valid); // true

// Invalid coordinate - out of range
const invalid = gps.isValidCoordinate({ latitude: 95, longitude: -122.4194 });
console.log(invalid); // false

// Invalid coordinate - missing properties
const missing = gps.isValidCoordinate({ latitude: 37.7749 });
console.log(missing); // false
```

---

## 11. Get Bounding Box

Create a bounding box around a coordinate.

### Example
```javascript
// Get bounding box within 10 km radius
const bbox = gps.getBoundingBox(37.7749, -122.4194, 10);
console.log(bbox);
// Output: {
//   north: 37.8646,
//   south: 37.6852,
//   east: -122.3097,
//   west: -122.5291
// }

// Useful for queries like "find all photos within 10 km of this location"
```

---

## 12. Check if Coordinate is Within Bounding Box

Verify if a coordinate falls within a bounding box.

### Example
```javascript
const bbox = gps.getBoundingBox(37.7749, -122.4194, 10);

// Point within bounding box
const inside = gps.isWithinBoundingBox(37.8000, -122.4000, bbox);
console.log(inside); // true

// Point outside bounding box
const outside = gps.isWithinBoundingBox(34.0522, -118.2437, bbox);
console.log(outside); // false
```

---

## 13. Calculate Midpoint

Find the midpoint between two coordinates.

### Example
```javascript
// Find midpoint between SF and LA
const midpoint = gps.calculateMidpoint(37.7749, -122.4194, 34.0522, -118.2437);
console.log(midpoint);
// Output: { latitude: 35.9136, longitude: -120.3316 }

// Useful for centering maps on two locations
```

---

## Error Handling

All functions include comprehensive error handling for invalid inputs.

### Example
```javascript
try {
    // Invalid latitude (> 90)
    gps.formatCoordinates(95, -122.4194);
} catch (error) {
    console.error(error.message);
    // Output: "Invalid coordinates: latitude must be -90 to 90, longitude must be -180 to 180"
}

try {
    // Invalid direction
    gps.decimalToDMS(37.7749, 'X');
} catch (error) {
    console.error(error.message);
    // Output: "Direction must be one of: N, S, E, W"
}

try {
    // Invalid DMS values
    gps.dmsToDecimal(37, 75, 30, 'N'); // minutes > 60
} catch (error) {
    console.error(error.message);
    // Output: "Invalid DMS values: degrees must be 0-180, minutes and seconds must be 0-59"
}

try {
    // Invalid unit
    gps.calculateDistance(37.7749, -122.4194, 34.0522, -118.2437, { unit: 'nm' });
} catch (error) {
    console.error(error.message);
    // Output: "Unit must be one of: km, mi, m"
}
```

---

## Common Use Cases

### 1. Display Photo Metadata with GPS
```javascript
const photo = {
    filename: 'vacation.jpg',
    latitude: 37.7749,
    longitude: -122.4194,
    altitude: 15
};

console.log(`Photo: ${photo.filename}`);
console.log(`Location: ${gps.formatCoordinates(photo.latitude, photo.longitude)}`);
console.log(`Altitude: ${gps.formatAltitude(photo.altitude, { unit: 'ft' })}`);
console.log(`View on Maps: ${gps.generateGoogleMapsLink(photo.latitude, photo.longitude)}`);
```

### 2. Find Photos Within a Region
```javascript
const centerLat = 37.7749;
const centerLon = -122.4194;
const radiusKm = 5;

const bbox = gps.getBoundingBox(centerLat, centerLon, radiusKm);

const photos = [
    { lat: 37.8, lon: -122.4 },
    { lat: 34.0, lon: -118.2 }
];

const nearby = photos.filter(p =>
    gps.isWithinBoundingBox(p.lat, p.lon, bbox)
);

console.log(`Found ${nearby.length} photos within ${radiusKm} km`);
```

### 3. Convert Between Formats
```javascript
// User provides coordinates in DMS format
const userInput = "37°46'29.6\"N 122°25'09.8\"W";

// Parse and convert to decimal
const coord = gps.parseCoordinateString(userInput);
console.log(coord); // { latitude: 37.7749, longitude: -122.4194 }

// Store in database as decimal
database.save({ lat: coord.latitude, lon: coord.longitude });

// Display back to user in DMS
console.log(gps.formatCoordinates(coord.latitude, coord.longitude));
// Output: "37°46'29.6\"N 122°25'09.8\"W"
```

---

## API Reference

### Conversion Methods
- `decimalToDMS(coordinate, direction)` - Convert decimal to DMS
- `dmsToDecimal(degrees, minutes, seconds, direction)` - Convert DMS to decimal
- `parseCoordinateString(coordinateString)` - Parse various coordinate formats

### Formatting Methods
- `formatCoordinates(latitude, longitude, options)` - Format as DMS with directions
- `formatDecimal(latitude, longitude, options)` - Format as decimal
- `formatAltitude(altitude, options)` - Format altitude with unit conversion

### Distance/Navigation Methods
- `calculateDistance(lat1, lon1, lat2, lon2, options)` - Haversine distance calculation
- `calculateBearing(lat1, lon1, lat2, lon2)` - Calculate direction between points
- `calculateMidpoint(lat1, lon1, lat2, lon2)` - Find midpoint between coordinates

### Geographic Utilities
- `getBoundingBox(latitude, longitude, radiusKm)` - Create radius-based bounding box
- `isWithinBoundingBox(latitude, longitude, boundingBox)` - Check containment
- `isValidCoordinate(coord)` - Validate coordinate object

### Maps Integration
- `generateGoogleMapsLink(latitude, longitude, options)` - Create Google Maps URLs

---

## Notes

- All latitude values must be between -90 and 90
- All longitude values must be between -180 and 180
- The module uses the Haversine formula for accurate distance calculations
- Earth radius used: 6,371 km (mean radius)
- Conversion factors:
  - 1 km = 0.621371 miles
  - 1 meter = 3.28084 feet
- Cardinal directions for bearings: N, NNE, NE, ENE, E, ESE, SE, SSE, S, SSW, SW, WSW, W, WNW, NW, NNW
