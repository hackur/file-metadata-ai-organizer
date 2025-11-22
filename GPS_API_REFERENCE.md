# GPS Utility Module - Complete API Reference

## Overview

The GPS utility module provides comprehensive GPS coordinate utilities for the File Metadata AI Organizer. It handles coordinate format conversions, distance calculations, bearing calculations, and Google Maps integration.

**Location**: `/src/utils/gps.js`

**Usage**: `const gps = require('./src/utils/gps');`

---

## Table of Contents

1. [Coordinate Conversion Methods](#coordinate-conversion-methods)
2. [Formatting Methods](#formatting-methods)
3. [Distance & Navigation Methods](#distance--navigation-methods)
4. [Geographic Utility Methods](#geographic-utility-methods)
5. [Google Maps Integration](#google-maps-integration)
6. [Validation & Helper Methods](#validation--helper-methods)
7. [Error Handling](#error-handling)
8. [Data Types](#data-types)

---

## Coordinate Conversion Methods

### decimalToDMS(coordinate, direction)

Convert a decimal coordinate value to Degrees, Minutes, Seconds format.

**Parameters:**
- `coordinate` (number): The coordinate value in decimal format
- `direction` (string): Cardinal direction - 'N', 'S', 'E', or 'W'

**Returns:** (Object)
```javascript
{
    degrees: number,  // 0-180
    minutes: number,  // 0-59
    seconds: number,  // 0-59.9
    direction: string // N, S, E, or W
}
```

**Throws:** Error if coordinate is not a valid number or direction is invalid

**Example:**
```javascript
const result = gps.decimalToDMS(37.7749, 'N');
// { degrees: 37, minutes: 46, seconds: 29.6, direction: 'N' }
```

---

### dmsToDecimal(degrees, minutes, seconds, direction)

Convert DMS (Degrees, Minutes, Seconds) to decimal format.

**Parameters:**
- `degrees` (number): Degrees component (0-180)
- `minutes` (number): Minutes component (0-59)
- `seconds` (number): Seconds component (0-59.9)
- `direction` (string): Cardinal direction - 'N', 'S', 'E', or 'W'

**Returns:** (number) Decimal coordinate value

**Throws:** Error if any parameter is invalid or out of range

**Example:**
```javascript
const result = gps.dmsToDecimal(37, 46, 29.6, 'N');
// 37.7749
```

---

### parseCoordinateString(coordinateString)

Parse various GPS coordinate formats and return standardized decimal format.

**Parameters:**
- `coordinateString` (string): The coordinate string to parse

**Returns:** (Object)
```javascript
{
    latitude: number,   // -90 to 90
    longitude: number   // -180 to 180
}
```

**Throws:** Error if coordinate string cannot be parsed

**Supported Formats:**
- Decimal: `"37.7749, -122.4194"`
- DMS with symbols: `"37°46'29.6\"N 122°25'09.8\"W"`
- Space-separated DMS: `"37 46 29.6 N, 122 25 09.8 W"`

**Example:**
```javascript
const result = gps.parseCoordinateString('37.7749, -122.4194');
// { latitude: 37.7749, longitude: -122.4194 }
```

---

## Formatting Methods

### formatCoordinates(latitude, longitude, options)

Format GPS coordinates for display in DMS (Degrees, Minutes, Seconds) format.

**Parameters:**
- `latitude` (number): Latitude value (-90 to 90)
- `longitude` (number): Longitude value (-180 to 180)
- `options` (Object, optional):
  - `includeDirection` (boolean): Include N/S/E/W indicators (default: true)
  - `decimalPlaces` (number): Decimal places for seconds (default: 1)

**Returns:** (string) Formatted coordinate string

**Throws:** Error if coordinates are invalid

**Example:**
```javascript
gps.formatCoordinates(37.7749, -122.4194);
// "37°46'29.6\"N 122°25'9.8\"W"

gps.formatCoordinates(37.7749, -122.4194, { decimalPlaces: 2 });
// "37°46'29.64\"N 122°25'09.84\"W"

gps.formatCoordinates(37.7749, -122.4194, { includeDirection: false });
// "37°46'29.6\" 122°25'09.8\""
```

---

### formatDecimal(latitude, longitude, options)

Format GPS coordinates in decimal format with specified precision.

**Parameters:**
- `latitude` (number): Latitude value (-90 to 90)
- `longitude` (number): Longitude value (-180 to 180)
- `options` (Object, optional):
  - `decimals` (number): Decimal places (default: 6)

**Returns:** (string) Formatted decimal string

**Throws:** Error if coordinates are invalid

**Example:**
```javascript
gps.formatDecimal(37.7749, -122.4194);
// "37.774900, -122.419400"

gps.formatDecimal(37.7749, -122.4194, { decimals: 4 });
// "37.7749, -122.4194"
```

---

### formatAltitude(altitude, options)

Format altitude values with unit conversion support.

**Parameters:**
- `altitude` (number): Altitude in meters (can be null/undefined)
- `options` (Object, optional):
  - `unit` (string): Output unit - 'ft' or 'm' (default: 'm')
  - `decimals` (number): Decimal places (default: 1)

**Returns:** (string) Formatted altitude string (e.g., "1000.0 m" or "3280.8 ft")

**Throws:** Error if altitude is not a valid number, null, or undefined

**Example:**
```javascript
gps.formatAltitude(1000);
// "1000.0 m"

gps.formatAltitude(1000, { unit: 'ft' });
// "3280.8 ft"

gps.formatAltitude(null);
// "N/A"
```

---

## Distance & Navigation Methods

### calculateDistance(lat1, lon1, lat2, lon2, options)

Calculate distance between two GPS points using the Haversine formula.

**Parameters:**
- `lat1` (number): Latitude of first point (-90 to 90)
- `lon1` (number): Longitude of first point (-180 to 180)
- `lat2` (number): Latitude of second point (-90 to 90)
- `lon2` (number): Longitude of second point (-180 to 180)
- `options` (Object, optional):
  - `unit` (string): Output unit - 'km', 'mi', or 'm' (default: 'km')

**Returns:** (number) Distance between points

**Throws:** Error if coordinates are invalid or unit is not recognized

**Notes:**
- Uses Earth radius of 6,371 km
- Conversion factors: 1 km = 0.621371 miles = 1000 meters
- Haversine formula provides accurate distances on spherical Earth

**Example:**
```javascript
gps.calculateDistance(37.7749, -122.4194, 34.0522, -118.2437);
// 559.12 (km)

gps.calculateDistance(37.7749, -122.4194, 34.0522, -118.2437, { unit: 'mi' });
// 347.42 (miles)

gps.calculateDistance(37.7749, -122.4194, 34.0522, -118.2437, { unit: 'm' });
// 559121 (meters)
```

---

### calculateBearing(lat1, lon1, lat2, lon2)

Calculate bearing (direction) between two GPS points.

**Parameters:**
- `lat1` (number): Latitude of first point (-90 to 90)
- `lon1` (number): Longitude of first point (-180 to 180)
- `lat2` (number): Latitude of second point (-90 to 90)
- `lon2` (number): Longitude of second point (-180 to 180)

**Returns:** (Object)
```javascript
{
    bearing: number,    // 0-360 degrees
    cardinal: string    // 'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                        // 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'
}
```

**Throws:** Error if coordinates are invalid

**Notes:**
- Bearing angles: 0° = North, 90° = East, 180° = South, 270° = West
- Cardinal directions are computed at 22.5° intervals (16 directions total)

**Example:**
```javascript
gps.calculateBearing(37.7749, -122.4194, 34.0522, -118.2437);
// { bearing: 136.5, cardinal: 'SE' }
```

---

### calculateMidpoint(lat1, lon1, lat2, lon2)

Calculate the geodesic midpoint between two coordinates.

**Parameters:**
- `lat1` (number): Latitude of first point (-90 to 90)
- `lon1` (number): Longitude of first point (-180 to 180)
- `lat2` (number): Latitude of second point (-90 to 90)
- `lon2` (number): Longitude of second point (-180 to 180)

**Returns:** (Object)
```javascript
{
    latitude: number,   // -90 to 90
    longitude: number   // -180 to 180
}
```

**Throws:** Error if coordinates are invalid

**Example:**
```javascript
gps.calculateMidpoint(37.7749, -122.4194, 34.0522, -118.2437);
// { latitude: 35.9316, longitude: -120.2824 }
```

---

## Geographic Utility Methods

### getBoundingBox(latitude, longitude, radiusKm)

Create a bounding box around a coordinate at a specified radius.

**Parameters:**
- `latitude` (number): Center latitude (-90 to 90)
- `longitude` (number): Center longitude (-180 to 180)
- `radiusKm` (number): Radius in kilometers (must be > 0)

**Returns:** (Object)
```javascript
{
    north: number,  // Maximum latitude
    south: number,  // Minimum latitude
    east: number,   // Maximum longitude
    west: number    // Minimum longitude
}
```

**Throws:** Error if coordinates are invalid or radius is not positive

**Example:**
```javascript
const bbox = gps.getBoundingBox(37.7749, -122.4194, 10);
// {
//     north: 37.8648,
//     south: 37.6850,
//     east: -122.3056,
//     west: -122.5332
// }
```

---

### isWithinBoundingBox(latitude, longitude, boundingBox)

Check if a coordinate is within a bounding box.

**Parameters:**
- `latitude` (number): Latitude to check (-90 to 90)
- `longitude` (number): Longitude to check (-180 to 180)
- `boundingBox` (Object): Bounding box with north, south, east, west properties

**Returns:** (boolean) true if coordinate is within bounds

**Throws:** Error if coordinates or bounding box are invalid

**Example:**
```javascript
const bbox = gps.getBoundingBox(37.7749, -122.4194, 10);
gps.isWithinBoundingBox(37.8000, -122.4000, bbox);
// true

gps.isWithinBoundingBox(34.0522, -118.2437, bbox);
// false
```

---

## Google Maps Integration

### generateGoogleMapsLink(latitude, longitude, options)

Generate a Google Maps URL from GPS coordinates.

**Parameters:**
- `latitude` (number): Latitude value (-90 to 90)
- `longitude` (number): Longitude value (-180 to 180)
- `options` (Object, optional):
  - `zoom` (number): Map zoom level 0-21 (default: 15)
  - `mapType` (string): 'roadmap', 'satellite', 'terrain', or 'hybrid' (default: 'roadmap')
  - `label` (string): Optional marker label
  - `title` (string): Optional marker title/tooltip

**Returns:** (string) Google Maps URL

**Throws:** Error if coordinates are invalid, zoom is out of range, or mapType is invalid

**Map Types:**
- `roadmap` - Standard street map
- `satellite` - Satellite/aerial view
- `terrain` - Terrain/topographic view
- `hybrid` - Satellite view with streets overlay

**Example:**
```javascript
gps.generateGoogleMapsLink(37.7749, -122.4194);
// "https://maps.google.com/?q=37.7749,-122.4194&z=15&t=roadmap"

gps.generateGoogleMapsLink(37.7749, -122.4194, {
    zoom: 18,
    mapType: 'satellite',
    label: 'Golden Gate Bridge'
});
// "https://maps.google.com/maps?q=loc:37.7749,-122.4194&z=18&t=satellite&marker=Golden+Gate+Bridge"
```

---

## Validation & Helper Methods

### isValidCoordinate(coord)

Validate if a coordinate object is complete and contains valid values.

**Parameters:**
- `coord` (Object): Object with latitude and longitude properties

**Returns:** (boolean) true if coordinate is valid

**Validation Criteria:**
- Object is not null
- Has both latitude and longitude properties
- Both values are numbers
- Latitude is between -90 and 90
- Longitude is between -180 and 180

**Example:**
```javascript
gps.isValidCoordinate({ latitude: 37.7749, longitude: -122.4194 });
// true

gps.isValidCoordinate({ latitude: 95, longitude: -122.4194 });
// false (latitude > 90)

gps.isValidCoordinate({ latitude: 37.7749 });
// false (missing longitude)
```

---

## Error Handling

All methods include comprehensive error handling and throw descriptive Error objects.

### Common Error Messages

```
"Invalid coordinates: latitude must be -90 to 90, longitude must be -180 to 180"
"Direction must be one of: N, S, E, W"
"Invalid DMS values: degrees must be 0-180, minutes and seconds must be 0-59"
"Unit must be one of: km, mi, m"
"Zoom level must be between 0 and 21"
"Map type must be one of: roadmap, satellite, terrain, hybrid"
"Radius must be a positive number"
"Coordinate must be a valid number"
"Degrees, minutes, and seconds must be valid numbers"
```

### Error Handling Example

```javascript
try {
    gps.formatCoordinates(95, -122.4194); // Invalid latitude
} catch (error) {
    console.error(error.message);
    // "Invalid coordinates: latitude must be -90 to 90, longitude must be -180 to 180"
}
```

---

## Data Types

### Coordinate Object
```javascript
{
    latitude: number,   // -90 to 90
    longitude: number   // -180 to 180
}
```

### DMS Object
```javascript
{
    degrees: number,    // 0-180
    minutes: number,    // 0-59
    seconds: number,    // 0-59.9
    direction: string   // 'N', 'S', 'E', or 'W'
}
```

### Bearing Object
```javascript
{
    bearing: number,    // 0-360 degrees
    cardinal: string    // 'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                        // 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'
}
```

### Bounding Box Object
```javascript
{
    north: number,  // Maximum latitude
    south: number,  // Minimum latitude
    east: number,   // Maximum longitude
    west: number    // Minimum longitude
}
```

---

## Constants & Conversion Factors

```javascript
// Earth Parameters
Earth radius: 6,371 km
Degrees to radians: multiply by (π / 180)
Radians to degrees: multiply by (180 / π)

// Unit Conversions
1 km = 0.621371 miles
1 meter = 3.28084 feet
1 kilometer = 1000 meters

// Coordinate Ranges
Latitude: -90° to 90° (South to North)
Longitude: -180° to 180° (West to East)

// Bearing Angles
0° = North
90° = East
180° = South
270° = West

// Cardinal Directions (16-point compass)
N, NNE, NE, ENE, E, ESE, SE, SSE, S, SSW, SW, WSW, W, WNW, NW, NNW
```

---

## Implementation Details

### Haversine Formula
The module uses the Haversine formula for distance calculations, which accounts for the spherical shape of Earth:

```
a = sin²(Δlat/2) + cos(lat1) × cos(lat2) × sin²(Δlon/2)
c = 2 × atan2(√a, √(1−a))
d = R × c
```

Where:
- R is Earth's radius (6,371 km)
- lat1, lon1 are first point coordinates
- lat2, lon2 are second point coordinates
- d is distance

### DMS Conversion
Decimal to DMS:
```
degrees = floor(|coordinate|)
minutes = floor((|coordinate| - degrees) × 60)
seconds = ((|coordinate| - degrees) × 60 - minutes) × 60
```

DMS to Decimal:
```
decimal = degrees + minutes/60 + seconds/3600
if (direction === 'S' or 'W'): decimal = -decimal
```

---

## Performance Considerations

- All calculations are synchronous (non-blocking)
- No external dependencies required
- Time complexity for all methods: O(1)
- Distance calculations use efficient trigonometric functions
- Suitable for real-time applications

---

## Best Practices

1. **Always validate user input** before processing
2. **Use try-catch blocks** when parsing user-provided coordinate strings
3. **Cache results** of expensive operations if called frequently
4. **Use consistent coordinate format** throughout your application
5. **Validate coordinates** with `isValidCoordinate()` when loading from external sources
6. **Consider precision** - latitude/longitude 6 decimal places = ~0.11m accuracy
7. **Use appropriate units** - select km, mi, or m based on context

---

## Testing

Run the included test suite:
```bash
node test_gps_module.js
```

This will verify all functionality and demonstrate usage patterns.

---

## Related Files

- Module: `/src/utils/gps.js`
- Usage Examples: `GPS_USAGE_EXAMPLES.md`
- Test Suite: `test_gps_module.js`
