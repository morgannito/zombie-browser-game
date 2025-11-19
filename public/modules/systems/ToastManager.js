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
  }

  show(options) {
    const {
      title = '',
      message = '',
      type = 'info', // success, info, warning, error
      icon = this.getDefaultIcon(type),
      duration = 3000
    } = options;

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <div class="toast-icon">${icon}</div>
      <div class="toast-content">
        ${title ? `<div class="toast-title">${title}</div>` : ''}
        <div class="toast-message">${message}</div>
      </div>
    `;

    // Add to container
    this.container.appendChild(toast);
    this.toasts.push(toast);

    // Auto remove after duration
    if (duration > 0) {
      setTimeout(() => {
        this.remove(toast);
      }, duration);
    }

    return toast;
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

// Export to window
window.ToastManager = ToastManager;
