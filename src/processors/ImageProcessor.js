/**
 * Image Processor
 * Extracts comprehensive metadata from image files using sharp and exifr
 *
 * Capabilities:
 * - Basic image properties (dimensions, color space, bit depth)
 * - EXIF metadata (camera, exposure settings, GPS coordinates)
 * - IPTC metadata (keywords, captions, credits)
 * - XMP metadata
 * - Dominant color extraction
 * - Thumbnail generation
 * - Perceptual hashing for similarity detection
 *
 * @see https://sharp.pixelplumbing.com/
 * @see https://github.com/MikeKovarik/exifr
 */

const BaseProcessor = require('./BaseProcessor');
const sharp = require('sharp');
const exifr = require('exifr');
const path = require('path');
const fs = require('fs').promises;
const gpsUtils = require('../utils/gps');

class ImageProcessor extends BaseProcessor {
    /**
     * Create an ImageProcessor instance
     *
     * @param {Object} config - Configuration options
     * @param {string} [config.thumbnailDir='./thumbnails'] - Directory for generated thumbnails
     * @param {boolean} [config.extractExif=true] - Whether to extract EXIF metadata
     * @param {boolean} [config.extractColors=true] - Whether to extract dominant colors
     * @param {boolean} [config.generateThumbnails=true] - Whether to generate thumbnails
     * @param {boolean} [config.perceptualHash=true] - Whether to calculate perceptual hash
     * @param {number[]} [config.thumbnailSizes=[150, 300]] - Thumbnail sizes in pixels
     *
     * @example
     * const processor = new ImageProcessor({
     *   thumbnailDir: './cache/thumbnails',
     *   thumbnailSizes: [150, 300, 600],
     *   perceptualHash: true
     * });
     */
    constructor(config = {}) {
        super(config);
        this.thumbnailDir = config.thumbnailDir || './thumbnails';
    }

    /**
     * Check if this processor can handle the given file
     *
     * Determines processing eligibility based on file category.
     * Part of the Template Method pattern from BaseProcessor.
     *
     * @param {Object} fileInfo - File information object
     * @param {string} fileInfo.category - File category (e.g., 'image', 'video')
     * @returns {boolean} True if file category is 'image'
     *
     * @example
     * const canHandle = processor.canProcess({ category: 'image' }); // true
     * const cannotHandle = processor.canProcess({ category: 'video' }); // false
     */
    canProcess(fileInfo) {
        return fileInfo.category === 'image';
    }

    /**
     * Initialize image-specific metadata structure
     *
     * Creates the metadata.image object to store all image-specific data.
     * Called by BaseProcessor.process() before metadata extraction.
     * Part of the Template Method pattern.
     *
     * @param {Object} fileInfo - File information object
     * @param {Object} fileInfo.metadata - Metadata container object
     * @returns {void}
     *
     * @example
     * // After initialization, fileInfo.metadata.image will be an empty object
     * // ready to store: exif, iptc, dominantColors, thumbnails, perceptualHash
     */
    initializeMetadata(fileInfo) {
        super.initializeMetadata(fileInfo);
        fileInfo.metadata.image = {};
    }

    /**
     * Extract image metadata
     *
     * Orchestrates the complete metadata extraction pipeline for images.
     * Implements the BaseProcessor.extractMetadata() template method.
     * Called by BaseProcessor.process() after initialization.
     *
     * Pipeline steps (configurable via constructor options):
     * 1. Basic image info (always) - dimensions, color space, format
     * 2. EXIF/IPTC/XMP data (optional) - camera, GPS, keywords
     * 3. Dominant colors (optional) - color analysis
     * 4. Thumbnails (optional) - generate resized versions
     * 5. Perceptual hash (optional) - similarity detection
     *
     * @param {Object} fileInfo - File information object with path and metadata
     * @param {string} fileInfo.path - Absolute path to the image file
     * @param {Object} fileInfo.metadata - Metadata container with image property
     * @returns {Promise<void>} Resolves when all metadata extraction is complete
     * @throws {Error} If basic info extraction fails (critical)
     *
     * @example
     * const fileInfo = {
     *   path: '/photos/IMG_001.jpg',
     *   metadata: { image: {} }
     * };
     * await processor.extractMetadata(fileInfo);
     * // fileInfo.metadata.image now contains all extracted data
     */
    async extractMetadata(fileInfo) {
        // Extract basic image info with sharp
        await this.extractBasicInfo(fileInfo);

        // Extract EXIF, IPTC, XMP data
        if (this.config.extractExif !== false) {
            await this.extractExifData(fileInfo);
        }

        // Extract dominant colors
        if (this.config.extractColors !== false) {
            await this.extractColors(fileInfo);
        }

        // Generate thumbnails
        if (this.config.generateThumbnails !== false) {
            await this.generateThumbnails(fileInfo);
        }

        // Calculate perceptual hash
        if (this.config.perceptualHash !== false) {
            await this.calculatePerceptualHash(fileInfo);
        }
    }

