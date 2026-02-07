// Global configuration
let API_KEY = "";
const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent";
const MODEL = "gemini-2.5-flash-preview-09-2025";

// Load API key from storage
(async function initApiKey() {
    try {
        const result = await chrome.storage.local.get(['geminiApiKey']);
        if (result.geminiApiKey) {
            API_KEY = result.geminiApiKey;
        }
    } catch (e) {}
})();

// Note: Tailwind/CSS and other libraries must be bundled locally for extension CSP compliance.
// The CSS file `styles/tailwind.css` is injected via the manifest's `content_scripts` css entry.

// Main setup function to initialize the extension
function setup() {

// --- Toast Notification Helper ---
const showToast = (message, type = 'success') => {
    const toast = document.createElement('div');
    toast.className = `gemini-toast ${type}`;
    const icon = type === 'success' ? '✓' : '✕';
    toast.innerHTML = `<div class="gemini-toast-icon">${icon}</div><span>${message}</span>`;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideUp 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 2500);
};

// --- Helper Functions ---

// 1. Exponential Backoff for API calls (required for robustness)
const exponentialBackoffFetch = async (url, options, maxRetries = 5) => {
    let lastError = null;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await fetch(url, options);
            if (response.ok) {
                return response;
            }
            // For non-2xx status codes, wait and retry.
            lastError = new Error(`HTTP error! status: ${response.status}`);
        } catch (error) {
            // For network errors, wait and retry.
            lastError = error;
        }

        if (attempt < maxRetries - 1) {
            const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    return {
        ok: false,
        json: async () => ({
            error: {
                message: `API request failed: ${lastError.message || 'Unknown network error'}`
            }
        })
    };
};

// 2. Core Gemini API Caller

