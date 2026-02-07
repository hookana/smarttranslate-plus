// popup.js - Handles the extension popup UI and state management

// Get the current tab's domain and state when popup opens
async function getCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
}

// Update UI based on the current state
function updateUI(isEnabled, domain) {
    const toggle = document.getElementById('enableToggle');
    const container = document.getElementById('toggleContainer');

    toggle.checked = isEnabled;
    container.classList.toggle('active', isEnabled);
    document.getElementById('domain').textContent = `for ${domain}`;
}

// Initialize tab switching
function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.getAttribute('data-tab');

            // Update active tab button
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update active tab content
            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(`${tabName}-tab`).classList.add('active');
        });
    });
}

// Initialize popup
async function initializePopup() {
    try {
        const tab = await getCurrentTab();
        if (!tab) {
            throw new Error('No active tab found');
        }

        // Get domain from the current tab's URL
        const url = new URL(tab.url);
        const domain = url.hostname;

        // Get current state for this domain
        const key = `smartTranslate_${domain}`;
        const result = await chrome.storage.local.get(key);
        const isEnabled = result[key] === undefined ? true : result[key];

        // Update UI
        updateUI(isEnabled, domain);

        // Add toggle event listener
        const toggle = document.getElementById('enableToggle');
        toggle.addEventListener('change', async (e) => {
            const newState = e.target.checked;

            // Save new state
            await chrome.storage.local.set({ [key]: newState });

            // Update UI
            updateUI(newState, domain);

            // Notify content script of state change
            try {
                await chrome.tabs.sendMessage(tab.id, {
                    type: 'smarttranslate:state-change',
                    enabled: newState
                });
            } catch (err) {
                // Could not notify content script
            }
        });

        // Floating Button Toggle Logic
        const floatToggle = document.getElementById('floatingButtonToggle');
        if (floatToggle) {
            const floatHiddenRes = await chrome.storage.local.get(['smarttranslate_hide_floating_button']);
            const isHidden = !!floatHiddenRes.smarttranslate_hide_floating_button;
            floatToggle.checked = !isHidden; // UI is "Show Floating Button"

            floatToggle.addEventListener('change', async (e) => {
                const show = e.target.checked;
                await chrome.storage.local.set({ 'smarttranslate_hide_floating_button': !show });

                // Notify all tabs to show/hide their floating button
                const tabs = await chrome.tabs.query({});
                tabs.forEach(t => {
                    chrome.tabs.sendMessage(t.id, {
                        type: 'smarttranslate:floating-button-visibility',
                        show: show
                    }).catch(() => { });
                });
            });
        }

    } catch (error) {
    }
}