    /**
     * Extract basic image information using sharp
     *
     * Reads fundamental image properties from the file header without
     * loading the entire image into memory. This is efficient and works
     * for all formats supported by sharp.
     *
     * Extracted properties:
     * - Dimensions (width, height, aspect ratio)
     * - Color information (color space, channels, bit depth, alpha)
     * - Format details (format, progressive encoding, density/DPI)
     *
     * @param {Object} fileInfo - File information object
     * @param {string} fileInfo.path - Absolute path to the image file
     * @param {Object} fileInfo.metadata - Metadata container
     * @param {Object} fileInfo.metadata.image - Image metadata object to populate
     * @returns {Promise<void>} Resolves when basic info is extracted
     * @throws {Error} If sharp cannot read the file or metadata
     *
     * @see https://sharp.pixelplumbing.com/api-input#metadata
     *
     * @example
     * // After extraction, fileInfo.metadata.image contains:
     * // {
     * //   width: 1920,
     * //   height: 1080,
     * //   aspectRatio: 1.777...,
     * //   colorSpace: 'srgb',
     * //   channels: 3,
     * //   bitDepth: 'uchar',
     * //   density: 72,
     * //   hasAlpha: false,
     * //   format: 'jpeg',
     * //   isProgressive: true
     * // }
     *
     * @private
     */
    async extractBasicInfo(fileInfo) {
        try {
            const metadata = await sharp(fileInfo.path).metadata();

            fileInfo.metadata.image = {
                width: metadata.width,
                height: metadata.height,
                aspectRatio: metadata.width / metadata.height,
                colorSpace: metadata.space,
                channels: metadata.channels,
                bitDepth: metadata.depth,
                density: metadata.density,
                hasAlpha: metadata.hasAlpha,
                format: metadata.format,
                isProgressive: metadata.isProgressive || false
            };

        } catch (error) {
            throw new Error(`Failed to extract basic image info: ${error.message}`);
        }
    }

