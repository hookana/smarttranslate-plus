// TinyMCE-specific helper for getting selection from TinyMCE editors
const TinyMCEHelper = {
    // Store for iframe content when injected scripts can't be used
    iframeContentCache: {},

    // Detect if TinyMCE is present in parent context
    isTinyMCEPresent: () => {
        return typeof tinyMCE !== 'undefined' && tinyMCE.activeEditor;
    },

    // Get selection from active TinyMCE editor (parent context)
    // Returns selected text, or all editor content if nothing is selected
    getActiveEditorSelection: () => {
        try {
            if (typeof tinyMCE === 'undefined' || !tinyMCE.activeEditor) {
                return null;
            }
            const editor = tinyMCE.activeEditor;
            if (!editor || !editor.selection) return null;

            // First try to get selected content
            const selected = editor.selection.getContent();
            if (selected && selected.trim()) {
                return selected.trim();
            }

            // If no selection, try to get all content from editor
            try {
                if (editor.getContent) {
                    const allContent = editor.getContent({ format: 'text' });
                    if (allContent && allContent.trim()) {
                        return allContent.trim();
                    }
                }
            } catch (e) {
                // Fall through
            }

            return null;
        } catch (e) {
            Logger.warn('Error getting TinyMCE selection', e);
            return null;
        }
    },

    // Get all TinyMCE iframes
    getTinyMCEIframes: () => {
        const iframes = [];
        try {
            // Find all TinyMCE iframes by common class/id patterns
            document.querySelectorAll('iframe').forEach(iframe => {
                try {
                    const isTinyMCE = iframe.classList.contains('tox-edit-area__iframe') ||
                        (iframe.id && iframe.id.includes('_ifr')) ||
                        (iframe.className && iframe.className.includes('tox'));
                    if (isTinyMCE) {
                        iframes.push(iframe);
                    }
                } catch (e) {
                    // ignore
                }
            });
        } catch (e) {
            Logger.warn('Error finding TinyMCE iframes', e);
        }
        return iframes;
    },

    // Inject a script into the iframe to get content and setup listeners
    // NOTE: This is disabled due to CSP violations in most iframes
    // We rely on direct content access instead
    injectScriptIntoIframe: (iframe, callback) => {
        try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            if (!iframeDoc) {
                Logger.debug('Cannot access iframe document for injection');
                return false;
            }

            // Try direct access instead of injection
            try {
                const body = iframeDoc.body;
                if (body) {
                    let bodyContent = '';

                    if (body.innerText) {
                        bodyContent = body.innerText.trim();
                    } else if (body.textContent) {
                        bodyContent = body.textContent.trim();
                    }

                    if (bodyContent) {
                        Logger.debug('Got iframe content without injection', { length: bodyContent.length });
                        return true;
                    }
                }
            } catch (e) {
                Logger.debug('Direct iframe access failed', e.message);
            }

            return false;
        } catch (e) {
            Logger.debug('Error attempting iframe access', e.message);
            return false;
        }
    },

    // Inject listeners for real-time detection
    // NOTE: Disabled due to CSP violations - will not inject inline scripts
    injectSelectionListenersIntoIframe: (iframe) => {
        // CSP-compliant: Don't inject inline scripts into cross-origin iframes
        // Instead rely on postMessage from parent or direct DOM access
        Logger.debug('Skipping iframe listener injection due to CSP restrictions');
        return false;
    },

    // Set up listener for iframe content messages (disabled due to CSP - no longer injecting scripts)
    setupIframeMessageListener: () => {
        // Disabled: We no longer inject scripts into iframes due to CSP violations
        // Message listeners are not needed if we're reading content directly
        Logger.debug('Iframe message listener setup skipped (CSP compliant approach)');
        return false;
    },

    // Setup all TinyMCE iframes with injection
    setupAllTinyMCEIframes: () => {
        try {
            const iframes = TinyMCEHelper.getTinyMCEIframes();
            for (const iframe of iframes) {
                try {
                    // Note: Script injection is disabled due to CSP violations
                    // Content will be read directly without injection
                    Logger.debug('TinyMCE iframe found (not injecting due to CSP)', { id: iframe.id });
                } catch (e) {
                    Logger.warn('Error setting up TinyMCE iframe', e);
                }
            }
        } catch (e) {
            Logger.warn('Error in setupAllTinyMCEIframes', e);
        }
    },

    // Get selection from any TinyMCE iframe content
    getSelectionFromIframes: () => {
        const iframes = TinyMCEHelper.getTinyMCEIframes();

        for (const iframe of iframes) {
            try {
                const cw = iframe.contentWindow;
                const cd = iframe.contentDocument;
                if (!cw || !cd) continue;

                const iframeDoc = cd || cw.document;
                if (!iframeDoc) continue;

                // Try getting selection from contenteditable body
                try {
                    const sel = iframeDoc.getSelection ? iframeDoc.getSelection() : (cw.getSelection ? cw.getSelection() : null);
                    if (sel) {
                        const text = sel.toString().trim();
                        if (text) {
                            let rect = null;
                            if (sel.rangeCount > 0) {
                                try {
                                    const rangeRect = sel.getRangeAt(0).getBoundingClientRect();
                                    const iframeRect = iframe.getBoundingClientRect();
                                    rect = {
                                        top: rangeRect.top + iframeRect.top,
                                        left: rangeRect.left + iframeRect.left,
                                        right: rangeRect.right + iframeRect.left,
                                        bottom: rangeRect.bottom + iframeRect.top,
                                        width: rangeRect.width,
                                        height: rangeRect.height
                                    };
                                } catch (e) { }
                            }
                            return { text, rect };
                        }
                    }
                } catch (e) { }
            } catch (e) { }
        }

        return { text: null, rect: null };
    },

    // Register SmartTranslate button in TinyMCE toolbar
    registerTinyMCEButton: () => {
        try {
            if (typeof tinymce === 'undefined') {
                Logger.debug('TinyMCE not available for button registration');
                return;
            }

            // Try to get the active editor
            let editor = tinymce.activeEditor;

            // If no active editor, try to get from editors list
            if (!editor && tinymce.editors && tinymce.editors.length > 0) {
                editor = tinymce.editors[0];
                Logger.debug('Using first editor from tinymce.editors list');
            }

            if (!editor) {
                Logger.debug('No TinyMCE editor found');
                return;
            }

            if (!editor.ui || !editor.ui.registry) {
                Logger.debug('TinyMCE editor UI not fully initialized yet');
                return;
            }

            // Check if button already registered
            try {
                if (editor.ui.registry._buttons && editor.ui.registry._buttons.smarttranslate) {
                    Logger.debug('SmartTranslate button already registered');
                    return;
                }
            } catch (e) {
                // Continue anyway
            }

            // Register button
            editor.ui.registry.addButton('smarttranslate', {
                tooltip: 'Translate/Explain with SmartTranslate',
                icon: 'language',
                onAction: () => {
                    Logger.info('SmartTranslate button clicked in TinyMCE');

                    // Get selected text from editor
                    let selectionText = editor.selection.getContent({ format: 'text' }).trim();

                    // If no selection, get all content
                    if (!selectionText && editor.getContent) {
                        selectionText = editor.getContent({ format: 'text' }).trim();
                    }

                    if (!selectionText) {
                        Logger.warn('No text selected in TinyMCE editor');
                        if (typeof UI !== 'undefined' && UI.showToast) {
                            UI.showToast('Please select some text first', 'error');
                        }
                        return;
                    }

                    // Set current selection and show popup
                    if (typeof Selection !== 'undefined' && Selection.setCurrentSelection) {
                        Selection.setCurrentSelection(selectionText);
                    }

                    if (typeof UI !== 'undefined' && UI.showPopup) {
                        // Get editor position
                        const editorElement = editor.getElement();
                        const rect = editorElement ? editorElement.getBoundingClientRect() : null;
                        const x = rect ? (rect.left + rect.width / 2) : 20;
                        const y = rect ? (rect.top + rect.height / 2) : 20;

                        UI.showPopup(x, y, selectionText);
                    }
                }
            });

            Logger.info('SmartTranslate button registered in TinyMCE');
        } catch (e) {
            Logger.warn('Error registering TinyMCE button', e);
        }
    },

    // Setup button for active editor and listen for new editors
    setupTinyMCEButton: () => {
        try {
            if (typeof tinymce === 'undefined') {
                Logger.debug('TinyMCE not loaded yet');
                // Try again in 500ms
                setTimeout(() => {
                    if (typeof tinymce !== 'undefined' && tinymce.activeEditor) {
                        Logger.debug('TinyMCE now available, setting up button');
                        TinyMCEHelper.setupTinyMCEButton();
                    }
                }, 500);
                return;
            }

            // If TinyMCE exists but no active editor, wait for one
            if (!tinymce.activeEditor) {
                Logger.debug('TinyMCE loaded but no active editor yet');
                if (tinymce.on) {
                    tinymce.on('AddEditor', (e) => {
                        try {
                            Logger.debug('New TinyMCE editor created, registering button');
                            // Wait a bit for editor to fully initialize
                            setTimeout(() => {
                                TinyMCEHelper.registerTinyMCEButton();
                            }, 100);
                        } catch (err) {
                            Logger.warn('Error handling AddEditor event', err);
                        }
                    });
                }
                return;
            }

            // Register button for current editor
            TinyMCEHelper.registerTinyMCEButton();

            // Also listen for future editors being created
            if (tinymce.on) {
                tinymce.on('AddEditor', (e) => {
                    try {
                        Logger.debug('New TinyMCE editor created, registering button');
                        setTimeout(() => {
                            TinyMCEHelper.registerTinyMCEButton();
                        }, 100);
                    } catch (err) {
                        Logger.warn('Error handling AddEditor event', err);
                    }
                });
            }

            Logger.info('TinyMCE button setup complete');
        } catch (e) {
            Logger.warn('Error setting up TinyMCE button', e);
        }
    }
};

// Export
if (typeof window !== 'undefined') {
    window.TinyMCEHelper = TinyMCEHelper;
}
