/**
 * TOAST NOTIFICATION SYSTEM
 * Manages toast notifications for game events
 * @module ToastManager
 * @author Claude Code
 * @version 2.0.0
 */

class ToastManager {
  constructor() {
    this.container = document.getElementById('toast-container');
    this.toasts = [];
    this._queue = [];
    this._rafPending = false;
    this.MAX_VISIBLE = 5;
  }

  show(options) {
    this._queue.push(options || {});
    if (!this._rafPending) {
      this._rafPending = true;
      requestAnimationFrame(() => this._flush());
    }
    return null;
  }

  _buildToast(title, message, type, icon) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const iconEl = document.createElement('div');
    iconEl.className = 'toast-icon';
    iconEl.textContent = icon;
    const content = document.createElement('div');
    content.className = 'toast-content';
    if (title) {
      const titleEl = document.createElement('div');
      titleEl.className = 'toast-title';
      titleEl.textContent = title;
      content.appendChild(titleEl);
    }
    const msgEl = document.createElement('div');
    msgEl.className = 'toast-message';
    msgEl.textContent = message;
    content.appendChild(msgEl);
    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.textContent = '×';
    closeBtn.setAttribute('aria-label', 'Fermer');
    toast.appendChild(iconEl);
    toast.appendChild(content);
    toast.appendChild(closeBtn);
    return toast;
  }

  _flush() {
    this._rafPending = false;
    if (!this._queue.length) {
return;
}
    const fragment = document.createDocumentFragment();
    const toInsert = [];
    for (const options of this._queue) {
      const { title = '', message = '', type = 'info', duration = 3000 } = options;
      const icon = options.icon !== undefined ? options.icon : this.getDefaultIcon(type);
      const toast = this._buildToast(title, message, type, icon);
      fragment.appendChild(toast);
      toInsert.push({ toast, duration });
    }
    this._queue = [];
    // Evict oldest toasts if cap exceeded
    while (this.toasts.length + toInsert.length > this.MAX_VISIBLE) {
      const oldest = this.toasts.shift();
      if (oldest) {
this.remove(oldest);
}
    }
    this.container.appendChild(fragment);
    for (const { toast, duration } of toInsert) {
      this.toasts.push(toast);
      toast.querySelector('.toast-close').addEventListener('click', () => this.remove(toast));
      if (duration > 0) {
        let remaining = duration;
        let startTime;
        let timerId;
        const start = () => {
          startTime = Date.now();
          timerId = setTimeout(() => this.remove(toast), remaining);
        };
        toast.addEventListener('mouseenter', () => {
          clearTimeout(timerId);
          remaining -= Date.now() - startTime;
        });
        toast.addEventListener('mouseleave', start);
        start();
      }
    }
  }

  remove(toast) {
    toast.classList.add('removing');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
      this.toasts = this.toasts.filter(t => t !== toast);
    }, 300); // Match animation duration
  }

  getDefaultIcon(type) {
    const icons = {
      success: '✅',
      info: 'ℹ️',
      warning: '⚠️',
      error: '❌',
      achievement: '🏆'
    };
    return icons[type] || icons.info;
  }

  success(message, title) {
    return this.show({ title, message, type: 'success' });
  }

  info(message, title) {
    return this.show({ title, message, type: 'info' });
  }

  warning(message, title) {
    return this.show({ title, message, type: 'warning' });
  }

  error(message, title) {
    return this.show({ title, message, type: 'error' });
  }

  clear() {
    this.toasts.forEach(toast => this.remove(toast));
  }
}

// Create singleton instance
const toastManager = new ToastManager();

// Export to window (both class and singleton instance)
window.ToastManager = toastManager; // Singleton instance for direct usage
window.ToastManagerClass = ToastManager; // Class for instantiation if needed
