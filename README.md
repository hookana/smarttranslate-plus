<p align="center">
  <img src="icon128.png" alt="SmartTranslate logo" width="96" height="96">
</p>

# SmartTranslate: AI Assistant Translate+

**Select text on any website and translate it instantly: free Google engine, no key needed, or your own Gemini key.**
Keeps bullet lists and line breaks, handles long texts, and works on strict sites like ServiceNow.

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Install-4f46e5?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/oakoplfgejfhlbckjfanpmniiebofpbd)
![Version](https://img.shields.io/badge/version-1.9.0-6366f1)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-6366f1)

👉 **[Install from the Chrome Web Store](https://chromewebstore.google.com/detail/oakoplfgejfhlbckjfanpmniiebofpbd)** · ⭐ **[Leave a review](https://chromewebstore.google.com/detail/oakoplfgejfhlbckjfanpmniiebofpbd/reviews)**

---

## 🚀 Key Features

- **Free translation, no API key**: uses Google Translate by default. If Google's main endpoint is rate-limited or unreachable, SmartTranslate switches automatically to a second Google endpoint, and to Gemini if you've added a key. Requests time out after 8 s and are retried.
- **Optional Gemini / Gemma models**: add your own Google AI Studio key to use Gemini 3.8 Flash, 3.5 Flash-Lite, 3.6 Flash, 3.1 Pro (preview), Gemma 3 and others.
- **Chrome on-device translator (experimental)**: uses Chrome's built-in Translator API when it's available, and falls back to Google Fast when it isn't.
- **Bullet lists stay intact**: list markers (`•`, `▪`, `–`, `1.`, `a.`, `(1)`…) are never translated into words. Line breaks and list structure are kept.
- **Long texts up to 100,000 characters**: text is split on paragraph, sentence and word boundaries into parts. Each part is sent by POST, up to two at a time. The parts are put back together in the original order, with "part X of Y" progress. If a part fails, it stays in the original language and you see a notice with a Retry button.
- **The popup stays on screen**: it opens next to your selection and flips above, below or to the side when there's no room. It also stays fully inside the window on scrolled or zoomed pages, in small windows and in iframes. You can drag it, resize it, or dock it to the left or right.
- **Isolated from the page**: the popup, translate icon, hover tooltip and floating button live in Shadow DOM. Page CSS can't break them, and they don't change the page.
- **Works where others break**: strict-CSP and Trusted Types sites such as ServiceNow and GitHub, iframes, rich-text editors and single-page apps.
- **Plain-text output**: translations are shown as plain text, never as HTML, which keeps the result safe.
- **🌙 Dark mode**: System, Light or Dark, in the in-page popup, the toolbar popup and the Options page.
- **⚙️ Options page**: target language, translation engine, API key, appearance, features and privacy.
- **More**: hover translate (hold `Ctrl`, `⌘` on Mac, and point at a word), listen to the original or the translation with your browser's speech, one-click copy, a language swap button, per-site on/off switches and 48 languages with auto-detect.

## 🔒 Privacy

- **No analytics and no usage data.** SmartTranslate collects no statistics, event counts, installation IDs or tracking data. On install or update it even deletes the leftovers of the analytics used in older versions.
- **Text is sent only when you ask for a translation**, and only to the engine you chose:
  - **Google Translate** (free engine): `translate.googleapis.com`, with `clients5.google.com` as the fallback
  - **Google Gemini API**, with your own key: `generativelanguage.googleapis.com`
  - **Chrome's on-device translator**: nothing leaves your computer
- **Your Gemini API key is stored locally** in `chrome.storage.local`. It is sent only to Google's Gemini API, in the `x-goog-api-key` request header and never in the URL.
- The extension has no servers of its own. Nothing is sent to the developer.

📄 Full privacy policy: **[hookana.github.io/smarttranslate-plus](https://hookana.github.io/smarttranslate-plus/)** (also in [PRIVACY_POLICY.md](PRIVACY_POLICY.md)).

## 🛠️ Installation

> ✅ **Releases:** From now on, each new version is published here only after it has been tested and confirmed to have no issues.

### From the Chrome Web Store (recommended)
Install **[SmartTranslate: AI Assistant Translate+](https://chromewebstore.google.com/detail/oakoplfgejfhlbckjfanpmniiebofpbd)** with one click.

### Load unpacked (developers)
1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome (version 116 or newer).
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the folder that contains `manifest.json`.

## ⚙️ Setup (optional)

SmartTranslate works right away with the free Google engine. To use Gemini:

1. Get a free API key from [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Click the SmartTranslate toolbar icon, open the **Settings** tab, and choose a Gemini model under **Translation engine**. You can also use **All settings…**, or right-click the icon and choose **Options**.
3. Paste your key, click **Save**, then **Test** to check it.

You can also set the target language (**Translate into**) and the theme (**Appearance**) there.

## 📖 Usage

| How | What happens |
|---|---|
| **Select text** | A small translate icon appears next to the selection. Click it to open the translation popup. |
| **Right-click** a selection | **Translate selection with SmartTranslate** |
| **`Ctrl+Shift+T`** (`⌘+Shift+T` on Mac) | Translates the current selection, or opens an empty popup if nothing is selected. You can change this in `chrome://extensions/shortcuts`. |
| **Hover translate** | Hold `Ctrl` (`⌘` on Mac) and point at a word to see its translation. |
| **Toolbar popup** | Quick translate for typed or pasted text, per-site switches, settings, and **✨ Assistant** to open the translator on the current page. |
| **Floating button** (optional) | A draggable quick-access button. It's off by default; turn it on per site in the toolbar popup. |

Inside the popup: `Ctrl+Enter` translates, `Esc` closes. There are also buttons to swap languages, listen, copy, clear and dock left or right.

## 🔑 Permissions explained

| Permission | Why it is needed |
|---|---|
| `storage` | Saves your settings and optional API key locally. |
| `contextMenus` | Adds the "Translate selection with SmartTranslate" right-click item. |
| `activeTab` | Gives temporary access to the current tab when you use the toolbar button, context menu or shortcut. |
| `scripting` | Inserts the extension's own bundled scripts into tabs that were already open before install or update. No remote code. |
| `translate.googleapis.com`, `clients5.google.com` | Sends the text you asked to translate to Google Translate (main and fallback endpoints). |
| `generativelanguage.googleapis.com` | Sends translation requests to Gemini, only if you've added your own key. |
| Content script on all sites (all frames) | Shows the translate icon and popup next to text you select, including inside iframes. Page content is read only when you ask for a translation. |

## ✨ What's new in 1.9.0

- **Fixed "Failed to fetch"** on ServiceNow and other strict sites. All requests now run in the background service worker, with a timeout, retries and an automatic backup engine.
- **Bullets and numbered lists stay intact.** Symbols like `•` are no longer translated into words.
- **The popup never gets cut off** at the screen edge, including in iframes, small windows and zoomed pages.
- **Long texts up to 100,000 characters** are translated completely, with progress and partial-failure handling.
- **New responsive design** in Shadow DOM, with dark mode, keyboard support and a resizable, dockable popup.
- **New Options page** and updated Gemini models (3.8 Flash, 3.5 Flash-Lite, 3.6 Flash, 3.1 Pro preview). The API key is now sent in a header.
- **Analytics removed:** no usage data is collected.
- Hover translate fixes, a translate-icon on/off setting, `Ctrl+Enter` to translate, `⌘+Shift+T` on macOS, and an optional, dismissible "Rate SmartTranslate" prompt.
- Lighter package: no injected Tailwind CSS, no `marked.js`, a smaller logo and the dead code removed.

📜 Full details and older versions: **[CHANGELOG.md](CHANGELOG.md)**

---

<p align="center">
  Created by <b>Tsoukas Aggelos</b> 💜<br>
  Enjoying SmartTranslate? A <a href="https://chromewebstore.google.com/detail/oakoplfgejfhlbckjfanpmniiebofpbd/reviews">review on the Chrome Web Store</a> helps a lot!
</p>
