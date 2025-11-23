/**
 * GPS Utility Module
 * Provides comprehensive GPS coordinate utilities including format conversion,
 * distance calculation, and Google Maps integration
 */

const logger = require('./logger');

/**
 * Validates GPS coordinate
 * @param {number} latitude - Latitude value (-90 to 90)
 * @param {number} longitude - Longitude value (-180 to 180)
 * @returns {boolean} True if coordinates are valid
 */
function validateCoordinates(latitude, longitude) {
    return (
        typeof latitude === 'number' &&
        typeof longitude === 'number' &&
        !isNaN(latitude) &&
        !isNaN(longitude) &&
        latitude >= -90 &&
        latitude <= 90 &&
        longitude >= -180 &&
        longitude <= 180
    );
}

/**
 * Validates altitude value
 * @param {number} altitude - Altitude in meters
 * @returns {boolean} True if altitude is valid
 */
function validateAltitude(altitude) {
    return (
        altitude === null ||
        altitude === undefined ||
        (typeof altitude === 'number' && !isNaN(altitude))
    );
}

class GPSUtil {
    /**
     * Convert decimal GPS coordinates to DMS (Degrees, Minutes, Seconds) format
     * @param {number} coordinate - The coordinate value in decimal format
     * @param {string} direction - The direction for latitude (N/S) or longitude (E/W)
     * @returns {Object} Object containing degrees, minutes, seconds, and direction
     * @throws {Error} If coordinate is invalid
     */
    decimalToDMS(coordinate, direction) {
        if (typeof coordinate !== 'number' || isNaN(coordinate)) {
            throw new Error('Coordinate must be a valid number');
        }

        if (!['N', 'S', 'E', 'W'].includes(direction)) {
            throw new Error('Direction must be one of: N, S, E, W');
        }

        const absoluteCoord = Math.abs(coordinate);
        const degrees = Math.floor(absoluteCoord);
        const minutesDecimal = (absoluteCoord - degrees) * 60;
        const minutes = Math.floor(minutesDecimal);
        const seconds = ((minutesDecimal - minutes) * 60).toFixed(1);

        return {
            degrees,
            minutes,
            seconds: parseFloat(seconds),
            direction
        };
    }

    /**
     * Convert DMS coordinates back to decimal format
     * @param {number} degrees - Degrees component
     * @param {number} minutes - Minutes component
     * @param {number} seconds - Seconds component
     * @param {string} direction - Direction (N, S, E, W)
     * @returns {number} Decimal coordinate value
     * @throws {Error} If DMS values are invalid
     */
    dmsToDecimal(degrees, minutes, seconds, direction) {
        if (![degrees, minutes, seconds].every(v => typeof v === 'number' && !isNaN(v))) {
            throw new Error('Degrees, minutes, and seconds must be valid numbers');
        }

        if (!['N', 'S', 'E', 'W'].includes(direction)) {
            throw new Error('Direction must be one of: N, S, E, W');
        }

        if (degrees < 0 || minutes < 0 || seconds < 0 || degrees > 180 || minutes >= 60 || seconds >= 60) {
            throw new Error('Invalid DMS values: degrees must be 0-180, minutes and seconds must be 0-59');
        }

        let decimal = degrees + minutes / 60 + seconds / 3600;

        if (direction === 'S' || direction === 'W') {
            decimal = -decimal;
        }

        return decimal;
    }

