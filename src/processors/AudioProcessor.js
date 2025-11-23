/**
 * Audio Processor
 * Extracts metadata from audio files
 */

const BaseProcessor = require('./BaseProcessor');

class AudioProcessor extends BaseProcessor {
    constructor(config = {}) {
        super(config);
        this.musicMetadata = null;
    }

    async ensureMusicMetadata() {
        if (!this.musicMetadata) {
            this.musicMetadata = await import('music-metadata');
        }
        return this.musicMetadata;
    }

    canProcess(fileInfo) {
        return fileInfo.category === 'audio';
    }

    /**
     * Initialize audio-specific metadata structure
     *
     * @param {Object} fileInfo - File information object
     */
    initializeMetadata(fileInfo) {
        super.initializeMetadata(fileInfo);
        fileInfo.metadata.audio = {};
    }

    /**
     * Extract audio metadata using music-metadata
     * Implements BaseProcessor.extractMetadata() template method
     *
     * @param {Object} fileInfo - File information object
     * @returns {Promise<void>}
     */
    async extractMetadata(fileInfo) {
        try {
            const mm = await this.ensureMusicMetadata();
            const metadata = await mm.parseFile(fileInfo.path);

            // Extract format information
            if (metadata.format) {
                fileInfo.metadata.audio.duration = metadata.format.duration;
                fileInfo.metadata.audio.bitrate = metadata.format.bitrate;
                fileInfo.metadata.audio.sampleRate = metadata.format.sampleRate;
                fileInfo.metadata.audio.channels = metadata.format.numberOfChannels;
                fileInfo.metadata.audio.codec = metadata.format.codec;
                fileInfo.metadata.audio.codecProfile = metadata.format.codecProfile;
                fileInfo.metadata.audio.container = metadata.format.container;
                fileInfo.metadata.audio.lossless = metadata.format.lossless;
            }

            // Extract tags (ID3, Vorbis Comments, etc.)
            if (metadata.common) {
                fileInfo.metadata.audio.tags = {
                    title: metadata.common.title,
                    artist: metadata.common.artist,
                    artists: metadata.common.artists,
                    album: metadata.common.album,
                    albumArtist: metadata.common.albumartist,
                    year: metadata.common.year,
                    genre: metadata.common.genre,
                    track: metadata.common.track?.no,
                    trackTotal: metadata.common.track?.of,
                    disk: metadata.common.disk?.no,
                    diskTotal: metadata.common.disk?.of,
                    composer: metadata.common.composer,
                    comment: metadata.common.comment,
                    copyright: metadata.common.copyright,
                    encodedBy: metadata.common.encodedby,
                    isrc: metadata.common.isrc,
                    bpm: metadata.common.bpm
                };

                // Extract embedded picture/artwork info (not the data itself)
                if (metadata.common.picture && metadata.common.picture.length > 0) {
                    fileInfo.metadata.audio.hasArtwork = true;
                    fileInfo.metadata.audio.artworkInfo = {
                        count: metadata.common.picture.length,
                        format: metadata.common.picture[0].format,
                        description: metadata.common.picture[0].description
                    };
                }
            }

            // Extract technical quality information
            if (metadata.quality) {
                fileInfo.metadata.audio.quality = metadata.quality;
            }

        } catch (error) {
            throw new Error(`Failed to extract audio metadata: ${error.message}`);
        }
    }

    getSupportedExtensions() {
        return ['mp3', 'flac', 'wav', 'ogg', 'opus', 'm4a', 'aac', 'wma', 'ape', 'wv', 'mpc'];
    }

    getSupportedMimeTypes() {
        return ['audio/mpeg', 'audio/flac', 'audio/wav', 'audio/ogg', 'audio/opus', 'audio/aac', 'audio/x-m4a'];
    }
}

module.exports = AudioProcessor;