// Helper: get selection text from main document or from same-origin iframes
function getSelectionTextIncludingIframes() {
    try {
        // Prefer main window selection
        if (window.getSelection) {
            const s = window.getSelection().toString().trim();
            if (s) {
                return s;
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
            // ignore
        }

        // Walk same-origin iframes and look for selection inside them
        const iframes = document.querySelectorAll('iframe');
        
        for (let i = 0; i < iframes.length; i++) {
            const iframe = iframes[i];
            try {
                const cw = iframe.contentWindow;
                const cd = iframe.contentDocument;
                
                if (!cw && !cd) {
                    continue;
                }



                // Try iframe window selection
                try {
                    const s = (cw && cw.getSelection) ? cw.getSelection().toString().trim() : (cd && cd.getSelection ? cd.getSelection().toString().trim() : '');
                    if (s) {
                        return s;
                    }
                } catch (e) {
                    // ignore
                }

                // Try to inspect active element inside iframe (for editors like TinyMCE)
                try {
                    const iframeDoc = cd || (cw && cw.document);
                    if (!iframeDoc) {
                        continue;
                    }

                    const ae = iframeDoc.activeElement;
                    if (ae && ae.tagName) {
                        
                        if ((ae.tagName === 'TEXTAREA' || ae.tagName === 'INPUT') && typeof ae.selectionStart === 'number') {
                            const sel = ae.value.substring(ae.selectionStart, ae.selectionEnd).trim();
                            if (sel) {
                                return sel;
                            }
                        }
                        
                        if (ae.isContentEditable) {
                            const s = (cw && cw.getSelection) ? cw.getSelection().toString().trim() : (iframeDoc.getSelection ? iframeDoc.getSelection().toString().trim() : '');
                            if (s) {
                                return s;
                            }
                        }
                    }

                    // Try body text selection for TinyMCE
                    try {
                        const body = iframeDoc.body;
                        if (body && body.isContentEditable) {
                            const s2 = iframeDoc.getSelection ? iframeDoc.getSelection().toString().trim() : '';
                            if (s2) {
                                return s2;
                            }
                        }
                    } catch (e) {
                        // ignore
                    }

                } catch (e) {
                    // ignore
                }
            } catch (e) {
                // ignore
            }
        }
        

    } catch (e) {
        // ignore
    }

    // Fallback to last-known selection captured by iframe handlers
    try {
        if (currentSelectedText && currentSelectedText.trim()) {
            return currentSelectedText.trim();
        }
    } catch (e) {}

    return '';
}

const callGemini = async (userPrompt, systemPrompt, elementId, useGrounding = false) => {
    
    const outputElement = document.getElementById(elementId);
    if (!outputElement) {
        console.error('Output element not found:', elementId);
        return null;
    }

    if (!API_KEY) {
        console.error('API_KEY not set');
        outputElement.innerHTML = `<span style="color: #dc2626;">⚠ Please set your API key in the extension settings first.</span>`;
        showToast('API key not configured', 'error');
        return null;
    }

    outputElement.innerHTML = `<span style="color: #9ca3af;">Loading...</span>`;

    const payload = {
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        tools: useGrounding ? [{ "google_search": {} }] : undefined
    };

    if (!API_URL || !API_KEY) {
        console.error('Configuration error: API URL or key is missing');
        outputElement.innerHTML = `<span style="color: #dc2626;">⚠ Configuration error: API URL or key is missing.</span>`;
        return null;
    }

    const apiUrlWithKey = `${API_URL}?key=${API_KEY}`;

    try {
        const response = await exponentialBackoffFetch(apiUrlWithKey, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (text) {
            // Prefer the bundled `marked` parser if available; otherwise fall back to safe plain text rendering.
            if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
                outputElement.innerHTML = marked.parse(text);
            } else {
                // Minimal safe fallback: escape HTML and preserve line breaks
                const escapeHtml = (unsafe) => unsafe.replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#039;"})[m]);
                outputElement.innerHTML = escapeHtml(text).replace(/\n/g, '<br>');
            }
            // Show success toast
            showToast('✓ Translation complete', 'success');
            // Return the raw text for callers that need it
            return text;
        } else if (result.error?.message) {
            console.error('API Error:', result.error.message);
            outputElement.innerHTML = `<span style="color: #dc2626;">✕ Error: ${result.error.message}</span>`;
            showToast('Translation failed', 'error');
            return null;
        } else {
            console.error('No text in response');
            outputElement.innerHTML = `<span style="color: #dc2626;">✕ Error: No response received.</span>`;
            showToast('No response from API', 'error');
            return null;
        }

    } catch (e) {
        console.error('Network error in callGemini:', e);
        outputElement.innerHTML = `<span style="color: #dc2626;">✕ Network error. Check your API key.</span>`;
        showToast('Network error', 'error');
        return null;
    }
};

// Lightweight Gemini caller that returns raw text (no DOM updates). Used for popup translations.
const callGeminiRaw = async (userPrompt, systemPrompt, useGrounding = false) => {
    if (!API_KEY) {
        return { error: 'API key not configured' };
    }

    const payload = {
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        tools: useGrounding ? [{ "google_search": {} }] : undefined
    };

    const apiUrlWithKey = `${API_URL}?key=${API_KEY}`;
    try {
        const response = await exponentialBackoffFetch(apiUrlWithKey, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return { text };
        if (result.error?.message) return { error: result.error.message };
        return { error: 'No response from API' };
    } catch (e) {
        return { error: e.message || 'Network error' };
    }
};

// --- UI Construction (HTML and CSS) ---

const popupId = 'gemini-extension-popup';
const translationOutputId = 'gemini-translation-output';
const chatOutputId = 'gemini-chat-output';
const chatInputId = 'gemini-chat-input';
const languageSelectId = 'gemini-lang-select';

// The `marked` library is bundled locally as `libs/marked.min.js` and injected via the manifest before this script.

const createPopupHTML = () => `
    <style>
        #${popupId} * { box-sizing: border-box; }
        
        .gemini-scrollbar::-webkit-scrollbar {
            width: 6px;
        }
        .gemini-scrollbar::-webkit-scrollbar-track {
            background: transparent;
        }
        .gemini-scrollbar::-webkit-scrollbar-thumb {
            background: #d1d5db;
            border-radius: 3px;
        }
        .gemini-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #9ca3af;
        }
        
        .gemini-tab-button {
            flex: 1;
            padding: 10px;
            border: none;
            background: transparent;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            color: #6b7280;
            border-bottom: 2px solid transparent;
            transition: all 0.2s ease;
        }
        
        .gemini-tab-button.active {
            color: #2563eb;
            border-bottom-color: #2563eb;
        }
        
        .gemini-tab-button:hover {
            color: #374151;
        }
        
        .gemini-tab-content {
            display: none;
            animation: fadeIn 0.2s ease;
        }
        
        .gemini-tab-content.active {
            display: block;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        .gemini-toast {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: white;
            padding: 12px 16px;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            animation: slideUp 0.3s ease;
            z-index: 99999;
        }
        
        @keyframes slideUp {
            from { transform: translateY(100%); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        
        .gemini-toast.success { color: #16a34a; }
        .gemini-toast.error { color: #dc2626; }
        
        .gemini-toast-icon {
            width: 18px;
            height: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .gemini-copy-btn {
            padding: 6px 12px;
            background: #f3f4f6;
            border: 1px solid #e5e7eb;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            color: #374151;
            transition: all 0.2s ease;
        }
        
        .gemini-copy-btn:hover {
            background: #e5e7eb;
            border-color: #d1d5db;
        }
        
        .gemini-copy-btn.copied {
            background: #dbeafe;
            border-color: #93c5fd;
            color: #2563eb;
        }

        .gemini-suggestion-btn {
            transition: all 0.2s ease !important;
        }
        
        .gemini-suggestion-btn:hover {
            background: #e5e7eb !important;
            border-color: #d1d5db !important;
        }
        
        .gemini-suggestion-btn:active {
            background: #d1d5db !important;
        }
    </style>
    <div id="${popupId}" class="fixed z-[99999] shadow-2xl rounded-lg bg-white text-gray-800 border border-gray-200 transition-opacity duration-300 opacity-0 transform scale-95" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; display: none; width: 95vw; max-width: 480px; height: auto; max-height: 90vh; overflow: auto; position: fixed;">
        <!-- Close button positioned relative to popup (top-right corner) -->
        <button id="gemini-close-btn" style="position:absolute; right:10px; top:10px; z-index:2147483648; padding:4px; background:transparent; border-radius:4px; border:none; cursor:pointer; color:#6b7280;" aria-label="Close popup">
            <svg style="width:18px;height:18px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>

        <!-- Header with drag handle -->
        <div id="gemini-drag-handle" style="padding: 14px 16px; border-bottom: 1px solid #f3f4f6; cursor: grab; user-select: none;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                <img src="${chrome.runtime.getURL('logo.png')}" alt="Gemini SmartTranslator+" style="width: 28px; height: 28px; object-fit: contain; flex-shrink: 0;">
                <div style="font-weight: 600; font-size: 15px; color: #111827;">Gemini SmartTranslator+</div>
            </div>

            <!-- Language Section -->
            <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 8px; align-items: center; margin-bottom: 12px;">
                <select id="source-lang-select" style="padding: 8px 10px; font-size: 12px; border: 1px solid #e5e7eb; border-radius: 4px; background: white; color: #374151;">
                    <option value="auto">Auto-detect</option>
                    <option value="el">Greek</option>
                    <option value="en">English</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                    <option value="es">Spanish</option>
                    <option value="it">Italian</option>
                    <option value="nl">Dutch</option>
                </select>
                <svg style="width:16px;height:16px;color:#9ca3af;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                <select id="${languageSelectId}" style="padding: 8px 10px; font-size: 12px; border: 1px solid #e5e7eb; border-radius: 4px; background: white; color: #374151;">
                    <option value="en">English</option>
                    <option value="el">Greek</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                    <option value="es">Spanish</option>
                    <option value="it">Italian</option>
                    <option value="nl">Dutch</option>
                </select>
            </div>
        </div>

        <!-- Selected Text Display -->
        <div id="gemini-original-text" style="padding: 12px 16px; background: #f9fafb; border-bottom: 1px solid #f3f4f6; font-size: 13px; color: #6b7280; line-height: 1.5; min-height: 32px; max-height: 80px; overflow-y: auto;">
            <span style="color: #9ca3af;">No text selected</span>
        </div>

        <!-- Tab Navigation -->
        <div style="display: flex; border-bottom: 1px solid #f3f4f6; padding: 0 4px;">
            <button class="gemini-tab-button active" data-tab="translation" style="border-bottom: 2px solid #2563eb; color: #2563eb;">Translation</button>
            <button class="gemini-tab-button" data-tab="chat">💬 Chat</button>
        </div>

        <!-- Tab Content Container -->
        <div style="overflow-y: auto; height: calc(100% - 250px);" class="gemini-scrollbar">
            <!-- Translation Tab -->
            <div id="translation-tab" class="gemini-tab-content active" style="padding: 16px;">
                <!-- Manual Input (shown when no selection) -->
                <div id="manual-input-section" style="display: none; margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; gap:8px;">
                        <label style="font-size: 12px; font-weight: 600; color: #374151;">Paste text to translate:</label>
                        <div style="display:flex; gap:6px;">
                            <button id="gemini-clear-manual-input-btn" style="padding: 4px 8px; font-size: 11px; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 4px; color: #6b7280; cursor: pointer;">Clear</button>
                            <button id="gemini-clear-selection-btn" title="Clear selected text" style="padding: 4px 8px; font-size: 11px; background: #fff1f2; border: 1px solid #fee2e2; border-radius: 4px; color: #b91c1c; cursor: pointer;">🧹 Clear Selection</button>
                        </div>
                    </div>
                    <textarea id="gemini-manual-input" placeholder="Enter text here..." style="width: 100%; padding: 10px; font-size: 12px; border: 1px solid #e5e7eb; border-radius: 4px; resize: vertical; min-height: 80px; font-family: inherit; color: #111827;"></textarea>
                    <button id="gemini-translate-manual-btn" style="width: 100%; margin-top: 8px; padding: 8px; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500; transition: background 0.2s;">Translate</button>
                </div>

                <!-- Translation Output -->
                <div>
                    <div style="font-size: 12px; font-weight: 600; color: #374151; margin-bottom: 8px;">Translation:</div>
                    <div id="${translationOutputId}" style="padding: 12px; background: #f0f9ff; border: 1px solid #bfdbfe; border-radius: 4px; font-size: 13px; line-height: 1.6; color: #111827; min-height: 80px; max-height: 220px; overflow-y: auto; word-wrap: break-word; white-space: pre-wrap;" class="gemini-scrollbar">
                        <span style="color: #9ca3af;">Awaiting translation...</span>
                    </div>
                    <button id="gemini-copy-btn" class="gemini-copy-btn" style="width: 100%; margin-top: 8px;">📋 Copy Translation</button>
                </div>
            </div>

            <!-- Chat Tab (hidden by default; becomes visible when the Chat tab is active) -->
            <div id="chat-tab" class="gemini-tab-content" style="padding: 16px;">
                <div style="display:flex; flex-direction:column; height:100%; gap:8px;">
                    <!-- Chat Messages Container (flex child) -->
                    <div id="${chatOutputId}" style="padding: 12px; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 4px; font-size: 13px; line-height: 1.6; color: #111827; min-height: 150px; max-height: 400px; overflow-y: auto; white-space: pre-wrap; margin-bottom: 0; flex: 1;" class="gemini-scrollbar">
                    </div>

                    <!-- Chat Input + Send -->
                    <div style="display: flex; gap: 6px;">
                        <input type="text" id="${chatInputId}" placeholder="Ask a question..." style="flex: 1; padding: 8px 10px; font-size: 12px; border: 1px solid #e5e7eb; border-radius: 4px; color: #111827;">
                        <button id="gemini-send-btn" style="padding: 8px 12px; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500; transition: background 0.2s;">
                            <svg style="width:16px;height:16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
                        </button>
                    </div>

                    <!-- Clear Chat Button -->
                    <button id="gemini-clear-chat-btn" style="width: 100%; padding: 8px; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 4px; cursor: pointer; font-size: 12px; color: #6b7280; font-weight: 500; transition: all 0.2s;">🗑️ Clear Chat</button>
                </div>
            </div>
        </div>
    </div>
`;

// Inject the popup HTML into the body once
let popup = document.getElementById(popupId);
if (!popup) {
    document.body.insertAdjacentHTML('beforeend', createPopupHTML());
    popup = document.getElementById(popupId);

    // Make the popup draggable by its header
    (function attachDrag() {
        try {
            const dragHandle = document.getElementById('gemini-drag-handle');
            if (!dragHandle) return;
            
            let isDragging = false;
            let startX = 0;
            let startY = 0;
            let initialX = 0;
            let initialY = 0;
            
            // Add drag indicator styles
            dragHandle.style.cursor = 'grab';
            dragHandle.title = 'Click and drag to move';

            let lastMoveTime = 0;
            const moveThrottle = 16; // ~60fps

            const onMouseMove = (e) => {
                if (!isDragging) return;
                
                // Throttle moves to prevent too many updates
                const now = Date.now();
                if (now - lastMoveTime < moveThrottle) return;
                lastMoveTime = now;
                
                e.preventDefault();
                e.stopPropagation();
                
                // Calculate new position
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                
                // Update popup position with smooth animation
                const newX = initialX + dx;
                const newY = initialY + dy;
                
                // Keep popup within viewport with some padding
                const vw = window.innerWidth;
                const vh = window.innerHeight;
                const rect = popup.getBoundingClientRect();
                const padding = 10;
                
                const x = Math.max(padding, Math.min(newX, vw - rect.width - padding));
                const y = Math.max(padding, Math.min(newY, vh - rect.height - padding));
                
                popup.style.left = `${x}px`;
                popup.style.top = `${y}px`;
                popup.style.transform = 'none';
                popup.style.opacity = '1';
                popup.style.transition = 'none'; // Disable transitions during drag
            };

            const startDrag = (e) => {
                // Only handle drag if the event originated from the drag handle area,
                // and not from interactive elements
                if (!e.target.closest('#gemini-drag-handle') || 
                    e.target.closest('#gemini-close-btn') || 
                    e.target.closest('select')) {
                    return;
                }
                
                isDragging = true;
                const rect = popup.getBoundingClientRect();
                startX = e.clientX;
                startY = e.clientY;
                initialX = rect.left;
                initialY = rect.top;
                
                dragHandle.style.cursor = 'grabbing';
                document.addEventListener('mousemove', onMouseMove);
                e.preventDefault();
            };

            const stopDrag = () => {
                if (isDragging) {
                    isDragging = false;
                    dragHandle.style.cursor = 'grab';
                    document.removeEventListener('mousemove', onMouseMove);
                    document.body.style.userSelect = ''; // Re-enable text selection
                }
            };

            // Ensure we always cleanup even if mouse leaves window
            const cleanupDrag = () => {
                if (isDragging) {
                    isDragging = false;
                    dragHandle.style.cursor = 'grab';
                    document.removeEventListener('mousemove', onMouseMove);
                    document.body.style.userSelect = '';
                }
            };

            // Only attach drag handlers to the handle element
            dragHandle.addEventListener('mousedown', startDrag);
            document.addEventListener('mouseup', stopDrag);
            document.addEventListener('mouseleave', cleanupDrag);
            window.addEventListener('blur', cleanupDrag);

            document.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    document.removeEventListener('mousemove', onMouseMove);
                }
            });

            // Also support touch dragging
            const onTouchMove = (e) => {
                if (!isDragging || !e.touches || !e.touches[0]) return;
                e.preventDefault();
                
                const t = e.touches[0];
                const dx = t.clientX - startX;
                const dy = t.clientY - startY;
                
                const newX = initialX + dx;
                const newY = initialY + dy;
                
                const vw = window.innerWidth;
                const vh = window.innerHeight;
                const rect = popup.getBoundingClientRect();
                
                const x = Math.max(0, Math.min(newX, vw - rect.width));
                const y = Math.max(0, Math.min(newY, vh - rect.height));
                
                popup.style.left = `${x}px`;
                popup.style.top = `${y}px`;
                popup.style.transform = 'none';
                popup.style.opacity = '1';
            };

            const startTouchDrag = (e) => {
                if (!e.touches || !e.touches[0]) return;
                if (e.target.id === 'gemini-close-btn' || e.target.closest('#gemini-close-btn')) return;
                
                isDragging = true;
                const t = e.touches[0];
                const rect = popup.getBoundingClientRect();
                
                startX = t.clientX;
                startY = t.clientY;
                initialX = rect.left;
                initialY = rect.top;
                
                popup.style.cursor = 'grabbing';
                e.preventDefault();
            };

            const stopTouchDrag = () => {
                if (isDragging) {
                    isDragging = false;
                    popup.style.cursor = 'grab';
                }
            };

            popup.addEventListener('touchstart', startTouchDrag, { passive: false });
            document.addEventListener('touchmove', onTouchMove, { passive: false });
            document.addEventListener('touchend', stopTouchDrag);
            
        } catch (e) {
            // Error attaching drag handlers
        }
    })();
}