// Handle API key functionality (multiple providers)
async function initializeApiKey() {
    const providersList = document.getElementById('providersList');
    const statusDiv = document.getElementById('apiKeyStatus');

    const DEFAULT_PROVIDERS = [
        { id: 'gemini', name: 'AI Assistant (Gemini)', desc: 'Professional AI tier', url: 'https://makersuite.google.com/app/apikey' }
    ];

    const showStatus = (message, isError = false) => {
        statusDiv.textContent = message;
        statusDiv.style.color = isError ? '#dc2626' : '#059669';
        statusDiv.style.display = 'block';
        setTimeout(() => { statusDiv.style.display = 'none'; }, 3000);
    };

    // Load saved keys and default provider
    const stored = await chrome.storage.local.get(['apiKeys', 'geminiApiKey', 'geminiDefaultProvider']);
    let apiKeys = stored.apiKeys || {};
    // Backwards compatibility: if legacy geminiApiKey found, use it
    if (stored.geminiApiKey && !apiKeys.gemini) apiKeys.gemini = stored.geminiApiKey;
    let defaultProvider = stored.geminiDefaultProvider || (apiKeys.gemini ? 'gemini' : (Object.keys(apiKeys)[0] || 'gemini'));

    const renderProviders = () => {
        providersList.innerHTML = '';
        const providerIds = Array.from(new Set([...DEFAULT_PROVIDERS.map(p => p.id), ...Object.keys(apiKeys)]));
        providerIds.forEach(pid => {
            const prov = DEFAULT_PROVIDERS.find(p => p.id === pid) || { id: pid, name: pid };
            const isActive = pid === defaultProvider;

            const card = document.createElement('div');
            card.className = `provider-input-card ${isActive ? 'active' : ''}`;

            // Header with radio and status
            const header = document.createElement('div');
            header.className = 'provider-input-header';

            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'defaultProvider';
            radio.value = pid;
            radio.checked = isActive;
            radio.className = 'provider-input-radio';
            radio.addEventListener('change', async () => {
                defaultProvider = pid;
                await chrome.storage.local.set({ geminiDefaultProvider: defaultProvider });
                renderProviders();
                broadcastApiKeys();
                showStatus('Default provider: ' + (prov.name || pid));
            });

            const label = document.createElement('label');
            label.className = 'provider-input-name';
            label.textContent = prov.name || pid;
            label.style.cursor = 'pointer';

            const statusBadge = document.createElement('div');
            statusBadge.className = `provider-input-status ${isActive ? 'active' : ''}`;
            statusBadge.textContent = isActive ? 'Default' : 'Inactive';

            header.appendChild(radio);
            header.appendChild(label);
            header.appendChild(statusBadge);

            // Input field
            const inputGroup = document.createElement('div');
            inputGroup.className = 'provider-input-field-group';

            const input = document.createElement('input');
            input.type = 'password';
            input.placeholder = 'Enter API key...';
            input.value = apiKeys[pid] || '';
            input.className = 'api-key-input';
            input.id = `apiKey-${pid}`;
            input.style.flex = '1';

            const buttonsContainer = document.createElement('div');
            buttonsContainer.className = 'provider-input-buttons';

            // Get Key button
            const getBtn = document.createElement('button');
            getBtn.className = 'provider-input-btn btn-get-key';
            getBtn.textContent = '🔗 Get Key';
            getBtn.addEventListener('click', () => {
                const p = DEFAULT_PROVIDERS.find(x => x.id === pid);
                const url = p?.url || `https://www.google.com/search?q=${encodeURIComponent(pid + ' api key')}`;
                chrome.tabs.create({ url });
            });

            // Save button
            const saveBtn = document.createElement('button');
            saveBtn.className = 'provider-input-btn btn-save';
            saveBtn.textContent = '💾 Save';
            saveBtn.addEventListener('click', async () => {
                const val = input.value.trim();
                if (!val) { showStatus('Please enter a valid API key', true); return; }
                apiKeys[pid] = val;
                await chrome.storage.local.set({ apiKeys });
                if (pid === 'gemini') await chrome.storage.local.set({ geminiApiKey: val });
                renderProviders();
                broadcastApiKeys();
                showStatus('✓ API key saved');
            });

            // Test button
            const testBtn = document.createElement('button');
            testBtn.className = 'provider-input-btn btn-test';
            testBtn.textContent = '⚡ Test';
            testBtn.addEventListener('click', async () => {
                showStatus('Testing…');
                apiKeys[pid] = input.value.trim();
                await chrome.storage.local.set({ apiKeys });
                broadcastApiKeys();
                showStatus('Saved. Try translating to validate.');
            });

            // Delete button (only for non-default custom providers)
            const delBtn = document.createElement('button');
            delBtn.className = 'provider-input-btn btn-delete';
            delBtn.textContent = '🗑️ Delete';
            delBtn.addEventListener('click', async () => {
                delete apiKeys[pid];
                await chrome.storage.local.set({ apiKeys });
                if (pid === defaultProvider) {
                    defaultProvider = Object.keys(apiKeys)[0] || 'gemini';
                    await chrome.storage.local.set({ geminiDefaultProvider: defaultProvider });
                }
                renderProviders();
                broadcastApiKeys();
                showStatus('Deleted provider');
            });

            buttonsContainer.appendChild(getBtn);
            buttonsContainer.appendChild(saveBtn);
            buttonsContainer.appendChild(testBtn);

            if (!DEFAULT_PROVIDERS.some(p => p.id === pid)) {
                buttonsContainer.appendChild(delBtn);
            }

            inputGroup.appendChild(input);
            inputGroup.appendChild(buttonsContainer);

            card.appendChild(header);
            card.appendChild(inputGroup);
            providersList.appendChild(card);
        });
    };

    const broadcastApiKeys = () => {
        // Notify all tabs about updated api keys and default provider
        chrome.tabs.query({}, function (tabs) {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    type: 'smarttranslate:api-keys-updated',
                    apiKeys,
                    defaultProvider
                }).catch(() => { });
            });
        });
    };

    renderProviders();
}

