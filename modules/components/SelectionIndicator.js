class SelectionIndicator {
    constructor() {
        this.host = null;
        this.shadow = null;
        this.element = null;
        this.pollingInterval = null;
    }

    mount() {
        if (document.getElementById('smarttranslate-indicator-host')) return;

        // Create Host & Shadow as before
        this.host = document.createElement('div');
        this.host.id = 'smarttranslate-indicator-host';
        this.host.style.setProperty('all', 'initial', 'important');
        this.host.style.setProperty('z-index', '2147483647', 'important');
        this.host.style.setProperty('position', 'fixed', 'important');
        this.host.style.setProperty('top', '0', 'important');
        this.host.style.setProperty('left', '0', 'important');
        this.host.style.setProperty('width', '0', 'important');
        this.host.style.setProperty('height', '0', 'important');
        this.host.style.setProperty('pointer-events', 'none', 'important');

        this.shadow = this.host.attachShadow({ mode: 'open' });

        this.element = document.createElement('div');
        this.element.title = 'Click to translate';

        const s = this.element.style;
        s.position = 'fixed';
        s.width = '1.5rem';
        s.height = '1.5rem';
        s.cursor = 'pointer';
        s.pointerEvents = 'auto';
        s.display = 'none'; // Start hidden
        s.alignItems = 'center';
        s.justifyContent = 'center';
        s.visibility = 'visible';
        s.opacity = '0';
        s.transition = 'opacity 0.15s ease';
        s.filter = 'drop-shadow(0 0 4px rgba(255, 255, 255, 0.9)) drop-shadow(0 2px 6px rgba(0, 0, 0, 0.4))';

        const logo = document.createElement('img');
        logo.src = chrome.runtime.getURL('logo.png');
        logo.style.width = '100%';
        logo.style.height = '100%';
        logo.style.objectFit = 'contain';
        logo.style.pointerEvents = 'none';

        this.element.appendChild(logo);
        this.shadow.appendChild(this.element);
        document.body.appendChild(this.host);

        // Listeners included directly
        this.attachListeners();

        return this.element;
    }

    attachListeners() {
        this.element.addEventListener('mouseenter', () => {
            this.element.style.transform = 'scale(1.15)';
            this.element.style.filter = 'drop-shadow(0 0 6px rgba(255, 255, 255, 1)) drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3))';
        });

        this.element.addEventListener('mouseleave', () => {
            this.element.style.transform = 'scale(1)';
            this.element.style.filter = 'drop-shadow(0 0 4px rgba(255, 255, 255, 0.9)) drop-shadow(0 2px 6px rgba(0, 0, 0, 0.4))';
        });

        this.element.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (window.UI && window.Selection) {
                const text = window.Selection.currentSelectedText || '';
                if (text) {
                    // Send message to open popup in Top Frame (handled by content.js)
                    chrome.runtime.sendMessage({
                        type: 'smarttranslate:show-popup',
                        selection: text,
                        // We can pass coordinates if supported later, but currently ignored by UI
                        x: e.clientX,
                        y: e.clientY
                    });
                    this.hide();
                }
            }
        });
    }

    show(x, y) {
        if (!this.element) return;
        this.element.style.left = `${x}px`;
        this.element.style.top = `${y}px`;
        this.element.style.display = 'flex';
        this.element.style.visibility = 'visible';
        this.element.style.pointerEvents = 'auto';
        void this.element.offsetWidth;
        this.element.style.opacity = '1';
    }

    hide() {
        if (!this.element) return;
        this.element.style.opacity = '0';
        this.element.style.pointerEvents = 'none';
        setTimeout(() => { if (this.element.style.opacity === '0') this.element.style.display = 'none'; }, 150);
    }

    update(event) {
        if (!this.element) return;

        // Check UI global state
        if (window.UI) {
            if (window.UI.isEnabled === false || (window.UI.popup && window.UI.popup.style.display === 'block')) {
                this.hide();
                return;
            }
        }

        let selectedText = '';
        let rect = null;

        // 1. Regular Selection
        const sel = window.getSelection ? window.getSelection() : null;
        if (sel && sel.toString().trim().length > 0) {
            const range = sel.getRangeAt(0);
            const container = range.startContainer.parentElement;
            if (container && (container.checkVisibility ? container.checkVisibility() : container.offsetParent !== null)) {
                selectedText = sel.toString().trim();
                try {
                    const rects = range.getClientRects();
                    if (rects.length > 0) rect = rects[rects.length - 1]; // End of text
                    else rect = range.getBoundingClientRect();
                } catch (e) { rect = range.getBoundingClientRect(); }
            }
        }

        // 2. ServiceNow
        if (!selectedText && typeof ServiceNowHelper !== 'undefined') {
            try {
                const sn = ServiceNowHelper.getSelection();
                if (sn && sn.selection) {
                    selectedText = sn.selection.trim();
                    if (sn.rect) rect = sn.rect;
                }
            } catch (e) { }
        }

        // 3. TinyMCE
        if (!selectedText && typeof TinyMCEHelper !== 'undefined') {
            try {
                const mce = TinyMCEHelper.getSelectionFromIframes();
                if (mce && mce.text) {
                    selectedText = mce.text.trim();
                    if (mce.rect) rect = mce.rect;
                }
            } catch (e) { }
        }

        // 4. Iframes (Recursive) - REMOVED
        // Since we inject content scripts into all_frames, each iframe handles its own selection.
        // Scanning from top frame causes double indicators and cross-origin security errors.

        if (selectedText && selectedText.trim().length > 0) {
            if (window.Selection) window.Selection.setCurrentSelection(selectedText);

            if (rect && (rect.width > 0 || rect.height > 0)) {
                const x = Math.max(10, Math.min(rect.right + 5, window.innerWidth - 40));
                const y = Math.max(10, Math.min(rect.top - 8, window.innerHeight - 40));

                if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) {
                    this.hide();
                } else {
                    this.show(x, y);
                }
            } else {
                this.hide();
            }
        } else {
            this.hide();
        }
    }
}
window.SelectionIndicator = SelectionIndicator;
