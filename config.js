// Configuration constants for SmartTranslate extension

const CONFIG = {
    // API Configuration
    API_URL: "https://generativelanguage.googleapis.com/v1beta/models/",
    MODEL: "gemini-1.5-flash",
    AVAILABLE_MODELS: [
        { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (17K RPM / 250K RPD)' },
        { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro (High Quality)' },
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (6 RPM / 250K RPD)' },
        { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite (10 RPM / 250K RPD)' },
        { id: 'gemini-2.5-flash-tts', name: 'Gemini 2.5 Flash TTS (Multi-modal)' },
        { id: 'gemini-robotics-er-1.5-preview', name: 'Gemini Robotics ER 1.5 (10 RPM)' },
        { id: 'gemma-3-27b-it', name: 'Gemma 3 27B (30 RPM / 15K RPD)' },
        { id: 'gemma-3-12b-it', name: 'Gemma 3 12B (30 RPM / 15K RPD)' },
        { id: 'gemma-3-4b-it', name: 'Gemma 3 4B (30 RPM / 15K RPD)' },
        { id: 'gemma-3-2b-it', name: 'Gemma 3 2B (30 RPM / 15K RPD)' },
        { id: 'gemma-3-1b-it', name: 'Gemma 3 1B (30 RPM / 15K RPD)' },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Stable Legacy)' },
        { id: 'google-fast-free', name: 'Google Fast (No API Key Required)' },
        { id: 'chrome-built-in', name: 'Experimental Local AI (BETA)' }
    ],
    MAX_RETRIES: 5,
    RETRY_BASE_DELAY: 1000, // Base delay in ms for exponential backoff

    // UI Configuration
    Z_INDEX: 2147483647,
    POPUP_MAX_WIDTH: 480,
    POPUP_MAX_HEIGHT: '90vh',
    FLOATING_BUTTON_SIZE: 56,
    FLOATING_BUTTON_MIN_SIZE: 40,
    AUTO_HIDE_DELAY: 3000,
    DRAG_THRESHOLD: 5, // pixels to distinguish drag from click

    // Text Limits
    MAX_SELECTION_LENGTH: 500,
    MAX_INPUT_LENGTH: 30000, // Increased for page summarization
    MAX_SUMMARY_LENGTH: 2000,
    MAX_CHAT_HISTORY: 50, // messages

    // Storage Keys
    STORAGE_KEYS: {
        // New: supports multiple provider keys
        API_KEYS: 'geminiApiKeys',
        DEFAULT_PROVIDER: 'geminiDefaultProvider',
        // Legacy single-key support (kept for compatibility)
        API_KEY: 'geminiApiKey',
        FLOATING_POS: 'geminiFloatingPos',
        DIAGNOSTICS_ENABLED: 'geminiDiagnosticsEnabled',
        DIAGNOSTICS_REPORT: 'geminiDiagnosticsReport',
        CHAT_HISTORY: 'geminiChatHistory',
        TOKEN_USAGE: 'geminiTokenUsage',
        TOKEN_LIMIT: 'geminiTokenLimit',
        SELECTED_MODEL: 'geminiSelectedModel',
        BACK_TRANSLATION: 'smarttranslate_back_translation',
        DOCK_SIDE: 'smarttranslate_dock_side',
        USER_LANGUAGE: 'smarttranslate_user_language',
        HIDE_FLOATING_BUTTON: 'smarttranslate_hide_floating_button'
    },

    // Token Usage Settings
    TOKEN_LIMIT_DEFAULT: 1000000, // 1M tokens default limit for free tier
    TOKEN_RESET_DAYS: 30, // Reset token counter every 30 days

    // Supported Languages
    LANGUAGES: {
        'auto': 'Auto-detect',
        'en': 'English',
        'el': 'Greek',
        'es': 'Spanish',
        'fr': 'French',
        'de': 'German',
        'it': 'Italian',
        'nl': 'Dutch',
        'pt': 'Portuguese',
        'ru': 'Russian',
        'ja': 'Japanese',
        'ko': 'Korean',
        'zh': 'Chinese (Simplified)',
        'zh-TW': 'Chinese (Traditional)',
        'ar': 'Arabic',
        'hi': 'Hindi',
        'bn': 'Bengali',
        'pa': 'Punjabi',
        'tr': 'Turkish',
        'vi': 'Vietnamese',
        'pl': 'Polish',
        'ro': 'Romanian',
        'hu': 'Hungarian',
        'cs': 'Czech',
        'sv': 'Swedish',
        'da': 'Danish',
        'fi': 'Finnish',
        'no': 'Norwegian',
        'he': 'Hebrew',
        'id': 'Indonesian',
        'ms': 'Malay',
        'th': 'Thai',
        'uk': 'Ukrainian',
        'bg': 'Bulgarian',
        'sr': 'Serbian',
        'hr': 'Croatian',
        'sk': 'Slovak',
        'sl': 'Slovenian',
        'et': 'Estonian',
        'lv': 'Latvian',
        'lt': 'Lithuanian',
        'sq': 'Albanian',
        'ka': 'Georgian',
        'hy': 'Armenian',
        'az': 'Azerbaijani',
        'fa': 'Persian',
        'ur': 'Urdu',
        'sw': 'Swahili',
        'af': 'Afrikaans'
    },

    // Language Codes for TTS (if re-enabled)
    TTS_LANGUAGE_MAP: {
        'en': 'en-US',
        'el': 'el-GR',
        'es': 'es-ES',
        'fr': 'fr-FR',
        'de': 'de-DE',
        'it': 'it-IT',
        'nl': 'nl-NL',
        'pt': 'pt-PT',
        'ru': 'ru-RU',
        'ja': 'ja-JP',
        'ko': 'ko-KR',
        'zh': 'zh-CN',
        'zh-TW': 'zh-TW',
        'ar': 'ar-SA',
        'tr': 'tr-TR',
        'pl': 'pl-PL'
    },

    // Element IDs
    ELEMENT_IDS: {
        POPUP: 'gemini-extension-popup',
        TRANSLATION_OUTPUT: 'gemini-translation-output',
        CHAT_OUTPUT: 'gemini-chat-output',
        CHAT_INPUT: 'gemini-chat-input',
        LANGUAGE_SELECT: 'gemini-lang-select',
        FLOATING_BUTTON: 'gemini-floating-btn',
        CLOSE_BUTTON: 'gemini-close-btn',
        DRAG_HANDLE: 'gemini-drag-handle',
        OPEN_WINDOW_BTN: 'gemini-open-window-btn',
        BACK_TRANSLATION_CHECKBOX: 'gemini-back-translation-checkbox',
        DOCK_LEFT_BTN: 'gemini-dock-left-btn',
        DOCK_RIGHT_BTN: 'gemini-dock-right-btn',
        UNDOCK_BTN: 'gemini-undock-btn'
    },

    // Toast Configuration
    TOAST_DURATION: 2500,
    TOAST_ANIMATION_DURATION: 300,

    // Animation Durations
    FADE_DURATION: 200,
    SLIDE_DURATION: 300,

    // Error Messages
    ERROR_MESSAGES: {
        NO_API_KEY: 'Please set your API key in the extension settings first.',
        API_ERROR: 'API request failed',
        NETWORK_ERROR: 'Network error. Check your API key.',
        NO_RESPONSE: 'No response from API',
        NO_SELECTION: 'No text selected',
        TRANSLATION_FAILED: 'Translation failed',
        SUMMARY_FAILED: 'Summarization failed',
        COPY_FAILED: 'Failed to copy to clipboard'
    },

    // Success Messages
    SUCCESS_MESSAGES: {
        TRANSLATION_COMPLETE: 'Translation complete',
        SUMMARY_COMPLETE: 'Summary complete',
        COPIED: 'Translation copied to clipboard',
        API_KEY_SAVED: 'API Key saved successfully!'
    }
};

// Export for use in modules
if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
