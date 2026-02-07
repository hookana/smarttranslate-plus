class FloatingButton {
    constructor() {
        this.host = null;
        this.shadow = null;
        this.element = null;
        this.isHidden = false;
        this.isDragging = false;
        this.hideTimeout = null;
    }

    mount() {
        // Prevent duplicate creation
        if (document.getElementById('smarttranslate-floating-host')) return;
        if (window.self !== window.top) return; // Only top frame

        // Create Shadow Host
        this.host = document.createElement('div');
        this.host.id = 'smarttranslate-floating-host';
        this.host.style.setProperty('all', 'initial', 'important');
        this.host.style.setProperty('z-index', '2147483646', 'important');
        this.host.style.setProperty('position', 'fixed', 'important');
        this.host.style.setProperty('top', '0', 'important');
        this.host.style.setProperty('left', '0', 'important');
        this.host.style.setProperty('width', '0', 'important');
        this.host.style.setProperty('height', '0', 'important');

        this.shadow = this.host.attachShadow({ mode: 'open' });

        // Create Button Container
        this.element = document.createElement('div');
        this.element.title = 'Open SmartTranslate';

        // Apply Styles
        const s = this.element.style;
        s.position = 'fixed';
        s.bottom = '1.25rem';
        s.right = '1.25rem';
        s.width = '2.5rem';
        s.height = '2.5rem';
        s.cursor = 'pointer';
        s.pointerEvents = 'auto';
        s.padding = '0';
        s.background = 'transparent';
        s.borderRadius = '0.625rem';
        s.borderStyle = 'groove';
        s.borderWidth = '0.125rem';
        s.overflow = 'hidden';
        s.display = 'flex';
        s.alignItems = 'center';
        s.justifyContent = 'center';
        s.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
        s.userSelect = 'none';
        s.opacity = '0.95';

        // Add Logo
        const logo = document.createElement('img');
        logo.src = chrome.runtime.getURL('logo.png');
        logo.style.width = '100%';
        logo.style.height = '100%';
        logo.style.objectFit = 'contain';
        logo.style.pointerEvents = 'none';
        logo.style.display = 'block';

        this.element.appendChild(logo);
        this.shadow.appendChild(this.element);
        document.body.appendChild(this.host);

        // Retrieve saved position
        this.loadPosition();

        // Attach Listeners
        this.attachListeners();

        // Start Auto-hide timer
        this.resetHideTimer();

        return this.element; // Return element for legacy compatibility if needed
    }

    loadPosition() {
        chrome.storage.local.get(['floatingButtonPos'], (result) => {
            if (result.floatingButtonPos) {
                const { left, top } = result.floatingButtonPos;
                const s = this.element.style;
                s.right = 'auto';
                s.bottom = 'auto';
                s.left = `${left}px`;
                s.top = `${top}px`;
            }
        });
    }

    savePosition(left, top) {
        chrome.storage.local.set({
            floatingButtonPos: { left, top }
        });
    }

    attachListeners() {
        if (!this.element) return;

        // Hover Effects
        this.element.addEventListener('mouseenter', () => {
            if (!this.isDragging) {
                this.element.style.transform = 'scale(1.1)';
                this.show();
            }
        });
        this.element.addEventListener('mouseleave', () => {
            if (!this.isDragging) this.element.style.transform = 'scale(1)';
        });

        // Dragging
        this.onPointerMoveBound = this.onPointerMove.bind(this);
        this.element.addEventListener('pointerdown', (e) => this.startDrag(e));

        // Click
        this.element.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.hasMoved) return;

            this.show();
            if (window.UI) {
                const currentSel = Selection.getSelectionTextIncludingIframes();
                window.UI.showPopup(window.innerWidth / 2, window.innerHeight / 2, currentSel || '');
            }
        });

        // Global events - Store for cleanup
        this.globalHandlers = {
            mousemove: () => this.show(),
            scroll: () => this.show(),
            resize: () => this.handleResize()
        };

        document.addEventListener('mousemove', this.globalHandlers.mousemove, { passive: true });
        document.addEventListener('scroll', this.globalHandlers.scroll, { passive: true });
        window.addEventListener('resize', this.globalHandlers.resize, { passive: true });
    }

    handleResize() {
        if (!this.element) return;
        const rect = this.element.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        if (rect.bottom > vh || rect.right > vw) {
            const newX = Math.min(rect.left, vw - 48 - 10);
            const newY = Math.min(rect.top, vh - 48 - 10);
            this.element.style.left = `${Math.max(10, newX)}px`;
            this.element.style.top = `${Math.max(10, newY)}px`;
        }
    }

    show() {
        if (!this.element) return;
        this.resetHideTimer();

        if (!this.isHidden) return;

        this.isHidden = false;
        this.element.style.transform = 'translateX(0)';
        this.element.style.opacity = '0.95';
    }

    hide() {
        if (!this.element || this.isHidden || this.isDragging) return;

        const rect = this.element.getBoundingClientRect();
        const vw = window.innerWidth;

        const distLeft = rect.left;
        const distRight = vw - rect.right;

        if (distLeft > 100 && distRight > 100) return;

        this.isHidden = true;

        if (distLeft < distRight) {
            this.element.style.transform = 'translateX(-30px)';
        } else {
            this.element.style.transform = 'translateX(30px)';
        }
        this.element.style.opacity = '0.5';
    }

    resetHideTimer() {
        clearTimeout(this.hideTimeout);
        if (!this.element) return;
        this.hideTimeout = setTimeout(() => this.hide(), CONFIG.AUTO_HIDE_DELAY || 3000);
    }

    startDrag(e) {
        if (!this.element) return;
        e.preventDefault();
        this.element.setPointerCapture(e.pointerId);

        const rect = this.element.getBoundingClientRect();
        this.startX = e.clientX;
        this.startY = e.clientY;
        this.initialLeft = rect.left;
        this.initialTop = rect.top;
        this.hasMoved = false;

        document.addEventListener('pointermove', this.onPointerMoveBound);
        this.element.addEventListener('pointerup', (e) => this.stopDrag(e), { once: true });
        this.element.addEventListener('pointercancel', (e) => this.stopDrag(e), { once: true });
    }

    onPointerMove(e) {
        if (!this.element) return;
        const dx = e.clientX - this.startX;
        const dy = e.clientY - this.startY;

        if (!this.isDragging && Math.sqrt(dx * dx + dy * dy) > 5) {
            this.isDragging = true;
            this.element.style.transition = 'none';
            this.element.style.cursor = 'grabbing';
            this.show();
        }

        if (!this.isDragging) return;
        e.preventDefault();

        let newX = this.initialLeft + dx;
        let newY = this.initialTop + dy;

        const vw = window.innerWidth;
        const vh = window.innerHeight;
        newX = Math.max(10, Math.min(newX, vw - 48 - 10));
        newY = Math.max(10, Math.min(newY, vh - 48 - 10));

        this.element.style.right = 'auto';
        this.element.style.bottom = 'auto';
        this.element.style.left = `${newX}px`;
        this.element.style.top = `${newY}px`;

        this.hasMoved = true;
    }

    stopDrag(e) {
        document.removeEventListener('pointermove', this.onPointerMoveBound);
        if (this.element) {
            this.element.releasePointerCapture(e.pointerId);
            this.element.style.cursor = 'pointer';
            this.element.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';

            if (this.isDragging) {
                this.isDragging = false;
                this.show();
                const rect = this.element.getBoundingClientRect();
                this.savePosition(rect.left, rect.top);
            }
        }
    }

    unmount() {
        if (this.globalHandlers) {
            document.removeEventListener('mousemove', this.globalHandlers.mousemove);
            document.removeEventListener('scroll', this.globalHandlers.scroll);
            window.removeEventListener('resize', this.globalHandlers.resize);
            this.globalHandlers = null;
        }

        if (this.host && this.host.parentNode) {
            this.host.parentNode.removeChild(this.host);
        }
        clearTimeout(this.hideTimeout);
        this.host = null;
        this.shadow = null;
        this.element = null;
    }
}

window.FloatingButton = FloatingButton;