    /**
     * Extract EXIF, IPTC, and XMP metadata
     *
     * Parses embedded metadata from image files using the exifr library.
     * Handles camera information, exposure settings, GPS coordinates,
     * keywords, captions, and copyright information.
     *
     * Extracted EXIF data includes:
     * - Camera: make, model, software
     * - Exposure: ISO, aperture (f-number), shutter speed, focal length, flash
     * - Dates: dateTime (when photo was taken)
     * - Image: orientation
     * - Copyright: artist, copyright
     * - GPS: coordinates (decimal and DMS), altitude, map links, GeoJSON
     *
     * Extracted IPTC data includes:
     * - Keywords, caption, headline
     * - Credit, source
     *
     * GPS coordinates are enriched with multiple formats:
     * - Decimal degrees (for calculations)
     * - DMS (Degrees Minutes Seconds) format
     * - Google Maps and OpenStreetMap links
     * - GeoJSON Point feature
     *
     * @param {Object} fileInfo - File information object
     * @param {string} fileInfo.path - Absolute path to the image file
     * @param {Object} fileInfo.metadata - Metadata container
     * @param {Object} fileInfo.metadata.image - Image metadata object
     * @returns {Promise<void>} Resolves when EXIF data is extracted
     *
     * @see https://github.com/MikeKovarik/exifr
     * @see https://exiftool.org/TagNames/EXIF.html - EXIF tag reference
     * @see https://www.iptc.org/standards/photo-metadata/ - IPTC standard
     *
     * @example
     * // After extraction, fileInfo.metadata.image.exif contains:
     * // {
     * //   make: 'Canon',
     * //   model: 'Canon EOS 5D Mark IV',
     * //   dateTime: '2024:01:15 14:30:00',
     * //   iso: 400,
     * //   fNumber: 2.8,
     * //   exposureTime: 0.004, // 1/250 seconds
     * //   focalLength: 50,
     * //   gps: {
     * //     latitude: 43.467,
     * //     longitude: 11.885,
     * //     formatted: '43°28\'2.8"N 11°53\'6.5"E',
     * //     googleMapsLink: 'https://maps.google.com/...',
     * //     geoJSON: { type: 'Feature', ... }
     * //   }
     * // }
     *
     * @private
     */
    async extractExifData(fileInfo) {
        try {
            const exifData = await exifr.parse(fileInfo.path, {
                exif: true,
                iptc: true,
                xmp: true,
                icc: false,
                jfif: false,
                ihdr: false,
                tiff: true,
                gps: true
            });

            if (exifData) {
                // Extract relevant EXIF fields
                fileInfo.metadata.image.exif = {
                    make: exifData.Make,
                    model: exifData.Model,
                    dateTime: exifData.DateTimeOriginal || exifData.DateTime,
                    exposureTime: exifData.ExposureTime,
                    fNumber: exifData.FNumber,
                    iso: exifData.ISO,
                    focalLength: exifData.FocalLength,
                    flash: exifData.Flash,
                    software: exifData.Software,
                    orientation: exifData.Orientation,
                    copyright: exifData.Copyright,
                    artist: exifData.Artist
                };

                // Extract GPS data if available
                if (exifData.latitude && exifData.longitude) {
                    const lat = exifData.latitude;
                    const lon = exifData.longitude;

                    // Convert to DMS format
                    const latDMS = gpsUtils.decimalToDMS(lat, lat >= 0 ? 'N' : 'S');
                    const lonDMS = gpsUtils.decimalToDMS(lon, lon >= 0 ? 'E' : 'W');

                    fileInfo.metadata.image.exif.gps = {
                        // Decimal coordinates
                        latitude: lat,
                        longitude: lon,
                        altitude: exifData.GPSAltitude,

                        // DMS format
                        latitudeDMS: latDMS,
                        longitudeDMS: lonDMS,

                        // Formatted strings
                        formatted: gpsUtils.formatCoordinates(lat, lon, { format: 'DMS' }),
                        formattedDecimal: gpsUtils.formatCoordinates(lat, lon, { format: 'decimal' }),

                        // Links and utilities
                        googleMapsLink: gpsUtils.generateGoogleMapsLink(lat, lon),
                        openStreetMapLink: gpsUtils.generateOpenStreetMapLink(lat, lon),

                        // GeoJSON point
                        geoJSON: gpsUtils.toGeoJSON(lat, lon)
                    };
                }

                // Extract IPTC data
                if (exifData.Keywords || exifData.Caption) {
                    fileInfo.metadata.image.iptc = {
                        keywords: exifData.Keywords,
                        caption: exifData.Caption,
                        headline: exifData.Headline,
                        credit: exifData.Credit,
                        source: exifData.Source
                    };
                }
            }

        } catch (error) {
            // EXIF extraction is optional, log but don't fail
            console.warn(`Could not extract EXIF data from ${fileInfo.path}: ${error.message}`);
        }
    }

