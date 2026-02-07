// UI module for popup, floating button, and user interface management

const UI = {
    popup: null,
    floatingButton: null,
    chatHistory: [],
    eventListeners: [],
    isEnabled: true,

    // Toast notification helper
    showToast: (message, type = 'success') => {
        const toast = document.createElement('div');
        toast.className = `gemini-toast ${type}`;
        const icon = type === 'success' ? '✓' : (type === 'warning' ? '⚠' : '✕');
        toast.innerHTML = `<div class="gemini-toast-icon">${icon}</div><span>${Security.escapeHtml(message)}</span>`;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideUp 0.3s ease reverse';
            setTimeout(() => toast.remove(), CONFIG.TOAST_ANIMATION_DURATION);
        }, CONFIG.TOAST_DURATION);
    },

    // Check if the extension context is still valid, if not show a warning
    checkContext: () => {
        if (typeof Storage !== 'undefined' && !Storage.isContextValid()) {
            UI.showToast('Extension updated. Please refresh the page to continue.', 'warning');
            return false;
        }
        return true;
    },

    // Create popup HTML
    createPopupHTML: () => {
        const ids = CONFIG.ELEMENT_IDS;
        const languages = Object.entries(CONFIG.LANGUAGES)
            .map(([code, name]) => `<option value="${code}">${Security.escapeHtml(name)}</option>`)
            .join('');

        return `
    <style>
        #${ids.POPUP} * { box-sizing: border-box; }
        
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
        
        /* Remove dotted focus outline and provide an accessible focus ring for popup controls */
        #${ids.POPUP} button:focus,
        #${ids.POPUP} input:focus,
        #${ids.POPUP} textarea:focus,
        #${ids.POPUP} select:focus,
        #${ids.POPUP} [tabindex]:focus {
            outline: none;
            box-shadow: 0 0 0 3px rgba(37,99,235,0.12);
            border-color: #2563eb;
        }
        
        .gemini-tab-content {
            display: none;
            animation: fadeIn ${CONFIG.FADE_DURATION}ms ease;
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
            animation: slideUp ${CONFIG.SLIDE_DURATION}ms ease;
            z-index: ${CONFIG.Z_INDEX - 1};
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
        
        .gemini-loading {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            color: #6b7280;
        }
        
        .gemini-spinner {
            width: 16px;
            height: 16px;
            border: 2px solid #e5e7eb;
            border-top-color: #2563eb;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        
        .gemini-chat-message {
            margin-bottom: 12px;
            padding: 8px 12px;
            border-radius: 6px;
        }
        
        .gemini-chat-message.user {
            background: #dbeafe;
            margin-left: 20%;
        }
        
        /* Reset paragraph margins within chat messages to avoid huge gaps */
        .gemini-chat-message p {
            margin: 0;
            padding: 0;
            line-height: 1.4;
        }
        
        .gemini-chat-message.assistant {
            background: #f3f4f6;
            margin-right: 20%;
        }
        
        .gemini-chat-message .timestamp {
            font-size: 10px;
            color: #9ca3af;
            margin-top: 4px;
        }
        
        .gemini-scrollbar::-webkit-scrollbar {
            width: 8px;
        }
        .gemini-scrollbar::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 4px;
        }
        .gemini-scrollbar::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 4px;
        }
        .gemini-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
        }
        .gemini-tab-content {
            display: none !important;
        }
        .gemini-tab-content.active {
            display: flex !important;
        }
        #gemini-scroll-body {
            scrollbar-width: thin;
            scrollbar-color: #cbd5e1 #f1f1f1;
            flex: 1;
            min-height: 0;
            overflow: hidden;
        }
    </style>
    <div id="${ids.POPUP}" class="fixed z-[99999] shadow-2xl rounded-lg bg-white text-gray-800 border border-gray-200 transition-all duration-200 transform" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; display: none; width: 400px; height: 550px; max-height: 90vh; position: fixed; flex-direction: column; overflow: hidden; opacity: 1; box-sizing: border-box;">
        <!-- Close button -->
        <button id="${ids.CLOSE_BUTTON}" style="position:absolute; right:10px; top:10px; z-index:2147483647; padding:4px; background:white; border-radius:50%; border:1px solid #e5e7eb; cursor:pointer; color:#6b7280; display:flex; align-items:center; justify-content:center; box-shadow:0 1px 4px rgba(0,0,0,0.1);" aria-label="Close popup">
            <svg style="width:16px;height:16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>

        <!-- Header / Drag Handle Area -->
        <div id="${ids.DRAG_HANDLE}" style="padding: 14px 16px; border-bottom: 1px solid #f3f4f6; cursor: grab; user-select: none; flex-shrink: 0; background: #fff;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                <img src="${chrome.runtime.getURL('logo.png')}" alt="Logo" style="width: 28px; height: 28px; object-fit: contain; flex-shrink: 0;">
                <div style="font-weight: 600; font-size: 15px; color: #111827; flex: 1;">SmartTranslate AI Assistant+</div>
                <div style="display: flex; gap: 4px; align-items: center;">
                    <button id="gemini-dock-left-btn" title="Dock Left" style="background:transparent; border:none; cursor:pointer; padding:4px; color:#6b7280; display:flex; align-items:center; justify-content:center; border-radius:4px;">
                        <svg style="width:14px;height:14px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                    </button>
                    <button id="gemini-dock-right-btn" title="Dock Right" style="background:transparent; border:none; cursor:pointer; padding:4px; color:#6b7280; display:flex; align-items:center; justify-content:center; border-radius:4px;">
                        <svg style="width:14px;height:14px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                    </button>
                    <button id="gemini-undock-btn" title="Floating Mode" style="background:transparent; border:none; cursor:pointer; padding:4px; color:#2563eb; display:none; align-items:center; justify-content:center; border-radius:4px;">
                        <svg style="width:14px;height:14px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
                    </button>
                </div>
            </div>

            <!-- Language Selection inside Header Block -->
            <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 8px; align-items: center; margin-top: 4px;">
                <select id="source-lang-select" style="padding: 6px; font-size: 11px; border: 1px solid #e2e8f0; border-radius: 4px; background: white; outline:none; cursor: pointer; height: 32px;">
                    ${languages}
                </select>
                <button id="gemini-swap-languages-btn" title="Swap" style="background:transparent; border:none; cursor:pointer; color:#64748b; font-size:14px; display:flex; align-items:center; justify-content:center; width:24px; height:24px; border-radius:4px;">⇄</button>
                <select id="${ids.LANGUAGE_SELECT}" style="padding: 6px; font-size: 11px; border: 1px solid #e2e8f0; border-radius: 4px; background: white; outline:none; cursor: pointer; height: 32px;">
                    ${languages.replace('<option value="auto">Auto-detect</option>', '')}
                </select>
            </div>
        </div>

        <!-- Selected Text Preview (Visible only when text is selected) -->
        <div id="gemini-original-label" style="padding: 10px 16px 4px; font-size: 10px; font-weight: 700; color: #64748b; background: #fff; flex-shrink: 0; display: none; text-transform: uppercase; letter-spacing: 0.5px;">Selected Text</div>
        <div id="gemini-original-container" style="display: none; grid-template-columns: 1fr auto; gap: 12px; padding: 4px 16px 12px; background: #fff; border-bottom: 1px solid #f1f5f9; flex-shrink: 0;">
            <div id="gemini-original-text" style="font-size: 12px; color: #334155; line-height: 1.5; max-height: 60px; overflow-y: auto; padding: 8px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0;"> 
                <span style="color: #94a3b8;">No text selected</span>
            </div>
            <div style="display:flex; flex-direction: column; gap:4px; align-items:center;">
                <button id="gemini-translate-now-btn" title="Translate now" style="padding: 4px 8px; font-size: 10px; font-weight: 700; background: #4f46e5; color: white; border: none; border-radius: 4px; cursor: pointer; transition: all 0.2s; min-width: 65px;">Translate</button>
                <div style="display:flex; gap:2px;">
                    <button id="gemini-speak-input-btn" title="Listen" style="background:transparent; border:none; cursor:pointer; color:#64748b; font-size:14px; width:26px; height:26px; display:flex; align-items:center; justify-content:center; border-radius:4px;">🔊</button>
                    <button id="gemini-clear-selection-inline" title="Clear" style="background:transparent; border:none; cursor:pointer; color:#ef4444; font-size:14px; width:26px; height:26px; display:flex; align-items:center; justify-content:center; border-radius:4px;">🧹</button>
                </div>
            </div>
        </div>

        <!-- Navigation Tabs -->
        <div style="display: flex; border-bottom: 1px solid #f3f4f6; padding: 0 4px; flex-shrink: 0; background: #fff;">
            <button class="gemini-tab-button active" data-tab="translation" style="flex:1;">Translation</button>
            <button class="gemini-tab-button" data-tab="summary" style="flex:1;">📝 Summary</button>
        </div>

        <!-- Main Content Area (No Global Scroll) -->
        <div id="gemini-scroll-body" style="overflow: hidden; flex: 1; min-height: 0; background: #fff; display: flex; flex-direction: column;" class="gemini-scrollbar">
            <!-- Translation Tab -->
            <div id="translation-tab" class="gemini-tab-content active" style="padding: 0; display: flex; flex-direction: column; height: 100%; box-sizing: border-box;">
                <div style="padding: 12px 16px; display: flex; flex-direction: column; flex: 1; min-height: 0;">
                    <div id="manual-input-section" style="display: none; margin-bottom: 10px; flex-shrink: 0;">
                        <textarea id="gemini-manual-input" placeholder="Type or paste text..." style="width: 100%; padding: 8px; font-size: 12px; border: 1px solid #e2e8f0; border-radius: 4px; resize: none; height: 60px; font-family: inherit; outline:none;"></textarea>
                        <button id="gemini-translate-manual-btn" style="width: 100%; margin-top: 6px; padding: 6px; background: #4f46e5; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600;">Translate Now</button>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; flex-shrink: 0;">
                        <div style="font-size: 10px; font-weight: 700; color: #475569; text-transform: uppercase;">Result</div>
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <label style="display: flex; align-items: center; gap: 4px; font-size: 10px; cursor: pointer; color: #64748b;">
                                <input type="checkbox" id="gemini-back-translation-cb" style="margin:0; width:12px; height:12px;">
                                <span>Proofread</span>
                            </label>
                            <button id="gemini-speak-btn" style="background:transparent; border:none; cursor:pointer; font-size:14px; color:#475569;">🔊</button>
                        </div>
                    </div>
                    
                    <div id="${ids.TRANSLATION_OUTPUT}" style="padding: 10px; background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 6px; font-size: 13px; line-height: 1.5; color: #1e1b4b; flex: 1; overflow-y: auto; word-wrap: break-word; white-space: pre-wrap; min-height: 60px; max-height: 200px;" class="gemini-scrollbar">
                        <span style="color: #94a3b8; font-style: italic;">Awaiting translation...</span>
                    </div>

                    <div style="display: flex; gap: 8px; margin-top: 8px; flex-shrink: 0;">
                        <button id="gemini-copy-btn" class="gemini-copy-btn" style="flex: 1; height: 30px; font-size: 11px; font-weight: 600;">📋 Copy</button>
                        <button id="gemini-clear-btn" class="gemini-copy-btn" style="flex: 1; height: 30px; font-size: 11px; color: #ef4444; border-color: #fecaca; background: #fff1f2; font-weight: 600;">🧹 Clear All</button>
                    </div>

                    <!-- Proofread Results section -->
                    <div id="gemini-proofread-results" style="display: none; margin-top: 8px; padding-top: 8px; border-top: 1px dashed #e2e8f0; overflow-y: auto; flex: 1;" class="gemini-scrollbar">
                        <div style="font-size: 10px; font-weight: 800; color: #4f46e5; margin-bottom: 6px; text-transform: uppercase;">✨ Intelligence Insights</div>
                        <div id="gemini-correction-output" style="padding: 8px; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 4px; font-size: 12px; color: #92400e; margin-bottom: 8px; border-left: 3px solid #f59e0b; max-height: 60px; overflow-y: auto;"></div>
                        <div id="gemini-explanation-output" style="padding: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 11px; color: #334155; max-height: 80px; overflow-y: auto;"></div>
                    </div>
                </div>
            </div>

            <!-- Summarization Tab -->
            <div id="summary-tab" class="gemini-tab-content" style="padding: 0; height: 100%; display: flex; flex-direction: column; box-sizing: border-box;">
                <div style="padding: 12px 16px; display: flex; flex-direction: column; flex: 1; min-height: 0; gap: 8px;">
                    <div style="display:flex; gap:6px; flex-shrink: 0;">
                        <button id="gemini-context-sel-btn" style="flex:1; padding:6px; background:#eef2ff; color:#4338ca; border:1px solid #c7d2fe; border-radius:4px; font-size:10px; font-weight: 700;">Selection</button>
                        <button id="gemini-context-page-btn" style="flex:1; padding:6px; background:#f8fafc; color:#64748b; border:1px solid #e2e8f0; border-radius:4px; font-size:10px; font-weight: 700;">Full Page</button>
                    </div>
                    
                    <div id="${ids.CHAT_OUTPUT}" style="padding: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 13px; line-height: 1.5; flex: 1; min-height: 100px; overflow-y: auto;" class="gemini-scrollbar">
                        <div style="color: #94a3b8; font-style: italic; text-align: center; margin-top: 30px; font-size: 12px;">Choose context to start.</div>
                    </div>

                    <div style="display: flex; gap: 4px; flex-shrink: 0;">
                        <input type="text" id="${ids.CHAT_INPUT}" placeholder="Ask anything..." style="flex: 1; padding: 8px 10px; font-size: 12px; border: 1px solid #e2e8f0; border-radius: 6px; outline:none; background: #fff;">
                        <button id="gemini-send-btn" style="padding: 6px 12px; background: #4f46e5; color: white; border: none; border-radius: 6px; cursor: pointer;">
                            <svg style="width:14px;height:14px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
                        </button>
                    </div>

                    <div style="display:flex; gap:6px; flex-shrink: 0;">
                         <button id="gemini-quick-summary-btn" style="flex:1; padding:6px; font-size:10px; background:#f5f3ff; color:#7c3aed; border:1px solid #ddd6fe; border-radius:4px; font-weight:700;">✨ Summarize</button>
                         <button id="gemini-clear-chat-btn" style="flex:1; padding:6px; font-size:10px; background:#fff1f2; color:#e11d48; border:1px solid #fecaca; border-radius:4px; font-weight:700;">🗑️ Clear</button>
                    </div>

                    <div id="gemini-token-usage" style="display: none; padding: 6px; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 6px; border-left: 3px solid #f59e0b; flex-shrink: 0;">
                        <div style="display: flex; justify-content: space-between; font-size: 9px; font-weight: 800; color: #92400e; margin-bottom: 2px;">
                            <span>USAGE</span>
                            <span id="gemini-token-usage-percent">0%</span>
                        </div>
                        <div style="height: 4px; background: #fef3c7; border-radius: 2px; overflow: hidden;">
                            <div id="gemini-token-usage-fill" style="height: 100%; width: 0%; background: #f59e0b;"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Sticky Footer Area (More Compact) -->
        <div style="flex-shrink: 0; padding: 8px 16px; background: #fff; border-top: 1px solid #f1f5f9;">
            <div style="margin-bottom: 4px;">
                <div style="font-size: 10px; font-weight: 700; color: #475569; display: flex; align-items: center; justify-content: space-between; cursor: pointer; text-transform: uppercase;" onclick="const c = this.nextElementSibling; const a = this.querySelector('.arrow'); const isOpen = c.style.display === 'block'; c.style.display = isOpen ? 'none' : 'block'; a.textContent = isOpen ? '▼' : '▲';">
                    <span>🔒 Privacy Policy</span>
                    <span class="arrow" style="font-size: 8px;">▼</span>
                </div>
                <div style="display: none; font-size: 9px; color: #64748b; line-height: 1.4; margin-top: 4px; padding: 6px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px;">
                    Processed securely via AI Provider API. No data is stored externally.
                </div>
            </div>

            <div style="text-align: center; line-height: 1;">
                <div style="font-size: 10px; color: #94a3b8; font-weight: 500;">
                    Created by <span style="color: #4f46e5; font-weight: 800;">Tsoukas Aggelos</span>
                </div>
                <div style="font-size: 8px; color: #cbd5e1; margin-top: 2px; font-weight: 700;">FINAL RELEASE v1.0</div>
            </div>
        </div>
    </div>
`;
    },

    // Initialize popup
    initPopup: () => {
        const ids = CONFIG.ELEMENT_IDS;
        UI.popup = document.getElementById(ids.POPUP);

        if (!UI.popup) {
            try {
                document.body.insertAdjacentHTML('beforeend', UI.createPopupHTML());
                UI.popup = document.getElementById(ids.POPUP);
                UI.attachPopupDragHandlers();
                UI.attachPopupEventHandlers();
            } catch (e) {
                Logger.error('insertAdjacentHTML failed for popup; will try minimal fallback', e);
            }
        }

        // If popup wasn't created (CSP, tracking prevention, or other issues), build a minimal DOM-only popup
        if (!UI.popup || !UI.popup.innerHTML || UI.popup.innerHTML.length < 80) {
            try {
                Logger.warn('Using minimal fallback popup due to blocked insertion or empty content');
                const existing = document.getElementById(ids.POPUP);
                if (existing && existing.innerHTML && existing.innerHTML.length >= 80) {
                    UI.popup = existing;
                } else {
                    const fallback = document.createElement('div');
                    fallback.id = ids.POPUP;
                    Object.assign(fallback.style, {
                        position: 'fixed',
                        left: '20px',
                        top: '20px',
                        width: '340px',
                        maxHeight: '80vh',
                        overflow: 'auto',
                        background: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        padding: '12px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                        zIndex: '99999999999'
                    });
                    fallback.innerHTML = `
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                            <div style="font-weight:600;">SmartTranslate AI+</div>
                            <button id="${ids.CLOSE_BUTTON}" style="border:none;background:transparent;cursor:pointer;font-size:16px;">✕</button>
                        </div>
                        <div id="gemini-original-text" style="color:#6b7280;min-height:24px;"><span style="color:#9ca3af;">No text selected</span></div>
                        <div id="${ids.TRANSLATION_OUTPUT}" style="margin-top:8px;padding:8px;background:#f0f9ff;border-radius:6px;">Awaiting translation...</div>
                    `;
                    document.body.appendChild(fallback);
                    UI.popup = fallback;
                    UI.attachPopupDragHandlers();
                    UI.attachPopupEventHandlers();
                }
            } catch (e) {
                Logger.error('Failed to create minimal popup fallback', e);
            }
        }

        // Populate enable toggle state and token usage immediately
        (async () => {
            try {
                const domain = window.location.hostname;
                const enabled = await Storage.getDomainState(domain);
                const toggle = document.getElementById('gemini-enable-toggle');
                const toggleContainer = document.getElementById('gemini-enable-container');
                if (toggle) toggle.checked = !!enabled;
                if (toggleContainer) toggleContainer.classList.toggle('active', !!enabled);

                // Back translation checkbox
                const btCheckbox = document.getElementById('gemini-back-translation-cb');
                if (btCheckbox) {
                    // Start unchecked by default to save tokens/API calls
                    btCheckbox.checked = false;

                    btCheckbox.addEventListener('change', async () => {
                        const isChecked = btCheckbox.checked;
                        await chrome.storage.local.set({ 'smarttranslate_back_translation': isChecked });

                        // Visual feedback: show where results will appear
                        const resultsArea = document.getElementById('gemini-proofread-results');
                        if (resultsArea) {
                            resultsArea.style.display = isChecked ? 'block' : 'none';
                            // If just checked, show a subtle hint
                            if (isChecked && (!resultsArea.innerText || resultsArea.innerText.length < 50)) {
                                resultsArea.style.opacity = '0.7';
                            } else {
                                resultsArea.style.opacity = '1';
                            }
                        }

                        // Re-trigger translation if there's text
                        const currentText = Selection.getCurrentSelection();
                        if (currentText) UI.translateSelectedText();
                    });
                }

                // Initial docking state
                const dockData = await chrome.storage.local.get(['smarttranslate_dock_side']);
                if (dockData.smarttranslate_dock_side === 'left') {
                    UI.dockLeft();
                } else if (dockData.smarttranslate_dock_side === 'right') {
                    UI.dockRight();
                }

                // Initial language state
                const userLang = await Storage.getUserLanguage();
                const langSelect = document.getElementById(ids.LANGUAGE_SELECT);
                if (langSelect) langSelect.value = userLang;

                // Update token usage in case it's already recorded
                UI.updateTokenUsage();
            } catch (e) {
                Logger.error('Error in UI initialization IIFE', e);
            }
        })();

        return UI.popup;
    },

    // Update token usage display (in-page popup)
    updateTokenUsage: async (lastTokens = { input: 0, output: 0 }) => {
        try {
            if (!chrome || !chrome.storage || !chrome.storage.local) {
                Logger.warn('chrome.storage not available for token update');
                return;
            }

            const keys = [CONFIG.STORAGE_KEYS.TOKEN_USAGE, CONFIG.STORAGE_KEYS.TOKEN_LIMIT];
            const data = await new Promise((resolve) => {
                try {
                    chrome.storage.local.get(keys, (res) => resolve(res || {}));
                } catch (e) {
                    Logger.warn('Storage get failed in token update', e);
                    resolve({});
                }
            });

            const totalUsed = data[CONFIG.STORAGE_KEYS.TOKEN_USAGE] || 0;
            const limit = data[CONFIG.STORAGE_KEYS.TOKEN_LIMIT] || 1000000;
            const percent = Math.round((totalUsed / limit) * 100);

            const fillEl = document.getElementById('gemini-token-usage-fill');
            if (fillEl) fillEl.style.width = percent + '%';

            const textEl = document.getElementById('gemini-token-usage-text');
            if (textEl) textEl.textContent = `${totalUsed.toLocaleString()} / ${limit.toLocaleString()}`;

            const percentEl = document.getElementById('gemini-token-usage-percent');
            if (percentEl) percentEl.textContent = percent + '%';

            const remEl = document.getElementById('gemini-token-usage-remaining');
            const usedThis = (lastTokens.input || 0) + (lastTokens.output || 0);
            if (remEl) remEl.textContent = `This translation: ${usedThis.toLocaleString()} tokens | Remaining: ${(limit - totalUsed).toLocaleString()}`;

            const tokenBox = document.getElementById('gemini-token-usage');
            if (tokenBox) tokenBox.style.display = 'block';
        } catch (e) {
            Logger.warn('Error updating in-page token usage', e);
        }
    },

    // Show popup with selected text
    showPopup: async (x, y, selectedTextArg = null) => {
        if (!UI.checkContext()) return;
        try {
            if (!UI.popup) {
                UI.initPopup();
            }

            if (!UI.popup) return;

            // Ensure language settings are synced from storage (in case changed in another tab or stored previously)
            try {
                const storedLang = await Storage.getUserLanguage();
                const langSelect = document.getElementById(ids.LANGUAGE_SELECT);
                if (langSelect && storedLang && langSelect.value !== storedLang) {
                    langSelect.value = storedLang;
                }

                // Also sync source language if we add persistence for it
                const storedSource = await Storage.get('smarttranslate_source_language');
                const sourceSelect = document.getElementById('source-lang-select');
                if (sourceSelect && storedSource && sourceSelect.value !== storedSource) {
                    sourceSelect.value = storedSource;
                }
            } catch (e) { Logger.warn('Sync lang error', e); }

            const ids = CONFIG.ELEMENT_IDS;
            let selectedText = '';

            // Check if argument is explicitly provided (including empty string)
            // If passed as empty string, we want to respect that and NOT auto-detect
            if (selectedTextArg !== null && selectedTextArg !== undefined) {
                selectedText = String(selectedTextArg).trim();
            } else {
                // Only auto-detect if no argument was provided (null/undefined)
                // Get fresh selection from the page
                selectedText = Selection.getSelectionTextIncludingIframes() || '';
            }

            // Clear everything if no text is selected
            if (!selectedText || !selectedText.trim()) {
                Selection.clearSelection();
                selectedText = '';
                // Don't clear UI.activeContext here immediately, allows persistence until explicit clear
            } else {
                const newText = selectedText.trim();
                UI.updateContext(newText);

                Selection.setCurrentSelection(newText);

                // OPTIONAL: Automatically clear the selection on the page (remove blue highlight)
                // This prevents the extension from picking it up again if you reopen without selecting new text.
                try {
                    if (window.getSelection) {
                        window.getSelection().removeAllRanges();
                    }
                    // Also clear any iframe selections if possible (basic attempt)
                    const frames = document.querySelectorAll('iframe');
                    frames.forEach(f => {
                        try {
                            if (f.contentWindow && f.contentWindow.getSelection) {
                                f.contentWindow.getSelection().removeAllRanges();
                            }
                        } catch (e) { }
                    });
                } catch (e) { }
            }

            const originalEl = document.getElementById('gemini-original-text');
            const clearBtn = document.getElementById('gemini-clear-selection-inline');
            const selectionLabel = document.getElementById('gemini-original-label');
            const selectionContainer = document.getElementById('gemini-original-container');
            const manualSection = document.getElementById('manual-input-section');

            if (originalEl) {
                if (selectedText && selectedText.trim()) {
                    // Show selected text section
                    Security.setSafeHtml(originalEl, ` ${Security.escapeHtml(selectedText.trim())}`);
                    if (clearBtn) { clearBtn.style.opacity = '1'; clearBtn.style.pointerEvents = 'auto'; }
                    if (selectionLabel) selectionLabel.style.display = 'block';
                    if (selectionContainer) selectionContainer.style.display = 'grid';
                    if (manualSection) manualSection.style.display = 'none';
                } else {
                    // Hide selected text section completely when no text
                    if (selectionLabel) selectionLabel.style.display = 'none';
                    if (selectionContainer) selectionContainer.style.display = 'none';
                    if (manualSection) manualSection.style.display = 'block';
                }
            }

            // Reset Proofread checkbox to off by default every time popup opens
            const btCheckbox = document.getElementById('gemini-back-translation-cb');
            if (btCheckbox) btCheckbox.checked = false;

            UI.switchTab('translation');
            UI.popup.style.display = 'flex';

            // User Request: Always force fixed position at 10% / 10%
            // We ignore dynamic coordinates for now as per user preference (Step 94)
            UI.popup.style.left = '10%';
            UI.popup.style.top = '10%';
            UI.popup.style.transform = 'none'; // Ensure no center offsets are applied in this mode

            UI.popup.style.visibility = 'visible';
            UI.popup.style.opacity = '1';
            UI.popup.classList.remove('opacity-0', 'scale-95');
            UI.popup.style.zIndex = '99999999999';

            try { UI.updateTokenUsage(); } catch (e) { /* ignore */ }

            if (selectedText && selectedText.trim()) {
                try {
                    UI.translateSelectedText();
                } catch (e) { Logger.error('Auto-translate failed', e, true); }
            }
        } catch (e) {
            console.error('[SmartTranslate] Failed to show popup:', e);
            try {
                if (!document.getElementById('gemini-extension-popup-fallback')) {
                    const fallback = document.createElement('div');
                    fallback.id = 'gemini-extension-popup-fallback';
                    fallback.style.position = 'fixed';
                    fallback.style.left = '10px';
                    fallback.style.top = '10px';
                    fallback.style.background = 'white';
                    fallback.style.border = '1px solid #e5e7eb';
                    fallback.style.padding = '8px 10px';
                    fallback.style.zIndex = CONFIG.Z_INDEX;
                    fallback.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)';
                    fallback.textContent = 'SmartTranslate: Couldn\'t open popup — check console for details.';
                    document.body.appendChild(fallback);
                    setTimeout(() => { try { fallback.remove(); } catch (e) { } }, 5000);
                }
            } catch (err) {
                // swallow any fallback errors
            }
        }
    },

    // Hard fallback overlay for environments where the popup is blocked
    showHardFallback: (selectedText = '') => {
        try {
            if (document.getElementById('gemini-hard-fallback')) return;
            const overlay = document.createElement('div');
            overlay.id = 'gemini-hard-fallback';
            Object.assign(overlay.style, {
                position: 'fixed',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: '999999999999',
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '12px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                width: '380px',
                maxHeight: '80vh',
                overflow: 'auto'
            });
            overlay.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <div style="font-weight:600;">SmartTranslate (Fallback)</div>
                    <button id="gemini-hard-fallback-close" style="border:none;background:transparent;cursor:pointer;font-size:16px;">✕</button>
                </div>
                <div id="gemini-hard-fallback-original" style="color:#6b7280;min-height:24px;">${Security.escapeHtml(selectedText || 'No text selected')}</div>
                <div id="gemini-hard-fallback-translation" style="margin-top:8px;padding:8px;background:#f0f9ff;border-radius:6px;">Awaiting translation…</div>
                <button id="gemini-hard-fallback-translate" style="width:100%;margin-top:8px;padding:8px;background:#2563eb;color:white;border:none;border-radius:6px;cursor:pointer;">Translate</button>
            `;
            document.body.appendChild(overlay);
            const closeBtn = document.getElementById('gemini-hard-fallback-close');
            const translateBtn = document.getElementById('gemini-hard-fallback-translate');
            const translationEl = document.getElementById('gemini-hard-fallback-translation');
            closeBtn && closeBtn.addEventListener('click', () => { try { overlay.remove(); } catch (e) { } });
            translateBtn && translateBtn.addEventListener('click', async () => {
                const t = selectedText || Selection.getCurrentSelection() || '';
                if (!t) {
                    translationEl.textContent = 'Nothing to translate';
                    return;
                }
                translationEl.textContent = 'Translating…';
                try {
                    // Start with proofread disabled for fallback
                    const res = await Api.translate(t, 'en', false);
                    if (res && res.error) {
                        translationEl.textContent = 'Error: ' + res.error;
                    } else if (res && res.text) {
                        translationEl.textContent = res.text;
                        try { if (res.tokens) UI.updateTokenUsage(res.tokens); } catch (x) { }
                    } else {
                        translationEl.textContent = 'No response';
                    }
                } catch (err) {
                    translationEl.textContent = 'Translation failed';
                    Logger.error('Hard fallback translate failed', err);
                }
            });
        } catch (e) {
            Logger.error('Failed to create hard fallback overlay', e);
        }
    },

    // Hide popup
    hidePopup: () => {
        if (!UI.popup) return;
        UI.popup.classList.add('opacity-0', 'scale-95');

        // Reset page layout in case it was docked
        UI.updatePageLayout(null);

        setTimeout(() => {
            if (UI.popup) {
                UI.popup.style.display = 'none';
            }
        }, CONFIG.SLIDE_DURATION);
    },

    // Switch tabs
    switchTab: (tabName) => {
        const allButtons = document.querySelectorAll('.gemini-tab-button');
        const allTabs = document.querySelectorAll('.gemini-tab-content');

        allButtons.forEach(btn => {
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
                btn.style.borderBottomColor = '#2563eb';
                btn.style.color = '#2563eb';
            } else {
                btn.classList.remove('active');
                btn.style.borderBottomColor = 'transparent';
                btn.style.color = '#6b7280';
            }
        });

        allTabs.forEach(tab => {
            if (tab.id === `${tabName}-tab`) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        // Hide "Selected Text" context when in chat mode as per user request
        // Hide "Selected Text" context when in chat mode as per user request
        const selectionContainer = document.getElementById('gemini-original-container');
        const selectionLabel = document.getElementById('gemini-original-label');

        // IMPORTANT: Only show if we actually have text!
        // Check if we previously hid it because of no text.
        // Use activeContext to ensure persistence even if selection is cleared temporarily
        const hasText = (UI.activeContext && UI.activeContext.trim().length > 0) || (Selection.currentSelectedText && Selection.currentSelectedText.trim().length > 0);

        if (selectionContainer) {
            if (tabName === 'summary') {
                selectionContainer.style.display = 'none';
            } else {
                // Only show in translation tab IF we have text
                selectionContainer.style.display = hasText ? 'grid' : 'none';
            }
        }

        // Also hide the "Selected Text:" label when in chat mode
        if (selectionLabel) {
            if (tabName === 'summary') {
                selectionLabel.style.display = 'none';
            } else {
                // Only show in translation tab IF we have text
                selectionLabel.style.display = hasText ? 'block' : 'none';
            }
        }

        // Handle Manual Input visibility: hide if we have active selection text
        const manualSection = document.getElementById('manual-input-section');
        if (manualSection) {
            if (tabName === 'summary') {
                manualSection.style.display = 'none';
            } else {
                // Show manual input ONLY if we have no text selection
                manualSection.style.display = hasText ? 'none' : 'block';
            }
        }
    },

    // Helper to push page content like DevTools
    updatePageLayout: (side) => {
        try {
            const html = document.documentElement;
            // Add transition for smooth scaling/shifting
            html.style.transition = 'margin 0.3s ease, width 0.3s ease';

            if (side === 'left') {
                html.style.marginLeft = '350px';
                html.style.marginRight = '0';
                html.style.width = 'calc(100% - 350px)';
            } else if (side === 'right') {
                html.style.marginRight = '350px';
                html.style.marginLeft = '0';
                html.style.width = 'calc(100% - 350px)';
            } else {
                html.style.marginLeft = '0';
                html.style.marginRight = '0';
                html.style.width = '100%';
            }
        } catch (e) {
            Logger.error('Failed to update page layout', e);
        }
    },

    dockLeft: async () => {
        if (!UI.popup) return;
        UI.popup.style.transition = 'all 0.3s ease';
        UI.popup.style.left = '0';
        UI.popup.style.top = '0';
        UI.popup.style.width = '350px';
        UI.popup.style.height = '100vh';
        UI.popup.style.maxHeight = '100vh';
        UI.popup.style.borderRadius = '0';
        UI.popup.style.transform = 'none';

        UI.updatePageLayout('left');

        document.getElementById('gemini-dock-left-btn').style.display = 'none';
        document.getElementById('gemini-dock-right-btn').style.display = 'flex';
        document.getElementById('gemini-undock-btn').style.display = 'flex';

        await chrome.storage.local.set({ 'smarttranslate_dock_side': 'left' });
    },

    dockRight: async () => {
        if (!UI.popup) return;
        UI.popup.style.transition = 'all 0.3s ease';
        UI.popup.style.left = 'calc(100% - 350px)';
        UI.popup.style.top = '0';
        UI.popup.style.width = '350px';
        UI.popup.style.height = '100vh';
        UI.popup.style.maxHeight = '100vh';
        UI.popup.style.borderRadius = '0';
        UI.popup.style.transform = 'none';

        UI.updatePageLayout('right');

        document.getElementById('gemini-dock-left-btn').style.display = 'flex';
        document.getElementById('gemini-dock-right-btn').style.display = 'none';
        document.getElementById('gemini-undock-btn').style.display = 'flex';

        await chrome.storage.local.set({ 'smarttranslate_dock_side': 'right' });
    },

    undock: async () => {
        if (!UI.popup) return;
        UI.popup.style.transition = 'all 0.3s ease';
        UI.popup.style.left = '10%';
        UI.popup.style.top = '14%';
        UI.popup.style.width = '95vw';
        UI.popup.style.maxWidth = `${CONFIG.POPUP_MAX_WIDTH}px`;
        UI.popup.style.height = 'auto';
        UI.popup.style.maxHeight = CONFIG.POPUP_MAX_HEIGHT;
        UI.popup.style.borderRadius = '8px';

        UI.updatePageLayout(null);

        document.getElementById('gemini-dock-left-btn').style.display = 'flex';
        document.getElementById('gemini-dock-right-btn').style.display = 'flex';
        document.getElementById('gemini-undock-btn').style.display = 'none';

        await chrome.storage.local.remove('smarttranslate_dock_side');
    },

    // Show loading state
    showLoading: (elementId, message = 'Loading...') => {
        const element = document.getElementById(elementId);
        if (element) {
            Security.setSafeHtml(element, `
                <div class="gemini-loading">
                    <div class="gemini-spinner"></div>
                    <span>${Security.escapeHtml(message)}</span>
                </div>
            `);
        }
    },

    // Sync back translation checkbox with external changes
    syncBackTranslation: (enabled) => {
        const btCheckbox = document.getElementById('gemini-back-translation-cb');
        if (btCheckbox) {
            btCheckbox.checked = enabled;
        }
    },

    // Translate selected text
    translateSelectedText: async () => {
        let selectedText = Selection.getCurrentSelection();
        if (!selectedText || !selectedText.trim()) {
            selectedText = UI.activeContext || '';
        }
        selectedText = selectedText.trim();
        const langSelect = document.getElementById(CONFIG.ELEMENT_IDS.LANGUAGE_SELECT);
        if (!selectedText || !langSelect) return;

        const targetLang = langSelect.value;
        const translationOutput = document.getElementById(CONFIG.ELEMENT_IDS.TRANSLATION_OUTPUT);
        const proofreadResults = document.getElementById('gemini-proofread-results');
        const correctionOutput = document.getElementById('gemini-correction-output');
        const backTranslationOutput = document.getElementById('gemini-back-translation-output');
        const explanationOutput = document.getElementById('gemini-explanation-output');

        const syncPlaceholders = () => {
            if (proofreadResults) {
                const btCheckbox = document.getElementById('gemini-back-translation-cb');
                const isBT = btCheckbox && btCheckbox.checked;
                proofreadResults.style.display = isBT ? 'block' : 'none';
                if (isBT) {
                    const sections = ['gemini-correction-output', 'gemini-explanation-output'];
                    sections.forEach(id => {
                        const el = document.getElementById(id);
                        if (el) el.innerHTML = '<span style="color: #9ca3af; font-style: italic;">Analyzing...</span>';
                    });
                }
            }
        };

        syncPlaceholders();

        UI.showLoading(CONFIG.ELEMENT_IDS.TRANSLATION_OUTPUT, 'Translating...');

        // IMPORTANT: Pass the current UI state of the checkbox directly
        const btCheckbox = document.getElementById('gemini-back-translation-cb');
        const isProofreadEnabled = btCheckbox && btCheckbox.checked;

        // Get source language
        const sourceSelect = document.getElementById('source-lang-select');
        const sourceLang = sourceSelect ? sourceSelect.value : 'auto';

        // Persist current choices to ensure they are saved as defaults
        if (targetLang) Storage.setUserLanguage(targetLang);
        if (sourceLang) Storage.set('smarttranslate_source_language', sourceLang);

        const result = await Api.translate(selectedText, targetLang, isProofreadEnabled, sourceLang);

        if (result.error) {
            Security.setSafeHtml(translationOutput, `<span style="color: #dc2626;">✕ ${Security.escapeHtml(result.error)}</span>`);
            UI.showToast(result.error, 'error');
        } else {
            // Check if it's JSON (structured proofread) or plain text
            try {
                let responseText = result.text.trim();

                // Strip markdown code blocks if AI wrapped the JSON
                if (responseText.includes('```')) {
                    const match = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                    if (match) responseText = match[1].trim();
                }

                if (responseText.startsWith('{')) {
                    const parsed = JSON.parse(responseText);

                    // Priority 1: Main translation
                    Security.setSafeHtml(translationOutput, parsed.translation || '', true);

                    // Priority 2: Proofread details
                    if (proofreadResults) {
                        const hasProofread = parsed.correction || parsed.explanation;
                        const btCheckboxCurrent = document.getElementById('gemini-back-translation-cb');
                        const isBTRequested = !!(btCheckboxCurrent && btCheckboxCurrent.checked);

                        if (hasProofread && isBTRequested) {
                            proofreadResults.style.display = 'block';
                            proofreadResults.style.opacity = '1';

                            const updateSec = (secId, outId, content, isMarkdown = false) => {
                                const sec = document.getElementById(secId);
                                const out = document.getElementById(outId);
                                if (sec && out) {
                                    if (content && content.trim() && content !== 'N/A') {
                                        sec.style.display = 'block';
                                        Security.setSafeHtml(out, content, isMarkdown);
                                    } else {
                                        sec.style.display = 'none';
                                    }
                                }
                            };

                            updateSec('gemini-correction-section', 'gemini-correction-output', parsed.correction);
                            updateSec('gemini-explanation-section', 'gemini-explanation-output', parsed.explanation, true);
                        } else {
                            proofreadResults.style.display = 'none';
                        }
                    }
                } else {
                    Security.setSafeHtml(translationOutput, responseText, true);
                    if (proofreadResults) proofreadResults.style.display = 'none';
                }
            } catch (e) {
                Logger.error('JSON Parse failed in UI', e);
                // Clean the text from markdown blocks before showing as raw text
                const cleanText = result.text.replace(/```json|```/g, '').trim();
                Security.setSafeHtml(translationOutput, cleanText, true);
                if (proofreadResults) proofreadResults.style.display = 'none';
            }

            UI.showToast(CONFIG.SUCCESS_MESSAGES.TRANSLATION_COMPLETE, 'success');

            // Update token usage
            try {
                if (result.usage) {
                    UI.updateTokenUsage(result.usage);
                }
            } catch (e) { Logger.warn('Failed to update token usage', e); }
        }
    },

    // Handle chat question
    handleChatQuestion: async () => {
        if (!UI.checkContext()) return;
        const input = document.getElementById(CONFIG.ELEMENT_IDS.CHAT_INPUT);
        if (!input || !input.value.trim()) return;

        const question = input.value.trim();
        input.value = '';

        // Switch to summary tab
        UI.switchTab('summary');

        // Add to history and render
        const userMsg = { role: 'user', content: question, timestamp: Date.now() };
        UI.chatHistory.push(userMsg);
        UI.renderChatMessage(userMsg);
        UI.saveChatHistory();

        // Determine context first to update loading message
        const context = (UI.activeContext && UI.activeContext.trim())
            ? UI.activeContext.trim()
            : ((Selection.currentSelectedText && Selection.currentSelectedText.trim())
                ? Selection.currentSelectedText.trim()
                : (Selection.getCurrentSelection() || 'No context selected - user is asking a general question'));

        const hasContext = context && context !== 'No context selected - user is asking a general question';

        // Show loading in chat
        const loadingText = hasContext ? 'Thinking (with context)...' : 'Thinking...';
        const loadingMsg = { role: 'assistant', content: loadingText, timestamp: Date.now(), isLoading: true };
        UI.renderChatMessage(loadingMsg);

        try {
            // Check for restricted models
            if (Api.model === 'google-fast-free') {
                UI.showToast('Please switch to a Gemini model for chat capabilities.', 'error');

                // Remove loading message
                const chatOutput = document.getElementById(CONFIG.ELEMENT_IDS.CHAT_OUTPUT);
                if (chatOutput && chatOutput.lastChild) chatOutput.removeChild(chatOutput.lastChild);

                // Add system message
                const errorMsg = { role: 'error', content: 'Chat is not available in "Google Fast" mode. Please select a Gemini model from the Settings.', timestamp: Date.now() };
                UI.chatHistory.push(errorMsg);
                UI.renderChatMessage(errorMsg);
                return;
            }

            const targetLangSelect = document.getElementById(CONFIG.ELEMENT_IDS.LANGUAGE_SELECT);
            const targetLang = targetLangSelect ? targetLangSelect.value : 'en';

            const response = await Api.chat(question, context, UI.chatHistory.slice(0, -1), targetLang);

            // Remove loading and add response
            const chatOutput = document.getElementById(CONFIG.ELEMENT_IDS.CHAT_OUTPUT);
            if (chatOutput && chatOutput.lastChild) chatOutput.removeChild(chatOutput.lastChild);

            if (response.error) {
                UI.showToast(response.error, 'error');
                return;
            }

            const assistantMsg = { role: 'assistant', content: response.text, timestamp: Date.now() };
            UI.chatHistory.push(assistantMsg);
            UI.renderChatMessage(assistantMsg);
            UI.saveChatHistory();

            // Update tokens
            if (response.usage) UI.updateTokenUsage(response.usage);
        } catch (err) {
            Logger.error('Chat error', err);
            UI.showToast('Chat failed', 'error');
        }
    },

    updateContext: (newText) => {
        const text = newText ? newText.trim() : '';
        if (UI.activeContext !== text) {
            UI.activeContext = text;
            // Clear chat history
            UI.chatHistory = [];
            const chatOutput = document.getElementById(CONFIG.ELEMENT_IDS.CHAT_OUTPUT);
            if (chatOutput) Security.setSafeHtml(chatOutput, '<span style="color: #9ca3af;">💬 Start a conversation about the selected text...</span>');
            Storage.clearChatHistory(window.location.hostname).catch(() => { });
        }
        Selection.setCurrentSelection(text);
    },

    // Render chat message
    renderChatMessage: (message) => {
        const chatOutput = document.getElementById(CONFIG.ELEMENT_IDS.CHAT_OUTPUT);
        if (!chatOutput) return;

        const messageEl = document.createElement('div');
        messageEl.className = `gemini-chat-message ${message.role}`;

        const time = new Date(message.timestamp).toLocaleTimeString();

        let contentHtml = '';
        if (message.isLoading) {
            contentHtml = `
                <div class="gemini-loading" style="display:flex; align-items:center; gap:8px;">
                    <div class="gemini-spinner" style="width:14px; height:14px; border-width:2px;"></div>
                    <span>${Security.escapeHtml(message.content) || 'Thinking...'}</span>
                </div>`;
        } else if (message.role === 'error') {
            contentHtml = `<span style="color: #dc2626;">✕ ${Security.escapeHtml(message.content || message.text)}</span>`;
        } else if (message.role === 'user') {
            // Treat user messages as plain text to avoid weird formatting
            const txt = message.content || message.text || '';
            contentHtml = Security.escapeHtml(txt).replace(/\n/g, '<br>');
        } else {
            // Assistant messages can support Markdown
            const textToRender = message.content || message.text || '';
            contentHtml = textToRender;
        }

        Security.setSafeHtml(messageEl, `
            <div class="message-content">${contentHtml}</div>
            <div class="timestamp" style="font-size: 10px; color: #9ca3af; margin-top: 4px;">${time}</div>
        `, message.role === 'assistant' && !message.isLoading); // Only render markdown for assistant if not loading

        chatOutput.appendChild(messageEl);
    },

    // Load chat history
    loadChatHistory: async () => {
        try {
            const domain = window.location.hostname;
            const history = await Storage.getChatHistory(domain);
            UI.chatHistory = history;

            const chatOutput = document.getElementById(CONFIG.ELEMENT_IDS.CHAT_OUTPUT);
            if (chatOutput && history.length > 0) {
                chatOutput.innerHTML = '';
                history.forEach(msg => UI.renderChatMessage(msg));
                chatOutput.scrollTop = chatOutput.scrollHeight;
            } else if (chatOutput) {
                Security.setSafeHtml(chatOutput, '<span style="color: #9ca3af;">💬 Start a conversation about the selected text...</span>');
            }
        } catch (e) {
            Logger.error('Error loading chat history', e);
        }
    },

    // Save chat history
    saveChatHistory: async () => {
        try {
            const domain = window.location.hostname;
            await Storage.saveChatHistory(domain, UI.chatHistory);
        } catch (e) {
            Logger.error('Error saving chat history', e);
        }
    },

    // Clear chat history
    clearChatHistory: async () => {
        UI.chatHistory = [];
        const chatOutput = document.getElementById(CONFIG.ELEMENT_IDS.CHAT_OUTPUT);
        if (chatOutput) {
            Security.setSafeHtml(chatOutput, '<span style="color: #9ca3af;">💬 Start a conversation about the selected text...</span>');
        }
        const domain = window.location.hostname;
        await Storage.clearChatHistory(domain);
        UI.showToast('Chat cleared', 'success');
    },

    // Copy to clipboard
    copyToClipboard: async (text) => {
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
            UI.showToast(CONFIG.SUCCESS_MESSAGES.COPIED, 'success');
        } catch (err) {
            Logger.error('Failed to copy', err);
            UI.showToast(CONFIG.ERROR_MESSAGES.COPY_FAILED, 'error');
        }
    },

    // Attach popup drag handlers (using pointer events for better responsiveness)
    attachPopupDragHandlers: () => {
        const dragHandle = document.getElementById(CONFIG.ELEMENT_IDS.DRAG_HANDLE);
        if (!dragHandle || !UI.popup) return;

        let isDragging = false;
        let startX = 0, startY = 0, initialX = 0, initialY = 0;

        const onPointerMove = (e) => {
            if (!isDragging) return;
            e.preventDefault();
            e.stopPropagation();

            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            const newX = initialX + dx;
            const newY = initialY + dy;

            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const rect = UI.popup.getBoundingClientRect();
            const padding = 10;

            const x = Math.max(padding, Math.min(newX, vw - rect.width - padding));
            const y = Math.max(padding, Math.min(newY, vh - rect.height - padding));

            UI.popup.style.left = `${x}px`;
            UI.popup.style.top = `${y}px`;
            UI.popup.style.transform = 'none';
            UI.popup.style.transition = 'none';
        };

        const startDrag = (e) => {
            if (!e.target.closest(`#${CONFIG.ELEMENT_IDS.DRAG_HANDLE}`) ||
                e.target.closest(`#${CONFIG.ELEMENT_IDS.CLOSE_BUTTON}`) ||
                e.target.closest('select')) {
                return;
            }

            isDragging = true;
            const rect = UI.popup.getBoundingClientRect();
            startX = e.clientX;
            startY = e.clientY;
            initialX = rect.left;
            initialY = rect.top;

            dragHandle.style.cursor = 'grabbing';
            document.addEventListener('pointermove', onPointerMove);
            e.preventDefault();
        };

        const stopDrag = () => {
            if (isDragging) {
                isDragging = false;
                dragHandle.style.cursor = 'grab';
                document.removeEventListener('pointermove', onPointerMove);
            }
        };

        dragHandle.addEventListener('pointerdown', startDrag);
        document.addEventListener('pointerup', stopDrag);
        document.addEventListener('pointerleave', stopDrag);
    },

    // Attach popup event handlers
    // Polyfill for closest() in case event target is from Shadow DOM or custom context
    elementClosest: (el, selector) => {
        if (!el || typeof el !== 'object') return null;
        if (el.closest) return el.closest(selector);
        while (el && el !== document) {
            if (el.matches && el.matches(selector)) return el;
            el = el.parentElement;
        }
        return null;
    },

    attachPopupEventHandlers: () => {
        const ids = CONFIG.ELEMENT_IDS;

        // Close button
        UI.addEventListener(document, 'click', (e) => {
            try { if (e && e.target && (e.target.id === ids.CLOSE_BUTTON || UI.elementClosest(e.target, `#${ids.CLOSE_BUTTON}`))) { UI.hidePopup(); } } catch (err) { Logger.warn('Close button error', err); }
        });

        // Tab switching
        UI.addEventListener(document, 'click', (e) => {
            try { const tabButton = e && e.target && UI.elementClosest(e.target, '.gemini-tab-button'); if (tabButton && tabButton.dataset.tab) { UI.switchTab(tabButton.dataset.tab); } } catch (err) { Logger.warn('Tab switching error', err); }
        });

        // Copy button
        UI.addEventListener(document, 'click', (e) => {
            try { if (e && e.target && (e.target.id === 'gemini-copy-btn' || UI.elementClosest(e.target, '#gemini-copy-btn'))) { const translationOutput = document.getElementById(ids.TRANSLATION_OUTPUT); if (translationOutput) { const text = translationOutput.textContent.trim(); if (text && text !== 'Awaiting translation...') { UI.copyToClipboard(text); } } } } catch (err) { Logger.warn('Copy button error', err); }
        });

        // Speaker buttons (Play/Stop toggle)
        UI.addEventListener(document, 'click', (e) => {
            try {
                if (e && e.target) {
                    if (e.target.id === 'gemini-dock-left-btn' || UI.elementClosest(e.target, '#gemini-dock-left-btn')) {
                        UI.dockLeft();
                    } else if (e.target.id === 'gemini-dock-right-btn' || UI.elementClosest(e.target, '#gemini-dock-right-btn')) {
                        UI.dockRight();
                    } else if (e.target.id === 'gemini-undock-btn' || UI.elementClosest(e.target, '#gemini-undock-btn')) {
                        UI.undock();
                    }
                }
            } catch (err) { Logger.warn('Docking button error', err); }
        });

        // Speaker buttons (Play/Stop toggle)
        UI.addEventListener(document, 'click', (e) => {
            try {
                const target = e.target;

                // Helper to reset state
                const resetSpeaker = () => {
                    if (UI.activeSpeakerBtn) {
                        UI.activeSpeakerBtn.innerHTML = '🔊';
                        UI.activeSpeakerBtn = null;
                    }
                    window.speechSynthesis.cancel();
                };

                const handleSpeak = (btnId, textId, isValue, useTargetLang) => {
                    // Find if we clicked this specific button
                    let btn = target.id === btnId ? target : null;
                    if (!btn && target.closest) btn = target.closest(`#${btnId}`);

                    if (btn) {
                        // Stop if clicking same button while speaking
                        if (UI.activeSpeakerBtn === btn && window.speechSynthesis.speaking) {
                            resetSpeaker();
                            return;
                        }

                        // Stop any previous speech
                        resetSpeaker();

                        const el = document.getElementById(textId);
                        const text = el ? (isValue ? el.value : el.textContent).trim() : '';

                        if (text && !text.includes('No text selected') && !text.includes('Awaiting translation...') && !text.includes('Error')) {
                            const u = new SpeechSynthesisUtterance(text);

                            // Set Stop Icon
                            btn.innerHTML = '⏹️';
                            UI.activeSpeakerBtn = btn;

                            u.onend = () => {
                                if (UI.activeSpeakerBtn === btn) {
                                    btn.innerHTML = '🔊';
                                    UI.activeSpeakerBtn = null;
                                }
                            };
                            u.onerror = () => resetSpeaker();

                            if (useTargetLang) {
                                const s = document.getElementById(ids.LANGUAGE_SELECT);
                                if (s && s.value) u.lang = s.value;
                            } else {
                                const s = document.getElementById('source-lang-select');
                                if (s && s.value && s.value !== 'auto') u.lang = s.value;
                            }
                            window.speechSynthesis.speak(u);
                        }
                    }
                };

                handleSpeak('gemini-speak-btn', ids.TRANSLATION_OUTPUT, false, true);
                handleSpeak('gemini-speak-input-btn', 'gemini-original-text', false, false);
                handleSpeak('gemini-speak-manual-btn', 'gemini-manual-input', true, false);

            } catch (err) { Logger.warn('Speaker button error', err); }
        });

        // Language change
        UI.addEventListener(document, 'change', (e) => {
            try {
                if (e.target.id === ids.LANGUAGE_SELECT) {
                    Storage.setUserLanguage(e.target.value); // Save persistence
                    UI.translateSelectedText();
                } else if (e.target.id === 'source-lang-select') {
                    Storage.set('smarttranslate_source_language', e.target.value);
                    UI.translateSelectedText();
                }
            } catch (err) { Logger.warn('Language change error', err); }
        });

        // Swap languages button
        UI.addEventListener(document, 'click', (e) => {
            try {
                if (e && e.target && (e.target.id === 'gemini-swap-languages-btn' || UI.elementClosest(e.target, '#gemini-swap-languages-btn'))) {
                    const sourceSelect = document.getElementById('source-lang-select');
                    const targetSelect = document.getElementById(ids.LANGUAGE_SELECT);

                    if (sourceSelect && targetSelect) {
                        const valS = sourceSelect.value;
                        const valT = targetSelect.value;

                        if (valS === 'auto') {
                            UI.showToast('Please select a specific source language to swap.', 'error');
                            return;
                        }

                        sourceSelect.value = valT;
                        targetSelect.value = valS;

                        // Save the new target language persistence
                        Storage.setUserLanguage(valS);
                        Storage.set('smarttranslate_source_language', valT);

                        // Trigger translation
                        UI.translateSelectedText();
                    }
                }
            } catch (err) { Logger.warn('Swap button error', err); }
        });

        // Widget Clear button
        UI.addEventListener(document, 'click', (e) => {
            try {
                if (e && e.target && (e.target.id === 'gemini-clear-btn' || UI.elementClosest(e.target, '#gemini-clear-btn'))) {
                    const translationOutput = document.getElementById(ids.TRANSLATION_OUTPUT);
                    if (translationOutput) {
                        Security.setSafeHtml(translationOutput, '<span style="color: #9ca3af;">Awaiting translation...</span>');
                    }
                    UI.showToast('Translation cleared', 'success');
                }
            } catch (err) { Logger.warn('Widget clear button error', err); }
        });

        // Enable toggle change (in-page)
        UI.addEventListener(document, 'change', (e) => {
            if (e.target && e.target.id === 'gemini-enable-toggle') {
                (async () => {
                    try {
                        const domain = window.location.hostname;
                        const newState = !!e.target.checked;
                        await Storage.setDomainState(domain, newState);
                        UI.setEnabled(newState);
                        const tc = document.getElementById('gemini-enable-container');
                        if (tc) tc.classList.toggle('active', !!newState);
                        try { chrome.runtime.sendMessage({ type: 'smarttranslate:state-change', enabled: newState }); } catch (err) { }
                    } catch (err) {
                        Logger.error('Error toggling enable state', err);
                    }
                })();
            }
        });

        // Listen for token usage updates broadcasted from background/popup
        try {
            if (typeof chrome !== 'undefined' && chrome.runtime) {
                chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                    try {
                        if (message && message.type === 'smarttranslate:token-usage-updated') {
                            UI.updateTokenUsage();
                            sendResponse({ ok: true });
                            return false;
                        } else if (message && message.type === 'smarttranslate:user-lang-updated') {
                            const userLangSelect = document.getElementById('gemini-user-lang-select');
                            if (userLangSelect) userLangSelect.value = message.lang;
                            // Also update translation target
                            const targetSelect = document.getElementById(ids.LANGUAGE_SELECT);
                            if (targetSelect) {
                                targetSelect.value = message.lang;
                                if (Selection.getCurrentSelection()) UI.translateSelectedText();
                            }
                            sendResponse({ ok: true });
                            return false;
                        }
                    } catch (e) { Logger.warn('Message listener error', e); }
                    return false; // Crucial: don't block other listeners
                });
            }
        } catch (e) {
            Logger.warn('chrome.runtime unavailable', e);
        }


        // Send chat button
        UI.addEventListener(document, 'click', (e) => {
            try { if (e && e.target && (e.target.id === 'gemini-send-btn' || UI.elementClosest(e.target, '#gemini-send-btn'))) { UI.handleChatQuestion(); } } catch (err) { Logger.warn('Chat send error', err); }
        });

        // Chat input Enter key
        UI.addEventListener(document, 'keypress', (e) => {
            try { if (e.target.id === ids.CHAT_INPUT && e.key === 'Enter') { e.preventDefault(); UI.handleChatQuestion(); } } catch (err) { Logger.warn('Chat input error', err); }
        });

        // Clear chat button
        UI.addEventListener(document, 'click', (e) => {
            try { if (e && e.target && (e.target.id === 'gemini-clear-chat-btn' || UI.elementClosest(e.target, '#gemini-clear-chat-btn'))) { UI.clearChatHistory(); } } catch (err) { Logger.warn('Clear chat error', err); }
        });

        // Manual translate button
        UI.addEventListener(document, 'click', (e) => {
            try { if (e && e.target && (e.target.id === 'gemini-translate-manual-btn' || UI.elementClosest(e.target, '#gemini-translate-manual-btn'))) { const inp = document.getElementById('gemini-manual-input'); if (inp) { const text = inp.value.trim(); if (text) { UI.updateContext(text); const originalEl = document.getElementById('gemini-original-text'); if (originalEl) { Security.setSafeHtml(originalEl, `<strong>To Translate:</strong> ${Security.escapeHtml(text)}`); } UI.translateSelectedText(); } } } } catch (err) { Logger.warn('Manual translate error', err); }
        });

        // Clear manual input button
        UI.addEventListener(document, 'click', (e) => {
            try {
                if (e && e.target && (e.target.id === 'gemini-clear-manual-input-btn' || UI.elementClosest(e.target, '#gemini-clear-manual-input-btn'))) {
                    const inp = document.getElementById('gemini-manual-input');
                    if (inp) {
                        inp.value = '';
                        inp.focus();
                    }
                }
            } catch (err) { Logger.warn('Clear manual input error', err); }
        });

        // Clear selection button (supports manual-section button and inline button)
        UI.addEventListener(document, 'click', (e) => {
            try {
                if (e && e.target && (e.target.id === 'gemini-translate-now-btn' || UI.elementClosest(e.target, '#gemini-translate-now-btn'))) {
                    UI.translateSelectedText();
                }
            } catch (err) { Logger.warn('Translate now button error', err); }
        });

        // Clear selection button (supports manual-section button and inline button)
        UI.addEventListener(document, 'click', (e) => {
            try {
                if (e && e.target && UI.elementClosest(e.target, '#gemini-clear-selection-btn, #gemini-clear-selection-inline')) {
                    UI.updateContext('');
                    Selection.clearSelection();

                    // Hide the selected text section
                    const selectionLabel = document.getElementById('gemini-original-label');
                    const selectionContainer = document.getElementById('gemini-original-container');
                    if (selectionLabel) selectionLabel.style.display = 'none';
                    if (selectionContainer) selectionContainer.style.display = 'none';

                    // Show manual input section
                    const manualSection = document.getElementById('manual-input-section');
                    if (manualSection) manualSection.style.display = 'block';

                    // Reset translation output
                    const translationOutput = document.getElementById(ids.TRANSLATION_OUTPUT);
                    if (translationOutput) {
                        Security.setSafeHtml(translationOutput, '<span style="color: #9ca3af;">Awaiting translation...</span>');
                    }

                    UI.clearChatHistory();
                    UI.showToast('Selection cleared', 'success');
                }
            } catch (err) { Logger.warn('Clear selection error', err); }
        });

        // Context Switch: Selection
        UI.addEventListener(document, 'click', (e) => {
            try {
                if (e && e.target && (e.target.id === 'gemini-context-sel-btn' || UI.elementClosest(e.target, '#gemini-context-sel-btn'))) {
                    const selText = Selection.currentSelectedText || Selection.getCurrentSelection() || '';
                    if (!selText) { UI.showToast('No text selected', 'warning'); return; }

                    UI.activeContext = selText;

                    const btnSel = document.getElementById('gemini-context-sel-btn');
                    const btnPage = document.getElementById('gemini-context-page-btn');
                    if (btnSel) { btnSel.style.background = '#e0e7ff'; btnSel.style.color = '#3730a3'; btnSel.style.border = '1px solid #c7d2fe'; }
                    if (btnPage) { btnPage.style.background = '#f3f4f6'; btnPage.style.color = '#4b5563'; btnPage.style.border = '1px solid #e5e7eb'; }

                    const lbl = document.getElementById('gemini-chat-context-label');
                    if (lbl) lbl.innerHTML = 'Ask questions about: <b>Selection</b>';
                    UI.showToast('Context set to Selection', 'info');
                }
            } catch (err) { Logger.warn('Context sel error', err); }
        });

        // Context Switch: Full Page
        UI.addEventListener(document, 'click', (e) => {
            try {
                if (e && e.target && (e.target.id === 'gemini-context-page-btn' || UI.elementClosest(e.target, '#gemini-context-page-btn'))) {
                    const pageText = Selection.getPageTextIncludingIframes();
                    if (!pageText) { UI.showToast('No page content found', 'warning'); return; }

                    UI.activeContext = pageText;

                    const btnSel = document.getElementById('gemini-context-sel-btn');
                    const btnPage = document.getElementById('gemini-context-page-btn');
                    if (btnPage) { btnPage.style.background = '#e0e7ff'; btnPage.style.color = '#3730a3'; btnPage.style.border = '1px solid #c7d2fe'; }
                    if (btnSel) { btnSel.style.background = '#f3f4f6'; btnSel.style.color = '#4b5563'; btnSel.style.border = '1px solid #e5e7eb'; }

                    const lbl = document.getElementById('gemini-chat-context-label');
                    if (lbl) lbl.innerHTML = 'Ask questions about: <b>Full Page</b>';
                    UI.showToast('Context set to Full Page', 'info');
                }
            } catch (err) { Logger.warn('Context page error', err); }
        });

        // Quick Summary Button
        UI.addEventListener(document, 'click', (e) => {
            try {
                if (e && e.target && (e.target.id === 'gemini-quick-summary-btn' || UI.elementClosest(e.target, '#gemini-quick-summary-btn'))) {
                    const inp = document.getElementById(CONFIG.ELEMENT_IDS.CHAT_INPUT);
                    if (inp) {
                        inp.value = 'Summarize this';
                        UI.handleChatQuestion();
                    }
                }
            } catch (err) { Logger.warn('Quick summary error', err); }
        });

        // Hide popup on outside click
        UI.addEventListener(document, 'mousedown', (e) => {
            if (UI.popup && UI.popup.style.display === 'block' &&
                !UI.popup.contains(e.target) &&
                window.getSelection().toString().length === 0) {
                UI.hidePopup();
            }
        });
    },

    // Add event listener with cleanup tracking
    addEventListener: (element, event, handler) => {
        element.addEventListener(event, handler);
        UI.eventListeners.push({ element, event, handler });
    },

    // Cleanup all event listeners
    cleanup: () => {
        UI.eventListeners.forEach(({ element, event, handler }) => {
            try {
                element.removeEventListener(event, handler);
            } catch (e) {
                Logger.warn('Error removing event listener', e);
            }
        });
        UI.eventListeners = [];

        // Remove global floating button resize handler if present
        try {
            if (window && UI._floatingBtnResizeHandler) {
                window.removeEventListener('resize', UI._floatingBtnResizeHandler);
                window.removeEventListener('scroll', UI._floatingBtnResizeHandler);
                delete UI._floatingBtnResizeHandler;
            }
        } catch (e) {
            Logger.warn('Error removing floating button resize handler', e);
        }

        Iframe.cleanup();
    },

    // Create permanent floating button for quick access
    ensureFloatingButton: async (skipStorageCheck = false) => {
        // Check if user disabled it globally
        if (!skipStorageCheck) {
            const res = await chrome.storage.local.get(['smarttranslate_hide_floating_button']);
            if (res.smarttranslate_hide_floating_button) return null;
        }

        if (UI.floatingButtonInstance) return UI.floatingButtonInstance.element;
        if (typeof FloatingButton !== 'undefined') {
            UI.floatingButtonInstance = new FloatingButton();
            return UI.floatingButtonInstance.mount();
        }
        /*
        try {
            // Prevent duplicate buttons - only create in top frame
            if (window.self !== window.top) {
                Logger.info('Skipping floating button in iframe');
                return null;
            }

            // Check if button already exists
            if (UI.floatingButton && document.body.contains(UI.floatingButton)) {
                return UI.floatingButton;
            }

            // Remove any existing buttons (cleanup)
            const existingButtons = document.querySelectorAll('#smarttranslate-floating-button');
            existingButtons.forEach(btn => {
                try { btn.remove(); } catch (e) { }
            });

            // Create button container - just the logo, no circular background
            const btnContainer = document.createElement('div');
            btnContainer.id = 'smarttranslate-floating-button';
            btnContainer.title = 'Open SmartTranslate';

            // Use setProperty with !important to override page CSS
            const setStyle = (prop, value) => {
                btnContainer.style.setProperty(prop, value, 'important');
            };

            setStyle('position', 'fixed');
            setStyle('bottom', '20px');
            setStyle('right', '20px');
            setStyle('width', '48px');
            setStyle('height', '48px');
            setStyle('cursor', 'pointer');
            setStyle('z-index', '2147483646');
            setStyle('pointer-events', 'auto');
            setStyle('padding', '0');

            setStyle('background', 'transparent');
            setStyle('border-radius', '10px');
            setStyle('border-style', 'groove');
            setStyle('border-width', '2px');
            setStyle('overflow', 'hidden'); // Ensure image clips to radius
            setStyle('display', 'flex');
            setStyle('align-items', 'center');
            setStyle('justify-content', 'center');
            setStyle('transition', 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)');
            setStyle('user-select', 'none');
            setStyle('opacity', '0.95');


            // Add logo image - full size, no container
            const logoImg = document.createElement('img');
            logoImg.src = chrome.runtime.getURL('logo.png');
            logoImg.alt = 'SmartTranslate';
            logoImg.style.setProperty('width', '100%', 'important');
            logoImg.style.setProperty('height', '100%', 'important');
            logoImg.style.setProperty('object-fit', 'contain', 'important');
            logoImg.style.setProperty('pointer-events', 'none', 'important');
            logoImg.style.setProperty('display', 'block', 'important');
            btnContainer.appendChild(logoImg);

            // Auto-hide functionality
            let hideTimeout = null;
            let isHidden = false;
            let isDragging = false;

            const hideButton = () => {
                if (isHidden || isDragging) return;

                const rect = btnContainer.getBoundingClientRect();
                const vw = window.innerWidth;

                // Check if we are near an edge (within 100px)
                const distLeft = rect.left;
                const distRight = vw - rect.right;

                // If floating in the middle, DO NOT slide/hide
                if (distLeft > 100 && distRight > 100) {
                    return;
                }

                isHidden = true;

                // Determine close edge for sliding
                const isLeft = rect.left + (rect.width / 2) < (vw / 2);

                // Slide towards the closest edge
                const translateX = isLeft ? '-40px' : '40px';
                btnContainer.style.setProperty('transform', `translateX(${translateX})`, 'important');
            };

            const showButton = () => {
                isHidden = false;
                btnContainer.style.setProperty('transform', 'translateX(0)', 'important');
                btnContainer.style.setProperty('opacity', '0.95', 'important');

                // Reset hide timer
                clearTimeout(hideTimeout);
                hideTimeout = setTimeout(hideButton, 3000);
            };

            // Initial hide timer
            hideTimeout = setTimeout(hideButton, 3000);

            // Add hover effects
            btnContainer.addEventListener('mouseenter', () => {
                showButton();
                btnContainer.style.setProperty('transform', 'translateX(0) scale(1.1)', 'important');
                btnContainer.style.setProperty('opacity', '1', 'important');
            });

            btnContainer.addEventListener('mouseleave', () => {
                let transformVal = 'translateX(0) scale(1)';

                if (isHidden) {
                    const rect = btnContainer.getBoundingClientRect();
                    const isLeft = rect.left + (rect.width / 2) < (window.innerWidth / 2);
                    const translateX = isLeft ? '-40px' : '40px';
                    transformVal = `translateX(${translateX})`;
                }

                btnContainer.style.setProperty('transform', transformVal, 'important');
                btnContainer.style.setProperty('opacity', '0.95', 'important');
            });



            // Make button draggable for repositioning - SMOOTH DRAG VERSION
            let startX = 0, startY = 0;
            let initialLeft = 0, initialTop = 0;
            let hasMoved = false;

            const onPointerMove = (e) => {
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;

                // Only start dragging if moved more than 5px
                if (!isDragging && Math.sqrt(dx * dx + dy * dy) > 5) {
                    isDragging = true;
                    // CRITICAL: Disable transitions during drag to prevent 'jumping'/lag
                    btnContainer.style.setProperty('transition', 'none', 'important');
                    btnContainer.style.setProperty('cursor', 'grabbing', 'important');
                    showButton();
                }

                if (!isDragging) return;

                e.preventDefault();
                e.stopPropagation();

                // Simple 1:1 movement relative to start position
                let newX = initialLeft + dx;
                let newY = initialTop + dy;

                const vw = window.innerWidth;
                const vh = window.innerHeight;
                const size = 48;
                const padding = 10;

                // Clamp to viewport
                newX = Math.max(padding, Math.min(newX, vw - size - padding));
                newY = Math.max(padding, Math.min(newY, vh - size - padding));

                // Switch to explict left/top positioning immediately
                btnContainer.style.setProperty('right', 'auto', 'important');
                btnContainer.style.setProperty('bottom', 'auto', 'important');
                btnContainer.style.setProperty('left', `${newX}px`, 'important');
                btnContainer.style.setProperty('top', `${newY}px`, 'important');

                hasMoved = true;
            };

            const startDrag = (e) => {
                if (e.button !== 0) return;

                const rect = btnContainer.getBoundingClientRect();
                startX = e.clientX;
                startY = e.clientY;
                // Store accurate initial position
                initialLeft = rect.left;
                initialTop = rect.top;

                isDragging = false;
                hasMoved = false;

                // Pointer capture ensures smooth drag even if mouse moves fast
                if (btnContainer.setPointerCapture) {
                    try { btnContainer.setPointerCapture(e.pointerId); } catch (e) { }
                }

                document.addEventListener('pointermove', onPointerMove);
                document.addEventListener('pointerup', stopDrag, { once: true });
                e.preventDefault();
            };

            const stopDrag = (e) => {
                document.removeEventListener('pointermove', onPointerMove);
                if (btnContainer.releasePointerCapture) {
                    try { btnContainer.releasePointerCapture(e.pointerId); } catch (e) { }
                }

                btnContainer.style.setProperty('cursor', 'pointer', 'important');
                // Restore smooth animations
                btnContainer.style.setProperty('transition', 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)', 'important');

                if (isDragging) {
                    isDragging = false;
                    showButton();
                    e.preventDefault();
                    e.stopPropagation();
                }
            };

            // Remove old click handler and implement split logic here
            // We handle 'click' manually based on whether a drag occurred
            btnContainer.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();

                // If we dragged, do NOT open popup
                if (hasMoved) return;

                Logger.info('Floating button clicked');
                showButton();

                const x = window.innerWidth / 2;
                const y = window.innerHeight / 2;
                
                // Explicitly check for selection right now
                const currentSel = Selection.getSelectionTextIncludingIframes();
                // Pass the result (empty string if none) to avoid any ambiguity
                UI.showPopup(x, y, currentSel || '');
            });

            btnContainer.addEventListener('pointerdown', startDrag);

            // Show button on any user activity
            document.addEventListener('mousemove', showButton, { passive: true });
            document.addEventListener('scroll', showButton, { passive: true });

            // Ensure button stays on screen during resize (e.g. devtools toggle)
            window.addEventListener('resize', () => {
                const rect = btnContainer.getBoundingClientRect();
                const vw = window.innerWidth;
                const vh = window.innerHeight;
                const size = 48;
                const padding = 10;

                // If off-screen (bottom or right edge), clamp it back
                if (rect.bottom > vh || rect.right > vw) {
                    const newX = Math.min(rect.left, vw - size - padding);
                    const newY = Math.min(rect.top, vh - size - padding);
                    btnContainer.style.setProperty('left', `${Math.max(padding, newX)}px`, 'important');
                    btnContainer.style.setProperty('top', `${Math.max(padding, newY)}px`, 'important');
                }
            }, { passive: true });

            // Add to page
            document.body.appendChild(btnContainer);
            UI.floatingButton = btnContainer;

            Logger.info('Floating button created (square logo, auto-hide)');
            return btnContainer;
        } catch (e) {
            Logger.error('Error creating floating button', e);
            return null;
        }
     */ return null;
    },

    // Selection Indicator instance
    selectionIndicatorInstance: null,

    createSelectionIndicator: () => {
        if (UI.selectionIndicatorInstance) return UI.selectionIndicatorInstance.element;
        if (typeof SelectionIndicator !== 'undefined') {
            UI.selectionIndicatorInstance = new SelectionIndicator();
            return UI.selectionIndicatorInstance.mount();
        }
        /*
        try {
            if (UI.selectionIndicator) return UI.selectionIndicator;

            const indicator = document.createElement('div');
            indicator.id = 'smarttranslate-selection-indicator';
            indicator.title = 'Click to translate';

            // Use setProperty with !important to override page CSS
            const setStyle = (prop, value) => {
                indicator.style.setProperty(prop, value, 'important');
            };

            setStyle('position', 'fixed');
            setStyle('width', '32px');
            setStyle('height', '32px');
            setStyle('cursor', 'pointer');
            setStyle('z-index', '2147483647');
            setStyle('pointer-events', 'auto');
            setStyle('padding', '0');
            setStyle('border', 'none');
            setStyle('background', 'transparent');
            setStyle('display', 'flex');
            setStyle('align-items', 'center');
            setStyle('justify-content', 'center');
            setStyle('visibility', 'visible');
            setStyle('opacity', '0');
            setStyle('transition', 'opacity 0.15s ease');
            setStyle('top', '0');
            setStyle('left', '0');
            setStyle('margin', '0');
            // White glow for visibility on dark backgrounds + Soft shadow for depth
            setStyle('filter', 'drop-shadow(0 0 4px rgba(255, 255, 255, 0.9)) drop-shadow(0 2px 6px rgba(0, 0, 0, 0.4))');

            // Add logo image - full size
            const logoImg = document.createElement('img');
            logoImg.src = chrome.runtime.getURL('logo.png');
            logoImg.alt = 'SmartTranslate';
            logoImg.style.setProperty('width', '100%', 'important');
            logoImg.style.setProperty('height', '100%', 'important');
            logoImg.style.setProperty('object-fit', 'contain', 'important');
            logoImg.style.setProperty('pointer-events', 'none', 'important');
            logoImg.style.setProperty('display', 'block', 'important');
            indicator.appendChild(logoImg);

            // Add hover effects
            indicator.addEventListener('mouseenter', () => {
                indicator.style.setProperty('transform', 'scale(1.15)', 'important');
                indicator.style.setProperty('filter', 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3))', 'important');
            });
            indicator.addEventListener('mouseleave', () => {
                indicator.style.setProperty('transform', 'scale(1)', 'important');
                indicator.style.setProperty('filter', 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.2))', 'important');
            });

            // Mouseup handler to catch the click more reliably than 'click' event
            // which often fails if selection changes between mousedown and mouseup
            indicator.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                e.preventDefault();

                Logger.info('Indicator mousedown');

                // Use the STORED selection text (because clicking deselects)
                let selectionText = Selection.currentSelectedText || '';

                if (selectionText && selectionText.trim().length > 0) {
                    Logger.info('Calling showPopup from indicator');
                    UI.showPopup(e.clientX, e.clientY, selectionText);

                    // Hide indicator
                    indicator.style.setProperty('opacity', '0', 'important');
                    indicator.style.setProperty('display', 'none', 'important');
                    indicator.style.setProperty('visibility', 'hidden', 'important');
                }
            });

            // Hide on document click (but not on the indicator itself)
            document.addEventListener('mousedown', (e) => {
                if (!UI.selectionIndicator) return;

                // Safe check if click is outside indicator
                const targetEl = (e.target && e.target.nodeType === 3) ? e.target.parentElement : e.target;
                const isInsideIndicator = targetEl && (targetEl === UI.selectionIndicator || UI.selectionIndicator.contains(targetEl));

                if (!isInsideIndicator) {
                    // Check if we have selection - if not, hide
                    const sel = window.getSelection();
                    if (!sel || sel.toString().trim().length === 0) {
                        UI.selectionIndicator.style.setProperty('display', 'none', 'important');
                        UI.selectionIndicator.style.setProperty('opacity', '0', 'important');
                        UI.selectionIndicator.style.setProperty('visibility', 'hidden', 'important');
                    }
                }
            });

            // Start polling for selection
            // In the TOP frame, we scan all iframes to show a unified indicator
            // In a SUB frame, we only scan locally but allow the indicator to show
            // This ensures coverage even in cross-origin or complex nested cases.

            // Keep indicator visible while text is selected (via continuous check)
            let selectionCheckInterval = setInterval(() => {
                if (!UI.selectionIndicator) return;

                // If extension is disabled or popup is showing, hide indicator
                if (UI.isEnabled === false || (UI.popup && UI.popup.style.display === 'block')) {
                    if (UI.selectionIndicator.style.display !== 'none') {
                        UI.selectionIndicator.style.setProperty('display', 'none', 'important');
                        UI.selectionIndicator.style.setProperty('opacity', '0', 'important');
                    }
                    return;
                }

                // If it's already being hovered, don't hide it
                if (UI.selectionIndicator.matches(':hover')) return;

                let selectedText = '';
                let rect = null;

                // 1. Try regular top-level selection
                const sel = window.getSelection ? window.getSelection() : null;
                if (sel && sel.toString().trim().length > 0) {
                    // Quick check if the selection is actually visible/active
                    const range = sel.getRangeAt(0);
                    const container = range.startContainer.parentElement;
                    if (container && (container.checkVisibility ? container.checkVisibility() : container.offsetParent !== null)) {
                        selectedText = sel.toString().trim();
                        try {
                            const rects = range.getClientRects();
                            if (rects.length > 0) {
                                // Use the last rect (end of selection/last line) for better positioning
                                // instead of the bounding box of the entire paragraph
                                rect = rects[rects.length - 1];
                            } else {
                                rect = range.getBoundingClientRect();
                            }
                        } catch (e) {
                            rect = range.getBoundingClientRect();
                        }
                    }
                }

                // 2. Try ServiceNow deep search
                if (!selectedText && typeof ServiceNowHelper !== 'undefined') {
                    try {
                        const snSelection = ServiceNowHelper.getSelection();
                        if (snSelection && snSelection.selection) {
                            selectedText = snSelection.selection.trim();
                            if (snSelection.rect) rect = snSelection.rect;
                        }
                    } catch (e) { }
                }

                // 3. Try TinyMCE search
                if (!selectedText && typeof TinyMCEHelper !== 'undefined') {
                    try {
                        const mceResult = TinyMCEHelper.getSelectionFromIframes();
                        if (mceResult && mceResult.text) {
                            selectedText = mceResult.text.trim();
                            if (mceResult.rect) rect = mceResult.rect;
                        }
                    } catch (e) { }
                }

                // 4. Recursive backup for any other same-origin iframes (ONLY if we are TOP frame)
                if (!selectedText && window.self === window.top) {
                    try {
                        const iframes = document.querySelectorAll('iframe');
                        for (const iframe of iframes) {
                            // Skip hidden iframes
                            if (!(iframe.checkVisibility ? iframe.checkVisibility() : iframe.offsetParent !== null)) continue;

                            try {
                                const cd = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
                                if (!cd) continue;
                                const iframeSel = cd.getSelection();
                                if (iframeSel && iframeSel.toString().trim()) {
                                    const range = iframeSel.getRangeAt(0);
                                    const container = range.startContainer.parentElement;
                                    // Verify visibility inside iframe
                                    if (container && (container.checkVisibility ? container.checkVisibility() : container.offsetParent !== null)) {
                                        selectedText = iframeSel.toString().trim();

                                        let r;
                                        try {
                                            const rects = range.getClientRects();
                                            if (rects.length > 0) {
                                                r = rects[rects.length - 1]; // Use last line rect
                                            } else {
                                                r = range.getBoundingClientRect();
                                            }
                                        } catch (e) { r = range.getBoundingClientRect(); }

                                        const ir = iframe.getBoundingClientRect();
                                        rect = { top: r.top + ir.top, left: r.left + ir.left, right: r.right + ir.left, bottom: r.bottom + ir.top, width: r.width, height: r.height };
                                        break;
                                    }
                                }
                            } catch (e) { }
                        }
                    } catch (e) { }
                }

                // IMPORTANT: If we are in a sub-frame and the TOP frame exists and is SAME-ORIGIN,
                // we should check if the TOP frame's indicator is already showing to avoid doubles.
                // However, ServiceNow frames are often deeply nested, so we prioritize showing the local one.

                const hasText = selectedText && selectedText.trim().length > 0;

                if (hasText) {
                    // Update shared selection state
                    Selection.setCurrentSelection(selectedText);

                    // Show indicator if we have position
                    if (rect && (rect.width > 0 || rect.height > 0)) {
                        UI.selectionIndicator.style.setProperty('display', 'flex', 'important');
                        UI.selectionIndicator.style.setProperty('opacity', '1', 'important');
                        UI.selectionIndicator.style.setProperty('visibility', 'visible', 'important');

                        // Position next to the end of text (last line)
                        // Slightly shifted up to align center with text line
                        // x: 5px to the right of text end
                        // y: aligned vertically with the text line (rect.top + slight offset)
                        const x = Math.max(10, Math.min(rect.right + 5, window.innerWidth - 40));
                        const y = Math.max(10, Math.min(rect.top - 8, window.innerHeight - 40));

                        // Final phantom check: If the rect is outside the current viewport entirely, hide it
                        if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) {
                            UI.selectionIndicator.style.setProperty('display', 'none', 'important');
                        } else {
                            UI.selectionIndicator.style.setProperty('left', x + 'px', 'important');
                            UI.selectionIndicator.style.setProperty('top', y + 'px', 'important');
                        }
                    } else {
                        UI.selectionIndicator.style.setProperty('display', 'none', 'important');
                    }
                } else {
                    UI.selectionIndicator.style.setProperty('display', 'none', 'important');
                    UI.selectionIndicator.style.setProperty('opacity', '0', 'important');
                }
            }, 250); // 200ms is enough to be responsive without flickering

            // Store interval ID for cleanup
            UI.selectionCheckInterval = selectionCheckInterval;

            document.body.appendChild(indicator);
            createSelectionIndicator: () => {
                if (UI.selectionIndicatorInstance) return UI.selectionIndicatorInstance.element;
                if (typeof SelectionIndicator !== 'undefined') {
                    UI.selectionIndicatorInstance = new SelectionIndicator();
                    return UI.selectionIndicatorInstance.mount();
                }
            },
                Logger.info('Selection indicator created');
            return indicator;
        } catch (e) {
            Logger.error('Error creating selection indicator', e);
            return null;
        }
     */ return null;
    },

    showSelectionIndicator: (x, y) => {
        try {
            const indicator = UI.selectionIndicator || UI.createSelectionIndicator();
            if (!indicator) return;

            // Position near cursor but offset to right and down
            const offsetX = 15;
            const offsetY = 15;

            // Clamp to viewport to ensure it stays visible
            const maxX = window.innerWidth - 50;
            const maxY = window.innerHeight - 50;
            const clampedX = Math.max(0, Math.min(x + offsetX, maxX));
            const clampedY = Math.max(0, Math.min(y + offsetY, maxY));

            indicator.style.setProperty('left', clampedX + 'px', 'important');
            indicator.style.setProperty('top', clampedY + 'px', 'important');
            indicator.style.setProperty('display', 'flex', 'important');
            indicator.style.setProperty('visibility', 'visible', 'important');
            indicator.style.setProperty('opacity', '1', 'important');
            indicator.style.setProperty('pointer-events', 'auto', 'important');

            // Clear any existing timeout
            clearTimeout(UI.selectionIndicatorTimeout);

            // Don't auto-hide - keep visible while text is selected
            // User must click elsewhere to hide it

            Logger.debug('Selection indicator shown at', { x: clampedX, y: clampedY });
        } catch (e) {
            Logger.warn('Error showing selection indicator', e);
        }
    },

    updateSelectionIndicator: (event) => {
        try {
            const indicator = UI.selectionIndicatorInstance || UI.createSelectionIndicator();
            if (indicator && UI.selectionIndicatorInstance && typeof UI.selectionIndicatorInstance.update === 'function') {
                UI.selectionIndicatorInstance.update(event);
            }
        } catch (e) {
            Logger.warn('Error updating selection indicator', e);
        }
    },

    hideSelectionIndicator: () => {
        try {
            if (UI.selectionIndicator) {
                UI.selectionIndicator.style.setProperty('display', 'none', 'important');
                UI.selectionIndicator.style.setProperty('opacity', '0', 'important');
                UI.selectionIndicator.style.setProperty('pointer-events', 'none', 'important');
            }
            clearTimeout(UI.selectionIndicatorTimeout);
        } catch (e) {
            // ignore errors
        }
    },

    // Clamp floating button position to viewport
    clampFloatingButtonPosition: (btnContainer) => {
        try {
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const bw = btnContainer.offsetWidth || CONFIG.FLOATING_BUTTON_SIZE;
            const bh = btnContainer.offsetHeight || CONFIG.FLOATING_BUTTON_SIZE;
            const padding = 8;
            let left = btnContainer.style.left ? parseFloat(btnContainer.style.left) : null;
            let top = btnContainer.style.top ? parseFloat(btnContainer.style.top) : null;

            if (left !== null) {
                left = Math.max(padding, Math.min(left, vw - bw - padding));
                btnContainer.style.left = `${left}px`;
                btnContainer.style.right = '';
            }
            if (top !== null) {
                top = Math.max(padding, Math.min(top, vh - bh - padding));
                btnContainer.style.top = `${top}px`;
                btnContainer.style.bottom = '';
            }
        } catch (e) {
            Logger.warn('Error clamping floating button position', e);
        }
    },

    // Set enabled state
    setEnabled: (enabled) => {
        UI.isEnabled = enabled;
        if (UI.floatingButton) {
            if (enabled) {
                UI.floatingButton.style.display = '';
            } else {
                try {
                    UI.floatingButton.remove();
                    UI.floatingButton = null;
                } catch (e) {
                    UI.floatingButton.style.display = 'none';
                }
            }
        }

        // Update in-popup toggle if present
        const toggle = document.getElementById('gemini-enable-toggle');
        const toggleContainer = document.getElementById('gemini-enable-container');
        if (toggle) toggle.checked = !!enabled;
        if (toggleContainer) toggleContainer.classList.toggle('active', !!enabled);
    }
};

// Export
if (typeof window !== 'undefined') {
    window.UI = UI;
    window.showToast = UI.showToast; // Global for backward compatibility
    window.ensureFloatingButton = UI.ensureFloatingButton; // Global for backward compatibility
}