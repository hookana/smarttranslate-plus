// Diagnostics module for debugging and troubleshooting

const Diagnostics = {
    // Check if diagnostics is enabled
    isEnabled: async () => {
        try {
            return await Storage.get(CONFIG.STORAGE_KEYS.DIAGNOSTICS_ENABLED) || false;
        } catch (e) {
            return false;
        }
    },
    
    // Safe text summary (limit length)
    safeTextSummary: (s) => {
        if (!s) return '';
        return String(s).trim().slice(0, 200);
    },
    
    // Collect shadow root information
    collectShadowRoots: (root) => {
        const results = [];
        
        const walk = (node) => {
            try {
                if (!node || typeof node !== 'object') return;
                if (node.shadowRoot) {
                    const host = node;
                    const elInfo = {
                        tag: host.tagName || 'UNKNOWN',
                        id: host.id || '',
                        classes: (host.className || '').toString().split(/\s+/).filter(Boolean),
                        containsText: Diagnostics.safeTextSummary(host.textContent),
                        childrenCount: host.childElementCount || 0
                    };
                    results.push(elInfo);
                    // Recurse into the shadowRoot children
                    Array.from(host.shadowRoot.querySelectorAll('*')).slice(0, 50).forEach((c) => {
                        if (c.shadowRoot) walk(c);
                    });
                }
                // Recurse children (limited depth)
                if (node.children && node.children.length) {
                    for (let i = 0; i < Math.min(node.children.length, 50); i++) {
                        walk(node.children[i]);
                    }
                }
            } catch (e) {
                Logger.warn('Error walking shadow root', e);
            }
        };
        
        try {
            walk(root || document.documentElement || document.body);
        } catch (e) {
            Logger.error('Error collecting shadow roots', e);
        }
        return results;
    },
    
    // Collect iframe information
    collectIframeInfo: () => {
        const iframes = Array.from(document.querySelectorAll('iframe'));
        const data = iframes.map((iframe, idx) => {
            const info = {
                index: idx,
                id: iframe.id || '',
                name: iframe.name || '',
                src: iframe.getAttribute ? iframe.getAttribute('src') : '',
                sandbox: iframe.getAttribute ? iframe.getAttribute('sandbox') : '',
                width: iframe.width || iframe.clientWidth || 0,
                height: iframe.height || iframe.clientHeight || 0,
                listenersAttached: !!iframe.__gemini_listeners_attached
            };
            
            try {
                const cw = iframe.contentWindow;
                const cd = iframe.contentDocument;
                if (cw && cd) {
                    try {
                        info.sameOrigin = true;
                        info.location = cw.location && cw.location.href ? 
                            Diagnostics.safeTextSummary(cw.location.href) : '';
                        // Check iframe selection if accessible
                        try {
                            const sel = (cw.getSelection && cw.getSelection().toString && cw.getSelection().toString()) || 
                                       (cd.getSelection && cd.getSelection().toString && cd.getSelection().toString());
                            info.hasSelection = !!(sel && sel.toString().trim());
                        } catch (e) {
                            info.hasSelection = false;
                        }
                        // Check for active element text
                        try {
                            const ae = cd.activeElement;
                            if (ae) {
                                info.activeElement = {
                                    tag: ae.tagName || '',
                                    id: ae.id || '',
                                    text: Diagnostics.safeTextSummary(ae.textContent || ae.value)
                                };
                            }
                        } catch (e) {
                            // ignore
                        }
                    } catch (e) {
                        info.sameOrigin = false;
                    }
                }
            } catch (e) {
                info.sameOrigin = false;
            }
            
            return info;
        });
        return data;
    },
    
    // Run diagnostics and generate report
    runDiagnostics: async () => {
        try {
            const enabled = await Diagnostics.isEnabled();
            const report = {
                timestamp: Date.now(),
                pageUrl: location.href,
                selection: Diagnostics.safeTextSummary(
                    window.getSelection && window.getSelection().toString && window.getSelection().toString()
                ),
                frames: Diagnostics.collectIframeInfo(),
                shadowRoots: Diagnostics.collectShadowRoots(document.documentElement),
                listenersAttachedCount: document.querySelectorAll && 
                    document.querySelectorAll('[__gemini_listeners_attached]').length || 0
            };
            
            try {
                await Storage.set(CONFIG.STORAGE_KEYS.DIAGNOSTICS_REPORT, report);
            } catch (e) {
                Logger.warn('Error saving diagnostics report', e);
            }
            
            if (enabled) {
                Logger.info('SmartTranslate diagnostics report:', report);
            }
            
            return report;
        } catch (e) {
            Logger.error('Error running diagnostics', e);
            return { error: e.message };
        }
    }
};

// Export
if (typeof window !== 'undefined') {
    window.Diagnostics = Diagnostics;
    // Expose for manual invocation (developer/testing only)
    window.__gemini_runDiagnostics = Diagnostics.runDiagnostics;
}