// Global variables
let currentSelectedText = "";
let isEnabled = true; // Default state is enabled

// Function to save extension state for current domain
const saveExtensionState = (enabled) => {
    const domain = window.location.hostname;
    chrome.storage.local.set({
        [`smartTranslate_${domain}`]: enabled
    });
};

// Function to load extension state for current domain
const loadExtensionState = () => {
    const domain = window.location.hostname;
    return new Promise((resolve) => {
        chrome.storage.local.get([`smartTranslate_${domain}`], (result) => {
            const state = result[`smartTranslate_${domain}`];
            isEnabled = state === undefined ? true : state;
            updateToggleButton();
            resolve(isEnabled);
        });
    });
};

// Function to update toggle button appearance
const updateToggleButton = () => {
    const toggleBtn = document.getElementById('gemini-toggle-btn');
    if (toggleBtn) {
        const onIcon = toggleBtn.querySelector('.toggle-on');
        const offIcon = toggleBtn.querySelector('.toggle-off');
        if (isEnabled) {
            onIcon.classList.remove('hidden');
            offIcon.classList.add('hidden');
            toggleBtn.classList.add('border-green-200', 'bg-green-50');
            toggleBtn.classList.remove('border-gray-300');
        } else {
            onIcon.classList.add('hidden');
            offIcon.classList.remove('hidden');
            toggleBtn.classList.remove('border-green-200', 'bg-green-50');
            toggleBtn.classList.add('border-gray-300');
        }
    }
};

// --- Event Handlers and Main Logic ---

// Generic selection handler that works for both regular pages and PDF viewers
const handleSelection = (event) => {
    // Don't process selections if extension is disabled for this domain
    if (!isEnabled) return;

    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    // Store the selected text for context menu use, but don't show popup
    if (selectedText.length > 0 && selectedText.length < 500) {
        currentSelectedText = selectedText;
    }
};

// Store last translated text for pronunciation
let lastTranslatedText = '';

// Function to translate the selected text
const translateSelectedText = async () => {
    const selectedText = currentSelectedText.trim();
    const langSelect = document.getElementById(languageSelectId);
    if (!selectedText || !langSelect) return;

    const targetLang = langSelect.value;
    const translationPrompt = `You are a professional translator. Translate the following text to the requested language. Do not add any extra commentary, just the translation. Target language: ${targetLang}. Text to translate: "${selectedText}"`;
    const systemPrompt = "Act as a professional and accurate language translator.";

    const translated = await callGemini(translationPrompt, systemPrompt, translationOutputId, false);
    if (translated) {
        lastTranslatedText = translated;
        /* Temporarily disabled TTS button handling
        const pronounceBtn = document.getElementById('gemini-pronounce-btn');
        if (pronounceBtn) pronounceBtn.style.display = 'inline-flex';
        */
    } else {
        lastTranslatedText = '';
        /* Temporarily disabled TTS button handling
        const pronounceBtn = document.getElementById('gemini-pronounce-btn');
        if (pronounceBtn) pronounceBtn.style.display = 'none';
        */
    }
};

