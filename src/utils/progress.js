/**
 * Progress Tracker
 * Tracks and reports processing progress
 */

class ProgressTracker {
    constructor() {
        this.total = 0;
        this.current = 0;
        this.startTime = null;
        this.currentFile = null;
        this.callbacks = [];
    }

    /**
     * Start tracking progress
     */
    start(total) {
        this.total = total;
        this.current = 0;
        this.startTime = Date.now();
        this.emit('start', { total });
    }

    /**
     * Update progress
     */
    update(currentFile = null) {
        this.current++;
        this.currentFile = currentFile;

        const percentage = (this.current / this.total) * 100;
        const elapsed = Date.now() - this.startTime;
        const estimatedTotal = (elapsed / this.current) * this.total;
        const remaining = estimatedTotal - elapsed;

        this.emit('progress', {
            current: this.current,
            total: this.total,
            percentage: percentage.toFixed(2),
            elapsed,
            remaining,
            currentFile
        });
    }

    /**
     * Complete progress tracking
     */
    complete() {
        const duration = Date.now() - this.startTime;

        this.emit('complete', {
            total: this.total,
            duration,
            averageTime: duration / this.total
        });
    }

    /**
     * Register callback
     */
    on(event, callback) {
        this.callbacks.push({ event, callback });
    }

    /**
     * Emit event
     */
    emit(event, data) {
        for (const cb of this.callbacks) {
            if (cb.event === event) {
                cb.callback(data);
            }
        }
    }

    /**
     * Get current progress
     */
    getProgress() {
        const percentage = (this.current / this.total) * 100;
        const elapsed = Date.now() - this.startTime;

        return {
            current: this.current,
            total: this.total,
            percentage: percentage.toFixed(2),
            elapsed,
            currentFile: this.currentFile
        };
    }

    /**
     * Format time
     */
    static formatTime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }
}

module.exports = ProgressTracker;