// Handle Gemini model selection
async function initializeModelSelection() {
    const modelSelect = document.getElementById('modelSelect');
    const statusDiv = document.getElementById('modelStatus');

    if (!modelSelect) return;

    const showStatus = (message, isError = false) => {
        statusDiv.textContent = message;
        statusDiv.style.color = isError ? '#dc2626' : '#059669';
        statusDiv.style.display = 'block';
        setTimeout(() => { statusDiv.style.display = 'none'; }, 3000);
    };

    // Populate options
    const models = (typeof CONFIG !== 'undefined' && CONFIG.AVAILABLE_MODELS) ? CONFIG.AVAILABLE_MODELS : [
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Fastest)' },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Powerful)' }
    ];

    modelSelect.innerHTML = '';
    models.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.name;
        modelSelect.appendChild(opt);
    });

    // Load saved model
    const modelKey = (typeof CONFIG !== 'undefined' && CONFIG.STORAGE_KEYS) ? CONFIG.STORAGE_KEYS.SELECTED_MODEL : 'geminiSelectedModel';
    const defaultModel = (typeof CONFIG !== 'undefined') ? CONFIG.MODEL : 'gemini-1.5-flash';

    const stored = await chrome.storage.local.get([modelKey]);
    let currentModel = stored[modelKey] || defaultModel;

    // Clean up name using Api mapping
    if (typeof Api !== 'undefined' && typeof Api.mapModelName === 'function') {
        currentModel = Api.mapModelName(currentModel);
    }

    // Validate if stored model still exists in the available list
    if (!models.find(m => m.id === currentModel)) {
        currentModel = defaultModel;
        await chrome.storage.local.set({ [modelKey]: currentModel });
    }

    modelSelect.value = currentModel;

    // Handle change
    modelSelect.addEventListener('change', async () => {
        const newModel = modelSelect.value;
        await chrome.storage.local.set({ [modelKey]: newModel });

        // Notify all tabs
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    type: 'smarttranslate:model-updated',
                    model: newModel
                }).catch(() => { });
            });
        });

        showStatus('Model updated: ' + newModel);
    });
}

// Request quick translation from content script with retry logic
async function requestQuickTranslation(tab, retries = 3) {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            // First ensure content script is injected and responding
            await chrome.tabs.sendMessage(tab.id, { type: 'smarttranslate:ping' });

            // Get proofread state
            const btCheck = document.getElementById('gemini-back-translation-checkbox');
            const isProofread = !!btCheck?.checked;

            // Then request translation
            const userLangSelect = document.getElementById('userLanguageSelect');
            const targetLang = userLangSelect ? userLangSelect.value : 'en';

            const resp = await chrome.tabs.sendMessage(tab.id, {
                type: 'smarttranslate:translate-selection',
                targetLang: targetLang,
                isProofread: isProofread
            });
            return resp;
        } catch (err) {
            if (attempt < retries - 1) {
                await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
            } else {
                throw err;
            }
        }
    }
}

// Handle Open Assistant button
function initializeOpenAssistant() {
    const openBtn = document.getElementById('gemini-open-window-btn');
    if (!openBtn) return;

    openBtn.addEventListener('click', async () => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) return;

            // Check if we can talk to this tab
            if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('about:')) {
                alert('Cannot open assistant on this page.');
                return;
            }

            // Clear any cached selection to start fresh
            await chrome.storage.local.remove(['smarttranslate_active_selection']);

            // Send message to show popup without any selection (opens in Translation tab by default)
            await chrome.tabs.sendMessage(tab.id, {
                type: 'smarttranslate:show-popup',
                selection: '',
                forceClear: true // Explicitly tell content script to ignore any page selection
            });

            // Close the extension popup to show the assistant window
            window.close();
        } catch (err) {
        }
    });
}

