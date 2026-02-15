# SmartTranslate: AI Assistant Translate+
## AI-Powered Browser Assistant for Instant Translation & Summarization

SmartTranslate is a powerful Chrome extension that enables instant text translation and AI-powered explanations directly on any webpage using the Gemini API.

## Features

### Core Functionality
- **Instant Text Translation**: Select any text on a webpage and translate it to multiple languages (English, Greek, French, German, Spanish, Italian, Dutch)
- **AI-Powered Explanations**: Ask questions about selected text and get contextual answers using Large Language Models
- **Context Menu Integration**: Right-click on selected text to access translation options
- **Inline Popup Interface**: Draggable popup with tabs for Translation and Chat functionality

### User Interface
- **Floating Action Button**: Draggable button in the bottom-right corner that opens the translation popup
- **Auto-Hide Behavior**: Floating button minimizes to the edge after inactivity to save screen space
- **Manual Text Input**: Paste or type text directly if no selection is made
- **Copy to Clipboard**: One-click button to copy translated text
- **Toast Notifications**: Success/error feedback for user actions

### Advanced Features
- **Iframe Support**: Works with text selections inside same-origin iframes (useful for rich text editors like TinyMCE)
- **PDF Compatibility**: Handles text selection in embedded PDFs
- **Per-Domain Settings**: Enable/disable the extension on specific websites
- **Language Selection**: Dropdowns for source and target language selection
- **Exponential Backoff**: Robust retry mechanism for API reliability
- **Diagnostics Mode**: Developer feature for debugging page elements and selections

### Technical Features
- **Cloud AI Integration**: Uses advanced AI models (like Gemini 1.5 Flash) for high-quality translations
- **Secure API Key Storage**: Keys stored in chrome.storage.local, not hardcoded
- **Content Security Policy Compliance**: All resources properly configured for extension security
- **Cross-Origin Safe**: Safely handles text from same-origin frames

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the extension directory
5. The extension will be installed and ready to use

## Setup

### API Key Configuration
1. Obtain an API key from your preferred provider (e.g., [Google AI Studio](https://makersuite.google.com/app/apikey))
2. Click the SmartTranslate extension icon in the toolbar
3. Go to the Settings tab
4. Enter your API key in the provider field
5. Click "Save API Key"

The API key is securely stored locally and used for all translations.

## Usage

### Basic Translation
1. Select text on any webpage
2. Either:
    - Right-click and select "Translate / Explain selection with AI Assistant"
   - Click the floating action button (bottom-right corner)
   - Use the keyboard shortcut Ctrl+Shift+G to toggle the floating button

### Advanced Features
- **Chat Mode**: Switch to the Chat tab to ask questions about the selected text
- **Manual Input**: If no text is selected, paste text directly in the popup
- **Language Selection**: Choose source and target languages from the dropdowns
- **Per-Site Control**: Use the toggle in settings to enable/disable on specific sites

### Keyboard Shortcuts
- **Ctrl+Shift+G**: Toggle floating button visibility on the current site

## Architecture

### Files Structure
- `manifest.json`: Extension manifest with permissions and configuration
- `background.js`: Service worker handling context menus and cross-tab communication
- `content.js`: Main content script injected into web pages (handles UI and API calls)
- `popup.html` & `popup.js`: Extension popup interface for settings and quick translation
- `styles/tailwind.css`: UI styling using Tailwind CSS
- `libs/marked.min.js`: Markdown parser for rendering AI responses

### Key Components
- **Selection Handler**: Captures text selections from main document and iframes
- **API Client**: Handles communication with Gemini API with retry logic
- **UI Manager**: Creates and manages the draggable popup interface
- **State Manager**: Persists settings and API keys using Chrome storage APIs
- **Floating Button**: Auto-hiding button for quick access to translation features

## Permissions

The extension requires the following permissions:
- `activeTab`: Access current tab for text selection
- `scripting`: Inject content scripts
- `contextMenus`: Create right-click menu items
- `storage`: Store API keys and settings locally
- `webNavigation`: Monitor navigation events

Host permissions:
- `https://generativelanguage.googleapis.com/*`: Access Gemini API

## Security Considerations

- API keys are stored securely in `chrome.storage.local` and never transmitted except to Google's API
- No data is collected or sent to third parties
- All API calls use HTTPS and proper authentication
- Content scripts only run on user-initiated actions

## Browser Compatibility

- Chrome 88+ (Manifest V3 support required)
- Chromium-based browsers (Edge, Opera, etc.)

## Development

### Building
No build process required - the extension runs directly from source files.

### Testing
1. Load the extension in developer mode
2. Test on various websites with different content types
3. Verify iframe and PDF text selection
4. Test error handling with invalid API keys

### Debugging
- Use Chrome DevTools on extension pages
- Check console logs in content scripts
- Enable diagnostics mode by setting `geminiDiagnosticsEnabled` in storage

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source. Please check the license file for details.

## Support

For issues or questions:
- Check the troubleshooting section below
- Open an issue on GitHub
- Ensure your API key is valid and has sufficient quota

## Troubleshooting

### Common Issues
- **"API key not configured"**: Set your Gemini API key in the extension settings
- **No translation on some sites**: Check if the site blocks content scripts
- **Floating button not visible**: Toggle with Ctrl+Shift+G or check per-site settings
- **Iframe text not selectable**: Ensure iframes are same-origin

### Error Messages
- Network errors: Check internet connection and API key validity
- "No response from API": Verify API key has quota remaining
- Selection errors: Try refreshing the page or selecting text differently

## Future Enhancements

- Support for additional AI providers
- Text-to-speech pronunciation
- Translation history and favorites
- Bulk translation of multiple selections
- Custom language model selection
- Enhanced accessibility features

## Release History & Changelog

<details>
<summary><b>Click to expand Version History</b></summary>

### [1.0.5] - 2026-02-15
- **Bulletproof PDF Protection**: Aggressive blocking and purging of UI elements on PDF pages to prevent "ghost" icons.
- **Instant Per-Site Sync**: Toggling the extension state now notifies all open tabs of the same domain immediately.
- **Chat Spacing & Consistency**: Unified summarization logic and fixed vertical spacing/placeholder issues in the chat interface.
- **Re-engineered Cleanup**: New `purgeFloatingUI` logic ensures all floating elements are wiped from the DOM immediately when disabled.

### [1.0.4] - 2026-02-15
- **Google Fast Default**: Set "Google Fast (No API Key)" as the default model for immediate functionality.
- **Universal Language Detection**: Unified detection across all AI models with high-visibility Indigo UI badge.
- **UI Dark Mode Armor**: Forced white background/dark text on dropdowns and inputs to resist website themes.
- **AI Tutor Personality**: Chat now strictly follows host language settings and provides professional linguistic context.
- **UX Refinement**: Fixed encoding issues and manual input UI refresh flow.

### [1.0.3] - 2026-02-11
- **ServiceNow Deep Crawler**: Fixed empty summaries by implementing recursion through Shadow DOM/Iframes.
- **Privacy First**: Floating button is now hidden by default on all sites until user enables it.
- **GA4 Analytics**: Integrated Google Analytics 4 for usage tracking.

### [1.0.2] - 2026-02-10
- UI alignment and footer branding refinements.
- Version consistency across all modules.

### [1.0.1] - 2026-02-09
- Dashboard layout refinements and folder view for saved links.

### [1.0.0] - 2026-02-08
- Initial release with Gemini 1.5 Flash integration.
- Service worker stability fixes for Manifest V3.
</details>

---

*SmartTranslate AI Assistant+ - Making web content accessible in any language*
