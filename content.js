// Main content script for SmartTranslate extension
// Refactored to use modular architecture

// Load configuration and utilities first
// Note: These should be loaded in order via manifest.json

// Ensure Logger is silent in production environment
window.Logger = window.Logger || {};
window.Logger.debug = () => { };
window.Logger.info = () => { };
window.Logger.warn = () => { };
window.Logger.log = async () => { };
if (!window.Logger.error) window.Logger.error = (msg, err) => console.error('[SmartTranslate] ERROR:', msg, err || '');

// Setup retry counter to avoid console spam
let setupRetryCount = 0;

// Initialize extension
async function setup() {
    try {
        // Ensure all modules are available
        if (typeof UI === 'undefined' || typeof Selection === 'undefined' || typeof Api === 'undefined') {
            setupRetryCount++;
            // Only log the first 2 retries to avoid console spam
            if (setupRetryCount <= 2) {
                Logger.error('Required modules not loaded (attempt ' + setupRetryCount + '). UI:', typeof UI, 'Selection:', typeof Selection, 'Api:', typeof Api);
            }
            // Max 50 retries (5 seconds) before giving up
            if (setupRetryCount >= 50) {
                Logger.error('Failed to load required modules after 50 attempts');
                return;
            }
            setTimeout(setup, 100); // Retry after a delay
            return;
        }

        // Reset counter on successful load
        setupRetryCount = 0;

        // Initialize API with stored key
        await Api.init();

        // Initialize enabled state from storage
        try {
            const url = new URL(window.location.href);
            const domain = url.hostname;
            const key = `smartTranslate_${domain}`;
            const result = await chrome.storage.local.get(key);
            const isEnabled = result[key] === undefined ? true : result[key];
            if (typeof UI !== 'undefined' && UI.setEnabled) {
                UI.setEnabled(isEnabled);
            }
        } catch (e) {
            Logger.warn('Could not load enabled state', e);
        }

        // Consolidated message listener
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            const type = message?.type;

            // 1. Sync handlers
            if (type === 'smarttranslate:ping') {
                sendResponse({ ok: true });
                return false;
            }
            if (type === 'smarttranslate:api-key-updated') {
                Api.updateApiKey('gemini', message.apiKey);
                sendResponse({ success: true });
                return false;
            }
            if (type === 'smarttranslate:api-keys-updated') {
                Api.handleApiKeysUpdated(message.apiKeys || {}, message.defaultProvider);
                sendResponse({ success: true });
                return false;
            }
            if (type === 'smarttranslate:model-updated') {
                Api.handleModelUpdated(message.model);
                sendResponse({ success: true });
                return false;
            }
            if (type === 'smarttranslate:token-usage-updated') {
                try { if (UI && typeof UI.updateTokenUsage === 'function') UI.updateTokenUsage(); } catch (e) { }
                sendResponse({ success: true });
                return false;
            }
            if (type === 'smarttranslate:state-change') {
                if (typeof UI !== 'undefined' && UI.setEnabled) UI.setEnabled(message.enabled);
                if (message.enabled) {
                    if (typeof UI !== 'undefined' && UI.ensureFloatingButton) {
                        UI.ensureFloatingButton().catch(e => Logger.error('Error ensuring floating button', e));
                    }
                } else {
                    if (typeof UI !== 'undefined' && UI.floatingButtonInstance) {
                        UI.floatingButtonInstance.unmount();
                        UI.floatingButtonInstance = null;
                    }
                    if (typeof UI !== 'undefined' && UI.hidePopup) UI.hidePopup();
                }
                sendResponse({ success: true });
                return false;
            }
            if (type === 'smarttranslate:back-translation-updated') {
                if (typeof UI !== 'undefined' && UI.syncBackTranslation) UI.syncBackTranslation(message.enabled);
                sendResponse({ success: true });
                return false;
            }
            if (type === 'smarttranslate:floating-button-visibility') {
                if (typeof UI !== 'undefined') {
                    if (message.show) {
                        UI.ensureFloatingButton(true).catch(() => { });
                    } else if (UI.floatingButtonInstance) {
                        UI.floatingButtonInstance.unmount();
                        UI.floatingButtonInstance = null;
                    }
                }
                sendResponse({ success: true });
                return false;
            }

            // 2. Async handlers
            if (type === 'smarttranslate:translate-selection') {
                // To avoid redundant API calls, if text is already provided, 
                // we only process it in the Top Frame.
                if (message.selection && window.self !== window.top) {
                    sendResponse({ ok: false, error: 'skipped-subframe' });
                    return false;
                }

                (async () => {
                    try {
                        let selectionText = message.selection ? String(message.selection).trim() : '';
                        if (!selectionText) {
                            // Add a timeout to ensure selection detection doesn't hang the entire process
                            const selectionPromise = (async () => {
                                if (Selection && typeof Selection.getSelectionTextIncludingIframes === 'function') {
                                    return Selection.getSelectionTextIncludingIframes() || '';
                                }
                                return '';
                            })();

                            const timeoutPromise = new Promise(resolve => setTimeout(() => resolve('timeout'), 2000));
                            const result = await Promise.race([selectionPromise, timeoutPromise]);

                            if (result === 'timeout') {
                                Logger.warn('Selection recognition timed out');
                                selectionText = '';
                            } else {
                                selectionText = result;
                            }
                        }

                        if (!selectionText) {
                            sendResponse({ ok: false, error: 'no-selection', frame: window.self === window.top ? 'top' : 'sub' });
                            return;
                        }

                        Selection.setCurrentSelection(selectionText);
                        const targetLang = message.targetLang || 'en';
                        const isProofread = message.isProofread !== undefined ? message.isProofread : null;

                        // Respect stored source language if available
                        const storedSource = await Storage.get('smarttranslate_source_language');
                        const sourceLang = message.sourceLang || storedSource || 'auto';

                        const result = await Api.translate(selectionText, targetLang, isProofread, sourceLang);
                        if (result.error) {
                            sendResponse({ ok: false, error: result.error });
                        } else {
                            sendResponse({ ok: true, text: result.text, tokens: result.tokens });
                        }
                    } catch (e) {
                        Logger.error('Error in translate-selection', e);
                        sendResponse({ ok: false, error: e.message || 'internal-error' });
                    }
                })();
                return true;
            }

            if (type === 'smarttranslate:summarize-selection') {
                (async () => {
                    try {
                        let selectionText = message.selection ? String(message.selection).trim() : '';
                        if (!selectionText) {
                            selectionText = await Selection.getSelectionTextIncludingIframes() || '';
                        }

                        if (!selectionText) {
                            sendResponse({ ok: false, error: 'no-selection' });
                            return;
                        }

                        const targetLang = message.targetLang || (await Storage.getUserLanguage()) || 'en';
                        const result = await Api.summarize(selectionText, false, targetLang);
                        if (result.error) {
                            sendResponse({ ok: false, error: result.error });
                        } else {
                            sendResponse({ ok: true, text: result.text, tokens: result.tokens });
                        }
                    } catch (e) {
                        Logger.error('Error in summarize-selection', e);
                        sendResponse({ ok: false, error: e.message || 'internal-error' });
                    }
                })();
                return true;
            }

            if (type === 'smarttranslate:summarize-page') {
                (async () => {
                    try {
                        // Extract page content including iframes
                        const pageText = Selection.getPageTextIncludingIframes().substring(0, CONFIG.MAX_INPUT_LENGTH);

                        if (!pageText) {
                            sendResponse({ ok: false, error: 'No content found on page' });
                            return;
                        }

                        const targetLang = message.targetLang || (await Storage.getUserLanguage()) || 'en';
                        const result = await Api.summarize(pageText, true, targetLang);
                        if (result.error) {
                            sendResponse({ ok: false, error: result.error });
                        } else {
                            sendResponse({ ok: true, text: result.text, tokens: result.tokens });
                        }
                    } catch (e) {
                        Logger.error('Error in summarize-page', e);
                        sendResponse({ ok: false, error: e.message || 'internal-error' });
                    }
                })();
                return true;
            }

            if (type === 'smarttranslate:show-popup') {
                // Ensure only the top frame opens the popup to avoid nested popups in iframes
                if (window.self !== window.top) {
                    return false;
                }

                (async () => {
                    try {
                        let selectionText = message.selection || '';

                        // If forceClear is true, we strictly want empty selection
                        if (message.forceClear) {
                            selectionText = '';
                            Selection.clearSelection();
                        }
                        // Otherwise, if selection is empty, try to get current selection
                        else if (!selectionText || !selectionText.trim()) {
                            selectionText = Selection.getSelectionTextIncludingIframes() || '';
                            if (!selectionText || !selectionText.trim()) {
                                Selection.clearSelection();
                                selectionText = '';  // Ensure it's empty
                            }
                        }

                        // Only set selection if we have text
                        if (selectionText && selectionText.trim()) {
                            Selection.setCurrentSelection(selectionText.trim());
                        }

                        let x = 20, y = 20;

                        // Use coordinates from message if available (from SelectionIndicator)
                        if (message.x !== undefined && message.y !== undefined) {
                            // If these are screen coordinates (from iframe), we need to map them to window client coords
                            // But since the popup is fixed position, client coords are what we need.
                            // If message came from iframe using screenX/Y, we approximate.
                            // For simplicity, let's assume message.x/y are SCREEN coordinates if they are large, 
                            // or Client coordinates if they are small? 
                            // Actually, let's rely on the fact that for a fixed popup, we want client coordinates relative to TOP window.

                            // If message came from iframe, it sent screen coordinates.
                            // Convert screen to client:
                            if (window.screenLeft !== undefined) {
                                x = message.x - window.screenLeft;
                                y = message.y - window.screenTop;
                            } else {
                                x = message.x;
                                y = message.y;
                            }
                        } else {
                            // Fallback to current selection rect
                            try {
                                const sel = window.getSelection();
                                if (sel && sel.rangeCount > 0) {
                                    const rect = sel.getRangeAt(0).getBoundingClientRect();
                                    x = rect.left;
                                    y = rect.top + window.scrollY; // Use absolute top
                                }
                            } catch (e) { }
                        }

                        if (typeof UI !== 'undefined' && UI.showPopup) {
                            UI.showPopup(x, y, selectionText);
                        }
                        sendResponse({ ok: true });
                    } catch (err) {
                        sendResponse({ ok: false, error: err.message });
                    }
                })();
                return true;
            }

            if (type === 'smarttranslate:run-diagnostics') {
                (async () => {
                    try {
                        const report = await Diagnostics.runDiagnostics();
                        sendResponse({ ok: true, report });
                    } catch (e) {
                        Logger.error('Error in diagnostics handler', e);
                        sendResponse({ ok: false, error: String(e) });
                    }
                })();
                return true;
            }

            return false; // Not handled
        });

        // Handle selection events
        const handleSelectionData = (event) => {
            if (typeof UI !== 'undefined' && !UI.isEnabled) return;
            if (typeof Selection !== 'undefined' && Selection.handleSelection) {
                Selection.handleSelection(event);
            }
        };

        const handleSelectionUI = (event) => {
            if (typeof UI !== 'undefined' && UI.isEnabled && UI.updateSelectionIndicator) {
                UI.updateSelectionIndicator(event);
            }
        };

        document.addEventListener('mouseup', (e) => {
            handleSelectionData(e);
            handleSelectionUI(e);
        });
        document.addEventListener('touchend', (e) => {
            handleSelectionData(e);
            handleSelectionUI(e);
        });
        document.addEventListener('keyup', (e) => {
            handleSelectionData(e);
            handleSelectionUI(e);
        });

        // Still track selection data changes for the popup, but don't update UI indicator here
        document.addEventListener('selectionchange', handleSelectionData);

        // Initialize iframe support
        Iframe.init();

        // Initialize TinyMCE support if available
        if (typeof TinyMCEHelper !== 'undefined') {
            try {
                TinyMCEHelper.setupIframeMessageListener();
                TinyMCEHelper.setupAllTinyMCEIframes();
                TinyMCEHelper.setupTinyMCEButton();
                Logger.info('TinyMCE helper initialized');
            } catch (e) {
                Logger.warn('Error initializing TinyMCE helper', e);
            }
        }

        // Initialize ServiceNow support if on ServiceNow
        if (Selection.isServiceNow() && typeof ServiceNowHelper !== 'undefined') {
            try {
                // Setup ServiceNow frame handlers for better selection detection
                ServiceNowHelper.setupFrameHandlers(Selection.handleSelection);
                Logger.info('ServiceNow helper initialized');
            } catch (e) {
                Logger.error('Error initializing ServiceNow helper', e);
            }
        }


        // Initialize floating button
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => UI.ensureFloatingButton());
        } else {
            UI.ensureFloatingButton().catch(e => Logger.error('Error ensuring floating button', e));
        }


        // Initialize selection indicator
        try {
            if (typeof UI !== 'undefined' && UI.createSelectionIndicator) {
                UI.createSelectionIndicator();
                Logger.info('Selection indicator initialized');
            }
        } catch (e) {
            Logger.warn('Error initializing selection indicator', e);
        }

        // Setup selection event listeners
        try {
            if (typeof Selection !== 'undefined' && Selection.handleSelection) {
                // Listen for mouseup (normal text selection)
                document.addEventListener('mouseup', (e) => {
                    try {
                        Selection.handleSelection(e);
                    } catch (err) {
                        Logger.error('Error in mouseup handler:', err);
                    }
                }, true); // Use capture phase

                // Listen for keyboard selection (Ctrl+A, Shift+Arrow, etc.)
                document.addEventListener('keyup', (e) => {
                    try {
                        Selection.handleSelection(e);
                    } catch (err) {
                        Logger.error('Error in keyup handler:', err);
                    }
                }, true); // Use capture phase

                // Listen for selection change (covers most selection scenarios)
                document.addEventListener('selectionchange', (e) => {
                    try {
                        Selection.handleSelection(e);
                    } catch (err) {
                        Logger.error('Error in selectionchange handler:', err);
                    }
                }, true); // Use capture phase

                Logger.info('Selection event listeners attached successfully');
            } else {
                Logger.error('Selection module not available for event listeners');
            }
        } catch (e) {
            Logger.error('Error setting up selection listeners', e);
        }



        Logger.info('SmartTranslate extension initialized');
    } catch (e) {
        Logger.error('Error initializing extension', e);
    }
}

// Initialize when script loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
} else {
    setup();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    try {
        if (typeof UI !== 'undefined' && UI.cleanup) {
            UI.cleanup();
        }
    } catch (e) {
        // ignore cleanup errors on unload
    }
});
