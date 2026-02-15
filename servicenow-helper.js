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

    getPageText: () => {
        let fullText = '';
        // WeakSet to detect cycles or already visited nodes (though DOM tree is acyclic, safety first)
        const visited = new WeakSet();

        const crawl = (node) => {
            if (!node) return;
            // Skip non-interesting node types
            if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.TEXT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;

            if (visited.has(node)) return;
            visited.add(node);

            // 1. Text Content
            if (node.nodeType === Node.TEXT_NODE) {
                const val = node.nodeValue.trim();
                if (val.length > 0) fullText += val + ' ';
                return;
            }

            // 2. Element Handling
            if (node.nodeType === Node.ELEMENT_NODE) {
                // Skip hidden elements to reduce noise
                // Note: getComputedStyle is expensive, so we only check if strictly necessary or use simple checks
                // For performance, we skip the style check for every node and just ignore obvious hidden ones
                if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE' || node.tagName === 'NOSCRIPT') return;

                // Form values
                if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') {
                    if (node.type !== 'hidden' && node.type !== 'password' && node.value) {
                        const v = node.value.trim();
                        if (v) fullText += v + ' ';
                    }
                }
            }

            // 3. Shadow DOM
            if (node.shadowRoot) {
                crawl(node.shadowRoot);
            }

            // 4. Iframes
            if (node.tagName === 'IFRAME') {
                try {
                    const doc = node.contentDocument || (node.contentWindow && node.contentWindow.document);
                    if (doc) {
                        crawl(doc.body);
                    }
                } catch (e) { }
            }

            // 5. Children (Light DOM or Shadow Content)
            if (node.childNodes && node.childNodes.length > 0) {
                Array.from(node.childNodes).forEach(crawl);
            }
        };

        if (document.body) crawl(document.body);

        return fullText.replace(/\s+/g, ' ').trim().substring(0, 50000); // Sanity limit
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