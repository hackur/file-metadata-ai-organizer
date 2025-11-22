/**
 * Configuration Manager
 * Loads and manages application configuration from multiple sources:
 * - Default configuration
 * - User configuration file
 * - Environment variables
 * - Command-line arguments
 */

const fs = require('fs').promises;
const path = require('path');

class ConfigManager {
    constructor() {
        this.config = null;
        this.defaultConfigPath = path.join(__dirname, '../../config.default.json');
        this.userConfigPath = path.join(__dirname, '../../config.json');
    }

    /**
     * Load configuration from all sources
     * Priority: CLI args > ENV vars > User config > Default config
     */
    async load(cliArgs = {}) {
        const defaultConfig = await this.loadDefaultConfig();
        const userConfig = await this.loadUserConfig();
        const envConfig = this.loadEnvConfig();

        this.config = this.mergeConfigs(defaultConfig, userConfig, envConfig, cliArgs);
        return this.config;
    }

    /**
     * Load default configuration
     */
    async loadDefaultConfig() {
        try {
            const content = await fs.readFile(this.defaultConfigPath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            console.warn('Could not load default config, using minimal defaults');
            return this.getMinimalDefaults();
        }
    }

    /**
     * Load user configuration if it exists
     */
    async loadUserConfig() {
        try {
            const content = await fs.readFile(this.userConfigPath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            return {};
        }
    }

    /**
     * Load configuration from environment variables
     * Format: FMAO_SECTION_KEY (e.g., FMAO_LOGGING_LEVEL)
     */
    loadEnvConfig() {
        const envConfig = {};
        const prefix = 'FMAO_';

        for (const [key, value] of Object.entries(process.env)) {
            if (key.startsWith(prefix)) {
                const configPath = key.slice(prefix.length).toLowerCase().split('_');
                this.setNestedValue(envConfig, configPath, this.parseValue(value));
            }
        }

        return envConfig;
    }

    /**
     * Deep merge multiple configuration objects
     */
    mergeConfigs(...configs) {
        return configs.reduce((merged, config) => {
            return this.deepMerge(merged, config);
        }, {});
    }

    /**
     * Deep merge two objects
     */
    deepMerge(target, source) {
        const result = { ...target };

        for (const key in source) {
            if (source[key] instanceof Object && key in target) {
                result[key] = this.deepMerge(target[key], source[key]);
            } else {
                result[key] = source[key];
            }
        }

        return result;
    }

    /**
     * Set nested value in object from array path
     */
    setNestedValue(obj, path, value) {
        let current = obj;
        for (let i = 0; i < path.length - 1; i++) {
            if (!(path[i] in current)) {
                current[path[i]] = {};
            }
            current = current[path[i]];
        }
        current[path[path.length - 1]] = value;
    }

    /**
     * Parse string value to appropriate type
     */
    parseValue(value) {
        if (value === 'true') return true;
        if (value === 'false') return false;
        if (!isNaN(value) && value !== '') return Number(value);
        return value;
    }

    /**
     * Get minimal default configuration
     */
    getMinimalDefaults() {
        return {
            scanning: {
                maxDepth: -1,
                respectGitignore: true,
                parallelProcessing: true,
                maxConcurrency: 4
            },
            storage: {
                type: 'json',
                dbPath: './data/metadata.db',
                jsonPath: './data/metadata.json'
            },
            logging: {
                level: 'info',
                enableConsole: true
            }
        };
    }

    /**
     * Get configuration value by path
     * @param {string} path - Dot-separated path (e.g., 'scanning.maxDepth')
     * @param {*} defaultValue - Default value if not found
     */
    get(path, defaultValue = null) {
        const keys = path.split('.');
        let value = this.config;

        for (const key of keys) {
            if (value && key in value) {
                value = value[key];
            } else {
                return defaultValue;
            }
        }

        return value;
    }

    /**
     * Set configuration value by path
     */
    set(path, value) {
        const keys = path.split('.');
        this.setNestedValue(this.config, keys, value);
    }

    /**
     * Get entire configuration
     */
    getAll() {
        return this.config;
    }

    /**
     * Save current configuration to user config file
     */
    async save() {
        const content = JSON.stringify(this.config, null, 2);
        await fs.writeFile(this.userConfigPath, content, 'utf8');
    }

    /**
     * Validate configuration
     */
    validate() {
        const errors = [];

        if (this.config.scanning.maxConcurrency < 1) {
            errors.push('scanning.maxConcurrency must be at least 1');
        }

        if (!['sqlite', 'json', 'both'].includes(this.config.storage.type)) {
            errors.push('storage.type must be "sqlite", "json", or "both"');
        }

        if (!['debug', 'info', 'warn', 'error'].includes(this.config.logging.level)) {
            errors.push('logging.level must be one of: debug, info, warn, error');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}

module.exports = new ConfigManager();