// Function to handle the chat question
const handleChatQuestion = () => {
    const input = document.getElementById(chatInputId);
    const question = input.value.trim();
    if (!question) return;

    // Switch to chat tab
    const chatTab = document.querySelector('[data-tab="chat"]');
    const translationTab = document.querySelector('[data-tab="translation"]');
    const chatContent = document.getElementById('chat-tab');
    const translationContent = document.getElementById('translation-tab');
    
    if (chatTab) chatTab.classList.add('active');
    if (translationTab) translationTab.classList.remove('active');
    if (chatContent) chatContent.classList.add('active');
    if (translationContent) translationContent.classList.remove('active');

    // Combine selection context and user question
    let userPrompt = '';
    if (currentSelectedText && currentSelectedText.trim()) {
        userPrompt = `Context: "${currentSelectedText}"\n\nUser Question: ${question}`;
    } else {
        userPrompt = question;
    }
    const systemPrompt = "Act as a helpful study assistant. Provide a clear and concise explanation or answer. Use examples when helpful.";

    // Clear input and run chat query
    input.value = '';
    callGemini(userPrompt, systemPrompt, chatOutputId, false);
    
    // After adding new content, scroll to the bottom
    const chatOutput = document.getElementById(chatOutputId);
    if (chatOutput) {
        setTimeout(() => {
            chatOutput.scrollTop = chatOutput.scrollHeight;
        }, 100); // Small delay to ensure content is rendered
    }
};

// Expose handleChatQuestion to window
window.handleChatQuestion = handleChatQuestion;

// Function to show the popup
const showPopup = (x, y, selectedTextArg = null) => {
    if (!popup) return;

    // Use the passed selected text if provided, otherwise fall back to global
    if (typeof selectedTextArg === 'string' && selectedTextArg.trim()) {
        currentSelectedText = selectedTextArg;
    }

    // Reset UI state and show original text (may be empty when user wants to type)
    const originalEl = document.getElementById('gemini-original-text');
    if (originalEl) {
        if (currentSelectedText) {
            originalEl.innerHTML = `<strong>Selected:</strong> ${currentSelectedText}`;
            // Hide manual input if text is selected
            const manualSection = document.getElementById('manual-input-section');
            if (manualSection) manualSection.style.display = 'none';
        } else {
            originalEl.innerHTML = '<span style="color: #9ca3af;">No text selected</span>';
            // Show manual input if no text selected
            const manualSection = document.getElementById('manual-input-section');
            if (manualSection) manualSection.style.display = 'block';
        }
    }

    // Reset chat tab
    document.getElementById(chatOutputId).innerHTML = '';
    document.getElementById(chatInputId).value = '';
    
    // Reset translation output if no text
    if (!currentSelectedText) {
        document.getElementById(translationOutputId).innerHTML = '<span style="color: #9ca3af;">Awaiting translation...</span>';
    }

    // Reset to translation tab
    const translationTab = document.querySelector('[data-tab="translation"]');
    const chatTab = document.querySelector('[data-tab="chat"]');
    const translationContent = document.getElementById('translation-tab');
    const chatContent = document.getElementById('chat-tab');
    
    if (translationTab) translationTab.classList.add('active');
    if (chatTab) chatTab.classList.remove('active');
    if (translationContent) translationContent.classList.add('active');
    if (chatContent) chatContent.classList.remove('active');

    // Show the popup centered in the viewport by default (will be clamped below)
    popup.style.display = 'block';
    popup.style.left = '50%';
    popup.style.top = '50%';
    popup.style.transform = 'translate(-50%, -50%)';
    
    // Ensure maximum visibility
    popup.style.zIndex = '2147483647';
    popup.style.pointerEvents = 'auto';

    // Wait a frame so layout updates and sizes are available
    requestAnimationFrame(() => {
        try {
            popup.classList.remove('opacity-0', 'scale-95');
            // Force visible inline styles to override page CSS if necessary
            popup.style.opacity = '1';
            popup.style.transform = 'none';

            // Measure and clamp to viewport so it doesn't appear off-screen
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const rect = popup.getBoundingClientRect();
            const pw = rect.width || popup.offsetWidth || 400;
            const ph = rect.height || popup.offsetHeight || 400;

            let finalX = parseFloat(popup.style.left) || x;
            let finalY = parseFloat(popup.style.top) || (y + 15);

            // If it goes off the right edge, move it left
            if (finalX + pw + 20 > vw) finalX = Math.max(20, vw - pw - 20);
            // If it goes off the bottom edge, move it up
            if (finalY + ph + 20 > window.scrollY + vh) finalY = Math.max(20, window.scrollY + vh - ph - 20);
            // Ensure not too far left or top
            if (finalX < 20) finalX = 20;
            if (finalY < 20) finalY = 20;

            popup.style.left = `${finalX}px`;
            popup.style.top = `${finalY}px`;
        } catch (e) {
            // Failed to finalize popup position
        }
    });

    // Automatically trigger translation only when there is selected text
    if (currentSelectedText && currentSelectedText.trim().length > 0) {
        translateSelectedText();
    }
};

// Function to hide the popup
const hidePopup = () => {
    if (!popup) return;
    popup.classList.add('opacity-0', 'scale-95');
    setTimeout(() => {
        popup.style.display = 'none';
    }, 300);
};

// Function to inject into PDF frames
const injectIntoPdfViewer = () => {
    const viewers = document.querySelectorAll('iframe[src*=".pdf"], embed[type="application/pdf"]');
    viewers.forEach(viewer => {
        try {
            const viewerDoc = viewer.contentDocument || viewer.contentWindow?.document;
            if (viewerDoc) {
                viewerDoc.addEventListener('mouseup', handleSelection);
                viewerDoc.addEventListener('touchend', handleSelection);
            }
        } catch (e) {
        }
    });
};

// Watch for PDF viewers being added to the page
// PDF viewer injection removed to simplify and avoid unreliable PDF-frame behavior

// --- Iframe selection helpers ---
// Attach mouseup/selectionchange listeners to same-origin iframes so we can reliably capture selections
function attachIframeSelectionListeners() {
    try {
        const iframes = Array.from(document.querySelectorAll('iframe'));
        iframes.forEach((iframe, idx) => {
            try {
                const id = iframe.id || iframe.name || `frame-${idx}`;
                // Skip if listeners already attached
                if (iframe.__gemini_listeners_attached) return;
                const cw = iframe.contentWindow;
                const cd = iframe.contentDocument;
                if (!cw || !cd) return; // probably cross-origin

                const iframeHandler = () => {
                    try {
                        const s = (cd.getSelection ? cd.getSelection().toString().trim() : '') || (cw.getSelection ? cw.getSelection().toString().trim() : '');
                        if (s && s.length > 0) {
                            currentSelectedText = s;
                        }
                    } catch (e) {
                        // ignore iframe access errors
                    }
                };

                // Add listeners
                try { cd.addEventListener('mouseup', iframeHandler); } catch (e) {}
                try { cd.addEventListener('selectionchange', iframeHandler); } catch (e) {}
                try { cd.addEventListener('touchend', iframeHandler); } catch (e) {}

                iframe.__gemini_listeners_attached = true;
            } catch (e) {
                // ignore per-iframe errors
            }
        });
    } catch (e) {
        // ignore
    }
}