// Handle Back Translation Checkbox
async function initializeBackTranslation() {
    const checkbox = document.getElementById('gemini-back-translation-checkbox');
    if (!checkbox) return;

    const storageKey = 'smarttranslate_back_translation';

    // Start unchecked by default
    checkbox.checked = false;

    // Save state on change
    checkbox.addEventListener('change', async () => {
        const val = checkbox.checked;
        await chrome.storage.local.set({ [storageKey]: val });

        // Re-trigger translation if there is a current translation visible
        const quickTranslation = document.getElementById('quickTranslation');
        if (quickTranslation && quickTranslation.textContent && quickTranslation.textContent !== 'Awaiting translation...') {
            handleQuickTranslation();
        }

        // Notify tabs
        const tabs = await chrome.tabs.query({});
        tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
                type: 'smarttranslate:back-translation-updated',
                enabled: val
            }).catch(() => { });
        });
    });
}

// Handle quick translation display
async function handleQuickTranslation() {
    const noSelectionMsg = document.getElementById('noSelectionMsg');
    const translationContainer = document.getElementById('translationContainer');
    const quickTranslation = document.getElementById('quickTranslation');
    const translatorSpinner = document.getElementById('translatorSpinner');

    function displayResult(text, tokens) {
        noSelectionMsg.style.display = 'none';
        translationContainer.style.display = 'block';

        const proofreadResults = document.getElementById('gemini-proofread-results');
        const correctionOutput = document.getElementById('gemini-correction-output');
        const backTranslationOutput = document.getElementById('gemini-back-translation-output');
        const explanationOutput = document.getElementById('gemini-explanation-output');

        if (proofreadResults) {
            const btCheck = document.getElementById('gemini-back-translation-checkbox');
            const isBT = !!btCheck?.checked;
            proofreadResults.style.display = isBT ? 'block' : 'none';
            if (isBT) {
                const ids = ['gemini-correction-output', 'gemini-explanation-output'];
                ids.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.textContent = 'Analyzing...';
                });
            }
        }

        // Check if it's JSON (structured proofread) or plain text
        try {
            let responseText = text.trim();

            // Strip markdown code blocks if AI wrapped the JSON
            if (responseText.includes('```')) {
                const match = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                if (match) responseText = match[1].trim();
            }

            if (responseText.startsWith('{')) {
                const parsed = JSON.parse(responseText);
                if (typeof Security !== 'undefined') {
                    Security.setSafeHtml(quickTranslation, parsed.translation || '', true);
                } else {
                    quickTranslation.textContent = parsed.translation || '';
                }

                if (proofreadResults) {
                    const hasProofread = parsed.correction || parsed.explanation;
                    const btCheck = document.getElementById('gemini-back-translation-checkbox');
                    const isBTRequested = !!btCheck?.checked;

                    if (hasProofread && isBTRequested) {
                        proofreadResults.style.display = 'block';

                        const updateSec = (secId, outId, content, useMD = false) => {
                            const sec = document.getElementById(secId);
                            const out = document.getElementById(outId);
                            if (sec && out) {
                                if (content && content.trim() && content !== 'N/A') {
                                    sec.style.display = 'block';
                                    if (typeof Security !== 'undefined') {
                                        Security.setSafeHtml(out, content, useMD);
                                    } else {
                                        out.textContent = content;
                                    }
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
                setupCopyButton(parsed.translation || '');
            } else {
                if (typeof Security !== 'undefined') {
                    Security.setSafeHtml(quickTranslation, responseText, true);
                } else {
                    quickTranslation.textContent = responseText;
                }
                if (proofreadResults) proofreadResults.style.display = 'none';
                setupCopyButton(responseText);
            }
        } catch (e) {
            const cleanText = text.replace(/```json|```/g, '').trim();
            quickTranslation.textContent = cleanText;
            if (proofreadResults) proofreadResults.style.display = 'none';
            setupCopyButton(cleanText);
        }

        if (tokens) updateTokenDisplay(tokens);
    }

    function setupCopyButton(textToCopy) {
        const copyBtn = document.getElementById('copyTranslationBtn');
        if (copyBtn) {
            copyBtn.onclick = () => {
                navigator.clipboard.writeText(textToCopy).then(() => {
                    const originalText = copyBtn.textContent;
                    copyBtn.textContent = '✓ Copied!';
                    setTimeout(() => { copyBtn.textContent = originalText; }, 2000);
                });
            };
        }
    }

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) return;

        // Restriction check
        if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('about:') || tab.url.startsWith('https://chrome.google.com')) {
            noSelectionMsg.textContent = 'Cannot translate this page (Browser Restriction)';
            noSelectionMsg.style.display = 'block';
            return;
        }

        translatorSpinner.style.display = 'block';
        noSelectionMsg.style.display = 'none';
        translationContainer.style.display = 'none';

        let foundSelection = '';

        // 0. Try reading from synced storage (most reliable for focus/cross-frame issues)
        try {
            const storageRes = await chrome.storage.local.get(['smarttranslate_active_selection']);
            if (storageRes && storageRes.smarttranslate_active_selection) {
                const data = storageRes.smarttranslate_active_selection;
                const currentHostname = new URL(tab.url).hostname;
                // Only use if domain matches and it was captured recently (within last 30 seconds)
                if (data.host === currentHostname && (Date.now() - data.timestamp < 30000)) {
                    foundSelection = data.text;
                }
            }
        } catch (e) { }

        // 1. If storage empty, scan ALL frames for selection using executeScript
        if (!foundSelection) {
            try {
                const results = await chrome.scripting.executeScript({
                    target: { tabId: tab.id, allFrames: true },
                    func: () => {
                        try {
                            // 1. Try ServiceNowHelper if available in this frame
                            if (typeof ServiceNowHelper !== 'undefined' && typeof ServiceNowHelper.getSelection === 'function') {
                                const sn = ServiceNowHelper.getSelection();
                                if (sn && sn.selection && sn.selection.trim()) return sn.selection.trim();
                            }

                            // 2. Deep Shadow DOM traversal 
                            const getShadowText = (root = document) => {
                                const sel = root.getSelection ? root.getSelection() : null;
                                if (sel && sel.toString().trim()) return sel.toString().trim();
                                const active = root.activeElement;
                                if (active && active.shadowRoot) return getShadowText(active.shadowRoot);
                                if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT')) {
                                    try { return active.value.substring(active.selectionStart, active.selectionEnd).trim(); } catch (e) { }
                                }
                                return '';
                            };

                            let text = getShadowText();
                            if (text) return text;

                            // 3. TinyMCE support
                            if (document.body && (document.body.classList.contains('mce-content-body') || document.body.classList.contains('tox-edit-area__iframe'))) {
                                return document.body.innerText.trim();
                            }
                        } catch (e) { return ''; }
                        return '';
                    }
                });
                if (Array.isArray(results)) {
                    for (const r of results) {
                        if (r && r.result && String(r.result).trim()) {
                            foundSelection = String(r.result).trim();
                            break;
                        }
                    }
                }
            } catch (e) { }
        }

        // 2. Fallback to broadcast message
        if (!foundSelection) {
            try {
                const resp = await requestQuickTranslation(tab);
                if (resp && resp.ok && resp.text) {
                    displayResult(resp.text, resp.tokens);
                    return;
                }
            } catch (e) { }
        }

        // 3. Translate the found text
        if (foundSelection) {
            const btCheck = document.getElementById('gemini-back-translation-checkbox');
            const isProofread = !!btCheck?.checked;

            const userLangSelect = document.getElementById('userLanguageSelect');
            const targetLang = userLangSelect ? userLangSelect.value : 'en';

            try {
                const translatePromise = chrome.tabs.sendMessage(tab.id, {
                    type: 'smarttranslate:translate-selection',
                    selection: foundSelection,
                    targetLang: targetLang,
                    isProofread: isProofread
                }, { frameId: 0 });

                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Translation timed out')), 15000));

                const retryResp = await Promise.race([translatePromise, timeoutPromise]);
                if (retryResp && retryResp.ok && retryResp.text) {
                    displayResult(retryResp.text, retryResp.tokens);
                } else {
                    throw new Error('Top frame translation failed');
                }
            } catch (retryErr) {
                // Final fallback: Broadcast translation
                const broadcastResp = await chrome.tabs.sendMessage(tab.id, {
                    type: 'smarttranslate:translate-selection',
                    selection: foundSelection,
                    targetLang: targetLang,
                    isProofread: isProofread
                });
                if (broadcastResp && broadcastResp.ok && broadcastResp.text) {
                    displayResult(broadcastResp.text, broadcastResp.tokens);
                } else {
                    throw retryErr;
                }
            }
        } else {
            noSelectionMsg.style.display = 'block';
            noSelectionMsg.textContent = 'Select text on the page first, then click the icon.';
        }
    } catch (err) {
        noSelectionMsg.style.display = 'block';
        noSelectionMsg.textContent = `Error: ${err.message}`;
    } finally {
        translatorSpinner.style.display = 'none';
    }
}

