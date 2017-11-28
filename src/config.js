const _sdkVersion = require('./__sdk');

const SERVER_PLAN_PREMIUM_MONTHLY = 'icebear_premium_monthly';
const SERVER_PLAN_PREMIUM_YEARLY = 'icebear_premium_yearly';
const SERVER_PLAN_PRO_MONTHLY = 'icebear_pro_monthly';
const SERVER_PLAN_PRO_YEARLY = 'icebear_pro_yearly';

/**
 * Configuration module.
 * Exists just to collect most of the app configuration aspects in one place.
 *
 * **Following properties have to be set before client app starts using Icebear SDK.**
 * Best to do it in your local config.js
 *
 * - socketServerUrl
 * - ghostFrontendUrl
 * - appVersion
 * - platform
 * - FileStream
 * - StorageEngine
 *
 * @module config
 * @public
 */
class UploadConfig {
    /**
     * For reference. Table of chunk sizes based on file sizes.
     * Is not supposed to be changed ever.
     * If you do change it for some reason - remember to restart paused uploads as file chunk size might change.
     * @member {Array<{maxFileSize: ?number, chunkSize: number}>} upload.chunkSizes
     * @memberof config
     * @public
     */
    get chunkSizes() {
        return [
            // up to ~10Mb file
            { maxFileSize: 192 * 1024 * 54, chunkSize: 192 * 1024 },
            // up to ~25Mb file
            { maxFileSize: 256 * 1024 * 100, chunkSize: 256 * 1024 },
            // up to ~50Mb file
            { maxFileSize: 384 * 1024 * 134, chunkSize: 384 * 1024 },
            // up to ~250Mb file
            { maxFileSize: 512 * 1024 * 300, chunkSize: 512 * 1024 },
            // above 250Mb
            { maxFileSize: null, chunkSize: 768 * 1024 }
        ];
    }

    /**
     * Finds which chunk size to use for given file size based on {@link chunkSizes} reference table.
     * @function upload.getChunkSize
     * @param {number} fileSize - in bytes.
     * @returns {number} chunk size to use, in bytes.
     * @memberof config
     * @public
     */
    getChunkSize(fileSize) {
        const data = this.chunkSizes;
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            if (row.maxFileSize === null) return row.chunkSize;
            if (fileSize > row.maxFileSize) continue;
            return row.chunkSize;
        }
        throw new Error('Ups. This should not have ever happen. We could not detect chunk size to use for upload.');
    }

    /**
     * Max amount of bytes to buffer from disk for encrypting.
     * This number can't be less than maximum chunk size.
     * @member {number} upload.encryptBufferSize
     * @memberof config
     * @public
     */
    encryptBufferSize = 1024 * 1024;
    /**
     * Max amount of chunks to pre-encrypt for sending
     * This number can't be less than maximum chunk size.
     * @member {number} upload.uploadBufferSize
     * @memberof config
     * @public
     */
    uploadBufferSize = 1024 * 1024;

    /**
     * Max amount of uploaded chunks per one file waiting for server response.
     * When reached this number, uploader will wait for at least one chunk to get a response.
     * Bigger number = faster upload = more pressure on server.
     * 0-5 is a reasonable range to pick. Default is 2.
     * @member {number} upload.uploadBufferSize
     * @memberof config
     * @public
     */
    maxResponseQueue = 2;
}

