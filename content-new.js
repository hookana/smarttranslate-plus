// Main content script for SmartTranslate extension
// Refactored to use modular architecture

// Load configuration and utilities first
// Note: These should be loaded in order via manifest.json

// Initialize extension
async function setup() {
    try {
        // Initialize API with stored key
        await Api.init();
        
        // Listen for API key updates (legacy single-key and new multi-key formats)
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'smarttranslate:api-key-updated') {
                Api.updateApiKey('gemini', message.apiKey);
                sendResponse({ success: true });
            }
            if (message.type === 'smarttranslate:api-keys-updated') {
                Api.handleApiKeysUpdated(message.apiKeys || {}, message.defaultProvider);
                sendResponse({ success: true });
            }
            return true;
        });
        
        // Load extension state for current domain
        const domain = window.location.hostname;
        const isEnabled = await Storage.getDomainState(domain);
        UI.setEnabled(isEnabled);
        
        // Listen for state changes
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'smarttranslate:state-change') {
                UI.setEnabled(message.enabled);
                if (message.enabled) {
                    UI.ensureFloatingButton();
                } else {
                    if (UI.floatingButton) {
                        try {
                            UI.floatingButton.remove();
                        } catch (e) {
                            UI.floatingButton.style.display = 'none';
                        }
                    }
                    UI.hidePopup();
                }
                sendResponse({ success: true });
            }
            return true;
        });
        
        // Handle context menu translation requests
        chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
            try {
                if (msg && msg.type === 'smarttranslate:show-popup') {
                    const selectionText = msg.selection || Selection.getSelectionTextIncludingIframes();
                    if (!selectionText || selectionText.trim().length === 0) {
                        return;
                    }
                    Selection.setCurrentSelection(selectionText.trim());
                    
                    // Position popup near selection
                    let x = 20, y = 20;
                    try {
                        const sel = window.getSelection();
                        if (sel && sel.rangeCount > 0) {
                            const range = sel.getRangeAt(0);
                            const rect = range.getBoundingClientRect();
                            if (rect) {
                                x = rect.left || x;
                                y = (rect.top || rect.bottom || 0) + window.scrollY;
                            }
                        }
                    } catch (e) {
                        Logger.warn('Error getting selection position', e);
                    }
                    
                    UI.showPopup(x, y);
                    sendResponse({ ok: true });
                }
            } catch (err) {
                Logger.error('Error handling show-popup message', err);
            }
            return true;
        });
        
        // Handle translation requests from popup
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'smarttranslate:translate-selection') {
                (async () => {
                    try {
                        const selectionText = (message.selection && String(message.selection).trim()) || 
                                            Selection.getSelectionTextIncludingIframes();
                        if (!selectionText) {
                            sendResponse({ ok: false, error: 'no-selection' });
                            return;
                        }
                        Selection.setCurrentSelection(selectionText);
                        const targetLang = message.targetLang || 'en';
                        const result = await Api.translate(selectionText, targetLang);
                        if (result.error) {
                            sendResponse({ ok: false, error: result.error });
                        } else {
                            sendResponse({ ok: true, text: result.text });
                        }
                    } catch (e) {
                        Logger.error('Error in translate-selection', e);
                        sendResponse({ ok: false, error: e.message || 'internal-error' });
                    }
                })();
                return true; // Keep channel open for async response
            }
            return true;
        });
        
        // Handle selection events
        const handleSelection = (event) => {
            if (!UI.isEnabled) return;
            Selection.handleSelection(event);
        };
        
        document.addEventListener('mouseup', handleSelection);
        document.addEventListener('touchend', handleSelection);
        document.addEventListener('selectionchange', handleSelection);
        
        // Initialize iframe support
        Iframe.init();
        
        // Initialize floating button
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', UI.ensureFloatingButton);
        } else {
            UI.ensureFloatingButton();
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
    UI.cleanup();
});