// Handle Summarization functionality
async function initializeSummarization() {
    const summarizeSelectionBtn = document.getElementById('summarizeSelectionBtn');
    const summarizePageBtn = document.getElementById('summarizePageBtn');
    const summaryOutput = document.getElementById('summaryOutput');
    const summaryResultContainer = document.getElementById('summaryResultContainer');
    const summarySpinner = document.getElementById('summarySpinner');
    const summaryStatusMsg = document.getElementById('summaryStatusMsg');
    const copySummaryBtn = document.getElementById('copySummaryBtn');

    if (!summarizeSelectionBtn || !summarizePageBtn) return;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    const startSummarization = () => {
        summarySpinner.style.display = 'block';
        summaryStatusMsg.style.display = 'none';
        summaryResultContainer.style.display = 'none';
    };

    const showResult = (text, tokens) => {
        summarySpinner.style.display = 'none';
        summaryResultContainer.style.display = 'block';
        if (typeof Security !== 'undefined') {
            Security.setSafeHtml(summaryOutput, text, true);
        } else {
            summaryOutput.textContent = text;
        }
        if (tokens) updateTokenDisplay(tokens);
    };

    const showError = (err) => {
        summarySpinner.style.display = 'none';
        summaryStatusMsg.style.display = 'block';
        summaryStatusMsg.textContent = `Error: ${err}`;
        summaryStatusMsg.style.color = '#dc2626';
    };

    // Summarize Selection
    summarizeSelectionBtn.addEventListener('click', async () => {
        startSummarization();
        try {
            // Try to find selection
            let foundSelection = '';

            // 1. From storage
            const storageRes = await chrome.storage.local.get(['smarttranslate_active_selection']);
            if (storageRes.smarttranslate_active_selection && (Date.now() - storageRes.smarttranslate_active_selection.timestamp < 60000)) {
                foundSelection = storageRes.smarttranslate_active_selection.text;
            }

            const userLangSelect = document.getElementById('userLanguageSelect');
            const targetLang = userLangSelect ? userLangSelect.value : 'en';

            const response = await chrome.tabs.sendMessage(tab.id, {
                type: 'smarttranslate:summarize-selection',
                selection: foundSelection || undefined,
                targetLang: targetLang
            });

            if (response && response.ok) {
                showResult(response.text, response.tokens);
            } else {
                showError(response?.error || 'Could not summarize selection. Make sure text is selected.');
            }
        } catch (err) {
            showError(err.message);
        }
    });

    // Summarize Page
    summarizePageBtn.addEventListener('click', async () => {
        startSummarization();
        try {
            const userLangSelect = document.getElementById('userLanguageSelect');
            const targetLang = userLangSelect ? userLangSelect.value : 'en';

            const response = await chrome.tabs.sendMessage(tab.id, {
                type: 'smarttranslate:summarize-page',
                targetLang: targetLang
            });

            if (response && response.ok) {
                showResult(response.text, response.tokens);
            } else {
                showError(response?.error || 'Could not summarize page.');
            }
        } catch (err) {
            showError(err.message);
        }
    });

    // Copy Summary
    if (copySummaryBtn) {
        copySummaryBtn.addEventListener('click', () => {
            const text = summaryOutput.textContent;
            navigator.clipboard.writeText(text).then(() => {
                const originalText = copySummaryBtn.textContent;
                copySummaryBtn.textContent = '✓ Copied!';
                setTimeout(() => { copySummaryBtn.textContent = originalText; }, 2000);
            });
        });
    }
}