    /**
     * Extract dominant colors from image
     */
    /**
     * Extract dominant colors from image using sharp's stats API
     *
     * Uses a 100x100 resized version to quickly get the dominant color.
     * The color is stored as an array to match the schema, even though
     * sharp.stats() only returns a single dominant color.
     *
     * @param {Object} fileInfo - File information object with metadata
     * @returns {Promise<void>}
     * @throws {Error} If color extraction fails (error is caught and logged)
     * @see https://sharp.pixelplumbing.com/api-operation#stats
     * @private
     */
    async extractColors(fileInfo) {
        try {
            const { dominant } = await sharp(fileInfo.path)
                .resize(100, 100, { fit: 'cover' })
                .stats();

            // sharp.stats() returns a single dominant color object {r, g, b}
            // Store as array to match schema's dominant_colors field
            if (dominant && typeof dominant === 'object') {
                const color = {
                    r: Math.round(dominant.r),
                    g: Math.round(dominant.g),
                    b: Math.round(dominant.b),
                    hex: this.rgbToHex(Math.round(dominant.r), Math.round(dominant.g), Math.round(dominant.b))
                };

                // Store as array for schema consistency
                fileInfo.metadata.image.dominantColors = [color];
            }

        } catch (error) {
            console.warn(`Could not extract colors from ${fileInfo.path}: ${error.message}`);
        }
    }

    /**
     * Generate thumbnails in multiple sizes
     *
     * Creates resized JPEG versions of the image for preview purposes.
     * Thumbnails maintain aspect ratio and are never enlarged beyond
     * original dimensions. All thumbnails are saved as JPEG with 80% quality
     * regardless of source format.
     *
     * Features:
     * - Maintains aspect ratio (fit: 'inside')
     * - Never enlarges small images (withoutEnlargement: true)
     * - Creates thumbnail directory automatically
     * - Generates multiple sizes (configurable)
     * - Consistent JPEG output format
     *
     * @param {Object} fileInfo - File information object
     * @param {string} fileInfo.path - Absolute path to the source image
     * @param {string} fileInfo.name - Original filename
     * @param {Object} fileInfo.metadata - Metadata container
     * @param {Object} fileInfo.metadata.image - Image metadata object
     * @returns {Promise<void>} Resolves when all thumbnails are generated
     *
     * @see https://sharp.pixelplumbing.com/api-resize
     *
     * @example
     * // With default sizes [150, 300], generates:
     * // - photo_150.jpg (max 150x150px, maintains aspect ratio)
     * // - photo_300.jpg (max 300x300px, maintains aspect ratio)
     * //
     * // After generation, fileInfo.metadata.image.thumbnails contains:
     * // [
     * //   { size: 150, path: './thumbnails/photo_150.jpg' },
     * //   { size: 300, path: './thumbnails/photo_300.jpg' }
     * // ]
     *
     * @private
     */
    async generateThumbnails(fileInfo) {
        try {
            // Create thumbnail directory if it doesn't exist
            await fs.mkdir(this.thumbnailDir, { recursive: true });

            const sizes = this.config.thumbnailSizes || [150, 300];
            const thumbnails = [];

            for (const size of sizes) {
                const thumbnailName = `${path.basename(fileInfo.name, path.extname(fileInfo.name))}_${size}.jpg`;
                const thumbnailPath = path.join(this.thumbnailDir, thumbnailName);

                await sharp(fileInfo.path)
                    .resize(size, size, { fit: 'inside', withoutEnlargement: true })
                    .jpeg({ quality: 80 })
                    .toFile(thumbnailPath);

                thumbnails.push({
                    size,
                    path: thumbnailPath
                });
            }

            fileInfo.metadata.image.thumbnails = thumbnails;

        } catch (error) {
            console.warn(`Could not generate thumbnails for ${fileInfo.path}: ${error.message}`);
        }
    }

