# GPS Utility Module - Integration Examples

This document demonstrates how to integrate the GPS utility module with the File Metadata AI Organizer system.

## Table of Contents

1. [Photo Metadata Integration](#photo-metadata-integration)
2. [Geolocation-Based Organization](#geolocation-based-organization)
3. [Media Gallery Sorting](#media-gallery-sorting)
4. [Location-Based Grouping](#location-based-grouping)
5. [EXIF Data Processing](#exif-data-processing)
6. [Distance-Based Recommendations](#distance-based-recommendations)
7. [Bounding Box Queries](#bounding-box-queries)

---

## Photo Metadata Integration

### Scenario
Process photo EXIF data and display GPS information in a human-readable format.

```javascript
const gps = require('./src/utils/gps');
const MetadataAnalyzer = require('./src/MetadataAnalyzer');

class PhotoMetadataProcessor {
    /**
     * Process photo EXIF data and format GPS information
     */
    async processPhotoMetadata(filePath) {
        const analyzer = new MetadataAnalyzer();
        const metadata = await analyzer.analyze(filePath);

        if (!metadata.exif || !metadata.exif.GPSLatitude) {
            return {
                filename: metadata.filename,
                hasGPS: false
            };
        }

        const latitude = metadata.exif.GPSLatitude;
        const longitude = metadata.exif.GPSLongitude;
        const altitude = metadata.exif.GPSAltitude || null;

        // Format for display
        const formatted = {
            filename: metadata.filename,
            hasGPS: true,
            coordinates: {
                decimal: gps.formatDecimal(latitude, longitude, { decimals: 6 }),
                dms: gps.formatCoordinates(latitude, longitude),
                raw: { latitude, longitude }
            },
            altitude: gps.formatAltitude(altitude, { unit: 'ft' }),
            mapsLink: gps.generateGoogleMapsLink(latitude, longitude, {
                label: metadata.filename,
                title: `Photo: ${metadata.filename}`
            }),
            timestamp: metadata.exif.DateTime || null
        };

        return formatted;
    }

    /**
     * Process multiple photos and return formatted metadata
     */
    async processBatch(filePaths) {
        return Promise.all(
            filePaths.map(path => this.processPhotoMetadata(path))
        );
    }
}

// Usage
const processor = new PhotoMetadataProcessor();
const photoMetadata = await processor.processPhotoMetadata('/path/to/photo.jpg');
console.log(photoMetadata);
// Output:
// {
//   filename: "vacation_photo.jpg",
//   hasGPS: true,
//   coordinates: {
//     decimal: "37.774900, -122.419400",
//     dms: "37°46'29.6\"N 122°25'9.8\"W",
//     raw: { latitude: 37.7749, longitude: -122.4194 }
//   },
//   altitude: "49.2 ft",
//   mapsLink: "https://maps.google.com/maps?q=loc:37.7749,-122.4194&z=15&t=roadmap&marker=vacation_photo.jpg",
//   timestamp: "2024-06-15 14:30:00"
// }
```

---

## Geolocation-Based Organization

### Scenario
Organize photos by geographical location (city, region, country).

```javascript
const gps = require('./src/utils/gps');
const ReverseGeocoder = require('some-reverse-geocoding-lib'); // External library

class GeolocationOrganizer {
    constructor() {
        this.geocoder = new ReverseGeocoder();
        this.locationCache = new Map();
    }

    /**
     * Get location name from coordinates
     */
    async getLocationName(latitude, longitude) {
        const key = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;

        if (this.locationCache.has(key)) {
            return this.locationCache.get(key);
        }

        try {
            // Use reverse geocoding API
            const location = await this.geocoder.reverse(latitude, longitude);
            this.locationCache.set(key, location);
            return location;
        } catch (error) {
            // Fallback to coordinate display
            return {
                city: 'Unknown',
                country: 'Unknown',
                coordinates: gps.formatCoordinates(latitude, longitude)
            };
        }
    }

    /**
     * Organize photos by location
     */
    async organizeByLocation(photoMetadataArray) {
        const organized = {};

        for (const photo of photoMetadataArray) {
            if (!photo.hasGPS) {
                if (!organized['Unknown Location']) {
                    organized['Unknown Location'] = [];
                }
                organized['Unknown Location'].push(photo);
                continue;
            }

            const location = await this.getLocationName(
                photo.coordinates.raw.latitude,
                photo.coordinates.raw.longitude
            );

            const key = location.city || 'Unknown';
            if (!organized[key]) {
                organized[key] = [];
            }
            organized[key].push({
                ...photo,
                location: location
            });
        }

        return organized;
    }

    /**
     * Create folder structure based on location
     */
    async createOrganizationPlan(photoMetadataArray) {
        const organized = await this.organizeByLocation(photoMetadataArray);
        const plan = [];

        for (const [location, photos] of Object.entries(organized)) {
            const folderPath = `Organized/${location}`;
            plan.push({
                folder: folderPath,
                files: photos.map(p => p.filename),
                count: photos.length,
                coordinates: photos[0].coordinates?.raw
            });
        }

        return plan;
    }
}

// Usage
const organizer = new GeolocationOrganizer();
const photos = await processor.processBatch(photoPaths);
const organized = await organizer.organizeByLocation(photos);
const plan = await organizer.createOrganizationPlan(photos);

console.log(plan);
// Output:
// [
//   {
//     folder: "Organized/San Francisco",
//     files: ["vacation1.jpg", "vacation2.jpg"],
//     count: 2,
//     coordinates: { latitude: 37.7749, longitude: -122.4194 }
//   },
//   {
//     folder: "Organized/Los Angeles",
//     files: ["vacation3.jpg"],
//     count: 1,
//     coordinates: { latitude: 34.0522, longitude: -118.2437 }
//   }
// ]
```

---

## Media Gallery Sorting

### Scenario
Sort photos by proximity to a central location.

```javascript
const gps = require('./src/utils/gps');

class GalleryOrganizer {
    /**
     * Sort photos by distance from reference point
     */
    sortByDistance(photos, centerLat, centerLon) {
        return photos
            .map(photo => {
                if (!photo.hasGPS) {
                    return {
                        ...photo,
                        distance: Infinity,
                        bearing: null
                    };
                }

                const distance = gps.calculateDistance(
                    centerLat,
                    centerLon,
                    photo.coordinates.raw.latitude,
                    photo.coordinates.raw.longitude,
                    { unit: 'km' }
                );

                const bearing = gps.calculateBearing(
                    centerLat,
                    centerLon,
                    photo.coordinates.raw.latitude,
                    photo.coordinates.raw.longitude
                );

                return {
                    ...photo,
                    distance: parseFloat(distance.toFixed(2)),
                    bearing: bearing
                };
            })
            .sort((a, b) => a.distance - b.distance);
    }

    /**
     * Group photos by proximity zones
     */
    groupByProximity(photos, centerLat, centerLon, radiusKm = 5) {
        const bbox = gps.getBoundingBox(centerLat, centerLon, radiusKm);

        return {
            nearbyPhotos: photos.filter(photo =>
                photo.hasGPS &&
                gps.isWithinBoundingBox(
                    photo.coordinates.raw.latitude,
                    photo.coordinates.raw.longitude,
                    bbox
                )
            ),
            distantPhotos: photos.filter(photo =>
                !photo.hasGPS ||
                !gps.isWithinBoundingBox(
                    photo.coordinates.raw.latitude,
                    photo.coordinates.raw.longitude,
                    bbox
                )
            ),
            searchRadius: radiusKm,
            center: gps.formatCoordinates(centerLat, centerLon)
        };
    }

    /**
     * Find interesting routes between photos
     */
    calculateRoute(photos, startIndex = 0) {
        if (photos.length === 0) return null;

        const route = [];
        let currentPhoto = photos[startIndex];
        route.push(currentPhoto);

        const remaining = photos
            .map((p, i) => i !== startIndex ? p : null)
            .filter(p => p !== null);

        while (remaining.length > 0) {
            const distances = remaining.map(photo => {
                if (!photo.hasGPS || !currentPhoto.hasGPS) {
                    return { photo, distance: Infinity };
                }

                const distance = gps.calculateDistance(
                    currentPhoto.coordinates.raw.latitude,
                    currentPhoto.coordinates.raw.longitude,
                    photo.coordinates.raw.latitude,
                    photo.coordinates.raw.longitude,
                    { unit: 'km' }
                );

                return { photo, distance };
            });

            const nearest = distances.reduce((a, b) =>
                a.distance < b.distance ? a : b
            );

            route.push(nearest.photo);
            currentPhoto = nearest.photo;

            remaining.splice(
                remaining.indexOf(nearest.photo),
                1
            );
        }

        return route;
    }
}

// Usage
const gallery = new GalleryOrganizer();
const sorted = gallery.sortByDistance(photos, 37.7749, -122.4194);
const grouped = gallery.groupByProximity(photos, 37.7749, -122.4194, 10);
const route = gallery.calculateRoute(photos);

console.log('Sorted by distance:', sorted.slice(0, 3).map(p => ({
    filename: p.filename,
    distance: `${p.distance} km`,
    bearing: p.bearing?.cardinal
})));
```

---

## Location-Based Grouping

### Scenario
Group photos by city/region for organized browsing.

```javascript
const gps = require('./src/utils/gps');

class LocationGrouper {
    /**
     * Group nearby photos using clustering
     */
    clusterPhotos(photos, minDistanceKm = 1) {
        if (photos.length === 0) return [];

        const geoPhotos = photos.filter(p => p.hasGPS);
        const noGeoPhotos = photos.filter(p => !p.hasGPS);

        const clusters = [];
        const used = new Set();

        for (let i = 0; i < geoPhotos.length; i++) {
            if (used.has(i)) continue;

            const cluster = [geoPhotos[i]];
            used.add(i);

            for (let j = i + 1; j < geoPhotos.length; j++) {
                if (used.has(j)) continue;

                const distance = gps.calculateDistance(
                    geoPhotos[i].coordinates.raw.latitude,
                    geoPhotos[i].coordinates.raw.longitude,
                    geoPhotos[j].coordinates.raw.latitude,
                    geoPhotos[j].coordinates.raw.longitude,
                    { unit: 'km' }
                );

                if (distance <= minDistanceKm) {
                    cluster.push(geoPhotos[j]);
                    used.add(j);
                }
            }

            clusters.push(cluster);
        }

        // Add non-geotagged photos as separate cluster
        if (noGeoPhotos.length > 0) {
            clusters.push(noGeoPhotos);
        }

        return clusters;
    }

    /**
     * Create summary for each cluster
     */
    summarizeClusters(clusters) {
        return clusters.map((cluster, index) => {
            const geoPhotos = cluster.filter(p => p.hasGPS);

            if (geoPhotos.length === 0) {
                return {
                    clusterId: index,
                    count: cluster.length,
                    location: 'No GPS Data',
                    photos: cluster.map(p => p.filename)
                };
            }

            // Calculate center point
            const center = geoPhotos.reduce(
                (acc, photo) => ({
                    lat: acc.lat + photo.coordinates.raw.latitude,
                    lon: acc.lon + photo.coordinates.raw.longitude
                }),
                { lat: 0, lon: 0 }
            );

            center.lat /= geoPhotos.length;
            center.lon /= geoPhotos.length;

            return {
                clusterId: index,
                count: cluster.length,
                location: gps.formatCoordinates(center.lat, center.lon),
                center: { latitude: center.lat, longitude: center.lon },
                mapsLink: gps.generateGoogleMapsLink(center.lat, center.lon, {
                    zoom: 14,
                    label: `Cluster ${index + 1} (${cluster.length} photos)`
                }),
                photos: cluster.map(p => p.filename)
            };
        });
    }
}

// Usage
const grouper = new LocationGrouper();
const clusters = grouper.clusterPhotos(photos, 0.5); // Group within 0.5 km
const summary = grouper.summarizeClusters(clusters);

console.log('Clusters:', summary);
// Output:
// [
//   {
//     clusterId: 0,
//     count: 5,
//     location: "37°46'29.6\"N 122°25'09.8\"W",
//     center: { latitude: 37.7749, longitude: -122.4194 },
//     mapsLink: "https://...",
//     photos: ["photo1.jpg", "photo2.jpg", ...]
//   },
//   ...
// ]
```

---

## EXIF Data Processing

### Scenario
Process and validate GPS data from photo EXIF information.

```javascript
const gps = require('./src/utils/gps');

class EXIFProcessor {
    /**
     * Validate and standardize GPS data from EXIF
     */
    processGPSData(exifData) {
        if (!exifData.GPSLatitude || !exifData.GPSLongitude) {
            return {
                valid: false,
                reason: 'Missing GPS coordinates'
            };
        }

        try {
            const latitude = parseFloat(exifData.GPSLatitude);
            const longitude = parseFloat(exifData.GPSLongitude);

            // Validate coordinates
            if (!gps.isValidCoordinate({ latitude, longitude })) {
                return {
                    valid: false,
                    reason: 'Invalid coordinate values'
                };
            }

            const altitude = exifData.GPSAltitude ?
                parseFloat(exifData.GPSAltitude) :
                null;

            return {
                valid: true,
                coordinates: {
                    latitude,
                    longitude,
                    altitude,
                    timestamp: exifData.DateTime || null
                },
                formatted: {
                    dms: gps.formatCoordinates(latitude, longitude),
                    decimal: gps.formatDecimal(latitude, longitude, { decimals: 8 }),
                    altitude: gps.formatAltitude(altitude, { unit: 'ft' })
                },
                accuracy: {
                    decimalPlaces: (latitude.toString().split('.')[1] || '').length,
                    estimatedAccuracy: this.estimateAccuracy(latitude)
                }
            };
        } catch (error) {
            return {
                valid: false,
                reason: error.message
            };
        }
    }

    /**
     * Estimate accuracy based on decimal places
     */
    estimateAccuracy(coordinate) {
        const decimalPlaces = (coordinate.toString().split('.')[1] || '').length;
        const accuracies = {
            0: '111.32 km',
            1: '11.13 km',
            2: '1.11 km',
            3: '111.3 m',
            4: '11.13 m',
            5: '1.11 m',
            6: '0.111 m',
            7: '0.0111 m',
            8: '0.00111 m'
        };
        return accuracies[Math.min(decimalPlaces, 8)];
    }

    /**
     * Compare GPS data quality from multiple sources
     */
    compareGPSQuality(exifArray) {
        const processed = exifArray.map(exif => ({
            ...this.processGPSData(exif),
            source: exif.source || 'unknown'
        }));

        const valid = processed.filter(p => p.valid);

        if (valid.length === 0) {
            return {
                status: 'No valid GPS data found',
                sources: processed.map(p => ({
                    source: p.source,
                    valid: p.valid,
                    reason: p.reason
                }))
            };
        }

        // Find most consistent data
        const mostAccurate = valid.reduce((a, b) => {
            const aAccuracy = parseInt(a.accuracy.decimalPlaces);
            const bAccuracy = parseInt(b.accuracy.decimalPlaces);
            return aAccuracy > bAccuracy ? a : b;
        });

        return {
            status: 'Found valid GPS data',
            bestSource: mostAccurate.source,
            coordinates: mostAccurate.coordinates,
            formatted: mostAccurate.formatted,
            allSources: processed.map(p => ({
                source: p.source,
                valid: p.valid,
                coordinates: p.coordinates,
                reason: p.reason
            }))
        };
    }
}

// Usage
const processor = new EXIFProcessor();
const exifData = {
    GPSLatitude: '37.7749',
    GPSLongitude: '-122.4194',
    GPSAltitude: '15',
    DateTime: '2024-06-15 14:30:00',
    source: 'iPhone'
};

const result = processor.processGPSData(exifData);
console.log('Processed GPS:', result);
```

---

## Distance-Based Recommendations

### Scenario
Recommend related photos based on geographical proximity.

```javascript
const gps = require('./src/utils/gps');

class PhotoRecommender {
    /**
     * Find related photos taken near the current photo
     */
    findNearbyPhotos(currentPhoto, allPhotos, maxDistanceKm = 5) {
        if (!currentPhoto.hasGPS) {
            return [];
        }

        return allPhotos
            .filter(photo =>
                photo.hasGPS &&
                photo.filename !== currentPhoto.filename
            )
            .map(photo => {
                const distance = gps.calculateDistance(
                    currentPhoto.coordinates.raw.latitude,
                    currentPhoto.coordinates.raw.longitude,
                    photo.coordinates.raw.latitude,
                    photo.coordinates.raw.longitude,
                    { unit: 'km' }
                );

                return { photo, distance };
            })
            .filter(item => item.distance <= maxDistanceKm)
            .sort((a, b) => a.distance - b.distance)
            .map(item => ({
                ...item.photo,
                distanceFromCurrent: `${item.distance.toFixed(2)} km`
            }));
    }

    /**
     * Create photo journey between two locations
     */
    createJourney(startPhoto, endPhoto, allPhotos) {
        if (!startPhoto.hasGPS || !endPhoto.hasGPS) {
            return {
                success: false,
                message: 'Both photos must have GPS data'
            };
        }

        const totalDistance = gps.calculateDistance(
            startPhoto.coordinates.raw.latitude,
            startPhoto.coordinates.raw.longitude,
            endPhoto.coordinates.raw.latitude,
            endPhoto.coordinates.raw.longitude,
            { unit: 'km' }
        );

        const midpoint = gps.calculateMidpoint(
            startPhoto.coordinates.raw.latitude,
            startPhoto.coordinates.raw.longitude,
            endPhoto.coordinates.raw.latitude,
            endPhoto.coordinates.raw.longitude
        );

        const intermediatePhotos = allPhotos
            .filter(photo =>
                photo.hasGPS &&
                photo.filename !== startPhoto.filename &&
                photo.filename !== endPhoto.filename
            )
            .map(photo => {
                const distFromStart = gps.calculateDistance(
                    startPhoto.coordinates.raw.latitude,
                    startPhoto.coordinates.raw.longitude,
                    photo.coordinates.raw.latitude,
                    photo.coordinates.raw.longitude,
                    { unit: 'km' }
                );

                return { photo, distFromStart };
            })
            .filter(item => item.distFromStart < totalDistance * 1.5)
            .sort((a, b) => a.distFromStart - b.distFromStart);

        return {
            success: true,
            journey: {
                start: startPhoto.filename,
                end: endPhoto.filename,
                distance: `${totalDistance.toFixed(2)} km`,
                intermediate: intermediatePhotos.map(item => ({
                    filename: item.photo.filename,
                    distanceFromStart: `${item.distFromStart.toFixed(2)} km`
                })),
                routeMapLink: gps.generateGoogleMapsLink(midpoint.latitude, midpoint.longitude, {
                    zoom: 10,
                    label: 'Route',
                    title: `Journey from ${startPhoto.filename} to ${endPhoto.filename}`
                })
            }
        };
    }
}

// Usage
const recommender = new PhotoRecommender();
const nearby = recommender.findNearbyPhotos(photos[0], photos);
const journey = recommender.createJourney(photos[0], photos[photos.length - 1], photos);

console.log('Nearby photos:', nearby.slice(0, 5));
console.log('Journey:', journey);
```

---

## Bounding Box Queries

### Scenario
Query and filter photos by geographic region.

```javascript
const gps = require('./src/utils/gps');

class GeographicDatabase {
    constructor(photos) {
        this.photos = photos;
        this.index = this.buildGeoIndex();
    }

    /**
     * Build spatial index for efficient queries
     */
    buildGeoIndex() {
        const index = new Map();

        this.photos.forEach((photo, idx) => {
            if (!photo.hasGPS) return;

            const lat = Math.floor(photo.coordinates.raw.latitude);
            const lon = Math.floor(photo.coordinates.raw.longitude);
            const key = `${lat},${lon}`;

            if (!index.has(key)) {
                index.set(key, []);
            }
            index.get(key).push(idx);
        });

        return index;
    }

    /**
     * Find all photos within a radius
     */
    queryRadius(centerLat, centerLon, radiusKm) {
        const bbox = gps.getBoundingBox(centerLat, centerLon, radiusKm);
        return this.queryBoundingBox(bbox);
    }

    /**
     * Find all photos in a bounding box
     */
    queryBoundingBox(bbox) {
        const results = [];

        for (const photo of this.photos) {
            if (!photo.hasGPS) continue;

            if (gps.isWithinBoundingBox(
                photo.coordinates.raw.latitude,
                photo.coordinates.raw.longitude,
                bbox
            )) {
                results.push(photo);
            }
        }

        return results;
    }

    /**
     * Find photos within a polygon (simplified)
     */
    queryRegion(centerLat, centerLon, radiusKm, direction = null) {
        const bbox = gps.getBoundingBox(centerLat, centerLon, radiusKm);
        const results = this.queryBoundingBox(bbox);

        if (!direction) return results;

        // Filter by direction from center
        return results.filter(photo => {
            const bearing = gps.calculateBearing(
                centerLat,
                centerLon,
                photo.coordinates.raw.latitude,
                photo.coordinates.raw.longitude
            );

            return this.isInDirection(bearing.bearing, direction);
        });
    }

    /**
     * Check if bearing is in specified direction
     */
    isInDirection(bearing, direction) {
        const directions = {
            'N': [348.75, 11.25],
            'NE': [33.75, 56.25],
            'E': [78.75, 101.25],
            'SE': [123.75, 146.25],
            'S': [168.75, 191.25],
            'SW': [213.75, 236.25],
            'W': [258.75, 281.25],
            'NW': [303.75, 326.25]
        };

        if (!directions[direction]) return false;

        const [min, max] = directions[direction];
        return bearing >= min && bearing <= max;
    }
}

// Usage
const db = new GeographicDatabase(photos);
const nearby = db.queryRadius(37.7749, -122.4194, 10);
const northeast = db.queryRegion(37.7749, -122.4194, 10, 'NE');

console.log(`Found ${nearby.length} photos within 10 km`);
console.log(`Found ${northeast.length} photos to the northeast`);
```

---

## Summary

The GPS utility module integrates seamlessly with the File Metadata AI Organizer to:

- Process and display GPS coordinates from photo EXIF data
- Organize photos by geographical location
- Calculate distances and directions between photos
- Create smart recommendations based on proximity
- Generate interactive maps and routes
- Query photos by geographic region

These integration patterns enable sophisticated location-based organization and analysis of media files.