const config = new class {
    sdkVersion = _sdkVersion;

    // debug = {
    //     /**
    //      * Traffic stat summary will be logged with this interval (ms.)
    //      * @member {number} debug.trafficReportInterval
    //      * @memberof config
    //      * @public
    //      */
    //     trafficReportInterval: 5 * 60 * 1000,
    //     /**
    //      * All socket messages will be logged if set to `true` before socket is started.
    //      * @member {boolean} debug.socketLogEnabled
    //      * @memberof config
    //      * @public
    //      */
    //     socketLogEnabled: false
    // };

    /**
     * App server connection url. (wss://)
     *
     * **Client app is required to set this property before using Icebear SDK.**
     * @member {string}
     * @memberof config
     * @public
     */
    socketServerUrl = 'wss://';

    /**
     * Ghost website url. (https://)
     *
     * **Client app is required to set this property before using Icebear SDK.**
     * @member {string}
     * @memberof config
     * @public
     */
    ghostFrontendUrl = 'https://';

    /**
     * Application version (semver).
     * Will be used by server to detect deprecated client versions.
     *
     * **Client app is required to set this property before using Icebear SDK.**
     * @member {string}
     * @memberof config
     * @public
     */
    appVersion = '';

    /**
     * Strictly one of: 'electron', 'outlook', 'android', 'ios', 'browser',
     * unless server has been updated to support more platform strings and this documentation wasn't :-P
     *
     * **Client app is required to set this property before using Icebear SDK.**
     * @member {string}
     * @memberof config
     * @public
     */
    platform = '';

    /**
     * For reference. Amount of bytes added to every file chunk in encrypted state.
     * DO NOT change this value unless you really know what you're doing.
     * @returns {number} 32
     * @memberof config
     * @public
     */
    get CHUNK_OVERHEAD() { return 32; }

    upload = new UploadConfig();

    download = {
        /**
         * Max amount of bytes to download at once for further processing.
         * File gets downloaded in 'downloadChunks' and then broken down to the chunk size it was uploaded with.
         * This number can't be less than maximum chunk size.
         * @member {number} download.maxDownloadChunkSize
         * @memberof config
         * @public
         */
        maxDownloadChunkSize: 1024 * 1024,
        /**
         * Max amount of bytes to download and queue for decryption.
         * This number can't be less than maximum chunk size.
         * @member {number} download.maxDecryptBufferSize
         * @memberof config
         * @public
         */
        maxDecryptBufferSize: 1024 * 1024 * 3
    };

    /**
     * File stream implementation class.
     *
     * **Client app is required to set this property before using Icebear SDK.**
     * @member {FileStreamAbstract}
     * @memberof config
     * @public
     */
    FileStream = null;
    /**
     * Storage engine implementation class.
     *
     * **Client app is required to set this property before using Icebear SDK.**
     * @member {StorageEngineInterface}
     * @memberof config
     * @public
     */
    StorageEngine = null;
    /**
     * Frequency (seconds) at which default observable clock will be changing its value.
     * Default clock can be used for refreshing timestamps and other time counters.
     * Do not set this value too low, create custom clocks instead.
     * @member {number}
     * @memberof config
     * @public
     */
    observableClockEventFrequency = 30; // seconds

    /**
     * Server plans ids
     * @member {Array<string>}
     * @memberof config
     * @public
     */
    serverPlans = [
        SERVER_PLAN_PREMIUM_MONTHLY,
        SERVER_PLAN_PREMIUM_YEARLY,
        SERVER_PLAN_PRO_MONTHLY,
        SERVER_PLAN_PRO_YEARLY
    ];

    /**
     * Server premium plans ids
     * @member {Array<string>}
     * @memberof config
     * @public
     */
    serverPlansPremium = [SERVER_PLAN_PREMIUM_MONTHLY, SERVER_PLAN_PREMIUM_YEARLY];

    /**
     * Server pro plans ids
     * @member {Array<string>}
     * @memberof config
     * @public
     */
    serverPlansPro = [SERVER_PLAN_PRO_MONTHLY, SERVER_PLAN_PRO_YEARLY];

    basicMaxSingleFileUploadSize = 512 * 1024 * 1024;
    premiumMaxSingleFileUploadSize = 2048 * 1024 * 1024;

    chat = {
        /**
         * Maximum amount of chats to load initially. Favorite chats will ignore this and load in full number.
         * @member {number} chat.maxInitialChats
         * @memberof config
         * @public
         */
        maxInitialChats: 15,
        /**
         * Amount of messages to load to a chat initially.
         * @member {number} chat.initialPageSize
         * @memberof config
         * @public
         */
        initialPageSize: 40,
        /**
         * When navigating chat history, load this amount of messages per page.
         * @member {number} chat.pageSize
         * @memberof config
         * @public
         */
        pageSize: 30,
        /**
         * Icebear will unload messages over this limit, resulting is low memory consumption when navigating history
         * or chatting normally.
         * @member {number} chat.maxLoadedMessages
         * @memberof config
         * @public
         */
        maxLoadedMessages: 130,
        /**
         * Delay (ms) between decryption of individual messages when processing a batch.
         * Increase to get more responsiveness, but increase page load time.
         * @member {number} chat.decryptQueueThrottle
         * @memberof config
         * @public
         */
        decryptQueueThrottle: 0,
        /**
         * Maximum amount of recent files to maintain in chat object to be able to display the list on UI.
         * @member {number} chat.recentFilesDisplayLimit
         * @memberof config
         * @public
         */
        recentFilesDisplayLimit: 10,
        /**
         * Maximum number of characters chat name can have.
         * Do not override this in clients, it's supposed to be a system limit.
         * @member {number} chat.maxChatNameLength
         * @memberof config
         * @readonly
         * @public
         */
        maxChatNameLength: 24,
        /**
         * Maximum number of characters chat purpose can have.
         * Do not override this in clients, it's supposed to be a system limit.
         * @member {number} chat.maxChatPurposeLength
         * @memberof config
         * @readonly
         * @public
         */
        maxChatPurposeLength: 120,
        /**
         * Maximum number of bytes inline image can have (both peerio file and external)
         * to allow auto-downloading and showing it inline with "show big files" enabled
         * or with manual "Display this image"
         * @member {number} chat.inlineImageSizeLimit
         * @memberof config
         * @readonly
         * @public
         */
        inlineImageSizeLimit: 10 * 1024 * 1024,
        /**
         * Image bigger than this is not downloaded inline even with manual "Display this image"
         * @member {number} chat.inlineImageSizeLimitCutoff
         * @memberof config
         * @readonly
         * @public
         */
        inlineImageSizeLimitCutoff: 30 * 1024 * 1024,
        allowedInlineContentTypes: {
            'image/jpeg': true,
            'image/bmp': true,
            'image/gif': true,
            'image/pjpeg': true,
            'image/png': true
        }
    };

    unfurlTimeout = 30000;
}();


module.exports = config;
