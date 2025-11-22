/**
 * Image Processor
 * Extracts comprehensive metadata from image files
 */

const BaseProcessor = require('./BaseProcessor');
const sharp = require('sharp');
const exifr = require('exifr');
const path = require('path');
const fs = require('fs').promises;

class ImageProcessor extends BaseProcessor {
    constructor(config = {}) {
        super(config);
        this.thumbnailDir = config.thumbnailDir || './thumbnails';
    }

    canProcess(fileInfo) {
        return fileInfo.category === 'image';
    }

    async process(fileInfo) {
        const startTime = Date.now();
        this.logStart(fileInfo);

        try {
            if (!await this.validate(fileInfo)) {
                return fileInfo;
            }

            // Initialize metadata structure
            if (!fileInfo.metadata) fileInfo.metadata = {};
            fileInfo.metadata.image = {};

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

            const duration = Date.now() - startTime;
            fileInfo.processing = {
                processedAt: new Date().toISOString(),
                processingTime: duration,
                version: '1.0.0',
                errors: []
            };

            this.logComplete(fileInfo, duration);
            return fileInfo;

        } catch (error) {
            return this.handleError(fileInfo, error);
        }
    }

    /**
     * Extract basic image information using sharp
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
                    fileInfo.metadata.image.exif.gps = {
                        latitude: exifData.latitude,
                        longitude: exifData.longitude,
                        altitude: exifData.GPSAltitude
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
    async extractColors(fileInfo) {
        try {
            const { dominant } = await sharp(fileInfo.path)
                .resize(100, 100, { fit: 'cover' })
                .stats();

            fileInfo.metadata.image.dominantColors = dominant.map(color => ({
                r: color.r,
                g: color.g,
                b: color.b,
                hex: this.rgbToHex(color.r, color.g, color.b)
            }));

        } catch (error) {
            console.warn(`Could not extract colors from ${fileInfo.path}: ${error.message}`);
        }
    }

    /**
     * Generate thumbnails in multiple sizes
     */
    async generateThumbnails(fileInfo) {
        try {
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
     */
    async calculatePerceptualHash(fileInfo) {
        try {
            // Create a simple perceptual hash (pHash-like)
            const { data, info } = await sharp(fileInfo.path)
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

            // Convert binary to hex
            fileInfo.metadata.image.perceptualHash = parseInt(hash, 2).toString(16).padStart(16, '0');

        } catch (error) {
            console.warn(`Could not calculate perceptual hash for ${fileInfo.path}: ${error.message}`);
        }
    }

    /**
     * Convert RGB to hex color
     */
    rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(x => {
            const hex = Math.round(x).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }

    getSupportedExtensions() {
        return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'tiff', 'tif', 'bmp', 'svg', 'heic', 'heif', 'avif'];
    }

    getSupportedMimeTypes() {
        return ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/tiff', 'image/bmp', 'image/svg+xml'];
    }
}

module.exports = ImageProcessor;