// Observe added/removed iframes and attach listeners dynamically
let __gemini_iframe_observer = null;
function initIframeMutationObserver() {
    try {
        if (__gemini_iframe_observer) return;
        __gemini_iframe_observer = new MutationObserver(mutations => {
            for (const m of mutations) {
                if (m.addedNodes && m.addedNodes.length) {
                    for (const n of m.addedNodes) {
                        if (n && n.tagName && n.tagName.toLowerCase() === 'iframe') {
                            // newly added iframe
                            attachIframeSelectionListeners();
                        }
                    }
                }
            }
        });
        __gemini_iframe_observer.observe(document.documentElement || document.body, { childList: true, subtree: true });
    } catch (e) {
        // ignore
    }
}

// Run once at startup
try { attachIframeSelectionListeners(); initIframeMutationObserver(); } catch (e) {}

// --- Diagnostics (feature-flagged) ---
// Adds run-time inspection of frames and shadow roots to help debug pages like ServiceNow
const DIAGNOSTICS_STORAGE_KEY = 'geminiDiagnosticsEnabled';
const DIAGNOSTICS_REPORT_KEY = 'geminiDiagnosticsReport';

async function isDiagnosticsEnabled() {
    try {
        return new Promise((resolve) => {
            chrome.storage && chrome.storage.local ? chrome.storage.local.get([DIAGNOSTICS_STORAGE_KEY], (r) => resolve(!!(r && r[DIAGNOSTICS_STORAGE_KEY]))) : resolve(false);
        });
    } catch (e) {
        return false;
    }
}

function safeTextSummary(s) {
    if (!s) return '';
    return String(s).trim().slice(0, 200);
}

function collectShadowRoots(root) {
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
                    containsText: safeTextSummary(host.textContent),
                    childrenCount: host.childElementCount || 0
                };
                results.push(elInfo);
                // Recurse into the shadowRoot children
                Array.from(host.shadowRoot.querySelectorAll('*')).slice(0, 50).forEach((c) => {
                    // If nested shadow roots, pick them up in later iterations
                    if (c.shadowRoot) walk(c);
                });
            }
            // Recurse children (limited depth)
            if (node.children && node.children.length) {
                for (let i = 0; i < Math.min(node.children.length, 50); i++) walk(node.children[i]);
            }
        } catch (e) {
            // ignore
        }
    };

    try { walk(root || document.documentElement || document.body); } catch (e) {}
    return results;
}

function collectIframeInfo() {
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
            // Test same-origin by attempting to read location.href
            const cw = iframe.contentWindow;
            const cd = iframe.contentDocument;
            if (cw && cd) {
                try {
                    info.sameOrigin = true;
                    info.location = cw.location && cw.location.href ? safeTextSummary(cw.location.href) : '';
                    // Check iframe selection if accessible
                    try {
                        const sel = (cw.getSelection && cw.getSelection().toString && cw.getSelection().toString()) || (cd.getSelection && cd.getSelection().toString && cd.getSelection().toString());
                        info.hasSelection = !!(sel && sel.toString().trim());
                    } catch (e) { info.hasSelection = false; }
                    // Check for active element text
                    try { 
                        const ae = cd.activeElement;
                        if (ae) info.activeElement = { tag: ae.tagName || '', id: ae.id || '', text: safeTextSummary(ae.textContent || ae.value) };
                    } catch (e) {}
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
}

async function runDiagnostics() {
    const enabled = await isDiagnosticsEnabled();
    const report = {
        timestamp: Date.now(),
        pageUrl: location.href,
        selection: safeTextSummary(window.getSelection && window.getSelection().toString && window.getSelection().toString()),
        frames: collectIframeInfo(),
        shadowRoots: collectShadowRoots(document.documentElement),
        listenersAttachedCount: document.querySelectorAll && document.querySelectorAll('[__gemini_listeners_attached]').length || 0
    };

    try {
        chrome.storage && chrome.storage.local && chrome.storage.local.set && chrome.storage.local.set({[DIAGNOSTICS_REPORT_KEY]: report});
    } catch (e) {}

    if (enabled) {
        try { console.info('SmartTranslate diagnostics report:', report); } catch (e) {}
    }

    return report;
}

// Expose diagnostics runner for manual invocation (developer/testing only)
try { window.__gemini_runDiagnostics = runDiagnostics; } catch (e) {}

// Message handler to trigger diagnostics from popup or background
chrome.runtime && chrome.runtime.onMessage && chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message) return;
    if (message.type === 'smarttranslate:run-diagnostics') {
        (async () => {
            try {
                const report = await runDiagnostics();
                sendResponse({ ok: true, report });
            } catch (e) {
                sendResponse({ ok: false, error: String(e) });
            }
        })();
        return true; // async
    }
});



// Listen for state changes and API key updates from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'smarttranslate:state-change') {
        isEnabled = message.enabled;
        const floatingBtn = document.getElementById('gemini-floating-btn');
        // Desired behavior: when ENABLED, show/create the floating button and make it usable.
        // When DISabled, hide/remove the floating button so users can't trigger it from the page.
        if (isEnabled) {
            // Show or create the floating button for this domain
            if (floatingBtn) {
                try { floatingBtn.style.display = ''; } catch (e) {}
            } else {
                ensureFloatingButton(); // Create button if it doesn't exist
            }
        } else {
            // Remove the floating button on this page when disabled
            if (floatingBtn) {
                try { floatingBtn.remove(); } catch (e) { floatingBtn.style.display = 'none'; }
            }
            if (popup) hidePopup(); // hide inline popup when disabling
        }
        sendResponse({ success: true });
    }
    else if (message.type === 'smarttranslate:api-key-updated') {
        API_KEY = message.apiKey;
        sendResponse({ success: true });
    }



    else if (message.type === 'smarttranslate:translate-selection') {
        // Handle popup-initiated translation requests. Responds asynchronously with { ok, text }.
        (async () => {
            try {
                const selectionText = (message.selection && String(message.selection).trim()) || getSelectionTextIncludingIframes();
                if (!selectionText) {
                    sendResponse({ ok: false, error: 'no-selection' });
                    return;
                }
                currentSelectedText = selectionText;
                // Determine target language from popup message or page selector
                const targetLang = (message.targetLang) || (document.getElementById(languageSelectId) ? document.getElementById(languageSelectId).value : 'en');
                const userPrompt = `You are a professional translator. Translate the following text to the requested language. Do not add any extra commentary, just the translation. Target language: ${targetLang}. Text to translate: "${currentSelectedText}"`;
                const systemPrompt = 'Act as a professional and accurate language translator.';
                const res = await callGeminiRaw(userPrompt, systemPrompt, false);
                if (res.error) sendResponse({ ok: false, error: res.error });
                else sendResponse({ ok: true, text: res.text });
            } catch (e) {
                sendResponse({ ok: false, error: e.message || 'internal-error' });
            }
        })();
        return true; // keep channel open for async sendResponse
    }
    return true; // Keep channel open for async response
});

// Load initial state
loadExtensionState();

// Listen for messages from the background/service worker (e.g., context menu clicks)
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        try {
            if (msg && msg.type === 'smarttranslate:show-popup') {
                const selectionText = msg.selection || getSelectionTextIncludingIframes();
                if (!selectionText || selectionText.trim().length === 0) {
                    return;
                }
                currentSelectedText = selectionText.trim();

                // Try to position popup near the selection's bounding rectangle if possible
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
                    // ignore and fall back to default coords
                }

                showPopup(x, y);
                sendResponse({ ok: true });
            }
        } catch (err) {
            // Error handling runtime message
        }
        // indicate async response if needed
        return true;
    });
}

// Toast notification helper
const copyToClipboard = async (text) => {
    try {
        await navigator.clipboard.writeText(text);
        const copyBtn = document.getElementById('gemini-copy-btn');
        if (copyBtn) {
            copyBtn.classList.add('copied');
            copyBtn.textContent = '✓ Copied!';
            setTimeout(() => {
                copyBtn.classList.remove('copied');
                copyBtn.textContent = '📋 Copy Translation';
            }, 2000);
        }
        showToast('Translation copied to clipboard', 'success');
    } catch (err) {
        showToast('Failed to copy', 'error');
    }
};

