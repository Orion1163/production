/**
 * Profile page JavaScript
 * Fetches and displays admin profile information
 */

(function () {
  'use strict';

  const PROFILE_ENDPOINT = '/api/v2/admin/profile/';

  /**
   * Get CSRF token from cookies
   */
  function getCookie(name) {
    const cookieValue = document.cookie
      .split(';')
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith(`${name}=`));
    return cookieValue ? decodeURIComponent(cookieValue.split('=')[1]) : '';
  }

  /**
   * Show toast message
   */
  function showMessage(message, type = 'info') {
    if (typeof window.showToast === 'function') {
      window.showToast(message, type, { duration: 4000 });
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  /**
   * Format date
   */
  function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (e) {
      return 'N/A';
    }
  }

  /**
   * Update profile information in the DOM
   */
  function updateProfile(data) {
    const { admin } = data;

    if (!admin) {
      console.error('No admin data received');
      return;
    }

    // Update employee ID
    const empIdElement = document.getElementById('emp-id');
    if (empIdElement && admin.emp_id) {
      empIdElement.textContent = admin.emp_id;
      // Add animation effect
      empIdElement.style.opacity = '0';
      setTimeout(() => {
        empIdElement.style.transition = 'opacity 0.5s ease';
        empIdElement.style.opacity = '1';
      }, 100);
    }

    // Update profile name with employee ID
    const profileName = document.getElementById('profile-name');
    if (profileName) {
      profileName.textContent = `Admin #${admin.emp_id || 'N/A'}`;
    }

    // Update last login time (using current time as placeholder)
    const lastLogin = document.getElementById('last-login');
    if (lastLogin) {
      const now = new Date();
      const timeString = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      lastLogin.textContent = `Today at ${timeString}`;
    }
  }

  /**
   * Fetch profile data from API
   */
  async function fetchProfile() {
    try {
      const response = await fetch(PROFILE_ENDPOINT, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCookie('csrftoken'),
        },
        credentials: 'same-origin',
      });

      if (!response.ok) {
        if (response.status === 401) {
          showMessage('Session expired. Please login again.', 'error');
          setTimeout(() => {
            window.location.href = '/login/';
          }, 2000);
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      updateProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
      showMessage('Failed to load profile data. Please refresh the page.', 'error');
      
      // Fallback: Use emp_id from data attribute if available
      const container = document.querySelector('.profile-container');
      const empId = container ? container.getAttribute('data-emp-id') : null;
      if (empId) {
        const empIdElement = document.getElementById('emp-id');
        const profileName = document.getElementById('profile-name');
        if (empIdElement) {
          empIdElement.textContent = empId;
        }
        if (profileName) {
          profileName.textContent = `Admin #${empId}`;
        }
      }
    }
  }

  /**
   * Initialize profile page
   */
  function init() {
    // Set initial emp_id from data attribute if available
    const container = document.querySelector('.profile-container');
    const empId = container ? container.getAttribute('data-emp-id') : null;
    if (empId) {
      const empIdElement = document.getElementById('emp-id');
      const profileName = document.getElementById('profile-name');
      if (empIdElement && empIdElement.textContent === 'Loading...') {
        empIdElement.textContent = empId;
      }
      if (profileName && profileName.textContent === 'Administrator') {
        profileName.textContent = `Admin #${empId}`;
      }
    }

    // Fetch profile data when page loads
    fetchProfile();

    // Add loading state
    if (container) {
      container.classList.add('loading');
      setTimeout(() => {
        container.classList.remove('loading');
      }, 500);
    }

    // Handle action button clicks
    document.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        const url = this.getAttribute('data-url');
        if (url) {
          // Add visual feedback
          this.style.transform = 'scale(0.95)';
          setTimeout(() => {
            window.location.href = url;
          }, 150);
        }
      });
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
