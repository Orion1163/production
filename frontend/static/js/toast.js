/**
 * Toast Notification System
 * A modern, customizable toast notification library
 */

class ToastManager {
  constructor() {
    this.container = null;
    this.toasts = new Map();
    this.defaultOptions = {
      duration: 5000,
      position: "top-right",
      showProgress: true,
      closeOnClick: false,
      pauseOnHover: true,
      maxToasts: 5,
    };
    this.init();
  }

  init() {
    this.createContainer();
    this.setupEventListeners();
  }

  createContainer() {
    // Remove existing container if it exists
    const existingContainer = document.querySelector(".toast-container");
    if (existingContainer) {
      existingContainer.remove();
    }

    this.container = document.createElement("div");
    this.container.className = "toast-container";
    document.body.appendChild(this.container);
  }

  setupEventListeners() {
    // Handle window resize
    window.addEventListener("resize", () => {
      this.adjustPosition();
    });
  }

  adjustPosition() {
    if (!this.container) return;

    // Adjust position based on screen size
    if (window.innerWidth <= 480) {
      this.container.style.right = "10px";
      this.container.style.left = "10px";
      this.container.style.maxWidth = "none";
    } else {
      this.container.style.right = "20px";
      this.container.style.left = "auto";
      this.container.style.maxWidth = "400px";
    }
  }

  show(message, type = "info", options = {}) {
    const config = { ...this.defaultOptions, ...options };
    const toastId = this.generateId();

    // Remove oldest toast if we exceed maxToasts
    if (this.toasts.size >= config.maxToasts) {
      const oldestToast = this.toasts.keys().next().value;
      this.remove(oldestToast);
    }

    const toast = this.createToast(toastId, message, type, config);
    this.container.appendChild(toast);
    this.toasts.set(toastId, { element: toast, config });

    // Trigger show animation
    requestAnimationFrame(() => {
      toast.classList.add("show");
    });

    // Auto remove
    if (config.duration > 0) {
      this.scheduleRemoval(toastId, config.duration);
    }

    return toastId;
  }

  createToast(id, message, type, config) {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.dataset.toastId = id;

    const icon = this.getIcon(type);
    const title = this.getTitle(type);

    toast.innerHTML = `
      <div class="toast-icon">${icon}</div>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        <div class="toast-message">${message}</div>
      </div>
      <button class="toast-close" onclick="toastManager.remove('${id}')">&times;</button>
      ${config.showProgress ? '<div class="toast-progress"></div>' : ""}
    `;

    // Add event listeners
    if (config.closeOnClick) {
      toast.addEventListener("click", () => this.remove(id));
    }

    if (config.pauseOnHover) {
      toast.addEventListener("mouseenter", () => this.pauseProgress(id));
      toast.addEventListener("mouseleave", () => this.resumeProgress(id));
    }

    return toast;
  }

  getIcon(type) {
    const icons = {
      success: "✓",
      error: "✕",
      warning: "⚠",
      info: "ℹ",
    };
    return icons[type] || icons.info;
  }

  getTitle(type) {
    const titles = {
      success: "Success",
      error: "Error",
      warning: "Warning",
      info: "Information",
    };
    return titles[type] || titles.info;
  }

  scheduleRemoval(id, duration) {
    const toastData = this.toasts.get(id);
    if (!toastData) return;

    const { element, config } = toastData;

    if (config.showProgress) {
      const progressBar = element.querySelector(".toast-progress");
      if (progressBar) {
        progressBar.style.width = "100%";
        progressBar.style.transition = `width ${duration}ms linear`;
      }
    }

    toastData.timeoutId = setTimeout(() => {
      this.remove(id);
    }, duration);
  }

  pauseProgress(id) {
    const toastData = this.toasts.get(id);
    if (!toastData || !toastData.timeoutId) return;

    clearTimeout(toastData.timeoutId);

    const progressBar = toastData.element.querySelector(".toast-progress");
    if (progressBar) {
      progressBar.style.animationPlayState = "paused";
    }
  }

  resumeProgress(id) {
    const toastData = this.toasts.get(id);
    if (!toastData) return;

    const remainingTime = this.calculateRemainingTime(toastData.element);
    if (remainingTime > 0) {
      this.scheduleRemoval(id, remainingTime);
    }
  }

  calculateRemainingTime(element) {
    const progressBar = element.querySelector(".toast-progress");
    if (!progressBar) return 0;

    const computedStyle = window.getComputedStyle(progressBar);
    const width = parseFloat(computedStyle.width);
    const totalWidth = progressBar.parentElement.offsetWidth;
    const percentage = width / totalWidth;

    // Estimate remaining time based on progress
    return Math.max(0, percentage * 5000); // Assuming 5s default duration
  }

  remove(id) {
    const toastData = this.toasts.get(id);
    if (!toastData) return;

    const { element, timeoutId } = toastData;

    // Clear timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Add hide animation
    element.classList.add("hide");
    element.classList.remove("show");

    // Remove from DOM after animation
    setTimeout(() => {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
      this.toasts.delete(id);
    }, 300);
  }

  clear() {
    this.toasts.forEach((_, id) => {
      this.remove(id);
    });
  }

  generateId() {
    return "toast_" + Math.random().toString(36).substr(2, 9);
  }
}

// Convenience methods
const toastManager = new ToastManager();

// Global functions for easy access
window.showToast = (message, type = "info", options = {}) => {
  return toastManager.show(message, type, options);
};

window.showSuccess = (message, options = {}) => {
  return toastManager.show(message, "success", options);
};

window.showError = (message, options = {}) => {
  return toastManager.show(message, "error", options);
};

window.showWarning = (message, options = {}) => {
  return toastManager.show(message, "warning", options);
};

window.showInfo = (message, options = {}) => {
  return toastManager.show(message, "info", options);
};

// Replace alert function globally
window.originalAlert = window.alert;
window.alert = (message) => {
  // Try to determine message type based on content
  let type = "info";
  if (typeof message === "string") {
    const lowerMessage = message.toLowerCase();
    if (
      lowerMessage.includes("error") ||
      lowerMessage.includes("failed") ||
      lowerMessage.includes("invalid")
    ) {
      type = "error";
    } else if (
      lowerMessage.includes("success") ||
      lowerMessage.includes("saved") ||
      lowerMessage.includes("created")
    ) {
      type = "success";
    } else if (
      lowerMessage.includes("warning") ||
      lowerMessage.includes("caution")
    ) {
      type = "warning";
    }
  }

  return showToast(message, type, { duration: 4000 });
};

// Export for module systems
if (typeof module !== "undefined" && module.exports) {
  module.exports = { ToastManager, toastManager };
}
