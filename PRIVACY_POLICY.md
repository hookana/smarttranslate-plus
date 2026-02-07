# Privacy Policy for SmartTranslate AI Assistant+

**Effective Date:** February 6, 2026

SmartTranslate ("the Extension") is committed to protecting your privacy. This Privacy Policy explains how we handle your data.

## 1. Information Collection and Use
SmartTranslate is designed to provide AI-assisted translation and summarization. To perform these functions:
- **Text Selection**: When you select text and use the translation or chat features, the selected text is sent to the AI API provider (such as Google Gemini) that you have configured in the settings.
- **Page Context**: If you use the "Summarize Page" feature, the text content of the active tab is extracted and sent to the configured AI API provider.

**We do NOT:**
- Store your selected text on any of our own servers.
- Collect or sell your browsing history.
- Use your data for advertising or tracking.

## 2. Third-Party Services
The Extension uses Google Gemini API (or other providers configured by the user). Data sent to these providers is subject to their respective privacy policies:
- **Google Privacy Policy**: [https://policies.google.com/privacy](https://policies.google.com/privacy)

## 3. Storage
The Extension stores the following data **locally on your device** using Chrome's local storage:
- Your API keys (encrypted/stored locally).
- Your language preferences.
- Your chosen AI model settings.
- Token usage statistics for the current session.

This data never leaves your device except for the API keys being sent to the respective AI provider to authenticate requests.

## 4. Permissions
The Extension requires the following permissions:
- `activeTab` & `scripting`: To extract selected text for translation.
- `storage`: To save your settings and preferences locally.
- `contextMenus`: To provide translation options in the right-click menu.
- `host_permissions`: To communicate with the Google Gemini API.

## 5. Security
We prioritize the security of your API keys. They are stored locally using browser storage APIs and are only used for direct communication with the AI provider.

## 6. Contact
If you have any questions about this Privacy Policy, please contact the developer via the official extension support channel.
