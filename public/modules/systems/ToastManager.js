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
    toast.appendChild(iconEl);
    toast.appendChild(content);
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
    this.container.appendChild(fragment);
    for (const { toast, duration } of toInsert) {
      this.toasts.push(toast);
      if (duration > 0) {
setTimeout(() => this.remove(toast), duration);
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
      error: '❌'
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