    /**
     * Calculate perceptual hash for similarity detection
     *
     * Generates a perceptual hash (pHash-like algorithm) that can be used
     * to find visually similar images. The hash is resistant to minor
     * modifications like resizing, compression, and slight color changes.
     *
     * Algorithm:
     * 1. Resize image to 8x8 pixels (64 pixels total)
     * 2. Convert to greyscale
     * 3. Calculate average pixel intensity
     * 4. Create binary string: '1' if pixel > average, '0' otherwise
     * 5. Convert binary to hexadecimal (16 character string)
     *
     * The resulting hash allows similarity comparison using Hamming distance:
     * - 0 bits different = identical images
     * - 1-5 bits different = very similar images
     * - 6-10 bits different = similar images
     * - >10 bits different = different images
     *
     * @param {Object} fileInfo - File information object
     * @param {string} fileInfo.path - Absolute path to the image file
     * @param {Object} fileInfo.metadata - Metadata container
     * @param {Object} fileInfo.metadata.image - Image metadata object
     * @returns {Promise<void>} Resolves when hash is calculated
     *
     * @see http://www.hackerfactor.com/blog/index.php?/archives/432-Looks-Like-It.html - pHash algorithm
     * @see https://en.wikipedia.org/wiki/Perceptual_hashing
     *
     * @example
     * // After calculation, fileInfo.metadata.image.perceptualHash contains:
     * // 'a3f1c7b8e2d4f6a1' (16 hex characters = 64 bits)
     * //
     * // To find similar images, compare hashes using Hamming distance:
     * // const similarity = hammingDistance(hash1, hash2);
     * // if (similarity <= 5) {
     * //   console.log('Images are very similar');
     * // }
     *
     * @private
     */
    async calculatePerceptualHash(fileInfo) {
        try {
            // Create a simple perceptual hash (pHash-like)
            // Resize to 8x8 and convert to greyscale
            const { data } = await sharp(fileInfo.path)
                .resize(8, 8, { fit: 'fill' })
                .greyscale()
                .raw()
                .toBuffer({ resolveWithObject: true });

            // Calculate average pixel value
            let sum = 0;
            for (let i = 0; i < data.length; i++) {
                sum += data[i];
            }
            const avg = sum / data.length;

            // Create hash based on pixels above/below average
            let hash = '';
            for (let i = 0; i < data.length; i++) {
                hash += data[i] > avg ? '1' : '0';
            }

            // Convert binary to hex (64 bits = 16 hex characters)
            fileInfo.metadata.image.perceptualHash = parseInt(hash, 2).toString(16).padStart(16, '0');

        } catch (error) {
            console.warn(`Could not calculate perceptual hash for ${fileInfo.path}: ${error.message}`);
        }
    }

    /**
     * Convert RGB color values to hexadecimal color code
     *
     * Converts separate red, green, and blue channel values (0-255)
     * into a standard web hex color format (#RRGGBB).
     *
     * @param {number} r - Red channel value (0-255)
     * @param {number} g - Green channel value (0-255)
     * @param {number} b - Blue channel value (0-255)
     * @returns {string} Hex color code in #RRGGBB format
     *
     * @example
     * processor.rgbToHex(255, 0, 0);     // '#ff0000' (red)
     * processor.rgbToHex(0, 128, 255);   // '#0080ff' (blue)
     * processor.rgbToHex(128.7, 64.2, 0); // '#804000' (rounded values)
     *
     * @private
     */
    rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(x => {
            const hex = Math.round(x).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }

    /**
     * Get list of supported file extensions
     *
     * Returns all image file extensions that this processor can handle.
     * Used by the file scanner to route files to the appropriate processor.
     *
     * @returns {string[]} Array of supported file extensions (lowercase, without dots)
     *
     * @example
     * const extensions = processor.getSupportedExtensions();
     * // ['jpg', 'jpeg', 'png', 'gif', 'webp', 'tiff', 'tif', 'bmp', 'svg', 'heic', 'heif', 'avif']
     */
    getSupportedExtensions() {
        return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'tiff', 'tif', 'bmp', 'svg', 'heic', 'heif', 'avif'];
    }

    /**
     * Get list of supported MIME types
     *
     * Returns MIME types that this processor can handle.
     * Used for file type detection when extension is ambiguous or missing.
     *
     * @returns {string[]} Array of supported MIME types
     *
     * @see https://www.iana.org/assignments/media-types/media-types.xhtml#image - IANA image MIME types
     *
     * @example
     * const mimeTypes = processor.getSupportedMimeTypes();
     * // ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/tiff', 'image/bmp', 'image/svg+xml']
     */
    getSupportedMimeTypes() {
        return ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/tiff', 'image/bmp', 'image/svg+xml'];
    }
}

module.exports = ImageProcessor;
