// Selection module for handling text selection from main document and iframes

const Selection = {
    currentSelectedText: '',
    lastSelectionCheckTime: 0,
    hasActiveSelection: false,

    // Check if we're on ServiceNow
    isServiceNow: () => {
        return window.location.hostname.includes('service-now.com') ||
            (typeof ServiceNowHelper !== 'undefined' && ServiceNowHelper.isServiceNow());
    },

    // Get selection text from main document or from same-origin iframes
    getSelectionTextIncludingIframes: () => {
        try {
            // ServiceNow-specific selection handling
            if (Selection.isServiceNow() && typeof ServiceNowHelper !== 'undefined') {
                try {
                    const snSelection = ServiceNowHelper.getSelection();
                    if (snSelection && snSelection.selection && snSelection.selection.trim()) {
                        return snSelection.selection.trim();
                    }
                } catch (e) {
                    Logger.warn('Error getting ServiceNow selection', e);
                }
            }

            // Prefer main window selection
            if (window.getSelection) {
                const s = window.getSelection().toString().trim();
                if (s) {
                    return s;
                }
            }

            // For ServiceNow: if no selection, try to get text from focused element or clicked cell
            if (Selection.isServiceNow()) {
                const activeEl = document.activeElement;
                if (activeEl && (activeEl.classList.contains('vt') || activeEl.tagName === 'TD' || activeEl.hasAttribute('ng-non-bindable'))) {
                    const text = activeEl.textContent.trim();
                    if (text) return text;
                }
            }

            // Check active element (useful when a textarea/input has selection)
            try {
                const ae = document.activeElement;
                if (ae) {
                    if ((ae.tagName === 'TEXTAREA' || ae.tagName === 'INPUT') && typeof ae.selectionStart === 'number') {
                        const sel = ae.value.substring(ae.selectionStart, ae.selectionEnd).trim();
                        if (sel) {
                            return sel;
                        }
                    }
                    // contentEditable
                    if (ae.isContentEditable) {
                        const sel = window.getSelection ? window.getSelection().toString().trim() : '';
                        if (sel) {
                            return sel;
                        }
                    }
                }
            } catch (e) {
                Logger.warn('Error checking active element', e);
            }

            // Try TinyMCEHelper first for better TinyMCE support
            if (typeof TinyMCEHelper !== 'undefined') {
                try {
                    const tinymceSelection = TinyMCEHelper.getSelectionFromIframes();
                    if (tinymceSelection && tinymceSelection.trim()) {
                        Logger.info('Got selection from TinyMCEHelper');
                        return tinymceSelection.trim();
                    }
                } catch (e) {
                    Logger.warn('Error using TinyMCEHelper', e);
                }
            }

            // Walk same-origin iframes and look for selection inside them
            // Prioritize TinyMCE iframes (they have specific classes/IDs)
            const allIframes = Array.from(document.querySelectorAll('iframe'));

            // Sort: TinyMCE iframes first (tox-edit-area__iframe, or iframes with _ifr in ID)
            const iframes = allIframes.sort((a, b) => {
                const aIsTinyMCE = a.classList.contains('tox-edit-area__iframe') ||
                    (a.id && a.id.includes('_ifr')) ||
                    (a.className && a.className.includes('tox'));
                const bIsTinyMCE = b.classList.contains('tox-edit-area__iframe') ||
                    (b.id && b.id.includes('_ifr')) ||
                    (b.className && b.className.includes('tox'));
                if (aIsTinyMCE && !bIsTinyMCE) return -1;
                if (!aIsTinyMCE && bIsTinyMCE) return 1;
                return 0;
            });

            for (let i = 0; i < iframes.length; i++) {
                const iframe = iframes[i];
                try {
                    // Check if iframe is accessible (same-origin)
                    let cw, cd, iframeDoc;
                    try {
                        cw = iframe.contentWindow;
                        cd = iframe.contentDocument;
                        if (!cw && !cd) continue;
                        iframeDoc = cd || (cw && cw.document);
                        if (!iframeDoc) continue;
                        // Try to access document property to verify same-origin
                        _ = iframeDoc.body; // Will throw if cross-origin
                    } catch (e) {
                        // Cross-origin iframe, skip silently
                        continue;
                    }
                    // Try iframe window selection first (most reliable)
                    try {
                        const iframeSelection = iframeDoc.getSelection ? iframeDoc.getSelection() :
                            (cw && cw.getSelection ? cw.getSelection() : null);
                        if (iframeSelection) {
                            const s = iframeSelection.toString().trim();
                            if (s) {
                                return s;
                            }
                        }
                    } catch (e) {
                        Logger.warn('Error getting iframe selection', e);
                    }

                    // Try to inspect active element inside iframe
                    try {
                        const ae = iframeDoc.activeElement;
                        if (ae && ae.tagName) {
                            if ((ae.tagName === 'TEXTAREA' || ae.tagName === 'INPUT') && typeof ae.selectionStart === 'number') {
                                const sel = ae.value.substring(ae.selectionStart, ae.selectionEnd).trim();
                                if (sel) {
                                    return sel;
                                }
                            }

                            if (ae.isContentEditable) {
                                const s = (cw && cw.getSelection) ? cw.getSelection().toString().trim() :
                                    (iframeDoc.getSelection ? iframeDoc.getSelection().toString().trim() : '');
                                if (s) {
                                    return s;
                                }
                            }
                        }
                    } catch (e) {
                        Logger.warn('Error checking iframe active element', e);
                    }

                    // Try body text selection for TinyMCE (body with mce-content-body class)
                    try {
                        const body = iframeDoc.body;
                        if (body) {
                            // Check if body has contentEditable or is in TinyMCE
                            const isTinyMCE = body.classList && body.classList.contains('mce-content-body');
                            const isContentEditable = body.isContentEditable || body.contentEditable === 'true';

                            if (isTinyMCE || isContentEditable) {
                                const bodySelection = iframeDoc.getSelection ? iframeDoc.getSelection() :
                                    (cw && cw.getSelection ? cw.getSelection() : null);
                                if (bodySelection) {
                                    const s2 = bodySelection.toString().trim();
                                    if (s2) {
                                        return s2;
                                    }
                                }

                                // Also try getting selected ranges directly
                                try {
                                    if (bodySelection && bodySelection.rangeCount > 0) {
                                        const range = bodySelection.getRangeAt(0);
                                        const s3 = range.toString().trim();
                                        if (s3) {
                                            return s3;
                                        }
                                    }
                                } catch (e) {
                                    // ignore range errors
                                }
                            }
                        }
                    } catch (e) {
                        Logger.warn('Error checking iframe body for TinyMCE', e);
                    }
                } catch (e) {
                    Logger.warn(`Error processing iframe ${i}`, e);
                }
            }
        } catch (e) {
            Logger.error('Error in getSelectionTextIncludingIframes', e);
        }

        // REMOVED Fallback to last-known selection
        // This was causing old text to persist even after clearing.
        // We only want what is visibly selected NOW.

        return '';

        return '';
    },

    // Get full page text including visible iframes (for summarization)
    getPageTextIncludingIframes: () => {
        try {
            const extractFromDoc = (doc) => {
                if (!doc || !doc.body) return '';

                // EXCLUDE extension UI from the text extraction to avoid "Inception" (AI seeing its own UI)
                const popupId = (typeof CONFIG !== 'undefined' && CONFIG.ELEMENT_IDS) ? CONFIG.ELEMENT_IDS.POPUP : 'gemini-extension-popup';
                const popup = doc.getElementById(popupId);
                const indicator = doc.getElementById('smarttranslate-selection-indicator');
                const floatingBtn = doc.getElementById('gemini-floating-btn');

                const hiddenElements = [];
                [popup, indicator, floatingBtn].forEach(el => {
                    if (el && el.style.display !== 'none') {
                        hiddenElements.push({ el: el, prev: el.style.display });
                        el.style.display = 'none';
                    }
                });

                let txt = doc.body.innerText || '';

                // Add values from inputs and textareas which innerText usually misses
                try {
                    const inputs = doc.querySelectorAll('input[type="text"], textarea, input:not([type])');
                    const formValues = [];
                    inputs.forEach(el => {
                        // Check simple visibility
                        if (el.offsetParent === null) return;

                        // Skip the extension's own chat input
                        if (el.id === (CONFIG.ELEMENT_IDS ? CONFIG.ELEMENT_IDS.CHAT_INPUT : 'gemini-chat-input')) return;

                        // Avoid password fields or hidden fields
                        if (el.type === 'password' || el.type === 'hidden') return;

                        if (el.value && el.value.trim()) {
                            formValues.push(el.value.trim());
                        }
                    });

                    if (formValues.length > 0) {
                        txt += "\n\n--- Form Content ---\n" + formValues.join("\n");
                    }
                } catch (e) { }

                // Restore UI visibility
                hiddenElements.forEach(item => {
                    item.el.style.display = item.prev;
                });

                return txt;
            };

            let fullText = extractFromDoc(document);

            // Search iframes for additional content
            const iframes = document.querySelectorAll('iframe');
            iframes.forEach(iframe => {
                try {
                    // Only process visible iframes
                    const style = window.getComputedStyle(iframe);
                    if (style.display === 'none' || style.visibility === 'hidden') return;

                    const cd = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
                    if (cd) {
                        const iframeText = extractFromDoc(cd);
                        // Lower threshold to capture short but important form content
                        if (iframeText && iframeText.trim().length > 20) {
                            fullText += "\n\n--- Iframe Content ---\n" + iframeText;
                        }
                    }
                } catch (e) {
                    // Cross-origin or other error, skip
                }
            });

            return fullText.replace(/\s+/g, ' ').trim();
        } catch (e) {
            Logger.error('Error in getPageTextIncludingIframes', e);
            return document.body ? document.body.innerText.trim() : '';
        }
    },

    // Set current selection and sync to storage for popup accessibility
    setCurrentSelection: (text) => {
        const sanitized = Security.sanitizeInput(text, CONFIG.MAX_SELECTION_LENGTH);
        const changed = Selection.currentSelectedText !== sanitized;
        Selection.currentSelectedText = sanitized;

        // Sync to storage so popup can retrieve it across frames/ShadowDOM
        if (changed && sanitized) {
            try {
                const data = {
                    text: sanitized,
                    host: window.location.hostname,
                    url: window.location.href,
                    timestamp: Date.now()
                };
                chrome.storage.local.set({ 'smarttranslate_active_selection': data });
            } catch (e) { }
        }
    },

    // Get current selection
    getCurrentSelection: () => {
        return Selection.currentSelectedText;
    },

    // Clear current selection
    clearSelection: () => {
        Selection.currentSelectedText = '';
        try {
            if (window.getSelection) {
                window.getSelection().removeAllRanges();
            }
        } catch (e) {
            Logger.warn('Error clearing selection', e);
        }
        // Also clear from storage to prevent cached text from appearing
        try {
            chrome.storage.local.remove(['smarttranslate_active_selection']);
        } catch (e) { }
    },

    // Handle selection event
    handleSelection: (event) => {
        let selectedText = '';
        let snRect = null;

        // Get selected text from various sources
        if (Selection.isServiceNow() && typeof ServiceNowHelper !== 'undefined') {
            try {
                const snSelection = ServiceNowHelper.getSelection();
                if (snSelection && snSelection.selection) {
                    selectedText = snSelection.selection.trim();
                    snRect = snSelection.rect;
                }
            } catch (e) {
                // ignore
            }
        }

        // Fallback to standard selection
        if (!selectedText) {
            const selection = window.getSelection();
            selectedText = selection ? selection.toString().trim() : '';
        }

        // Try TinyMCE if still no text
        if (!selectedText && typeof TinyMCEHelper !== 'undefined') {
            try {
                selectedText = TinyMCEHelper.getSelectionFromIframes();
                if (selectedText) selectedText = selectedText.trim();
            } catch (e) {
                // ignore
            }
        }

        // Try full iframe iteration
        if (!selectedText) {
            try {
                selectedText = Selection.getSelectionTextIncludingIframes();
            } catch (e) {
                // ignore
            }
        }

        if (selectedText && selectedText.length > 0 && selectedText.length < CONFIG.MAX_SELECTION_LENGTH) {
            Selection.setCurrentSelection(selectedText);
            Selection.hasActiveSelection = true;
            Selection.lastSelectionCheckTime = Date.now();
        } else {
            // Check if click was inside our UI using composedPath for Shadow DOM/Iframe robustness
            const path = event.composedPath ? event.composedPath() : [];
            const isOurUI = path.some(el =>
                el.id === 'gemini-extension-popup' ||
                el.id === 'smarttranslate-selection-indicator' ||
                el.id === 'gemini-floating-btn' ||
                (el.classList && el.classList.contains('gemini-extension-element'))
            );

            if (isOurUI) return;

            Selection.hasActiveSelection = false;
            // Only clear memory if we're certain it's a click on the page background
            Selection.currentSelectedText = '';
        }
    }
};

// Export
if (typeof window !== 'undefined') {
    window.Selection = Selection;
}
