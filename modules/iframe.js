// Iframe module for detecting and attaching listeners to same-origin iframes

const Iframe = {
    observer: null,

    // Attach selection listeners to same-origin iframes
    attachIframeSelectionListeners: () => {
        try {
            const iframes = Array.from(document.querySelectorAll('iframe'));
            iframes.forEach((iframe, idx) => {
                try {
                    // Skip if listeners already attached
                    if (iframe.__gemini_listeners_attached) return;

                    const cw = iframe.contentWindow;
                    const cd = iframe.contentDocument;
                    if (!cw || !cd) return; // probably cross-origin

                    const iframeHandler = () => {
                        try {
                            // Try multiple methods to get selection
                            let s = '';

                            // Check if this is a TinyMCE iframe
                            const isTinyMCEFrame = iframe.classList.contains('tox-edit-area__iframe') ||
                                (iframe.id && iframe.id.includes('_ifr')) ||
                                (iframe.className && iframe.className.includes('tox'));

                            // Method 1: Direct getSelection
                            try {
                                const sel = cd.getSelection ? cd.getSelection() : (cw.getSelection ? cw.getSelection() : null);
                                if (sel) {
                                    s = sel.toString().trim();
                                }
                            } catch (e) { }

                            // Method 2: If no selection, try body contentEditable (TinyMCE)
                            if (!s && cd.body) {
                                try {
                                    const body = cd.body;
                                    const isTinyMCE = body.classList && body.classList.contains('mce-content-body');
                                    if (isTinyMCE || body.isContentEditable || isTinyMCEFrame) {
                                        const bodySel = cd.getSelection ? cd.getSelection() : (cw.getSelection ? cw.getSelection() : null);
                                        if (bodySel) {
                                            s = bodySel.toString().trim();
                                        }

                                        // If still no selection and it's TinyMCE, get body content
                                        if (!s && isTinyMCEFrame) {
                                            const bodyContent = body.innerText ? body.innerText.trim() : '';
                                            if (bodyContent && bodyContent !== '<br>' && bodyContent.length > 0) {
                                                s = bodyContent;
                                            }
                                        }
                                    }
                                } catch (e) { }
                            }

                            // Method 3: Try active element
                            if (!s && cd.activeElement) {
                                try {
                                    const ae = cd.activeElement;
                                    if (ae.isContentEditable) {
                                        const aeSel = cd.getSelection ? cd.getSelection() : (cw.getSelection ? cw.getSelection() : null);
                                        if (aeSel) {
                                            s = aeSel.toString().trim();
                                        }
                                    }
                                } catch (e) { }
                            }

                            if (s && s.length > 0) {
                                Selection.setCurrentSelection(s);
                            }
                        } catch (e) {
                            Logger.warn('Error in iframe selection handler', e);
                        }
                    };

                    // Add listeners - use capture phase for better TinyMCE support
                    try {
                        cd.addEventListener('mouseup', iframeHandler, true);
                        cd.addEventListener('mouseup', iframeHandler, false); // Also non-capture
                    } catch (e) {
                        Logger.warn('Could not attach mouseup listener to iframe', e);
                    }
                    try {
                        cd.addEventListener('selectionchange', iframeHandler, true);
                        cd.addEventListener('selectionchange', iframeHandler, false);
                    } catch (e) {
                        Logger.warn('Could not attach selectionchange listener to iframe', e);
                    }
                    try {
                        cd.addEventListener('touchend', iframeHandler, true);
                        cd.addEventListener('touchend', iframeHandler, false);
                    } catch (e) {
                        Logger.warn('Could not attach touchend listener to iframe', e);
                    }

                    // Also listen on the iframe body directly for TinyMCE
                    try {
                        if (cd.body) {
                            cd.body.addEventListener('mouseup', iframeHandler, true);
                            cd.body.addEventListener('selectionchange', iframeHandler, true);
                        }
                    } catch (e) {
                        // ignore
                    }

                    iframe.__gemini_listeners_attached = true;
                } catch (e) {
                    Logger.warn(`Error attaching listeners to iframe ${idx}`, e);
                }
            });
        } catch (e) {
            Logger.error('Error in attachIframeSelectionListeners', e);
        }
    },

    // Initialize mutation observer for dynamically added iframes
    initMutationObserver: () => {
        try {
            if (Iframe.observer) return;

            Iframe.observer = new MutationObserver(mutations => {
                let shouldReattach = false;

                for (const m of mutations) {
                    if (m.addedNodes && m.addedNodes.length) {
                        for (const n of m.addedNodes) {
                            if (n && n.tagName && n.tagName.toLowerCase() === 'iframe') {
                                shouldReattach = true;
                                // Also setup TinyMCE for new iframes if helper available
                                if (typeof TinyMCEHelper !== 'undefined') {
                                    try {
                                        const isTinyMCE = n.classList.contains('tox-edit-area__iframe') ||
                                            (n.id && n.id.includes('_ifr')) ||
                                            (n.className && n.className.includes('tox'));
                                        if (isTinyMCE) {
                                            TinyMCEHelper.injectScriptIntoIframe(n);
                                            TinyMCEHelper.injectSelectionListenersIntoIframe(n);
                                        }
                                    } catch (e) {
                                        // Ignore TinyMCE setup errors, regular listeners will still work
                                    }
                                }
                                break;
                            }
                        }
                    }
                }

                if (shouldReattach) {
                    // Debounce reattachment
                    clearTimeout(Iframe.reattachTimeout);
                    Iframe.reattachTimeout = setTimeout(() => {
                        Iframe.attachIframeSelectionListeners();
                    }, 100);
                }
            });

            Iframe.observer.observe(document.documentElement || document.body, {
                childList: true,
                subtree: true
            });
        } catch (e) {
            Logger.error('Error initializing iframe mutation observer', e);
        }
    },

    // Cleanup mutation observer
    cleanup: () => {
        if (Iframe.observer) {
            Iframe.observer.disconnect();
            Iframe.observer = null;
        }
        if (Iframe.reattachTimeout) {
            clearTimeout(Iframe.reattachTimeout);
        }
    },

    // Initialize iframe support
    init: () => {
        Iframe.attachIframeSelectionListeners();
        Iframe.initMutationObserver();
    }
};

// Export
if (typeof window !== 'undefined') {
    window.Iframe = Iframe;
}
