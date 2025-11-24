/**
 * Font Processor
 * Extracts comprehensive metadata from font files (TTF, OTF, WOFF, WOFF2)
 *
 * Supported Formats:
 * - TTF (TrueType Font)
 * - OTF (OpenType Font)
 * - WOFF (Web Open Font Format)
 * - WOFF2 (Web Open Font Format 2)
 *
 * Extracted Metadata:
 * - Font family, subfamily, full name
 * - Font weight (100-900), style (normal/italic/oblique), stretch
 * - Glyph count and character coverage (Basic Latin, Greek, Cyrillic, CJK, etc.)
 * - OpenType features (ligatures, small caps, alternates, etc.)
 * - Supported scripts and languages (auto-detected from character coverage)
 * - Font variations (for variable fonts with multiple axes)
 * - Typography flags (monospace, serif detection)
 * - Licensing information (copyright, license, trademark)
 *
 * @requires fontkit - Optional but recommended for comprehensive metadata extraction
 * @see https://github.com/foliojs/fontkit - fontkit library documentation
 * @see https://docs.microsoft.com/en-us/typography/opentype/spec/ - OpenType specification
 */

const BaseProcessor = require('./BaseProcessor');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class FontProcessor extends BaseProcessor {
    /**
     * Create a FontProcessor instance
     *
     * Automatically attempts to load the fontkit library on construction.
     * If fontkit is not available, falls back to basic font information extraction.
     *
     * @param {Object} config - Configuration options (passed to BaseProcessor)
     *
     * @example
     * const processor = new FontProcessor();
     * if (processor.fontkitAvailable) {
     *   console.log('Full font metadata extraction available');
     * } else {
     *   console.log('Install fontkit: npm install fontkit');
     * }
     */
    constructor(config = {}) {
        super(config);
        this.fontkit = null;
        this.fontkitAvailable = false;
        this.initializeFontkit();
    }

    /**
     * Initialize and check fontkit availability
     *
     * Attempts to load the fontkit library via require().
     * fontkit is an optional dependency that enables comprehensive
     * font metadata extraction. If unavailable, the processor falls
     * back to basic file information only.
     *
     * Sets two instance properties:
     * - this.fontkit: The fontkit module or null
     * - this.fontkitAvailable: Boolean flag indicating availability
     *
     * @returns {void}
     *
     * @see https://github.com/foliojs/fontkit - fontkit library
     *
     * @private
     */
    initializeFontkit() {
        try {
            this.fontkit = require('fontkit');
            this.fontkitAvailable = true;
            logger.debug('fontkit library loaded successfully');
        } catch (error) {
            this.fontkitAvailable = false;
            logger.warn('fontkit library not available - basic font processing will be limited');
            logger.debug(`fontkit error: ${error.message}`);
        }
    }

    /**
     * Check if this processor can handle the given file
     *
     * Determines processing eligibility based on file category.
     * Part of the Template Method pattern from BaseProcessor.
     * Files are categorized as 'font' by the scanner based on
     * extension (.ttf, .otf, .woff, .woff2) or MIME type.
     *
     * @param {Object} fileInfo - File information object
     * @param {string} fileInfo.category - File category (e.g., 'font', 'image')
     * @returns {boolean} True if file category is 'font'
     *
     * @example
     * const canHandle = processor.canProcess({ category: 'font' }); // true
     * const cannotHandle = processor.canProcess({ category: 'image' }); // false
     */
    canProcess(fileInfo) {
        return fileInfo.category === 'font';
    }

    /**
     * Main processing method
     *
     * Orchestrates complete font metadata extraction pipeline.
     * Overrides BaseProcessor.process() to implement custom processing logic.
     *
     * Processing flow:
     * 1. Validate file exists and is accessible
     * 2. Initialize metadata.font object
     * 3. Choose extraction method based on fontkit availability:
     *    - With fontkit: Full metadata (family, glyphs, features, coverage, etc.)
     *    - Without fontkit: Basic metadata (format, file size, warning message)
     * 4. Add processing metadata (timestamp, duration, warnings)
     *
     * Unlike other processors that use the Template Method pattern,
     * FontProcessor overrides process() entirely for better control
     * over fontkit availability handling.
     *
     * @param {Object} fileInfo - File information object
     * @param {string} fileInfo.path - Absolute path to the font file
     * @param {string} fileInfo.name - Filename with extension
     * @returns {Promise<Object>} Enhanced fileInfo with metadata.font populated
     * @throws {Error} Only throws via handleError() which catches and logs errors
     *
     * @example
     * const fileInfo = {
     *   path: '/fonts/Roboto-Regular.ttf',
     *   name: 'Roboto-Regular.ttf',
     *   category: 'font'
     * };
     * const result = await processor.process(fileInfo);
     * // result.metadata.font contains: family, weight, glyphCount, features, etc.
     */
    async process(fileInfo) {
        const startTime = Date.now();
        this.logStart(fileInfo);

        try {
            if (!await this.validate(fileInfo)) {
                return fileInfo;
            }

            // Initialize metadata structure
            if (!fileInfo.metadata) fileInfo.metadata = {};
            fileInfo.metadata.font = {};

            // Extract font metadata
            if (this.fontkitAvailable) {
                await this.extractFontMetadataWithFontkit(fileInfo);
            } else {
                await this.extractBasicFontInfo(fileInfo);
            }

            const duration = Date.now() - startTime;
            fileInfo.processing = {
                processedAt: new Date().toISOString(),
                processingTime: duration,
                version: '1.0.0',
                errors: [],
                warnings: this.fontkitAvailable ? [] : ['fontkit not available - limited metadata extraction']
            };

            this.logComplete(fileInfo, duration);
            return fileInfo;

        } catch (error) {
            return this.handleError(fileInfo, error);
        }
    }

    /**
     * Extract comprehensive font metadata using fontkit library
     *
     * Main extraction pipeline when fontkit is available.
     * Parses font binary data and extracts all available metadata
     * by calling specialized extraction methods for each aspect.
     *
     * Extraction pipeline:
     * 1. Load font file into memory buffer
     * 2. Parse with fontkit (supports TTF, OTF, WOFF, WOFF2, TTC/OTC)
     * 3. Extract naming (family, subfamily, PostScript name, etc.)
     * 4. Extract properties (weight, style, stretch, monospace, serif)
     * 5. Extract glyph data (count, metrics, units per em)
     * 6. Extract OpenType features (ligatures, alternates, etc.)
     * 7. Extract character coverage (Unicode ranges, supported scripts)
     * 8. Extract variations (for variable fonts with multiple axes)
     * 9. Extract licensing (copyright, license, trademark)
     *
     * @param {Object} fileInfo - File information object
     * @param {string} fileInfo.path - Absolute path to the font file
     * @param {string} fileInfo.name - Filename with extension
     * @param {Object} fileInfo.metadata - Metadata container
     * @param {Object} fileInfo.metadata.font - Font metadata object to populate
     * @returns {Promise<void>} Resolves when extraction is complete
     * @throws {Error} If fontkit cannot parse the file or extraction fails
     *
     * @see https://github.com/foliojs/fontkit#opening-a-font - fontkit API
     *
     * @example
     * // After extraction, fileInfo.metadata.font contains:
     * // {
     * //   family: 'Roboto',
     * //   weight: 400,
     * //   glyphCount: 3878,
     * //   features: [{ tag: 'liga', type: 'substitution' }, ...],
     * //   characterSets: { hasBasicLatin: true, hasCJK: false, ... },
     * //   languages: ['en', 'el', 'ru'],
     * //   isVariable: false
     * // }
     *
     * @private
     */
    async extractFontMetadataWithFontkit(fileInfo) {
        try {
            // Read font file into buffer
            const buffer = await fs.readFile(fileInfo.path);

            // Parse font using fontkit
            const font = this.fontkit.create(buffer);

            // Set format based on file extension
            const extension = path.extname(fileInfo.name).toLowerCase().slice(1);
            fileInfo.metadata.font.format = this.normalizeFormatName(extension);

            // Extract basic naming information
            this.extractNamingInfo(fileInfo, font);

            // Extract font properties
            this.extractFontProperties(fileInfo, font);

            // Extract glyph information
            this.extractGlyphInfo(fileInfo, font);

            // Extract OpenType features
            this.extractOpenTypeFeatures(fileInfo, font);

            // Extract character sets and coverage
            this.extractCharacterCoverage(fileInfo, font);

            // Extract font variations (if variable font)
            this.extractVariations(fileInfo, font);

            // Extract licensing information
            this.extractLicensingInfo(fileInfo, font);

        } catch (error) {
            throw new Error(`Failed to extract font metadata with fontkit: ${error.message}`);
        }
    }

    /**
     * Extract font naming information (family, subfamily, full name, etc.)
     *
     * Extracts human-readable names from the font's name table (OpenType 'name' table).
     * These names are used for font identification and display in applications.
     *
     * Extracted names:
     * - family: Font family name (e.g., 'Roboto', 'Helvetica')
     * - subfamily: Style name (e.g., 'Regular', 'Bold', 'Italic')
     * - fullName: Complete font name (e.g., 'Roboto Bold Italic')
     * - postScriptName: PostScript-compatible name (no spaces, e.g., 'Roboto-BoldItalic')
     * - manufacturer: Font foundry or creator (optional)
     * - designer: Font designer name (optional)
     *
     * @param {Object} fileInfo - File information object
     * @param {Object} fileInfo.metadata - Metadata container
     * @param {Object} fileInfo.metadata.font - Font metadata object
     * @param {Object} font - Parsed font object from fontkit
     * @param {string} font.familyName - Font family name
     * @param {string} font.subfamilyName - Font subfamily/style name
     * @param {string} font.fullName - Complete font name
     * @param {string} font.postscriptName - PostScript name
     * @returns {void}
     *
     * @see https://docs.microsoft.com/en-us/typography/opentype/spec/name - OpenType name table
     *
     * @example
     * // After extraction:
     * // {
     * //   family: 'Roboto',
     * //   subfamily: 'Bold',
     * //   fullName: 'Roboto Bold',
     * //   postScriptName: 'Roboto-Bold',
     * //   manufacturer: 'Google',
     * //   designer: 'Christian Robertson'
     * // }
     *
     * @private
     */
    extractNamingInfo(fileInfo, font) {
        try {
            fileInfo.metadata.font.family = font.familyName || 'Unknown';
            fileInfo.metadata.font.subfamily = font.subfamilyName || 'Regular';
            fileInfo.metadata.font.fullName = font.fullName || `${font.familyName} ${font.subfamilyName}`;
            fileInfo.metadata.font.postScriptName = font.postscriptName || null;

            // Extract manufacturer and designer info if available
            if (font.manufacturer) {
                fileInfo.metadata.font.manufacturer = font.manufacturer;
            }

            if (font.designer) {
                fileInfo.metadata.font.designer = font.designer;
            }

        } catch (error) {
            logger.warn(`Could not extract naming info from font: ${error.message}`);
        }
    }

    /**
     * Extract font properties (weight, style, stretch, width)
     *
     * Extracts typographic properties from the font's OS/2 and post tables.
     * These properties define the visual characteristics of the font.
     *
     * Extracted properties:
     * - weight: Numerical weight (100-900, where 400=normal, 700=bold)
     * - style: Text style ('normal', 'italic', 'oblique')
     * - stretch: Width class ('normal', 'condensed', 'expanded', etc.)
     * - width: Numeric width value (optional)
     * - isMonospace: Whether all glyphs have equal width
     * - hasSerifs: Whether the font has serif decorations
     *
     * Uses multiple extraction strategies with fallbacks:
     * - Primary: OS/2 table values (usWeightClass, usWidthClass, etc.)
     * - Fallback: Subfamily name parsing (e.g., "Bold Italic" → weight=700, style=italic)
     * - Default: Standard values (weight=400, style=normal, stretch=normal)
     *
     * @param {Object} fileInfo - File information object
     * @param {Object} fileInfo.metadata - Metadata container
     * @param {Object} fileInfo.metadata.font - Font metadata object
     * @param {Object} font - Parsed font object from fontkit
     * @param {Object} font.OS2 - OS/2 table with weight/width classifications
     * @param {Object} font.post - Post table with italic angle
     * @returns {void}
     *
     * @see https://docs.microsoft.com/en-us/typography/opentype/spec/os2 - OpenType OS/2 table
     * @see https://docs.microsoft.com/en-us/typography/opentype/spec/post - OpenType post table
     *
     * @example
     * // After extraction for "Roboto Bold Italic":
     * // {
     * //   weight: 700,
     * //   style: 'italic',
     * //   stretch: 'normal',
     * //   isMonospace: false,
     * //   hasSerifs: false
     * // }
     *
     * @private
     */
    extractFontProperties(fileInfo, font) {
        try {
            // Weight (100-900)
            fileInfo.metadata.font.weight = this.extractFontWeight(font);

            // Style (normal, italic, oblique)
            fileInfo.metadata.font.style = this.extractFontStyle(font);

            // Stretch (ultra-condensed to ultra-expanded)
            fileInfo.metadata.font.stretch = this.extractFontStretch(font);

            // Width (if available)
            if (font.width) {
                fileInfo.metadata.font.width = font.width;
            }

            // Monospace flag
            fileInfo.metadata.font.isMonospace = this.isMonospaceFont(font);

            // Serif flag
            fileInfo.metadata.font.hasSerifs = this.hasSerifs(font);

        } catch (error) {
            logger.warn(`Could not extract font properties: ${error.message}`);
        }
    }

    /**
     * Extract glyph count and related information
     *
     * @param {Object} fileInfo - File information object
     * @param {Object} font - Parsed font object from fontkit
     * @private
     */
    extractGlyphInfo(fileInfo, font) {
        try {
            // Get glyph count directly from font
            fileInfo.metadata.font.glyphCount = font.numGlyphs || 0;

            const glyphCollection = font.glyphs || [];

            // Analyze glyph metrics
            if (glyphCollection.length > 0) {
                let totalWidth = 0;
                let minAdvanceWidth = Infinity;
                let maxAdvanceWidth = -Infinity;

                for (let i = 0; i < Math.min(glyphCollection.length, 1000); i++) {
                    const glyph = glyphCollection[i];
                    if (glyph && glyph.advanceWidth !== undefined) {
                        totalWidth += glyph.advanceWidth;
                        minAdvanceWidth = Math.min(minAdvanceWidth, glyph.advanceWidth);
                        maxAdvanceWidth = Math.max(maxAdvanceWidth, glyph.advanceWidth);
                    }
                }

                if (minAdvanceWidth !== Infinity) {
                    fileInfo.metadata.font.glyphMetrics = {
                        averageAdvanceWidth: Math.round(totalWidth / Math.min(glyphCollection.length, 1000)),
                        minAdvanceWidth,
                        maxAdvanceWidth
                    };
                }
            }

            // UPM (Units Per Em) - standard font unit
            if (font.unitsPerEm) {
                fileInfo.metadata.font.unitsPerEm = font.unitsPerEm;
            }

        } catch (error) {
            logger.warn(`Could not extract glyph info: ${error.message}`);
        }
    }

    /**
     * Extract OpenType feature information (ligatures, small caps, etc.)
     *
     * @param {Object} fileInfo - File information object
     * @param {Object} font - Parsed font object from fontkit
     * @private
     */
    extractOpenTypeFeatures(fileInfo, font) {
        try {
            const features = [];
            const featureMap = {};

            // Try to extract feature tags from GSUB/GPOS tables
            if (font.GSUB && font.GSUB.features) {
                for (const feature of font.GSUB.features) {
                    if (feature.tag && !featureMap[feature.tag]) {
                        featureMap[feature.tag] = true;
                        features.push({
                            tag: feature.tag,
                            type: 'substitution',
                            description: this.getFeatureDescription(feature.tag)
                        });
                    }
                }
            }

            if (font.GPOS && font.GPOS.features) {
                for (const feature of font.GPOS.features) {
                    if (feature.tag && !featureMap[feature.tag]) {
                        featureMap[feature.tag] = true;
                        features.push({
                            tag: feature.tag,
                            type: 'positioning',
                            description: this.getFeatureDescription(feature.tag)
                        });
                    }
                }
            }

            if (features.length > 0) {
                fileInfo.metadata.font.features = features;
                fileInfo.metadata.font.featureCount = features.length;
            }

        } catch (error) {
            logger.warn(`Could not extract OpenType features: ${error.message}`);
        }
    }

    /**
     * Extract character set and unicode coverage information
     *
     * @param {Object} fileInfo - File information object
     * @param {Object} font - Parsed font object from fontkit
     * @private
     */
    extractCharacterCoverage(fileInfo, font) {
        try {
            const characterSets = {
                hasBasicLatin: false,
                hasLatin1Supplement: false,
                hasLatinExtA: false,
                hasLatinExtB: false,
                hasGreek: false,
                hasCyrillic: false,
                hasArabic: false,
                hasHebrew: false,
                hasDevanagari: false,
                hasHangul: false,
                hasCJK: false,
                hasEmoji: false
            };

            const cmap = font.cmap;
            if (cmap) {
                // Iterate through cmap tables to analyze character coverage
                const tables = cmap.tables || [];
                for (const table of tables) {
                    if (table.codeMap) {
                        for (const charCode of Object.keys(table.codeMap)) {
                            const code = parseInt(charCode);

                    // Basic Latin (U+0000 to U+007F)
                    if (code >= 0x0000 && code <= 0x007F) {
                        characterSets.hasBasicLatin = true;
                    }
                    // Latin-1 Supplement (U+0080 to U+00FF)
                    else if (code >= 0x0080 && code <= 0x00FF) {
                        characterSets.hasLatin1Supplement = true;
                    }
                    // Latin Extended-A (U+0100 to U+017F)
                    else if (code >= 0x0100 && code <= 0x017F) {
                        characterSets.hasLatinExtA = true;
                    }
                    // Latin Extended-B (U+0180 to U+024F)
                    else if (code >= 0x0180 && code <= 0x024F) {
                        characterSets.hasLatinExtB = true;
                    }
                    // Greek (U+0370 to U+03FF)
                    else if (code >= 0x0370 && code <= 0x03FF) {
                        characterSets.hasGreek = true;
                    }
                    // Cyrillic (U+0400 to U+04FF)
                    else if (code >= 0x0400 && code <= 0x04FF) {
                        characterSets.hasCyrillic = true;
                    }
                    // Arabic (U+0600 to U+06FF)
                    else if (code >= 0x0600 && code <= 0x06FF) {
                        characterSets.hasArabic = true;
                    }
                    // Hebrew (U+0590 to U+05FF)
                    else if (code >= 0x0590 && code <= 0x05FF) {
                        characterSets.hasHebrew = true;
                    }
                    // Devanagari (U+0900 to U+097F)
                    else if (code >= 0x0900 && code <= 0x097F) {
                        characterSets.hasDevanagari = true;
                    }
                    // Hangul (U+AC00 to U+D7AF)
                    else if (code >= 0xAC00 && code <= 0xD7AF) {
                        characterSets.hasHangul = true;
                    }
                    // CJK Unified Ideographs (U+4E00 to U+9FFF)
                    else if (code >= 0x4E00 && code <= 0x9FFF) {
                        characterSets.hasCJK = true;
                    }
                    // Emoji (various ranges)
                    else if ((code >= 0x1F300 && code <= 0x1F9FF) ||
                             (code >= 0x2600 && code <= 0x27BF)) {
                        characterSets.hasEmoji = true;
                    }
                        }
                    }
                }
            }

            fileInfo.metadata.font.characterSets = characterSets;

            // Create languages array from character sets
            const languages = [];
            if (characterSets.hasBasicLatin) languages.push('en');
            if (characterSets.hasGreek) languages.push('el');
            if (characterSets.hasCyrillic) languages.push('ru');
            if (characterSets.hasArabic) languages.push('ar');
            if (characterSets.hasHebrew) languages.push('he');
            if (characterSets.hasDevanagari) languages.push('hi');
            if (characterSets.hasHangul) languages.push('ko');
            if (characterSets.hasCJK) languages.push('zh', 'ja');

            if (languages.length > 0) {
                fileInfo.metadata.font.languages = languages;
            }

        } catch (error) {
            logger.warn(`Could not extract character coverage: ${error.message}`);
        }
    }

    /**
     * Extract font variation information for variable fonts
     *
     * @param {Object} fileInfo - File information object
     * @param {Object} font - Parsed font object from fontkit
     * @private
     */
    extractVariations(fileInfo, font) {
        try {
            if (font.fvar) {
                // This is a variable font
                fileInfo.metadata.font.isVariable = true;

                const axes = [];
                if (font.fvar.axes) {
                    for (const axis of font.fvar.axes) {
                        axes.push({
                            tag: axis.tag,
                            name: axis.name || axis.tag,
                            min: axis.minValue,
                            default: axis.defaultValue,
                            max: axis.maxValue
                        });
                    }
                }

                if (axes.length > 0) {
                    fileInfo.metadata.font.variationAxes = axes;
                }

                const namedInstances = [];
                if (font.fvar.instances) {
                    for (const instance of font.fvar.instances) {
                        namedInstances.push({
                            name: instance.name,
                            coordinates: instance.coordinates
                        });
                    }
                }

                if (namedInstances.length > 0) {
                    fileInfo.metadata.font.namedInstances = namedInstances;
                }
            } else {
                fileInfo.metadata.font.isVariable = false;
            }

        } catch (error) {
            logger.warn(`Could not extract variation info: ${error.message}`);
        }
    }

    /**
     * Extract licensing and copyright information
     *
     * @param {Object} fileInfo - File information object
     * @param {Object} font - Parsed font object from fontkit
     * @private
     */
    extractLicensingInfo(fileInfo, font) {
        try {
            const licensing = {};

            // Try to extract from name table
            if (font.copyright) {
                licensing.copyright = font.copyright;
            }

            if (font.license) {
                licensing.license = font.license;
            }

            if (font.licenseUrl) {
                licensing.licenseUrl = font.licenseUrl;
            }

            if (font.trademark) {
                licensing.trademark = font.trademark;
            }

            if (Object.keys(licensing).length > 0) {
                fileInfo.metadata.font.licensing = licensing;
            }

        } catch (error) {
            logger.warn(`Could not extract licensing info: ${error.message}`);
        }
    }

    /**
     * Extract basic font info when fontkit is not available
     * Provides fallback metadata based on file format and basic parsing
     *
     * @param {Object} fileInfo - File information object
     * @returns {Promise<void>}
     * @private
     */
    async extractBasicFontInfo(fileInfo) {
        try {
            const extension = path.extname(fileInfo.name).toLowerCase().slice(1);

            // Set basic information
            fileInfo.metadata.font.family = 'Unknown (fontkit unavailable)';
            fileInfo.metadata.font.format = this.normalizeFormatName(extension);
            fileInfo.metadata.font.fontkitAvailable = false;
            fileInfo.metadata.font.warning = 'Install fontkit for comprehensive font metadata extraction: npm install fontkit';

            // Store file size for reference
            const stats = await fs.stat(fileInfo.path);
            fileInfo.metadata.font.fileSize = stats.size;
            fileInfo.metadata.font.fileSizeFormatted = this.formatFileSize(stats.size);

        } catch (error) {
            throw new Error(`Failed to extract basic font info: ${error.message}`);
        }
    }

    /**
     * Extract font weight from font object
     * Returns standard CSS weight value (100-900)
     *
     * @param {Object} font - Parsed font object
     * @returns {number} - Font weight (100-900)
     * @private
     */
    extractFontWeight(font) {
        try {
            // Try OS/2 table weight
            if (font.OS2 && font.OS2.usWeightClass) {
                return font.OS2.usWeightClass;
            }

            // Fallback based on subfamily
            const subfamily = (font.subfamilyName || '').toLowerCase();
            if (subfamily.includes('thin')) return 100;
            if (subfamily.includes('extralight') || subfamily.includes('extra light')) return 200;
            if (subfamily.includes('light')) return 300;
            if (subfamily.includes('regular') || subfamily.includes('normal')) return 400;
            if (subfamily.includes('medium')) return 500;
            if (subfamily.includes('semibold') || subfamily.includes('semi bold')) return 600;
            if (subfamily.includes('bold')) return 700;
            if (subfamily.includes('extrabold') || subfamily.includes('extra bold')) return 800;
            if (subfamily.includes('black') || subfamily.includes('heavy')) return 900;

            return 400; // Default to normal
        } catch (error) {
            logger.warn(`Could not extract font weight: ${error.message}`);
            return 400;
        }
    }

    /**
     * Extract font style from font object
     * Returns 'normal', 'italic', or 'oblique'
     *
     * @param {Object} font - Parsed font object
     * @returns {string} - Font style
     * @private
     */
    extractFontStyle(font) {
        try {
            // Try post table for italic angle
            if (font.post && font.post.italicAngle && font.post.italicAngle !== 0) {
                return font.post.italicAngle > 0 ? 'oblique' : 'italic';
            }

            // Check subfamily name
            const subfamily = (font.subfamilyName || '').toLowerCase();
            if (subfamily.includes('italic')) return 'italic';
            if (subfamily.includes('oblique')) return 'oblique';

            return 'normal';
        } catch (error) {
            logger.warn(`Could not extract font style: ${error.message}`);
            return 'normal';
        }
    }

    /**
     * Extract font stretch/width from font object
     * Returns CSS stretch keyword or percentage
     *
     * @param {Object} font - Parsed font object
     * @returns {string} - Font stretch value
     * @private
     */
    extractFontStretch(font) {
        try {
            // Try OS/2 table usWidthClass
            if (font.OS2 && font.OS2.usWidthClass) {
                const widthClass = font.OS2.usWidthClass;
                const widthMap = {
                    1: 'ultra-condensed',
                    2: 'extra-condensed',
                    3: 'condensed',
                    4: 'semi-condensed',
                    5: 'normal',
                    6: 'semi-expanded',
                    7: 'expanded',
                    8: 'extra-expanded',
                    9: 'ultra-expanded'
                };
                return widthMap[widthClass] || 'normal';
            }

            return 'normal';
        } catch (error) {
            logger.warn(`Could not extract font stretch: ${error.message}`);
            return 'normal';
        }
    }

    /**
     * Determine if font is monospace
     *
     * @param {Object} font - Parsed font object
     * @returns {boolean} - True if monospace
     * @private
     */
    isMonospaceFont(font) {
        try {
            // Check post table for monospace flag
            if (font.post && font.post.isFixedPitch) {
                return font.post.isFixedPitch === 1;
            }

            // Check OS/2 panose for monospace
            if (font.OS2 && font.OS2.panose) {
                return font.OS2.panose.bFamilyType === 2; // 2 = monospace
            }

            return false;
        } catch (error) {
            logger.warn(`Could not determine if monospace: ${error.message}`);
            return false;
        }
    }

    /**
     * Determine if font has serifs
     *
     * @param {Object} font - Parsed font object
     * @returns {boolean} - True if font has serifs
     * @private
     */
    hasSerifs(font) {
        try {
            // Check OS/2 panose for serif info
            if (font.OS2 && font.OS2.panose) {
                const serifType = font.OS2.panose.bSerifStyle;
                // 0 = no serifs, 1 = cove, 2 = obtuse, 3 = square, 4 = bone, 5 = flared, 6 = rounded, 11 = sans serif
                return serifType > 0 && serifType < 11;
            }

            return false;
        } catch (error) {
            logger.warn(`Could not determine serif status: ${error.message}`);
            return false;
        }
    }

    /**
     * Get human-readable description for OpenType feature tag
     *
     * @param {string} tag - OpenType feature tag
     * @returns {string} - Feature description
     * @private
     */
    getFeatureDescription(tag) {
        const featureDescriptions = {
            'aalt': 'Access All Alternates',
            'abvm': 'Above-base Mark Positioning',
            'afrc': 'Alternative Fractions',
            'akhn': 'Akhandu Form',
            'blwf': 'Below-base Form',
            'blwm': 'Below-base Mark Positioning',
            'calt': 'Contextual Alternates',
            'case': 'Case Sensitive Forms',
            'ccmp': 'Glyph Composition/Decomposition',
            'cfar': 'Conjunct Form After Ro',
            'cjkf': 'CJK Compatibility Forms',
            'clig': 'Contextual Ligatures',
            'cpsp': 'Capital Spacing',
            'cswh': 'Contextual Swash',
            'curs': 'Cursive Attachment',
            'c2cp': 'Capitals to Small Capitals',
            'c2sc': 'Small Capitals',
            'dist': 'Distances',
            'dlig': 'Discretionary Ligatures',
            'dnom': 'Denominators',
            'dtls': 'Dotless Forms',
            'expt': 'Expert Forms',
            'falt': 'Final Glyph on Line Alternates',
            'fin2': 'Terminal Forms #2',
            'fin3': 'Terminal Forms #3',
            'fina': 'Terminal Forms',
            'flac': 'Flattened Accent Forms',
            'fwid': 'Full Width',
            'half': 'Half Forms',
            'haln': 'Halant Forms',
            'halt': 'Alternate Half Width',
            'hist': 'Historical Forms',
            'hkna': 'Hiragana',
            'hlig': 'Historical Ligatures',
            'hngl': 'Hangul',
            'hojo': 'Hojo Kanji Forms',
            'hwid': 'Half Width',
            'init': 'Initial Forms',
            'isol': 'Isolated Forms',
            'ital': 'Italics',
            'jalt': 'Justification Alternates',
            'jp78': 'JIS78 Forms',
            'jp83': 'JIS83 Forms',
            'jp90': 'JIS90 Forms',
            'jp04': 'JIS2004 Forms',
            'kana': 'Katakana',
            'kpf': 'Kerning Pair Positioning',
            'liga': 'Standard Ligatures',
            'loclCAT': 'Localized Forms (Catalan)',
            'locl': 'Localized Forms',
            'ltra': 'Left-to-Right Alternates',
            'ltrm': 'Left-to-Right Mirrored Forms',
            'mark': 'Mark Positioning',
            'med2': 'Medial Forms #2',
            'medi': 'Medial Forms',
            'mgrk': 'Mathematical Greek',
            'mkmk': 'Mark to Mark Positioning',
            'mset': 'Mark Positioning via Substitution',
            'nalt': 'Alternate Annotation Forms',
            'nlck': 'NLC Kanji Forms',
            'nukt': 'Nukta Forms',
            'numr': 'Numerators',
            'onum': 'Oldstyle Figures',
            'opbd': 'Optical Bounds',
            'ordn': 'Ordinals',
            'orna': 'Ornaments',
            'orth': 'Orthographic Alternates',
            'palt': 'Proportional Alternate Width',
            'pcap': 'Petite Capitals',
            'pnum': 'Proportional Figures',
            'pref': 'Pre-base Forms',
            'pres': 'Pre-base Substitutions',
            'pstf': 'Post-base Forms',
            'psts': 'Post-base Substitutions',
            'pwid': 'Proportional Width',
            'qwid': 'Quarter Width',
            'rand': 'Randomize',
            'rchg': 'Reach',
            'rlig': 'Required Ligatures',
            'rphf': 'Reph Form',
            'rtbd': 'Right Bounds',
            'rtla': 'Right-to-Left Alternates',
            'rtlm': 'Right-to-Left Mirrored Forms',
            'ruby': 'Ruby Notification Forms',
            'rvrn': 'Required Variation Alternates',
            'salt': 'Stylistic Alternates',
            'saln': 'Samaritan Letters',
            'sasf': 'Serif to Sans-serif Form',
            'saus': 'Simplified Akshara Forms Unicode Semantics',
            'sax': 'Simplified Forms Extended',
            'sbin': 'Subscripts',
            'sblm': 'Subscript By Markup',
            'sc': 'Small Capitals',
            'scmp': 'Small Caps',
            'scox': 'Simplified Chinese Omit Parenthesis',
            'scpo': 'Small Caps Punctuation',
            'scsl': 'Small Caps Subscript Lowercase',
            'scur': 'Script Form',
            'sdot': 'Stylistic Set 01',
            'sfrm': 'Serif Forms',
            'shap': 'Shaping',
            'shex': 'Shapes Extended',
            'shmo': 'Shape Modification',
            'shrt': 'Short Forms',
            'sinf': 'Scientific Inferiors',
            'size': 'Optical Size',
            'sizf': 'Optical Size - Fine Tuning',
            'sksh': 'Skill Shapes',
            'smcp': 'Small Capitals',
            'smpl': 'Simplified Forms',
            'snps': 'Snap',
            'spln': 'Spell Alternates',
            'sprn': 'Sprinkles',
            'sscr': 'Style Alternates',
            'ssty': 'Script Style',
            'ss01': 'Stylistic Set 01',
            'ss02': 'Stylistic Set 02',
            'ss03': 'Stylistic Set 03',
            'ss04': 'Stylistic Set 04',
            'ss05': 'Stylistic Set 05',
            'ss06': 'Stylistic Set 06',
            'ss07': 'Stylistic Set 07',
            'ss08': 'Stylistic Set 08',
            'ss09': 'Stylistic Set 09',
            'ss10': 'Stylistic Set 10',
            'ss11': 'Stylistic Set 11',
            'ss12': 'Stylistic Set 12',
            'ss13': 'Stylistic Set 13',
            'ss14': 'Stylistic Set 14',
            'ss15': 'Stylistic Set 15',
            'ss16': 'Stylistic Set 16',
            'ss17': 'Stylistic Set 17',
            'ss18': 'Stylistic Set 18',
            'ss19': 'Stylistic Set 19',
            'ss20': 'Stylistic Set 20',
            'subs': 'Subscripts',
            'sups': 'Superscripts',
            'swsh': 'Swash',
            'tage': 'Tagalog Forms',
            'tail': 'Tail Forms',
            'talt': 'Alternate Tail Forms',
            'thal': 'Thai Lao Forms',
            'tho': 'Tho Digits',
            'titl': 'Titling',
            'tnam': 'Traditional Name Forms',
            'tnum': 'Tabular Figures',
            'trad': 'Traditional Forms',
            'trau': 'Transparent Alternates Updated',
            'trat': 'Transparent Alternates',
            'trf': 'Trailing Forms',
            'trin': 'Trailing Init Forms',
            'trio': 'Trailing Init Obj Forms',
            'trip': 'Trailing Init Punctuation',
            'truc': 'Trailing UC Forms',
            'trul': 'Trailing Lowercase',
            'tsub': 'Trailing Subscripts',
            'tvar': 'Trailing Variation',
            'twid': 'Third Width',
            'unic': 'Unicase',
            'valt': 'Alternate Vertical Forms',
            'vatu': 'Vattu Variants',
            'vchg': 'Vertical Change',
            'vcmp': 'Vertical Composites',
            'vkna': 'Vertical Kana Alternates',
            'vkrn': 'Vertical Kerning',
            'vpal': 'Vertical Positioning Alternates',
            'vrt2': 'Vertical Rotation & Alternates #2',
            'vrt': 'Vertical Rotation',
            'vrtr': 'Vertical Right-to-Left',
            'zero': 'Slashed Zero'
        };

        return featureDescriptions[tag] || tag;
    }

    /**
     * Normalize font format name
     *
     * @param {string} extension - File extension
     * @returns {string} - Normalized format name
     * @private
     */
    normalizeFormatName(extension) {
        const formatMap = {
            'ttf': 'TrueType (TTF)',
            'otf': 'OpenType (OTF)',
            'woff': 'Web Open Font Format (WOFF)',
            'woff2': 'Web Open Font Format 2 (WOFF2)'
        };

        return formatMap[extension.toLowerCase()] || extension.toUpperCase();
    }

    /**
     * Get list of supported file extensions
     *
     * Returns all font file extensions that this processor can handle.
     * Used by the file scanner to route files to the appropriate processor.
     *
     * Supported formats:
     * - TTF (TrueType Font) - Desktop font format
     * - OTF (OpenType Font) - Advanced desktop font format
     * - WOFF (Web Open Font Format) - Compressed web font
     * - WOFF2 (Web Open Font Format 2) - Better compressed web font
     *
     * Note: TTC (TrueType Collection) and OTC (OpenType Collection) are
     * also supported by fontkit but not included in the extension list
     * as they're less common.
     *
     * @returns {string[]} Array of supported file extensions (lowercase, without dots)
     *
     * @example
     * const extensions = processor.getSupportedExtensions();
     * // ['ttf', 'otf', 'woff', 'woff2']
     */
    getSupportedExtensions() {
        return ['ttf', 'otf', 'woff', 'woff2'];
    }

    /**
     * Get list of supported MIME types
     *
     * Returns MIME types that this processor can handle.
     * Used for file type detection when extension is ambiguous or missing.
     *
     * Includes both modern standard MIME types (font/ttf, font/woff)
     * and legacy application/* types for broader compatibility.
     *
     * @returns {string[]} Array of supported MIME types
     *
     * @see https://www.iana.org/assignments/media-types/media-types.xhtml#font - IANA font MIME types
     *
     * @example
     * const mimeTypes = processor.getSupportedMimeTypes();
     * // [
     * //   'font/ttf',
     * //   'font/otf',
     * //   'application/x-font-ttf',
     * //   'application/x-font-opentype',
     * //   'font/woff',
     * //   'application/x-font-woff',
     * //   'font/woff2',
     * //   'application/x-font-woff2'
     * // ]
     */
    getSupportedMimeTypes() {
        return [
            'font/ttf',
            'font/otf',
            'application/x-font-ttf',
            'application/x-font-opentype',
            'font/woff',
            'application/x-font-woff',
            'font/woff2',
            'application/x-font-woff2'
        ];
    }
}

module.exports = FontProcessor;
