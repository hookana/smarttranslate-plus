// Security utilities for input sanitization and XSS prevention

const Security = {
    // Sanitize text input - remove dangerous characters and limit length
    sanitizeInput: (text, maxLength = CONFIG.MAX_INPUT_LENGTH) => {
        if (!text || typeof text !== 'string') return '';
        
        // Trim and limit length
        let sanitized = text.trim().slice(0, maxLength);
        
        // Remove null bytes and other control characters (except newlines and tabs)
        sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
        
        return sanitized;
    },
    
    // Escape HTML to prevent XSS
    escapeHtml: (unsafe) => {
        if (!unsafe) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(unsafe).replace(/[&<>"']/g, (m) => map[m]);
    },
    
    // Safe text content setter (prefer textContent over innerHTML)
    setTextContent: (element, text) => {
        if (!element) return;
        try {
            element.textContent = text;
        } catch (e) {
            Logger.error('Error setting text content', e);
        }
    },
    
    // Safe HTML setter with sanitization
    // - If `useMarkdown` is true and `marked` is available, parse markdown.
    // - If `html` contains HTML tags, assume the caller provided intended HTML
    //   (callers should escape any user-provided portions with `escapeHtml`).
    // - Otherwise treat the input as plain text and escape it.
    setSafeHtml: (element, html, useMarkdown = false) => {
        if (!element) return;
        try {
            if (useMarkdown && typeof marked !== 'undefined' && typeof marked.parse === 'function') {
                element.innerHTML = marked.parse(html);
                return;
            }

            // If string contains HTML tags, assume it's intended HTML (caller responsibility)
            const containsHtml = /<[^>]+>/.test(html);
            if (containsHtml) {
                element.innerHTML = html;
            } else {
                // Plain text: escape and preserve line breaks
                element.innerHTML = Security.escapeHtml(html).replace(/\n/g, '<br>');
            }
        } catch (e) {
            Logger.error('Error setting HTML content', e);
            Security.setTextContent(element, html);
        }
    },
    
    // Validate API key format (basic validation)
    validateApiKey: (key) => {
        if (!key || typeof key !== 'string') return false;
        const trimmed = key.trim();
        // Gemini API keys are typically alphanumeric and quite long
        return trimmed.length > 20 && /^[A-Za-z0-9_-]+$/.test(trimmed);
    }
};

// Export
if (typeof window !== 'undefined') {
    window.Security = Security;
}