// Populate language dropdowns from CONFIG.LANGUAGES
function initializeLanguageSelections() {
    const userLangSelect = document.getElementById('userLanguageSelect');
    if (!userLangSelect) return;

    if (typeof CONFIG === 'undefined' || !CONFIG.LANGUAGES) return;

    // Clear existing options
    userLangSelect.innerHTML = '';

    // Population helper
    const addOption = (select, code, name) => {
        const opt = document.createElement('option');
        opt.value = code;

        // Add flags for major languages
        let flag = '';
        const lowerCode = code.toLowerCase();
        if (lowerCode === 'en') flag = '🇺🇸 ';
        else if (lowerCode === 'el') flag = '🇬🇷 ';
        else if (lowerCode === 'fr') flag = '🇫🇷 ';
        else if (lowerCode === 'de') flag = '🇩🇪 ';
        else if (lowerCode === 'es') flag = '🇪🇸 ';
        else if (lowerCode === 'it') flag = '🇮🇹 ';
        else if (lowerCode === 'nl') flag = '🇳🇱 ';
        else if (lowerCode === 'ja') flag = '🇯🇵 ';
        else if (lowerCode === 'ko') flag = '🇰🇷 ';
        else if (lowerCode === 'zh') flag = '🇨🇳 ';

        opt.textContent = `${flag}${name}`;
        select.appendChild(opt);
    };

    Object.entries(CONFIG.LANGUAGES).forEach(([code, name]) => {
        if (code === 'auto') return;
        addOption(userLangSelect, code, name);
    });
}

