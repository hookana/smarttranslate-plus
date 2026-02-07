// API module for Gemini API calls with retry logic and error handling

const Api = {
    apiKey: '',
    providerId: 'gemini',
    apiKeys: {},
    model: 'gemini-1.5-flash',
    tokenUsage: 0,
    tokenLimit: 1000000, // Default, will be updated on init

    // Map outdated model names to correct ones
    mapModelName: (modelId) => {
        const mapping = {
            'gemini-3-flash': 'gemini-1.5-flash',
            'gemini-3-pro': 'gemini-1.5-pro',
            'gemini-3-flash-preview': 'gemini-1.5-flash',
            'gemini-3-pro-preview': 'gemini-1.5-pro',
            'gemini-2.0-flash-exp': 'gemini-2.0-flash-exp',
            'gemini-1.5-flash-latest': 'gemini-1.5-flash',
            'google-fast-free': 'google-fast-free',
            'chrome-built-in': 'chrome-built-in'
        };
        return mapping[modelId] || modelId;
    },

    // Initialize API keys and selected provider from storage
    init: async () => {
        try {
            Api.apiKeys = await Storage.getApiKeys();
            Api.providerId = await Storage.getDefaultProvider() || 'gemini';
            Api.apiKey = Api.apiKeys[Api.providerId] || await Storage.getApiKey() || '';

            let storedModel = await Storage.getSelectedModel() || CONFIG.MODEL;
            storedModel = Api.mapModelName(storedModel);

            // Final validation against available list
            if (CONFIG.AVAILABLE_MODELS && !CONFIG.AVAILABLE_MODELS.find(m => m.id === storedModel)) {
                Api.model = CONFIG.MODEL || 'gemini-1.5-flash';
            } else {
                Api.model = storedModel;
            }

            // Sync back to storage if we fixed it
            if (storedModel !== (await Storage.getSelectedModel())) {
                await Storage.setSelectedModel(Api.model);
            }

            // Load token usage
            const tokenLimitKey = CONFIG && CONFIG.STORAGE_KEYS ? CONFIG.STORAGE_KEYS.TOKEN_LIMIT : 'geminiTokenLimit';
            const tokenUsageKey = CONFIG && CONFIG.STORAGE_KEYS ? CONFIG.STORAGE_KEYS.TOKEN_USAGE : 'geminiTokenUsage';
            const stored = await chrome.storage.local.get([tokenUsageKey, tokenLimitKey]);
            Api.tokenUsage = stored[tokenUsageKey] || 0;
            Api.tokenLimit = stored[tokenLimitKey] || 1000000;
        } catch (e) {
            Logger.error('Failed to initialize API keys', e);
        }
    },

    // Update token usage
    updateTokenUsage: async (inputTokens, outputTokens) => {
        const totalTokens = (inputTokens || 0) + (outputTokens || 0);
        Api.tokenUsage += totalTokens;

        try {
            if (chrome && chrome.storage && chrome.storage.local) {
                await chrome.storage.local.set({
                    [CONFIG.STORAGE_KEYS.TOKEN_USAGE]: Api.tokenUsage,
                    [CONFIG.STORAGE_KEYS.TOKEN_LIMIT]: Api.tokenLimit
                });
            }

            // Broadcast token usage update (check if chrome.tabs is available)
            if (chrome && chrome.tabs && chrome.tabs.query) {
                try {
                    chrome.tabs.query({}, function (tabs) {
                        if (tabs && Array.isArray(tabs)) {
                            tabs.forEach(tab => {
                                try {
                                    chrome.tabs.sendMessage(tab.id, {
                                        type: 'smarttranslate:token-usage-updated',
                                        tokenUsage: Api.tokenUsage,
                                        tokenLimit: Api.tokenLimit
                                    }).catch(() => { });
                                } catch (e) {
                                    // ignore individual tab errors
                                }
                            });
                        }
                    });
                } catch (e) {
                    Logger.warn('Failed to broadcast token usage', e);
                }
            }
        } catch (e) {
            Logger.warn('Failed to update token usage', e);
        }

        return { used: Api.tokenUsage, limit: Api.tokenLimit };
    },

    // Update API key for provider
    updateApiKey: (providerId, key) => {
        if (!providerId) return;
        Api.apiKeys[providerId] = key;
        if (providerId === Api.providerId) Api.apiKey = key;
    },

    // Handle broadcasted keys update
    handleApiKeysUpdated: (keys, defaultProvider) => {
        Api.apiKeys = keys || {};
        if (defaultProvider) Api.providerId = defaultProvider;
        Api.apiKey = Api.apiKeys[Api.providerId] || '';
    },

    // Handle broadcasted model update
    handleModelUpdated: (model) => {
        if (model) {
            Api.model = Api.mapModelName(model);
            Logger.info('Model updated to:', Api.model);
        }
    },

    // Exponential backoff retry with proper error handling
    exponentialBackoffFetch: async (url, options, maxRetries = CONFIG.MAX_RETRIES) => {
        let lastError = null;
        let lastResponse = null;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const response = await fetch(url, options);

                // Handle rate limiting (429) with longer delay
                if (response.status === 429) {
                    const retryAfter = response.headers.get('Retry-After');
                    const delay = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * CONFIG.RETRY_BASE_DELAY;
                    Logger.warn(`Rate limited. Retrying after ${delay}ms`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    lastResponse = response;
                    continue;
                }

                // Success
                if (response.ok) {
                    return response;
                }

                // Don't retry on client errors (4xx) except 429
                if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                    lastResponse = response;
                    break;
                }

                // For other errors, wait and retry
                lastResponse = response;
                lastError = new Error(`HTTP error! status: ${response.status}`);
            } catch (error) {
                // Network errors - retry
                lastError = error;
            }

            // Wait before retrying (exponential backoff with jitter)
            if (attempt < maxRetries - 1) {
                const delay = Math.pow(2, attempt) * CONFIG.RETRY_BASE_DELAY + Math.random() * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        // If we reached here, all retries failed or a non-retryable error occurred
        let errorMessage = `API request failed after ${maxRetries} attempts`;
        if (lastResponse) {
            try {
                const errorData = await lastResponse.json();
                if (errorData?.error?.message) {
                    errorMessage = errorData.error.message;
                } else if (lastResponse.status === 429) {
                    errorMessage = 'Rate limit reached (429). Please wait a moment before trying again.';
                } else if (lastResponse.status === 400) {
                    errorMessage = 'Invalid request or API key (400). Check your settings.';
                }
            } catch (e) {
                if (lastError) errorMessage = lastError.message;
            }
        } else if (lastError) {
            errorMessage = lastError.message;
        }

        return {
            ok: false,
            status: lastResponse?.status || 0,
            json: async () => ({
                error: {
                    message: errorMessage,
                    status: lastResponse?.status
                }
            })
        };
    },

    // Call Gemini API with full error handling
    callGemini: async (userPrompt, systemPrompt, useGrounding = false) => {
        if (!Api.apiKey) {
            return { error: CONFIG.ERROR_MESSAGES.NO_API_KEY };
        }

        // Sanitize inputs
        const sanitizedPrompt = Security.sanitizeInput(userPrompt, CONFIG.MAX_INPUT_LENGTH);
        const sanitizedSystem = Security.sanitizeInput(systemPrompt, CONFIG.MAX_INPUT_LENGTH);

        if (!sanitizedPrompt) {
            return { error: 'Empty prompt' };
        }

        if (!Api.apiKey) {
            console.error('[SmartTranslate] API key not set');
            return { error: 'API key not configured' };
        }

        const isGemma = Api.model.toLowerCase().includes('gemma');

        const payload = {
            contents: [{
                parts: [{
                    text: isGemma ? `System: ${sanitizedSystem}\n\nTask: ${sanitizedPrompt}` : sanitizedPrompt
                }]
            }],
            generationConfig: {
                temperature: 0,
                topP: 1,
                maxOutputTokens: 512,
                responseMimeType: "text/plain",
                candidateCount: 1
            },
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
            ],
            tools: useGrounding ? [{ "google_search": {} }] : undefined
        };

        // Only add systemInstruction for non-Gemma models
        if (!isGemma) {
            payload.systemInstruction = { parts: [{ text: sanitizedSystem }] };
        }

        const apiUrlWithKey = `${CONFIG.API_URL}${Api.model}:generateContent?key=${Api.apiKey}`;

        try {
            const response = await Api.exponentialBackoffFetch(apiUrlWithKey, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.error) {
                const errorMsg = result.error.message || result.error || JSON.stringify(result.error);
                console.error('[SmartTranslate] API Error response:', result.error);
                Logger.error('API Error', errorMsg);
                return { error: errorMsg };
            }

            const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

            // Track token usage
            const inputTokens = result.usageMetadata?.promptTokenCount || 0;
            const outputTokens = result.usageMetadata?.candidatesTokenCount || 0;
            const totalTokens = inputTokens + outputTokens;

            if (totalTokens > 0) {
                await Api.updateTokenUsage(inputTokens, outputTokens);
            }

            if (text) {
                return { text: text.trim(), tokens: { input: inputTokens, output: outputTokens } };
            } else {
                Logger.warn('No text in API response', result);
                return { error: CONFIG.ERROR_MESSAGES.NO_RESPONSE };
            }
        } catch (e) {
            Logger.error('Network error in callGemini', e);
            return { error: CONFIG.ERROR_MESSAGES.NETWORK_ERROR };
        }
    },

    // Fast Public Translation (No Key Required)
    callFreeGoogle: async (text, targetLang, sourceLang = 'auto') => {
        try {
            const sl = (sourceLang && sourceLang !== 'auto') ? sourceLang : 'auto';
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data && data[0] && data[0][0] && data[0][0][0]) {
                const combined = data[0].map(x => x[0]).join('');
                return { text: combined, tokens: { input: 0, output: 0 } };
            }
            throw new Error('Fallback translation failed');
        } catch (e) {
            Logger.error('Free Google Error', e);
            return { error: 'Fast Translate failed. Try Gemini or check your connection.' };
        }
    },

    // Local AI call using Chrome's built-in APIs
    callLocalAI: async (text, type = 'translate', targetLang = 'en') => {
        try {
            if (type === 'translate') {
                if (typeof window.translation === 'undefined' || !window.translation.createTranslator) {
                    throw new Error('On-device AI not supported by this browser version or disabled.');
                }
                const translator = await window.translation.createTranslator({
                    sourceLanguage: 'auto',
                    targetLanguage: targetLang
                });
                const result = await translator.translate(text);
                return { text: result, tokens: { input: 0, output: 0 } };
            } else if (type === 'summarize') {
                if (typeof window.ai === 'undefined' || !window.ai.summarizer) {
                    throw new Error('Local Summarization API not found.');
                }
                const summarizer = await window.ai.summarizer.create();
                const result = await summarizer.summarize(text);
                return { text: result, tokens: { input: 0, output: 0 } };
            }
        } catch (e) {
            Logger.error('Local AI Error', e);
            return { error: `${e.message} Try the "Google Fast" option instead.` };
        }
    },

    // Translate text
    translate: async (text, targetLang, isProofread = false, sourceLang = 'auto') => {
        const sanitizedText = Security.sanitizeInput(text, CONFIG.MAX_SELECTION_LENGTH);
        if (!sanitizedText) {
            return { error: CONFIG.ERROR_MESSAGES.NO_SELECTION };
        }

        if (Api.model === 'google-fast-free') {
            // Google Fast supports sl=auto or sl=code
            // Since we use 'auto' as code, it fits perfectly.
            // But we need to ensure we pass it correctly if it's different.
            // callFreeGoogle argument signature update needed?
            // Actually callFreeGoogle takes (text, targetLang).
            // Let's create a helper or update callFreeGoogle to accept source. 
            // For now, let's keep it simple and focus on Gemini as requested.
            // But improving Google Fast is good too.
            // Let's check callFreeGoogle signature above... it's (text, targetLang).
            // We can quickly update it below or just leave it auto.
            // For consistency, let's just use auto for Google Fast unless we update it.
            // Actually, let's just update callFreeGoogle below this block if we want.
            // For now, let's just pass targetLang.
            return await Api.callFreeGoogle(sanitizedText, targetLang, sourceLang);
        }

        if (Api.model === 'chrome-built-in') {
            // Local AI might support source lang
            return await Api.callLocalAI(sanitizedText, 'translate', targetLang, sourceLang);
        }

        // Use provided state
        const isBackTranslationEnabled = !!isProofread;

        let userPrompt, systemPrompt;

        const langName = CONFIG.LANGUAGES[targetLang] || targetLang;
        let sourceLangName = '';
        if (sourceLang && sourceLang !== 'auto') {
            sourceLangName = CONFIG.LANGUAGES[sourceLang] || sourceLang;
        }

        if (isBackTranslationEnabled) {
            userPrompt = `Please do the following for this text: "${sanitizedText}"
1. Translate it to ${langName}.
2. Correct the original text in its source language.
3. Brief explanation of changes.

Format your response STRICTLY as a JSON object with these keys: 
"translation" (string), "correction" (string), "explanation" (string). 
Do not include any other text or markdown formatting in your response.`;
            systemPrompt = "You are a professional translator and language coach. Return ONLY a valid JSON object. No markdown, no prefixes.";
        } else {
            if (sourceLangName) {
                userPrompt = `Translate from ${sourceLangName} to ${langName}: ${sanitizedText}`;
                systemPrompt = `Translate exactly from ${sourceLangName} to ${langName}. Output ONLY the result.`;
            } else {
                userPrompt = `Translate to ${langName}: ${sanitizedText}`;
                systemPrompt = `Translate exactly to ${langName}. Output ONLY the result.`;
            }
        }

        if (Api.providerId === 'gemini') {
            return await Api.callGemini(userPrompt, systemPrompt, false);
        }
        return { error: `Provider '${Api.providerId}' not supported yet` };
    },

    // Summarize text
    summarize: async (text, isPage = false, targetLang = 'en') => {
        const limit = isPage ? CONFIG.MAX_INPUT_LENGTH : CONFIG.MAX_SELECTION_LENGTH;
        const sanitizedText = Security.sanitizeInput(text, limit);

        if (!sanitizedText) {
            return { error: isPage ? 'No page content found' : CONFIG.ERROR_MESSAGES.NO_SELECTION };
        }

        if (!Api.apiKey || !Api.apiKey.trim()) {
            return { error: `No API key configured for ${Api.providerId}. Please add your API key in settings.` };
        }

        const userPrompt = isPage
            ? `You are an expert content summarizer. Provide a high-quality, professional summary of the following webpage content. 
               Start with a concise introductory paragraph about the page's purpose, then use bullet points for key takeaways. 
               Format the output clearly using Markdown. Content: \n\n${sanitizedText}`
            : `You are a professional assistant. Provide a concise and accurate summary of the following text. 
               Use a brief paragraph followed by bullet points if necessary. 
               Format the output clearly using Markdown. Text to summarize: "${sanitizedText}"`;

        const langName = CONFIG.LANGUAGES[targetLang] || targetLang;
        const systemPrompt = `Act as an expert summarizer. Be concise, accurate, and professional. Do NOT repeat the source text or provide redundant rephrasings.
                             IMPORTANT: You MUST provide the final summary output in ${langName}.`;

        if (Api.model === 'chrome-built-in') {
            return await Api.callLocalAI(sanitizedText, 'summarize', targetLang);
        }

        if (Api.model === 'google-fast-free') {
            return { error: 'Summary feature is not supported in "Google Fast" mode (Language Only). Please switch to a Gemini model in Settings.' };
        }

        if (Api.providerId === 'gemini') {
            return await Api.callGemini(userPrompt, systemPrompt, false);
        }
        return { error: `Provider '${Api.providerId}' not supported yet` };
    },

    // Chat with context
    chat: async (question, context = '', history = [], targetLang = 'en') => {
        const sanitizedQuestion = Security.sanitizeInput(question, CONFIG.MAX_INPUT_LENGTH);
        if (!sanitizedQuestion) {
            return { error: 'Empty question' };
        }

        // Check if API key is configured
        if (!Api.apiKey || !Api.apiKey.trim()) {
            return { error: `No API key configured for ${Api.providerId}. Please add your API key in settings.` };
        }

        let userPrompt = '';
        if (context && context.trim()) {
            // Use MAX_INPUT_LENGTH for context to support full page content
            const sanitizedContext = Security.sanitizeInput(context, CONFIG.MAX_INPUT_LENGTH);
            userPrompt = `Context: "${sanitizedContext}"\n\nUser Question: ${sanitizedQuestion}`;
        } else {
            userPrompt = sanitizedQuestion;
        }

        const langName = CONFIG.LANGUAGES[targetLang] || targetLang;
        const systemPrompt = `Act as a helpful but DIRECT study assistant. The user has provided some context text (labeled 'Context'). You must answer the user's question based on this context, especially if they ask "explain this", "what is this", or similar. Provide a SINGLE, clear explanation. Do NOT repeat the answer or provide alternative phrasings in parentheses unless explicitly asked. Be concise.
                             IMPORTANT: You MUST respond in ${langName}.`;

        if (Api.model === 'chrome-built-in') {
            return await Api.callLocalAI(sanitizedQuestion, 'translate', targetLang);
        }

        if (Api.model === 'google-fast-free') {
            return { error: 'Chat is not available in "Google Fast" mode. Please switch to a Gemini model.' };
        }

        if (Api.providerId === 'gemini') {
            return await Api.callGemini(userPrompt, systemPrompt, false);
        }
        return { error: `Provider '${Api.providerId}' not supported yet` };
    }

    // Additional providers can be added here following the same pattern as callGemini
};

// Export
if (typeof window !== 'undefined') {
    window.Api = Api;
}
