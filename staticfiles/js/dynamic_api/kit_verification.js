/**
 * Kit Verification API Integration
 * Handles form submission for kit verification and sends data to the API
 */

(() => {
  'use strict';

  const API_BASE_URL = '/api/v2/kit-verification/';

  /**
   * Get CSRF token from cookies
   */
  function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
      const cookies = document.cookie.split(';');
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i].trim();
        if (cookie.substring(0, name.length + 1) === (name + '=')) {
          cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
          break;
        }
      }
    }
    return cookieValue;
  }

  /**
   * Show toast notification
   */
  function showToast(message, type = 'success') {
    if (typeof showToast === 'function' && window.showToast) {
      window.showToast(message, type, { duration: 3000 });
    } else if (typeof showSuccess === 'function' && type === 'success') {
      showSuccess(message);
    } else if (typeof showError === 'function' && type === 'error') {
      showError(message);
    } else {
      alert(message);
    }
  }

  /**
   * Get user emp_id from session or window variable
   */
  async function getUserEmpId() {
    // First try to get from window variable (set in template)
    if (window.USER_EMP_ID) {
      return window.USER_EMP_ID;
    }

    // If not available, fetch from user profile API
    try {
      const response = await fetch('/api/v2/user/profile/', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCookie('csrftoken') || '',
        },
        credentials: 'same-origin',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.user && data.user.emp_id) {
          return data.user.emp_id;
        }
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }

    return null;
  }

  /**
   * Get part number from window variable or URL
   */
  function getPartNo() {
    // Try to get from window variable (set in base_section.html)
    if (window.PART_NO) {
      return window.PART_NO;
    }

    // Fallback: try to extract from URL
    const pathParts = window.location.pathname.split('/');
    const partIndex = pathParts.indexOf('part');
    if (partIndex !== -1 && partIndex + 1 < pathParts.length) {
      return pathParts[partIndex + 1];
    }

    return null;
  }

  /**
   * Validate form data
   */
  function validateFormData(formData) {
    const errors = [];

    if (!formData.so_no || formData.so_no.trim() === '') {
      errors.push('SO No is required');
    }

    if (!formData.kit_no || formData.kit_no.trim() === '') {
      errors.push('Kit No is required');
    }

    if (!formData.kit_quantity || formData.kit_quantity <= 0 || isNaN(formData.kit_quantity)) {
      errors.push('Kit Quantity must be a valid number greater than 0');
    }

    return errors;
  }

  /**
   * Collect form data
   */
  function collectFormData() {
    const soNoInput = document.getElementById('soNo');
    const kitNoInput = document.getElementById('kitNo');
    const kitQuantityInput = document.getElementById('kitQuantity');

    if (!soNoInput || !kitNoInput || !kitQuantityInput) {
      throw new Error('Form fields not found');
    }

    return {
      so_no: soNoInput.value.trim(),
      kit_no: kitNoInput.value.trim(),
      kit_quantity: parseInt(kitQuantityInput.value, 10),
    };
  }

  /**
   * Handle form submission
   */
  async function handleFormSubmit(event) {
    event.preventDefault();
    event.stopPropagation();

    const form = event.target;
    if (!form) return;

    // Validate form HTML5 validation
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonText = submitButton ? submitButton.textContent : 'Verify Kit';

    try {
      // Disable submit button
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Verifying...';
      }

      // Collect form data
      let formData;
      try {
        formData = collectFormData();
      } catch (error) {
        showToast(error.message, 'error');
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = originalButtonText;
        }
        return;
      }

      // Validate form data
      const validationErrors = validateFormData(formData);
      if (validationErrors.length > 0) {
        showToast(validationErrors.join(', '), 'error');
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = originalButtonText;
        }
        return;
      }

      // Get part number
      const partNo = getPartNo();
      if (!partNo) {
        showToast('Part number not found. Please refresh the page.', 'error');
        return;
      }

      // Get user emp_id
      const empId = await getUserEmpId();
      if (!empId) {
        showToast('User information not found. Please login again.', 'error');
        setTimeout(() => {
          window.location.href = '/login/';
        }, 2000);
        return;
      }

      // Prepare API payload
      const payload = {
        part_no: partNo,
        kit_done_by: empId.toString(), // Convert to string
        kit_no: formData.kit_no,
        kit_quantity: formData.kit_quantity,
        kit_verification: true, // Automatically set to true
        so_no: formData.so_no,
      };

      console.log(payload);
      // Get CSRF token
      const csrfToken = getCookie('csrftoken');

      // Send API request
      const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRFToken': csrfToken || '',
        },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || errorData.message || 'Failed to verify kit';
        
        // Log full error details for debugging
        console.error('Kit verification API error:', {
          status: response.status,
          error: errorData.error,
          message: errorData.message,
          available_fields: errorData.available_model_fields,
          available_columns: errorData.available_database_columns,
          fields_found: errorData.fields_found,
          missing_fields: errorData.missing_fields,
          table_name: errorData.table_name
        });
        
        throw new Error(errorMessage);
      }

      const result = await response.json();

      // Show success message
      showToast(result.message || 'Kit verified successfully!', 'success');

      // Reset form after successful submission
      form.reset();

      // Optional: Redirect or reload after a delay
      setTimeout(() => {
        // You can add redirect logic here if needed
        // window.location.reload();
      }, 1500);

    } catch (error) {
      console.error('Kit verification failed:', error);
      showToast(error.message || 'Unable to verify kit. Please try again.', 'error');
    } finally {
      // Re-enable submit button
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
      }
    }
  }

  /**
   * Initialize kit verification form handler
   */
  function init() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
      return;
    }

    const form = document.getElementById('kitVerificationForm');
    if (!form) {
      console.warn('Kit verification form not found');
      return;
    }

    // Attach submit handler
    form.addEventListener('submit', handleFormSubmit);

    console.log('Kit verification form handler initialized');
  }

  // Initialize when script loads
  init();
})();