// Update token usage display
function updateTokenDisplay(tokens) {
    if (!tokens) {
        return;
    }

    const display = document.getElementById('tokenUsageDisplay');
    if (!display) {
        if (typeof Logger !== 'undefined') Logger.warn('Token display element not found');
        return;
    }

    display.style.display = 'block';
    if (typeof Logger !== 'undefined') Logger.info('Displaying tokens:', tokens);

    // Get token limit from storage
    chrome.storage.local.get(['geminiTokenLimit', 'geminiTokenUsage'], (data) => {
        const limit = data.geminiTokenLimit || 1000000;
        const currentUsage = (data.geminiTokenUsage || 0);

        const usedTokens = (tokens.input || 0) + (tokens.output || 0);
        const totalUsed = currentUsage;
        const percentage = Math.round((totalUsed / limit) * 100);

        if (typeof Logger !== 'undefined') Logger.debug('Token stats:', { limit, currentUsage, usedTokens, totalUsed, percentage });

        // Update progress bar
        const fillEl = document.getElementById('tokenUsageFill');
        if (fillEl) fillEl.style.width = percentage + '%';

        // Format numbers with commas
        const formatNumber = (n) => n.toLocaleString();

        // Update stats
        const textEl = document.getElementById('tokenUsageText');
        if (textEl) textEl.textContent =
            `${formatNumber(totalUsed)} / ${formatNumber(limit)}`;

        const percentEl = document.getElementById('tokenUsagePercent');
        if (percentEl) percentEl.textContent = percentage + '%';

        // Update remaining info
        const remaining = limit - totalUsed;
        const remainingEl = document.getElementById('tokenUsageRemaining');
        if (remainingEl) remainingEl.textContent =
            `This translation: ${formatNumber(usedTokens)} tokens | Remaining: ${formatNumber(remaining)}`;
    });
}