    /**
     * Format GPS coordinates for display: "37°46'29.6\"N 122°25'09.8\"W"
     * @param {number} latitude - Latitude in decimal format
     * @param {number} longitude - Longitude in decimal format
     * @param {Object} options - Formatting options
     * @param {boolean} options.includeDirection - Include N/S/E/W (default: true)
     * @param {number} options.decimalPlaces - Decimal places for seconds (default: 1)
     * @returns {string} Formatted coordinate string
     * @throws {Error} If coordinates are invalid
     */
    formatCoordinates(latitude, longitude, options = {}) {
        const {
            includeDirection = true,
            decimalPlaces = 1
        } = options;

        if (!validateCoordinates(latitude, longitude)) {
            throw new Error('Invalid coordinates: latitude must be -90 to 90, longitude must be -180 to 180');
        }

        const latDirection = latitude >= 0 ? 'N' : 'S';
        const lonDirection = longitude >= 0 ? 'E' : 'W';

        const latDMS = this.decimalToDMS(latitude, latDirection);
        const lonDMS = this.decimalToDMS(longitude, lonDirection);

        const formatDMS = (dms, decimals) => {
            const secondsStr = dms.seconds.toFixed(decimals);
            if (includeDirection) {
                return `${dms.degrees}°${dms.minutes}'${secondsStr}"${dms.direction}`;
            } else {
                return `${dms.degrees}°${dms.minutes}'${secondsStr}"`;
            }
        };

        const latStr = formatDMS(latDMS, decimalPlaces);
        const lonStr = formatDMS(lonDMS, decimalPlaces);

        return `${latStr} ${lonStr}`;
    }

    /**
     * Format coordinates in decimal format for display
     * @param {number} latitude - Latitude in decimal format
     * @param {number} longitude - Longitude in decimal format
     * @param {Object} options - Formatting options
     * @param {number} options.decimals - Decimal places (default: 6)
     * @returns {string} Formatted decimal coordinate string
     * @throws {Error} If coordinates are invalid
     */
    formatDecimal(latitude, longitude, options = {}) {
        const { decimals = 6 } = options;

        if (!validateCoordinates(latitude, longitude)) {
            throw new Error('Invalid coordinates: latitude must be -90 to 90, longitude must be -180 to 180');
        }

        return `${latitude.toFixed(decimals)}, ${longitude.toFixed(decimals)}`;
    }

    /**
     * Generate Google Maps link from coordinates
     * @param {number} latitude - Latitude in decimal format
     * @param {number} longitude - Longitude in decimal format
     * @param {Object} options - Additional options
     * @param {number} options.zoom - Map zoom level (default: 15)
     * @param {string} options.mapType - Map type: roadmap, satellite, terrain, hybrid (default: roadmap)
     * @param {string} options.label - Marker label
     * @param {string} options.title - Marker title/tooltip
     * @returns {string} Google Maps URL
     * @throws {Error} If coordinates are invalid
     */
    generateGoogleMapsLink(latitude, longitude, options = {}) {
        if (!validateCoordinates(latitude, longitude)) {
            throw new Error('Invalid coordinates: latitude must be -90 to 90, longitude must be -180 to 180');
        }

        const {
            zoom = 15,
            mapType = 'roadmap',
            label = null,
            title = null
        } = options;

        if (zoom < 0 || zoom > 21) {
            throw new Error('Zoom level must be between 0 and 21');
        }

        const validMapTypes = ['roadmap', 'satellite', 'terrain', 'hybrid'];
        if (!validMapTypes.includes(mapType)) {
            throw new Error(`Map type must be one of: ${validMapTypes.join(', ')}`);
        }

        let url = `https://maps.google.com/?q=${latitude},${longitude}&z=${zoom}&t=${mapType}`;

        // Add marker with label
        if (label) {
            const encodedLabel = encodeURIComponent(label);
            url = `https://maps.google.com/maps?q=loc:${latitude},${longitude}&z=${zoom}&t=${mapType}&marker=${encodedLabel}`;
        }

        // Add title as URL parameter
        if (title) {
            const encodedTitle = encodeURIComponent(title);
            url += `&title=${encodedTitle}`;
        }

        return url;
    }

