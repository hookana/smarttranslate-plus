// Logger utility for consistent error handling and debugging

const Logger = {
    debugMode: false, // Set to false to disable debug/info logging

    isDevelopment: () => {
        try {
            return chrome.storage && chrome.storage.local ?
                new Promise((resolve) => {
                    chrome.storage.local.get(['geminiDebugMode'], (r) => {
                        resolve(!!(r && r.geminiDebugMode));
                    });
                }) : Promise.resolve(false);
        } catch (e) {
            return Promise.resolve(false);
        }
    },

    log: async (message, data = null) => {
        const isDev = await Logger.isDevelopment();
        if (isDev && Logger.debugMode) {
            console.log('[SmartTranslate]', message, data || '');
        }
    },

    error: (message, error = null, showToast = false) => {
        // Log error message and stack (if available) for better debugging
        try {
            if (error && error.stack) {
                console.error('[SmartTranslate] ERROR:', message, error.message || error, '\nStack:', error.stack);
            } else {
                console.error('[SmartTranslate] ERROR:', message, error || '');
            }
        } catch (e) {
            try { console.error('[SmartTranslate] ERROR (logging failed):', message, error); } catch (_) { }
        }

        // Show toast if requested and UI is available
        if (showToast) {
            if (typeof UI !== 'undefined' && UI.showToast) {
                UI.showToast(message, 'error');
            } else if (typeof SmartTranslate !== 'undefined' && SmartTranslate.UI && SmartTranslate.UI.showToast) {
                SmartTranslate.UI.showToast(message, 'error');
            } else if (typeof window !== 'undefined' && window.showToast) {
                window.showToast(message, 'error');
            }
        }
    },

    warn: (message, data = null) => {
        if (Logger.debugMode) {
            console.warn('[SmartTranslate]', message, data || '');
        }
    },

    info: (message, data = null) => {
        if (Logger.debugMode) {
            console.info('[SmartTranslate]', message, data || '');
        }
    },

    debug: (message, data = null) => {
        if (Logger.debugMode === true) {
            console.log('[SmartTranslate] DEBUG', message, data || '');
        }
    }
};

// Ensure all methods exist as a defensive measure
if (!Logger.debug) Logger.debug = (msg, data) => console.log('[SmartTranslate] DEBUG', msg, data || '');
if (!Logger.info) Logger.info = (msg, data) => console.info('[SmartTranslate]', msg, data || '');
if (!Logger.warn) Logger.warn = (msg, data) => console.warn('[SmartTranslate]', msg, data || '');
if (!Logger.error) Logger.error = (msg, err) => console.error('[SmartTranslate] ERROR:', msg, err || '');
if (!Logger.log) Logger.log = async (msg, data) => console.log('[SmartTranslate]', msg, data || '');

// Export
if (typeof window !== 'undefined') {
    window.Logger = Logger;
}