// Handle User Global Language Selection
async function initializeUserLanguage() {
    const langSelect = document.getElementById('userLanguageSelect');
    if (!langSelect) return;

    // Load saved language
    const savedLang = await chrome.storage.local.get(['smarttranslate_user_language']);
    const currentLang = savedLang.smarttranslate_user_language || 'en';
    langSelect.value = currentLang;

    // Handle change
    langSelect.addEventListener('change', async () => {
        const newLang = langSelect.value;
        await chrome.storage.local.set({ 'smarttranslate_user_language': newLang });

        // Notify all tabs to update their in-page widgets
        const tabs = await chrome.tabs.query({});
        tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
                type: 'smarttranslate:user-lang-updated',
                lang: newLang
            }).catch(() => { });
        });

        // Instantly trigger re-translation if text exists
        const quickTranslation = document.getElementById('quickTranslation');
        if (quickTranslation && quickTranslation.textContent && quickTranslation.textContent !== 'Awaiting translation...') {
            handleQuickTranslation();
        }
    });

    // Also listen for changes from other components (like the in-page widget)
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.smarttranslate_user_language) {
            langSelect.value = changes.smarttranslate_user_language.newValue;
        }
    });
}

// Initialize when popup opens
document.addEventListener('DOMContentLoaded', async () => {
    initTabs();

    // Run initialization tasks independently so one failing task doesn't prevent running the others
    initializeLanguageSelections();

    await Promise.allSettled([
        initializePopup(),
        initializeApiKey(),
        initializeModelSelection(),
        initializeSummarization(),
        initializeOpenAssistant(),
        initializeBackTranslation(),
        handleQuickTranslation(),
        initializeUserLanguage()
    ]);

    // Privacy Toggle
    const privacyBtn = document.getElementById('togglePrivacyBtn');
    const privacyContent = document.getElementById('privacyContent');
    const privacyArrow = document.getElementById('privacyArrow');
    if (privacyBtn && privacyContent) {
        privacyBtn.addEventListener('click', () => {
            const isVisible = privacyContent.style.display === 'block';
            privacyContent.style.display = isVisible ? 'none' : 'block';
            if (privacyArrow) privacyArrow.textContent = isVisible ? '▼' : '▲';
        });
    }

    // Clear Translation
    const clearBtn = document.getElementById('clearTranslationBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            const container = document.getElementById('translationContainer');
            const noSelectionMsg = document.getElementById('noSelectionMsg');
            if (container) container.style.display = 'none';
            if (noSelectionMsg) {
                noSelectionMsg.style.display = 'block';
                noSelectionMsg.textContent = 'Translation cleared. Select new text to continue.';
            }
        });
    }

    // Clear Summary
    const clearSummaryBtn = document.getElementById('clearSummaryBtn');
    if (clearSummaryBtn) {
        clearSummaryBtn.addEventListener('click', () => {
            const container = document.getElementById('summaryResultContainer');
            const msg = document.getElementById('summaryStatusMsg');
            if (container) container.style.display = 'none';
            if (msg) {
                msg.style.display = 'block';
                msg.textContent = 'Summary cleared. Select an option above to restart analysis.';
            }
        });
    }

    // Ensure token usage (stored) is visible on popup open and live-update
    function displayStoredTokenUsage() {
        try {
            chrome.storage.local.get(['geminiTokenUsage', 'geminiTokenLimit'], (data) => {
                const totalUsed = data.geminiTokenUsage || 0;
                const limit = data.geminiTokenLimit || 1000000;
                const percentage = Math.round((totalUsed / limit) * 100);

                const fillEl = document.getElementById('tokenUsageFill');
                if (fillEl) fillEl.style.width = percentage + '%';

                const textEl = document.getElementById('tokenUsageText');
                if (textEl) textEl.textContent = `${totalUsed.toLocaleString()} / ${limit.toLocaleString()}`;

                const percentEl = document.getElementById('tokenUsagePercent');
                if (percentEl) percentEl.textContent = percentage + '%';

                const remainingEl = document.getElementById('tokenUsageRemaining');
                if (remainingEl) remainingEl.textContent = `Used this session`;

                const display = document.getElementById('tokenUsageDisplay');
                if (display) display.style.display = 'block';
            });
        } catch (e) {
            // ignore
        }
    }

    // Initial load
    displayStoredTokenUsage();

    // Live update when storage changes
    try {
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'local' && (changes.geminiTokenUsage || changes.geminiTokenLimit)) {
                displayStoredTokenUsage();
            }
        });
    } catch (e) {
        // ignore
    }
});