    /**
     * Generate OpenStreetMap link from coordinates
     * @param {number} latitude - Latitude in decimal format
     * @param {number} longitude - Longitude in decimal format
     * @param {Object} options - Additional options
     * @param {number} options.zoom - Map zoom level (default: 15)
     * @param {string} options.marker - Whether to include a marker (default: true)
     * @returns {string} OpenStreetMap URL
     * @throws {Error} If coordinates are invalid
     */
    generateOpenStreetMapLink(latitude, longitude, options = {}) {
        if (!validateCoordinates(latitude, longitude)) {
            throw new Error('Invalid coordinates: latitude must be -90 to 90, longitude must be -180 to 180');
        }

        const {
            zoom = 15,
            marker = true
        } = options;

        if (zoom < 0 || zoom > 19) {
            throw new Error('Zoom level must be between 0 and 19');
        }

        let url = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}`;

        if (marker) {
            url += `#map=${zoom}/${latitude}/${longitude}`;
        } else {
            url = `https://www.openstreetmap.org/#map=${zoom}/${latitude}/${longitude}`;
        }

        return url;
    }

    /**
     * Calculate distance between two GPS points using Haversine formula
     * @param {number} lat1 - Latitude of first point
     * @param {number} lon1 - Longitude of first point
     * @param {number} lat2 - Latitude of second point
     * @param {number} lon2 - Longitude of second point
     * @param {Object} options - Calculation options
     * @param {string} options.unit - Distance unit: 'km', 'mi', 'm' (default: 'km')
     * @returns {number} Distance between points
     * @throws {Error} If coordinates are invalid
     */
    calculateDistance(lat1, lon1, lat2, lon2, options = {}) {
        if (!validateCoordinates(lat1, lon1) || !validateCoordinates(lat2, lon2)) {
            throw new Error('Invalid coordinates: latitude must be -90 to 90, longitude must be -180 to 180');
        }

        const { unit = 'km' } = options;
        const validUnits = ['km', 'mi', 'm'];

        if (!validUnits.includes(unit)) {
            throw new Error(`Unit must be one of: ${validUnits.join(', ')}`);
        }

        // Earth radius in kilometers
        const earthRadiusKm = 6371;

        // Convert degrees to radians
        const toRad = (deg) => (deg * Math.PI) / 180;

        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);

        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distanceKm = earthRadiusKm * c;

        // Convert to requested unit
        if (unit === 'mi') {
            return distanceKm * 0.621371; // km to miles
        } else if (unit === 'm') {
            return distanceKm * 1000; // km to meters
        }

        return distanceKm;
    }

    /**
     * Calculate bearing (direction) between two GPS points
     * @param {number} lat1 - Latitude of first point
     * @param {number} lon1 - Longitude of first point
     * @param {number} lat2 - Latitude of second point
     * @param {number} lon2 - Longitude of second point
     * @returns {Object} Bearing angle and cardinal direction
     * @throws {Error} If coordinates are invalid
     */
    calculateBearing(lat1, lon1, lat2, lon2) {
        if (!validateCoordinates(lat1, lon1) || !validateCoordinates(lat2, lon2)) {
            throw new Error('Invalid coordinates: latitude must be -90 to 90, longitude must be -180 to 180');
        }

        const toRad = (deg) => (deg * Math.PI) / 180;
        const toDeg = (rad) => (rad * 180) / Math.PI;

        const dLon = toRad(lon2 - lon1);
        const lat1Rad = toRad(lat1);
        const lat2Rad = toRad(lat2);

        const y = Math.sin(dLon) * Math.cos(lat2Rad);
        const x =
            Math.cos(lat1Rad) * Math.sin(lat2Rad) -
            Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

        let bearing = toDeg(Math.atan2(y, x));

        // Normalize bearing to 0-360
        bearing = (bearing + 360) % 360;

        // Get cardinal direction
        const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
        const index = Math.round(bearing / 22.5) % 16;

        return {
            bearing: parseFloat(bearing.toFixed(2)),
            cardinal: directions[index]
        };
    }

    /**
     * Format altitude for display
     * @param {number} altitude - Altitude in meters
     * @param {Object} options - Formatting options
     * @param {string} options.unit - Unit: 'ft', 'm' (default: 'm')
     * @param {number} options.decimals - Decimal places (default: 1)
     * @returns {string} Formatted altitude string
     * @throws {Error} If altitude is invalid
     */
    formatAltitude(altitude, options = {}) {
        if (!validateAltitude(altitude)) {
            throw new Error('Altitude must be a valid number or null/undefined');
        }

        if (altitude === null || altitude === undefined) {
            return 'N/A';
        }

        const { unit = 'm', decimals = 1 } = options;

        let value = altitude;
        let unitStr = unit;

        if (unit === 'ft') {
            value = altitude * 3.28084; // meters to feet
            unitStr = 'ft';
        }

        return `${value.toFixed(decimals)} ${unitStr}`;
    }

    /**
     * Parse various GPS coordinate formats and return standardized decimal format
     * Supports formats like:
     * - "37.7749, -122.4194" (decimal)
     * - "37°46'29.6\"N 122°25'09.8\"W" (DMS)
     * - "37 46 29.6 N, 122 25 09.8 W" (DMS space-separated)
     * @param {string} coordinateString - The coordinate string to parse
     * @returns {Object} Object with latitude and longitude
     * @throws {Error} If coordinate string cannot be parsed
     */
    parseCoordinateString(coordinateString) {
        if (typeof coordinateString !== 'string') {
            throw new Error('Coordinate string must be a string');
        }

        const trimmed = coordinateString.trim();

        // Try decimal format first: "37.7749, -122.4194"
        const decimalMatch = trimmed.match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/);
        if (decimalMatch) {
            const [, latStr, lonStr] = decimalMatch;
            const lat = parseFloat(latStr);
            const lon = parseFloat(lonStr);

            if (validateCoordinates(lat, lon)) {
                return { latitude: lat, longitude: lon };
            }
        }

        // Try DMS format: "37°46'29.6\"N 122°25'09.8\"W"
        const dmsRegex = /(\d+)°(\d+)'([\d.]+)"([NSEW])\s+(\d+)°(\d+)'([\d.]+)"([NSEW])/;
        const dmsMatch = trimmed.match(dmsRegex);
        if (dmsMatch) {
            const [, lat_deg, lat_min, lat_sec, lat_dir, lon_deg, lon_min, lon_sec, lon_dir] = dmsMatch;
            try {
                const latitude = this.dmsToDecimal(
                    parseInt(lat_deg, 10),
                    parseInt(lat_min, 10),
                    parseFloat(lat_sec),
                    lat_dir
                );
                const longitude = this.dmsToDecimal(
                    parseInt(lon_deg, 10),
                    parseInt(lon_min, 10),
                    parseFloat(lon_sec),
                    lon_dir
                );

                if (validateCoordinates(latitude, longitude)) {
                    return { latitude, longitude };
                }
            } catch (error) {
                throw new Error(`Failed to parse DMS format: ${error.message}`);
            }
        }

        // Try space-separated DMS: "37 46 29.6 N, 122 25 09.8 W"
        const spaceDmsRegex = /(\d+)\s+(\d+)\s+([\d.]+)\s+([NSEW])[,\s]+(\d+)\s+(\d+)\s+([\d.]+)\s+([NSEW])/;
        const spaceDmsMatch = trimmed.match(spaceDmsRegex);
        if (spaceDmsMatch) {
            const [, lat_deg, lat_min, lat_sec, lat_dir, lon_deg, lon_min, lon_sec, lon_dir] = spaceDmsMatch;
            try {
                const latitude = this.dmsToDecimal(
                    parseInt(lat_deg, 10),
                    parseInt(lat_min, 10),
                    parseFloat(lat_sec),
                    lat_dir
                );
                const longitude = this.dmsToDecimal(
                    parseInt(lon_deg, 10),
                    parseInt(lon_min, 10),
                    parseFloat(lon_sec),
                    lon_dir
                );

                if (validateCoordinates(latitude, longitude)) {
                    return { latitude, longitude };
                }
            } catch (error) {
                throw new Error(`Failed to parse space-separated DMS format: ${error.message}`);
            }
        }

        throw new Error('Unable to parse coordinate string. Supported formats: decimal (37.7749, -122.4194), DMS (37°46\'29.6"N 122°25\'09.8"W)');
    }

    /**
     * Validate if a coordinate object is complete and valid
     * @param {Object} coord - Coordinate object with latitude and longitude
     * @returns {boolean} True if valid
     */
    isValidCoordinate(coord) {
        return (
            typeof coord === 'object' &&
            coord !== null &&
            typeof coord.latitude === 'number' &&
            typeof coord.longitude === 'number' &&
            validateCoordinates(coord.latitude, coord.longitude)
        );
    }

    /**
     * Get bounding box around a coordinate
     * @param {number} latitude - Center latitude
     * @param {number} longitude - Center longitude
     * @param {number} radiusKm - Radius in kilometers
     * @returns {Object} Bounding box with north, south, east, west bounds
     * @throws {Error} If coordinates are invalid
     */
    getBoundingBox(latitude, longitude, radiusKm) {
        if (!validateCoordinates(latitude, longitude)) {
            throw new Error('Invalid coordinates: latitude must be -90 to 90, longitude must be -180 to 180');
        }

        if (typeof radiusKm !== 'number' || radiusKm <= 0) {
            throw new Error('Radius must be a positive number');
        }

        // Earth radius in kilometers
        const earthRadiusKm = 6371;

        // Convert radius to angular distance
        const latOffset = (radiusKm / earthRadiusKm) * (180 / Math.PI);
        const lonOffset = (radiusKm / earthRadiusKm) * (180 / Math.PI) / Math.cos((latitude * Math.PI) / 180);

        return {
            north: Math.min(latitude + latOffset, 90),
            south: Math.max(latitude - latOffset, -90),
            east: Math.min(longitude + lonOffset, 180),
            west: Math.max(longitude - lonOffset, -180)
        };
    }

    /**
     * Check if a coordinate is within a bounding box
     * @param {number} latitude - Latitude to check
     * @param {number} longitude - Longitude to check
     * @param {Object} boundingBox - Bounding box object with north, south, east, west
     * @returns {boolean} True if coordinate is within bounds
     * @throws {Error} If coordinates are invalid
     */
    isWithinBoundingBox(latitude, longitude, boundingBox) {
        if (!validateCoordinates(latitude, longitude)) {
            throw new Error('Invalid coordinates: latitude must be -90 to 90, longitude must be -180 to 180');
        }

        if (!boundingBox || typeof boundingBox !== 'object') {
            throw new Error('Bounding box must be an object with north, south, east, west properties');
        }

        const { north, south, east, west } = boundingBox;

        return (
            latitude >= south &&
            latitude <= north &&
            longitude >= west &&
            longitude <= east
        );
    }

    /**
     * Convert coordinates to GeoJSON format
     * @param {number} latitude - Latitude in decimal format
     * @param {number} longitude - Longitude in decimal format
     * @param {Object} properties - Optional additional properties
     * @returns {Object} GeoJSON Point feature
     * @throws {Error} If coordinates are invalid
     */
    toGeoJSON(latitude, longitude, properties = {}) {
        if (!validateCoordinates(latitude, longitude)) {
            throw new Error('Invalid coordinates: latitude must be -90 to 90, longitude must be -180 to 180');
        }

        return {
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [longitude, latitude] // GeoJSON uses [lon, lat] order
            },
            properties: properties
        };
    }

    /**
     * Calculate the midpoint between two coordinates
     * @param {number} lat1 - Latitude of first point
     * @param {number} lon1 - Longitude of first point
     * @param {number} lat2 - Latitude of second point
     * @param {number} lon2 - Longitude of second point
     * @returns {Object} Midpoint with latitude and longitude
     * @throws {Error} If coordinates are invalid
     */
    calculateMidpoint(lat1, lon1, lat2, lon2) {
        if (!validateCoordinates(lat1, lon1) || !validateCoordinates(lat2, lon2)) {
            throw new Error('Invalid coordinates: latitude must be -90 to 90, longitude must be -180 to 180');
        }

        const toRad = (deg) => (deg * Math.PI) / 180;
        const toDeg = (rad) => (rad * 180) / Math.PI;

        const lat1Rad = toRad(lat1);
        const lon1Rad = toRad(lon1);
        const lat2Rad = toRad(lat2);
        const lon2Rad = toRad(lon2);

        const bx = Math.cos(lat2Rad) * Math.cos(lon2Rad - lon1Rad);
        const by = Math.cos(lat2Rad) * Math.sin(lon2Rad - lon1Rad);

        const latMid = Math.atan2(Math.sin(lat1Rad) + Math.sin(lat2Rad), Math.sqrt((Math.cos(lat1Rad) + bx) ** 2 + by ** 2));
        const lonMid = lon1Rad + Math.atan2(by, Math.cos(lat1Rad) + bx);

        return {
            latitude: toDeg(latMid),
            longitude: toDeg(lonMid)
        };
    }
}

module.exports = new GPSUtil();
