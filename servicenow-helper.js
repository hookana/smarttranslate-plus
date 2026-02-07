// ServiceNow-specific helper functions
const ServiceNowHelper = {
    isServiceNow: () => window.location.hostname.includes('service-now.com'),

    // Optimized Deep selection helper to traverse Shadow DOM
    getDeepSelection: (root = document, depth = 0) => {
        if (depth > 5) return { selection: '', rect: null }; // Security depth limit

        // 1. Try standard selection in this root
        try {
            const sel = (root.getSelection ? root.getSelection() : null) || (window.getSelection());
            if (sel && sel.toString().trim()) {
                const selection = sel.toString().trim();
                let rect = null;
                if (sel.rangeCount > 0) {
                    try { rect = sel.getRangeAt(0).getBoundingClientRect(); } catch (e) { }
                }
                return { selection, rect };
            }
        } catch (e) { }

        // 2. Focused element Shadow DOM (Most efficient)
        try {
            const active = root.activeElement;
            if (active && active.shadowRoot) {
                const deep = ServiceNowHelper.getDeepSelection(active.shadowRoot, depth + 1);
                if (deep.selection) return deep;
            }
        } catch (e) { }

        // 3. Search only likely candidates for Shadow DOM to save CPU
        // In ServiceNow, these are usually custom elements (contain a hyphen)
        try {
            const candidates = root.querySelectorAll('*'); // fallback for general search but cautious
            // If there are too many elements, we limit the search to the first few to avoid freezing
            const limit = candidates.length > 500 ? 500 : candidates.length;

            for (let i = 0; i < limit; i++) {
                const el = candidates[i];
                if (el.shadowRoot) {
                    const deep = ServiceNowHelper.getDeepSelection(el.shadowRoot, depth + 1);
                    if (deep.selection) return deep;
                }
            }
        } catch (e) { }

        return { selection: '', rect: null };
    },

    getSelection: () => {
        let selection = '';
        let rect = null;

        // 1. Try deep selection in current frame (Shadow DOM + standard)
        const deep = ServiceNowHelper.getDeepSelection();
        if (deep.selection) return deep;

        // 2. Try to get selection from active textarea/input (covers ServiceNow form fields)
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT')) {
            try {
                const start = activeElement.selectionStart;
                const end = activeElement.selectionEnd;
                if (start !== end) {
                    selection = activeElement.value.substring(start, end).trim();
                    if (selection) {
                        rect = activeElement.getBoundingClientRect();
                        return { selection, rect };
                    }
                }
            } catch (e) { }
        }

        // 3. Search all same-origin iframes on the entire page
        // We do this via a flat search of all iframes available to the current window context
        try {
            const allIframes = document.querySelectorAll('iframe');
            for (const iframe of allIframes) {
                try {
                    const frameDoc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
                    if (!frameDoc) continue;

                    // Search inside this iframe
                    const frameSel = frameDoc.getSelection();
                    if (frameSel && frameSel.toString().trim()) {
                        const s = frameSel.toString().trim();
                        const r = frameSel.getRangeAt(0).getBoundingClientRect();
                        const ir = iframe.getBoundingClientRect();

                        // Return normalized coordinates relative to current viewport
                        return {
                            selection: s,
                            rect: {
                                top: r.top + ir.top,
                                left: r.left + ir.left,
                                width: r.width,
                                height: r.height
                            }
                        };
                    }
                } catch (e) { /* cross-origin or other error, skip */ }
            }
        } catch (e) { }

        return { selection: selection.trim(), rect };
    },

    attachToFrame: (frame, handler) => {
        try {
            if (frame.contentDocument) {
                frame.contentDocument.addEventListener('mouseup', handler, { capture: true });
                frame.contentDocument.addEventListener('keyup', handler, { capture: true });
                frame.contentDocument.addEventListener('selectionchange', handler, { capture: true });

                // Watch for dynamic content changes in the frame
                const frameObserver = new MutationObserver(() => {
                    handler({ target: frame.contentDocument });
                });

                frameObserver.observe(frame.contentDocument.body || frame.contentDocument.documentElement, {
                    childList: true,
                    subtree: true
                });
            }
        } catch (e) {
            // Ignore cross-origin frame errors
        }
    },

    setupFrameHandlers: (handler) => {
        // Handle existing frames
        document.querySelectorAll('iframe').forEach(frame => {
            ServiceNowHelper.attachToFrame(frame, handler);
        });

        // Watch for new frames
        const frameObserver = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.tagName === 'IFRAME') {
                        ServiceNowHelper.attachToFrame(node, handler);
                    }
                });
            });
        });

        frameObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
};

// Export for use in content.js
window.ServiceNowHelper = ServiceNowHelper;