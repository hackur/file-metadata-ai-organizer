/**
 * Video Processor
 * Extracts metadata from video files using ffprobe
 */

const BaseProcessor = require('./BaseProcessor');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

class VideoProcessor extends BaseProcessor {
    constructor(config = {}) {
        super(config);
        this.ffprobePath = config.ffprobePath || 'ffprobe';
    }

    canProcess(fileInfo) {
        return fileInfo.category === 'video';
    }

    async process(fileInfo) {
        const startTime = Date.now();
        this.logStart(fileInfo);

        try {
            if (!await this.validate(fileInfo)) {
                return fileInfo;
            }

            if (!fileInfo.metadata) fileInfo.metadata = {};
            fileInfo.metadata.video = {};

            // Extract metadata using ffprobe
            await this.extractVideoMetadata(fileInfo);

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
     * Extract video metadata using ffprobe
     */
    async extractVideoMetadata(fileInfo) {
        try {
            const args = [
                '-v', 'quiet',
                '-print_format', 'json',
                '-show_format',
                '-show_streams',
                fileInfo.path
            ];

            const { stdout } = await execFileAsync(this.ffprobePath, args);
            const data = JSON.parse(stdout);

            // Extract format information
            if (data.format) {
                fileInfo.metadata.video.duration = parseFloat(data.format.duration) || null;
                fileInfo.metadata.video.bitrate = parseInt(data.format.bit_rate) || null;
                fileInfo.metadata.video.container = data.format.format_name;
                fileInfo.metadata.video.formatLongName = data.format.format_long_name;

                // Extract metadata tags
                if (data.format.tags) {
                    fileInfo.metadata.video.tags = {
                        title: data.format.tags.title,
                        artist: data.format.tags.artist,
                        album: data.format.tags.album,
                        date: data.format.tags.date,
                        comment: data.format.tags.comment,
                        encoder: data.format.tags.encoder
                    };
                }
            }

            // Extract stream information
            if (data.streams && data.streams.length > 0) {
                fileInfo.metadata.video.streams = [];

                const videoStream = data.streams.find(s => s.codec_type === 'video');
                if (videoStream) {
                    fileInfo.metadata.video.width = videoStream.width;
                    fileInfo.metadata.video.height = videoStream.height;
                    fileInfo.metadata.video.codec = videoStream.codec_name;
                    fileInfo.metadata.video.codecLongName = videoStream.codec_long_name;
                    fileInfo.metadata.video.profile = videoStream.profile;

                    // Calculate frame rate
                    if (videoStream.r_frame_rate) {
                        const [num, den] = videoStream.r_frame_rate.split('/').map(Number);
                        fileInfo.metadata.video.frameRate = den ? num / den : num;
                    }

                    // Pixel format and color information
                    fileInfo.metadata.video.pixelFormat = videoStream.pix_fmt;
                    fileInfo.metadata.video.colorSpace = videoStream.color_space;
                    fileInfo.metadata.video.colorRange = videoStream.color_range;

                    // Display aspect ratio
                    if (videoStream.display_aspect_ratio) {
                        fileInfo.metadata.video.aspectRatio = videoStream.display_aspect_ratio;
                    }
                }

                const audioStream = data.streams.find(s => s.codec_type === 'audio');
                if (audioStream) {
                    fileInfo.metadata.video.audioCodec = audioStream.codec_name;
                    fileInfo.metadata.video.audioChannels = audioStream.channels;
                    fileInfo.metadata.video.audioSampleRate = audioStream.sample_rate;
                    fileInfo.metadata.video.audioBitrate = parseInt(audioStream.bit_rate);
                }

                // Store all streams for detailed analysis
                fileInfo.metadata.video.streams = data.streams.map(stream => ({
                    type: stream.codec_type,
                    codec: stream.codec_name,
                    index: stream.index
                }));
            }

        } catch (error) {
            throw new Error(`Failed to extract video metadata: ${error.message}`);
        }
    }

    getSupportedExtensions() {
        return ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'mpg', 'mpeg', '3gp', 'ogv'];
    }

    getSupportedMimeTypes() {
        return ['video/mp4', 'video/x-msvideo', 'video/x-matroska', 'video/quicktime', 'video/webm'];
    }
}

module.exports = VideoProcessor;