// Tab switching functionality
document.addEventListener('click', (event) => {
    try {
        if (!event || !event.target) return;
        const tabButton = event.target.closest && event.target.closest('.gemini-tab-button');
        if (!tabButton) return;
        
        const tabName = tabButton.dataset && tabButton.dataset.tab;
        if (!tabName) return;
        
        const allButtons = document.querySelectorAll('.gemini-tab-button');
        const allTabs = document.querySelectorAll('.gemini-tab-content');
        
        allButtons.forEach(btn => btn.classList.remove('active'));
        allTabs.forEach(tab => tab.classList.remove('active'));
        
        tabButton.classList.add('active');
        const activeTab = document.getElementById(`${tabName}-tab`);
        if (activeTab) activeTab.classList.add('active');
    } catch (e) {
        console.error('Error in tab switching handler:', e);
    }
});

// Copy button event listener
document.addEventListener('click', (event) => {
    try {
        if (event.target.id === 'gemini-copy-btn' || (event.target.closest && event.target.closest('#gemini-copy-btn'))) {
            const translationOutput = document.getElementById(translationOutputId);
            if (translationOutput) {
                const text = translationOutput.textContent.trim();
                if (text && text !== 'Awaiting translation...') {
                    copyToClipboard(text);
                }
            }
        }
    } catch (e) {
        console.error('Error in copy button handler:', e);
    }
});

// Event listener for the close button
document.addEventListener('click', (event) => {
    try {
        if (!event.target) return;
        if (event.target.id === 'gemini-close-btn' || (event.target.closest && event.target.closest('#gemini-close-btn'))) {
            hidePopup();
        }
    } catch (e) {
        console.error('Error in close button handler:', e);
    }
});

// Event listener for language change (to re-translate)
document.addEventListener('change', (event) => {
    try {
        if (event.target.id === languageSelectId) {
            translateSelectedText();
        }
    } catch (e) {
        console.error('Error in language change handler:', e);
    }
});

// Event listener for sending the chat question and manual controls
document.addEventListener('click', (event) => {
    try {
        if (!event || !event.target) return;

        // Send chat question
        if (event.target.id === 'gemini-send-btn' || (event.target.closest && event.target.closest('#gemini-send-btn'))) {
            handleChatQuestion();
            return;
        }

        // Manual-translate button (when user pasted/typed text)
        if (event.target.id === 'gemini-translate-manual-btn' || (event.target.closest && event.target.closest('#gemini-translate-manual-btn'))) {
            const inp = document.getElementById('gemini-manual-input');
            if (!inp) return;
            const text = inp.value.trim();
            if (!text) return;
            currentSelectedText = text;
            // Update original text display
            const originalEl = document.getElementById('gemini-original-text');
            if (originalEl) originalEl.innerHTML = `<strong>To Translate:</strong> ${text}`;
            // Translate using current language selection
            translateSelectedText();
            return;
        }

        // Clear manual input textarea
        if (event.target.id === 'gemini-clear-manual-input-btn' || (event.target.closest && event.target.closest('#gemini-clear-manual-input-btn'))) {
            const inp = document.getElementById('gemini-manual-input');
            if (inp) inp.value = '';
            return;
        }

        // Clear the selected text (deselect on page and clear state)
        if (event.target.id === 'gemini-clear-selection-btn' || (event.target.closest && event.target.closest('#gemini-clear-selection-btn'))) {
            try {
                // Clear selection in page
                try { window.getSelection && window.getSelection().removeAllRanges(); } catch (e) {}

                // Clear internal selection state
                currentSelectedText = '';

                // Update UI: original text area
                const originalEl = document.getElementById('gemini-original-text');
                if (originalEl) originalEl.innerHTML = '<span style="color: #9ca3af;">No text selected</span>';

                // Show manual input section so user can paste text
                const manualSection = document.getElementById('manual-input-section');
                if (manualSection) manualSection.style.display = 'block';

                // Clear translation output
                const translationOutput = document.getElementById(translationOutputId);
                if (translationOutput) translationOutput.innerHTML = '<span style="color: #9ca3af;">Awaiting translation...</span>';

                // Clear chat output
                const chatOutput = document.getElementById(chatOutputId);
                if (chatOutput) chatOutput.innerHTML = '<span style="color: #9ca3af;">💬 Start a conversation about the selected text...</span>';

                showToast('Selection cleared', 'success');
            } catch (e) {
                console.error('Error clearing selection:', e);
                showToast('Could not clear selection', 'error');
            }
            return;
        }

    } catch (e) {
        console.error('Error in send/translate button handler:', e);
    }
});

/* Temporarily disabled TTS functionality
// Pronunciation handling using Web Speech API
// Global handle to the current utterance
let __gemini_current_utterance = null;

// Helper: clean text for TTS to avoid character-by-character pronunciation
const cleanTTS = (text) => {
    if (!text) return '';
    // remove zero-width/soft hyphens and multiple whitespace
    return String(text)
        .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
};

// Helper: choose best voice for language code (bcp prefix) with heuristics
const chooseVoiceForLang = (langTag) => {
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    const target = (langTag || '').toLowerCase();
    const prefix = target.split('-')[0];

    // Scoring heuristic
    const scoreVoice = (voice) => {
        let score = 0;
        const vlang = (voice.lang || '').toLowerCase();
        const name = (voice.name || '').toLowerCase();

        // exact language match is best
        if (vlang === target) score += 100;
        // prefix match (e.g., 'el' matches 'el-gr')
        if (vlang.startsWith(prefix) && prefix) score += 60;
        // prefer known providers in the name
        if (name.includes('google')) score += 30;
        if (name.includes('microsoft') || name.includes('azure')) score += 25;
        if (name.includes('amazon') || name.includes('polly')) score += 20;
        // prefer voices whose name contains the language name
        if ((prefix === 'el' && (name.includes('greek') || name.includes('ell')))) score += 20;
        if ((prefix === 'nl' && (name.includes('dutch') || name.includes('nederlands')))) score += 20;
        // prefer default voice slightly
        if (voice.default) score += 5;
        return score;
    };

    let best = null;
    let bestScore = -Infinity;
    for (const v of voices) {
        const s = scoreVoice(v);
        if (s > bestScore) {
            bestScore = s;
            best = v;
        }
    }

    return best || null;
};

document.addEventListener('click', (event) => {
    const t = event.target;

    // Stop button
    if (t.id === 'gemini-stop-tts-btn' || t.closest('#gemini-stop-tts-btn')) {
        try { window.speechSynthesis.cancel(); } catch(e) {}
        __gemini_current_utterance = null;
        return;
    }

    // Play translation
    if (t.id === 'gemini-pronounce-btn' || t.closest('#gemini-pronounce-btn')) {
        if (!lastTranslatedText) return;
        const langMap = {
            'el': 'el-GR', 'en': 'en-US', 'fr': 'fr-FR', 'de': 'de-DE', 'es': 'es-ES', 'it': 'it-IT', 'nl': 'nl-NL'
        };
        const langSelect = document.getElementById(languageSelectId);
        const target = langSelect ? langSelect.value : 'en';
        const langTag = langMap[target] || target;
        const text = cleanTTS(lastTranslatedText);
        if (!text) return;

        try {
            window.speechSynthesis.cancel();
            const utter = new SpeechSynthesisUtterance(text);
            utter.lang = langTag;
            // pick a suitable voice
            const voice = chooseVoiceForLang(langTag);
            if (voice) utter.voice = voice;
            // tuning per language
            const langPrefix = (langTag || '').split('-')[0];
            const rateMap = { 'el': 0.95, 'nl': 1.0, 'fr': 1.0, 'de': 1.0, 'es': 1.0 };
            const pitchMap = { 'el': 1.0, 'nl': 1.0 };
            utter.rate = rateMap[langPrefix] || 1.0;
            utter.pitch = pitchMap[langPrefix] || 1.0;
            __gemini_current_utterance = utter;
            window.speechSynthesis.speak(utter);
        } catch (e) {
            // Speech synthesis not available
        }
        return;
    }

    // Play selection
    if (t.id === 'gemini-pronounce-selection-btn' || t.closest('#gemini-pronounce-selection-btn')) {
        const selectionText = (currentSelectedText || '').trim();
        if (!selectionText) {
            // try window selection fallback
            const sel = window.getSelection();
            if (sel) selectionText = sel.toString().trim();
        }
        if (!selectionText) return;

        // pick a reasonable lang for selected text (use source select)
        const srcSelect = document.getElementById('source-lang-select');
        const src = srcSelect ? srcSelect.value : 'auto';
        const langMap = { 'el': 'el-GR', 'en': 'en-US', 'fr': 'fr-FR', 'de': 'de-DE', 'es': 'es-ES', 'it': 'it-IT', 'nl': 'nl-NL' };
        const langTag = (langMap[src] || (src === 'auto' ? 'en-US' : src));

        const text = cleanTTS(selectionText);
        try {
            window.speechSynthesis.cancel();
            const utter = new SpeechSynthesisUtterance(text);
            utter.lang = langTag;
            const voice = chooseVoiceForLang(langTag);
            if (voice) utter.voice = voice;
            const langPrefix = (langTag || '').split('-')[0];
            const rateMap = { 'el': 0.95, 'nl': 1.0, 'fr': 1.0, 'de': 1.0, 'es': 1.0 };
            const pitchMap = { 'el': 1.0, 'nl': 1.0 };
            utter.rate = rateMap[langPrefix] || 1.0;
            utter.pitch = pitchMap[langPrefix] || 1.0;
            __gemini_current_utterance = utter;
            window.speechSynthesis.speak(utter);
        } catch (e) {
            // Speech synthesis not available
        }
        return;
    }
});
*/

