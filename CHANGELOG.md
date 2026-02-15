# Changelog - SmartTranslate

All notable changes to this project will be documented in this file.

## [1.0.5] - 2026-02-15
### Added
- **Bulletproof PDF Protection**: Implemented aggressive blocking and purging of UI elements on PDF pages to prevent "ghost" icons and interference with the browser's PDF viewer.
- **Smart Per-Site Sync**: Toggling the extension or floating button state now synchronizes instantly across **all open tabs** of the same domain.
- **Enhanced Summarization Hub**: Unified the summarization logic between the popup and the AI Assistant window. Context buttons (Selection/Page) now trigger summaries automatically if the Summary tab is active.
- **Improved Chat UX**: Fixed persistent placeholder text in the chat and resolved excessive vertical spacing in AI messages caused by empty HTML tags.

### Fixed
- **Cleanup Logic**: Re-engineered the `purgeFloatingUI` function to ensure all floating elements are wiped from the DOM immediately when the extension is disabled.
- **Reliability**: Hardened content script messaging to ensure "Cleanup" commands are processed even on complex or restricted internal pages.

## [1.0.4] - 2026-02-15
### Added
- **Google Fast Default**: Set "Google Fast (No API Key)" as the default model for immediate functionality after install.
- **Universal Language Detection**: Implemented a unified detection engine that identifies the source language for ALL models (Gemini & Google Fast) and displays it in a high-visibility Indigo badge.
- **AI Tutor Improvement**: Refined the chat system to act as a professional linguistic assistant that strictly responds in the target language.
- **Manual Input UX**: Removed redundant prefixes and ensured the UI refreshes immediately to show translation controls.
- **Dark Mode Protection**: Forced white themes and dark text colors on all popup elements to prevent website CSS from breaking the UI.
- **Encoding Fix**: Resolved the `&quot;` double-escaping bug in the selected text preview.

### Fixed
- **Floating Button Logic**: Ensured the button is strictly OFF by default on all domains.
- **Icon Visibility**: Fixed a bug where the Clear (brush) and Listen (speaker) icons wouldn't appear correctly on the first translation attempt.
- **Cleanup**: Removed all "Final Release" labels to reflect the ongoing beta development.

## [1.0.3] - 2026-02-11
### Added
- **Deep Crawler for ServiceNow**: Implemented a recursion-based DOM crawler in `servicenow-helper.js` to extract text from Shadow DOM and Iframes. This fixes the issue where page summaries were empty on ServiceNow.
- **Floating Button Default State**: The floating button is now **OFF by default** for all new sites. Users can enable it per domain via the extension settings.
- **Logo Branding**: Updated the extension logo across the application.

### Changed
- **Version Tracking**: Updated version to 1.0.3 across `manifest.json`, `ui.js`, and build scripts.
- **Maintenance**: Cleaned up the `backups/` directory, keeping only the last 2 versions to save space.
- **Backup Update**: Refreshed `backup_stable_latest` with the latest production-ready code.

## [1.0.2] - 2026-02-10
### Fixed
- UI alignment and footer branding.
- Ensured version consistency across all modules.

## [1.0.1] - 2026-02-09
### Added
- Dashboard layout refinements.
- Folder view for saved links.

## [1.0.0] - 2026-02-08
### Added
- Initial GA4 analytics integration.
- Service worker stability fixes for Manifest V3.
- Production-ready store submission build.
