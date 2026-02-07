// Storage module for Chrome storage API wrapper

const Storage = {
    _isInvalidated: false,

    // Check if the extension context is still valid
    isContextValid: () => {
        if (Storage._isInvalidated) return false;
        try {
            // Accessing chrome.runtime.id will throw if context is invalidated
            return !!(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id);
        } catch (e) {
            Storage._isInvalidated = true;
            return false;
        }
    },

    // Get value from storage
    get: (key) => {
        return new Promise((resolve) => {
            try {
                if (!Storage.isContextValid()) {
                    resolve(null);
                    return;
                }
                chrome.storage.local.get([key], (result) => {
                    try {
                        if (chrome.runtime.lastError) {
                            if (chrome.runtime.lastError.message.includes('context invalidated')) {
                                Storage._isInvalidated = true;
                            }
                            resolve(null);
                        } else {
                            resolve(result ? result[key] : null);
                        }
                    } catch (e) {
                        resolve(null);
                    }
                });
            } catch (e) {
                if (e.message.includes('context invalidated')) {
                    Storage._isInvalidated = true;
                } else {
                    Logger.error('Storage get error', e);
                }
                resolve(null);
            }
        });
    },

    // Set value in storage
    set: (key, value) => {
        return new Promise((resolve, reject) => {
            try {
                if (!Storage.isContextValid()) {
                    resolve();
                    return;
                }
                chrome.storage.local.set({ [key]: value }, () => {
                    try {
                        if (chrome.runtime.lastError) {
                            if (chrome.runtime.lastError.message.includes('context invalidated')) {
                                Storage._isInvalidated = true;
                            }
                            reject(chrome.runtime.lastError);
                        } else {
                            resolve();
                        }
                    } catch (e) {
                        resolve();
                    }
                });
            } catch (e) {
                if (e.message.includes('context invalidated')) {
                    Storage._isInvalidated = true;
                } else {
                    Logger.error('Storage set error', e);
                }
                resolve();
            }
        });
    },

    // Get multiple keys
    getMultiple: (keys) => {
        return new Promise((resolve) => {
            try {
                chrome.storage.local.get(keys, (result) => {
                    resolve(result);
                });
            } catch (e) {
                Logger.error('Storage getMultiple error', e);
                resolve({});
            }
        });
    },

    // Set multiple key-value pairs
    setMultiple: (data) => {
        return new Promise((resolve, reject) => {
            try {
                chrome.storage.local.set(data, () => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve();
                    }
                });
            } catch (e) {
                Logger.error('Storage setMultiple error', e);
                reject(e);
            }
        });
    },

    // Remove key from storage
    remove: (key) => {
        return new Promise((resolve) => {
            try {
                chrome.storage.local.remove([key], () => {
                    resolve();
                });
            } catch (e) {
                Logger.error('Storage remove error', e);
                resolve();
            }
        });
    },

    // Get domain-specific key
    getDomainKey: (domain, suffix = '') => {
        return `smartTranslate_${domain}${suffix ? '_' + suffix : ''}`;
    },

    // Get extension state for domain
    getDomainState: async (domain) => {
        try {
            const key = Storage.getDomainKey(domain);
            const state = await Storage.get(key);
            return state === undefined ? true : state; // Default to enabled
        } catch (e) {
            Logger.warn('getDomainState error', e);
            return true;
        }
    },

    // Set extension state for domain
    setDomainState: async (domain, enabled) => {
        try {
            const key = Storage.getDomainKey(domain);
            await Storage.set(key, enabled);
        } catch (e) {
            Logger.warn('setDomainState error', e);
        }
    },

    // Get API key
    getApiKey: async () => {
        return await Storage.get(CONFIG.STORAGE_KEYS.API_KEY) || '';
    },

    // Set API key
    setApiKey: async (key) => {
        await Storage.set(CONFIG.STORAGE_KEYS.API_KEY, key);
    },

    // Get all API keys (new multi-provider support)
    getApiKeys: async () => {
        try {
            return await Storage.get(CONFIG.STORAGE_KEYS.API_KEYS) || {};
        } catch (e) {
            Logger.warn('getApiKeys error', e);
            return {};
        }
    },

    // Set all API keys
    setApiKeys: async (keys) => {
        try {
            await Storage.set(CONFIG.STORAGE_KEYS.API_KEYS, keys);
        } catch (e) {
            Logger.warn('setApiKeys error', e);
        }
    },

    // Get default provider id
    getDefaultProvider: async () => {
        try {
            return await Storage.get(CONFIG.STORAGE_KEYS.DEFAULT_PROVIDER) || 'gemini';
        } catch (e) {
            Logger.warn('getDefaultProvider error', e);
            return 'gemini';
        }
    },

    // Set default provider id
    setDefaultProvider: async (providerId) => {
        try {
            await Storage.set(CONFIG.STORAGE_KEYS.DEFAULT_PROVIDER, providerId);
        } catch (e) {
            Logger.warn('setDefaultProvider error', e);
        }
    },

    // Get selected Gemini model
    getSelectedModel: async () => {
        try {
            return await Storage.get(CONFIG.STORAGE_KEYS.SELECTED_MODEL) || CONFIG.MODEL;
        } catch (e) {
            Logger.warn('getSelectedModel error', e);
            return CONFIG.MODEL;
        }
    },

    // Set selected Gemini model
    setSelectedModel: async (modelId) => {
        try {
            await Storage.set(CONFIG.STORAGE_KEYS.SELECTED_MODEL, modelId);
        } catch (e) {
            Logger.warn('setSelectedModel error', e);
        }
    },

    // Get chat history for domain
    getChatHistory: async (domain) => {
        const key = Storage.getDomainKey(domain, 'chat');
        const history = await Storage.get(key);
        return Array.isArray(history) ? history : [];
    },

    // Save chat history for domain
    saveChatHistory: async (domain, history) => {
        const key = Storage.getDomainKey(domain, 'chat');
        // Limit history size
        const limited = history.slice(-CONFIG.MAX_CHAT_HISTORY);
        await Storage.set(key, limited);
    },

    // Clear chat history for domain
    clearChatHistory: async (domain) => {
        const key = Storage.getDomainKey(domain, 'chat');
        await Storage.remove(key);
    },

    // Get user's primary language
    getUserLanguage: async () => {
        try {
            return await Storage.get(CONFIG.STORAGE_KEYS.USER_LANGUAGE) || 'en';
        } catch (e) {
            return 'en';
        }
    },

    // Set user's primary language
    setUserLanguage: async (lang) => {
        try {
            await Storage.set(CONFIG.STORAGE_KEYS.USER_LANGUAGE, lang);

            // Broadcast to other tabs
            if (chrome && chrome.tabs && chrome.tabs.query) {
                chrome.tabs.query({}, function (tabs) {
                    if (tabs && Array.isArray(tabs)) {
                        tabs.forEach(tab => {
                            try {
                                chrome.tabs.sendMessage(tab.id, {
                                    type: 'smarttranslate:user-lang-updated',
                                    lang: lang
                                }).catch(() => { });
                            } catch (e) { }
                        });
                    }
                });
            }
        } catch (e) { }
    },

    // Get floating button hidden state
    getHideFloatingButton: async () => {
        try {
            return await Storage.get(CONFIG.STORAGE_KEYS.HIDE_FLOATING_BUTTON) || false;
        } catch (e) {
            return false;
        }
    },

    // Set floating button hidden state
    setHideFloatingButton: async (hidden) => {
        try {
            await Storage.set(CONFIG.STORAGE_KEYS.HIDE_FLOATING_BUTTON, hidden);
        } catch (e) { }
    }
};

// Export
if (typeof window !== 'undefined') {
    window.Storage = Storage;
}