// Event listener for pressing Enter in the chat input
document.addEventListener('keypress', (event) => {
    try {
        if (event && event.target && event.target.id === chatInputId && event.key === 'Enter') {
            event.preventDefault();
            handleChatQuestion();
        }
    } catch (e) {
        console.error('Error in chat input keypress handler:', e);
    }
});

// Hide the popup when clicking anywhere outside of it, except on selection
document.addEventListener('mousedown', (event) => {
    if (popup && popup.style.display === 'block' && !popup.contains(event.target) && window.getSelection().toString().length === 0) {
        hidePopup();
    }
});

// Floating action button: opens the same popup used by the right-click/context-menu flow
function ensureFloatingButton() {
    // expose to global so external callers / intervals can invoke it without ReferenceError
    try { window.ensureFloatingButton = ensureFloatingButton; } catch (e) {}
    try {
        // Respect per-domain enabled state stored as `smartTranslate_{domain}` and restore position
        const domain = window.location.hostname;
        const key = `smartTranslate_${domain}`;
        chrome.storage.local.get([key, 'geminiFloatingPos'], (res) => {
            try {
                const enabled = res && (typeof res[key] !== 'undefined') ? res[key] : true;
                const FLOATING_BTN_ID = 'gemini-floating-btn';
                const existingBtn = document.getElementById(FLOATING_BTN_ID);

                if (!enabled) {
                    // If extension is disabled for this domain, ensure the button is removed
                    if (existingBtn) { try { existingBtn.remove(); } catch (e) { existingBtn.style.display = 'none'; } }
                    return;
                }

                // If button already exists, ensure style is correct and return
                if (existingBtn) {
                    try {
                        existingBtn.style.zIndex = '2147483647';
                        existingBtn.style.background = existingBtn.style.background || `url('${chrome.runtime.getURL('logo.png')}') center/60% no-repeat #ffffff`;
                        existingBtn.style.display = '';
                        // Ensure button is within viewport if page was resized (clamp stored position)
                        try {
                            const vw = window.innerWidth;
                            const vh = window.innerHeight;
                            const bw = existingBtn.offsetWidth || 56;
                            const bh = existingBtn.offsetHeight || 56;
                            const padding = 8;
                            let left = existingBtn.style.left ? parseFloat(existingBtn.style.left) : null;
                            let top = existingBtn.style.top ? parseFloat(existingBtn.style.top) : null;
                            if (left !== null) {
                                left = Math.max(padding, Math.min(left, vw - bw - padding));
                                existingBtn.style.left = `${left}px`;
                                existingBtn.style.right = '';
                            }
                            if (top !== null) {
                                top = Math.max(padding, Math.min(top, vh - bh - padding));
                                existingBtn.style.top = `${top}px`;
                                existingBtn.style.bottom = '';
                            }
                        } catch (e) {}
                    } catch (e) {}
                    return;
                }

                // Create the floating button
                const btn = document.createElement('button');
                btn.id = FLOATING_BTN_ID;
                btn.setAttribute('aria-label', 'Translate/Explain');
                btn.title = 'Translate/Explain (dblclick to hide, Ctrl+Shift+G to toggle)';
                btn.style.touchAction = 'none';

                Object.assign(btn.style, {
                    position: 'fixed',
                    bottom: '28px',
                    right: '28px',
                    zIndex: '2147483647',
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)',
                    background: `url('${chrome.runtime.getURL('logo.png')}') center/54% no-repeat #ffffff`,
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0',
                    transition: 'all 0.2s ease-in-out',
                    transform: 'scale(1)'
                });

                // Hover
                btn.addEventListener('mouseenter', () => { btn.style.transform = 'scale(1.05)'; btn.style.boxShadow = '0 12px 32px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.10)'; });
                btn.addEventListener('mouseleave', () => { btn.style.transform = 'scale(1)'; btn.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)'; });

                // Click handler - only trigger if not dragging
                btn.addEventListener('click', (ev) => {
                    if (!isEnabled) return; // Don't process clicks if disabled
                    // Calculate if this was a drag (check distance moved)
                    const dragDistance = Math.sqrt(
                        Math.pow(ev.clientX - startX, 2) + 
                        Math.pow(ev.clientY - startY, 2)
                    );
                    if (dragDistance > 5) return;
                    try {
                        if (!document.body.contains(btn)) return;
                        const selection = window.getSelection();
                        let selectionText = selection ? selection.toString().trim() : '';
                        let x = ev.clientX || 20;
                        let y = ev.clientY || 20;
                        if (selection && selection.rangeCount > 0) {
                            const range = selection.getRangeAt(0);
                            const rect = range.getBoundingClientRect();
                            if (rect) { x = (rect.left || x) + window.scrollX; y = (rect.top || rect.bottom || 0) + window.scrollY; }
                        }
                        // Always pass the selected text to showPopup
                        showPopup(x, y, selectionText);
                    } catch (e) {}
                });

                // Draggable with click detection
                let isDragging = false;
                let dragStartTime = 0;
                let startX = 0, startY = 0, initialLeft = 0, initialTop = 0;
                
                const onPointerMove = (e) => {
                    if (!isDragging) return;
                    const dx = e.clientX - startX;
                    const dy = e.clientY - startY;
                    const vw = window.innerWidth;
                    const vh = window.innerHeight;
                    const bw = 56;
                    const bh = 56;
                    let nx = initialLeft + dx;
                    let ny = initialTop + dy;
                    const padding = 8;
                    nx = Math.max(padding, Math.min(nx, vw - bw - padding));
                    ny = Math.max(padding, Math.min(ny, vh - bh - padding));
                    btn.style.left = `${nx}px`;
                    btn.style.top = `${ny}px`;
                    btn.style.right = '';
                    btn.style.bottom = '';
                    btn.style.transition = 'none';
                };
                
                const onPointerUp = (e) => {
                    if (!isDragging) return;
                    isDragging = false;
                    const dragTime = Date.now() - dragStartTime;
                    const dx = e.clientX - startX;
                    const dy = e.clientY - startY;
                    const dragDistance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dragDistance > 5 || dragTime > 200) {
                        chrome.storage.local.set({
                            geminiFloatingPos: {
                                left: btn.style.left,
                                top: btn.style.top
                            }
                        });
                        // Clear the stuck-edge state because the user manually repositioned the button
                        try { delete btn.dataset.geminiStuck; } catch (e) {}

                        // Restart the auto-hide timer so the button will hide again after inactivity
                        try { if (typeof startAutoHideTimer === 'function') startAutoHideTimer(); } catch (e) {}
                    }
                    
                    try {
                        btn.releasePointerCapture && btn.releasePointerCapture(e.pointerId);
                    } catch (e) {}
                    document.removeEventListener('pointermove', onPointerMove);
                    document.removeEventListener('pointerup', onPointerUp);
                };
                
                btn.addEventListener('pointerdown', (e) => {
                    if (!document.body.contains(btn)) return;
                    isDragging = true;
                    dragStartTime = Date.now();
                    startX = e.clientX;
                    startY = e.clientY;
                    const rect = btn.getBoundingClientRect();
                    initialLeft = rect.left;
                    initialTop = rect.top;
                    btn.style.left = `${initialLeft}px`;
                    btn.style.top = `${initialTop}px`;
                    btn.style.right = '';
                    btn.style.bottom = '';
                    btn.setPointerCapture(e.pointerId);
                    document.addEventListener('pointermove', onPointerMove);
                    document.addEventListener('pointerup', onPointerUp);
                });

                // Double-click to disable for this domain
                btn.addEventListener('dblclick', () => { try { btn.remove(); } catch (e) { btn.style.display = 'none'; } chrome.storage.local.set({ [key]: false }); });

                // Keyboard toggle: Ctrl+Shift+G toggles per-domain enabled state
                document.addEventListener('keydown', (e) => {
                    if (e.ctrlKey && e.shiftKey && e.key && e.key.toLowerCase() === 'g') {
                        chrome.storage.local.get([key], (res2) => {
                            const cur = res2 && (typeof res2[key] !== 'undefined') ? res2[key] : true;
                            const next = !cur;
                            chrome.storage.local.set({ [key]: next }, () => {
                                if (!next) { try { btn.remove(); } catch (e) { btn.style.display = 'none'; } }
                                else { btn.style.display = ''; }
                            });
                        });
                    }
                });

                // Restore position if available and clamp to current viewport so it doesn't remain off-screen
                if (res && res.geminiFloatingPos) {
                    try {
                        const vw = window.innerWidth;
                        const vh = window.innerHeight;
                        const bw = 56;
                        const bh = 56;
                        const padding = 8;
                        let left = null;
                        let top = null;
                        if (res.geminiFloatingPos.left) {
                            left = parseFloat(String(res.geminiFloatingPos.left).replace('px',''));
                        }
                        if (res.geminiFloatingPos.top) {
                            top = parseFloat(String(res.geminiFloatingPos.top).replace('px',''));
                        }
                        if (left === null) {
                            // fallback to right/bottom preset
                            btn.style.right = btn.style.right || '28px';
                            btn.style.bottom = btn.style.bottom || '28px';
                        } else {
                            left = Math.max(padding, Math.min(left, vw - bw - padding));
                            btn.style.left = `${left}px`;
                            btn.style.right = '';
                        }
                        if (top === null) {
                            // fallback handled by bottom/right
                        } else {
                            top = Math.max(padding, Math.min(top, vh - bh - padding));
                            btn.style.top = `${top}px`;
                            btn.style.bottom = '';
                        }
                    } catch (e) {
                        // ignore restore errors
                    }
                }

                // --- Auto-hide floating button behavior ---
                let __gemini_hide_timer = null;
                const __GEMINI_HIDE_DELAY = 3000; // ms
                const startAutoHideTimer = () => { try { clearTimeout(__gemini_hide_timer); } catch (e) {} ; __gemini_hide_timer = setTimeout(() => { try { hideFloatingToEdge(); } catch (e) {} }, __GEMINI_HIDE_DELAY); };
                const stopAutoHideTimer = () => { try { if (__gemini_hide_timer) { clearTimeout(__gemini_hide_timer); __gemini_hide_timer = null; } } catch (e) {} };

                const hideFloatingToEdge = () => {
                    try {
                        if (!btn || btn.dataset.geminiHidden === '1') return;
                        const rect = btn.getBoundingClientRect();
                        let topPx = rect.top || 100;
                        const vw = window.innerWidth, vh = window.innerHeight;
                        const padding = 8;
                        topPx = Math.max(padding, Math.min(topPx, vh - 40 - padding));

                        // Save current coords
                        btn.dataset.savedLeft = btn.style.left || '';
                        btn.dataset.savedTop = btn.style.top || '';
                        btn.dataset.savedRight = btn.style.right || '';
                        btn.dataset.savedBottom = btn.style.bottom || '';

                        btn.style.transition = 'all 0.25s ease-in-out';
                        btn.style.width = '40px';
                        btn.style.height = '40px';
                        btn.style.borderRadius = '8px';
                        btn.style.right = '6px';
                        btn.style.left = '';
                        btn.style.top = `${topPx}px`;
                        btn.style.bottom = '';
                        btn.style.opacity = '0.92';
                        // Make this hidden state a sticky "edge" state — it should remain stuck on the right edge
                        btn.dataset.geminiHidden = '1';
                        btn.dataset.geminiStuck = '1';
                        // Ensure it sits above page content when stuck
                        btn.style.zIndex = '2147483647';
                    } catch (e) { /* ignore */ }
                };

                const showFloatingFromEdge = () => {
                    try {
                        if (!btn || btn.dataset.geminiHidden !== '1') return;
                        btn.style.transition = 'all 0.18s ease-out';
                        btn.style.width = '56px';
                        btn.style.height = '56px';
                        btn.style.borderRadius = '50%';
                        btn.style.opacity = '1';

                        const savedLeft = btn.dataset.savedLeft;
                        const savedTop = btn.dataset.savedTop;
                        const savedRight = btn.dataset.savedRight;
                        const savedBottom = btn.dataset.savedBottom;
                        if (savedLeft) { btn.style.left = savedLeft; btn.style.right = ''; }
                        else if (savedRight) { btn.style.right = savedRight; btn.style.left = ''; }
                        if (savedTop) { btn.style.top = savedTop; btn.style.bottom = ''; }
                        else if (savedBottom) { btn.style.bottom = savedBottom; btn.style.top = ''; }

                        // If no saved coordinates exist, place at a sensible bottom-right default
                        if (!savedLeft && !savedRight) {
                            btn.style.right = '12px';
                            btn.style.left = '';
                        }
                        if (!savedTop && !savedBottom) {
                            btn.style.bottom = '12px';
                            btn.style.top = '';
                        }

                        btn.dataset.geminiHidden = '0';
                        // Clearing stuck flag — user explicitly expanded the button
                        delete btn.dataset.geminiStuck;
                        // Do not auto-hide again automatically; prefer manual user control
                    } catch (e) { /* ignore */ }
                };

                // Expand on click/tap only to avoid hover-based reflow or re-hiding
                btn.addEventListener('click', (ev) => { try { ev.preventDefault(); showFloatingFromEdge(); } catch (e) {} });

                // For drag interactions, still stop the hide timer while dragging; but we won't auto-restart the timer on pointerup
                btn.addEventListener('pointerdown', () => { try { stopAutoHideTimer(); } catch (e) {} });
                btn.addEventListener('pointerup', () => { try { /* no automatic restart — remains in user state */ } catch (e) {} });

                // Start hide timer initially
                startAutoHideTimer();

                document.body.appendChild(btn);
            } catch (e) {
                // ignore pages where DOM is restricted
            }
        });
    } catch (e) {}
}

    // Initialize floating button when DOM is ready or immediately if already loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ensureFloatingButton);
    } else {
        ensureFloatingButton();
    }
} // End of setup()

// Initialize the extension
setup();
