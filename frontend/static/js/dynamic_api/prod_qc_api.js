/**
 * Prod QC API Integration
 * Handles fetching Prod QC data when Kit No is entered and populates form fields
 */

(() => {
  'use strict';

  const API_BASE_URL = '/api/v2/prod-qc-data-fetch/';

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
    if (typeof window.showToast === 'function') {
      window.showToast(message, type, { duration: 3000 });
    } else if (typeof showSuccess === 'function' && type === 'success') {
      showSuccess(message);
    } else if (typeof showError === 'function' && type === 'error') {
      showError(message);
    } else {
      // Fallback to console or alert
      console.log(`[${type.toUpperCase()}] ${message}`);
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
   * Fetch Prod QC data by Kit No
   */
  async function fetchProdQCData(kitNo) {
    const partNo = getPartNo();
    if (!partNo) {
      showToast('Part number not found. Please refresh the page.', 'error');
      return null;
    }

    if (!kitNo || kitNo.trim() === '') {
      return null;
    }

    try {
      const csrfToken = getCookie('csrftoken');
      
      // Build query parameters
      const params = new URLSearchParams({
        part_no: partNo,
        kit_no: kitNo.trim()
      });

      const response = await fetch(`${API_BASE_URL}?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRFToken': csrfToken || '',
        },
        credentials: 'same-origin',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || errorData.message || 'Failed to fetch Prod QC data';
        
        // Don't show error for 404 (no entry found) - just clear fields
        if (response.status === 404) {
          return null;
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data;

    } catch (error) {
      console.error('Prod QC data fetch failed:', error);
      // Only show error if it's not a 404 (not found)
      if (!error.message.includes('No entry found')) {
        showToast(error.message || 'Unable to fetch Prod QC data. Please try again.', 'error');
      }
      return null;
    }
  }

  /**
   * Update submit button state based on available quantity and forwarding quantity
   */
  function updateSubmitButtonState() {
    const form = document.getElementById('prodQCForm');
    const submitButton = form ? form.querySelector('button[type="submit"]') : null;
    const prodQCAvailableQuantityInput = document.getElementById('prodQCAvailableQuantity');
    const forwardingQuantityInput = document.getElementById('forwardingQuantity');
    
    if (!submitButton || !prodQCAvailableQuantityInput) {
      return;
    }

    const availableQuantity = parseInt(prodQCAvailableQuantityInput.value, 10) || 0;
    const forwardingQuantity = forwardingQuantityInput ? (parseInt(forwardingQuantityInput.value, 10) || 0) : 0;
    
    // Disable if available quantity is 0 or less, or if forwarding quantity exceeds available quantity
    if (availableQuantity <= 0 || forwardingQuantity > availableQuantity) {
      submitButton.disabled = true;
      submitButton.style.opacity = '0.6';
      submitButton.style.cursor = 'not-allowed';
    } else {
      submitButton.disabled = false;
      submitButton.style.opacity = '1';
      submitButton.style.cursor = 'pointer';
    }
  }

  /**
   * Populate form fields with fetched data
   */
  function populateFormFields(data) {
    if (!data) {
      // Clear fields if no data
      const soNoInput = document.getElementById('soNo');
      const prodQCAvailableQuantityInput = document.getElementById('prodQCAvailableQuantity');
      
      if (soNoInput) soNoInput.value = '';
      if (prodQCAvailableQuantityInput) prodQCAvailableQuantityInput.value = '';
      
      // Update submit button state
      updateSubmitButtonState();
      
      return;
    }

    // Populate SO No
    const soNoInput = document.getElementById('soNo');
    if (soNoInput && data.so_no) {
      soNoInput.value = data.so_no;
    }

    // Populate Prod QC Available Quantity
    const prodQCAvailableQuantityInput = document.getElementById('prodQCAvailableQuantity');
    if (prodQCAvailableQuantityInput && data.prod_qc_available_quantity) {
      prodQCAvailableQuantityInput.value = data.prod_qc_available_quantity;
    }

    // Update submit button state after populating fields
    updateSubmitButtonState();
  }

  /**
   * Handle search button click
   */
  async function handleSearchClick() {
    const kitNoInput = document.getElementById('kitNo');
    const searchBtn = document.getElementById('searchProdQCBtn');
    
    if (!kitNoInput) {
      showToast('Kit No input field not found', 'error');
      return;
    }

    const kitNo = kitNoInput.value.trim();

    // Validate Kit No is not empty
    if (kitNo === '') {
      showToast('Please enter a Kit Number', 'error');
      return;
    }

    try {
      // Disable search button
      if (searchBtn) {
        searchBtn.disabled = true;
      }

      // Show loading state
      const soNoInput = document.getElementById('soNo');
      const prodQCAvailableQuantityInput = document.getElementById('prodQCAvailableQuantity');
      
      if (soNoInput) {
        soNoInput.value = 'Loading...';
        soNoInput.style.opacity = '0.6';
      }
      if (prodQCAvailableQuantityInput) {
        // For number inputs, use placeholder or empty string instead of "Loading..."
        prodQCAvailableQuantityInput.value = '';
        prodQCAvailableQuantityInput.placeholder = 'Loading...';
        prodQCAvailableQuantityInput.style.opacity = '0.6';
      }

      const data = await fetchProdQCData(kitNo);
      
      // Remove loading state
      if (soNoInput) {
        soNoInput.style.opacity = '1';
      }
      if (prodQCAvailableQuantityInput) {
        prodQCAvailableQuantityInput.placeholder = '';
        prodQCAvailableQuantityInput.style.opacity = '1';
      }

      if (data) {
        populateFormFields(data);
        showToast('Prod QC data loaded successfully', 'success');
      } else {
        populateFormFields(null);
        // Don't show error for "not found" - it's expected behavior
      }
    } catch (error) {
      console.error('Error handling search:', error);
      populateFormFields(null);
    } finally {
      // Re-enable search button
      if (searchBtn) {
        searchBtn.disabled = false;
      }
    }
  }

  /**
   * Handle Enter key press on Kit No input
   */
  function handleKitNoKeyPress(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSearchClick();
    }
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
    const originalButtonText = submitButton ? submitButton.querySelector('span').textContent : 'Forward to Next Section';

    try {
      // Disable submit button
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.querySelector('span').textContent = 'Submitting...';
      }

      // Collect form data
      const kitNoInput = document.getElementById('kitNo');
      const forwardingQuantityInput = document.getElementById('forwardingQuantity');
      const prodQCAvailableQuantityInput = document.getElementById('prodQCAvailableQuantity');
      const soNoInput = document.getElementById('soNo');

      if (!kitNoInput || !forwardingQuantityInput) {
        throw new Error('Required form fields not found');
      }

      const kitNo = kitNoInput.value.trim();
      const forwardingQuantity = parseInt(forwardingQuantityInput.value, 10);

      // Validate form data
      if (!kitNo) {
        throw new Error('Kit No is required');
      }

      if (isNaN(forwardingQuantity) || forwardingQuantity < 0) {
        throw new Error('Forwarding quantity must be a valid number greater than or equal to 0');
      }

      // Get part number
      const partNo = getPartNo();
      if (!partNo) {
        throw new Error('Part number not found. Please refresh the page.');
      }

      // Get user emp_id
      const empId = await getUserEmpId();
      if (!empId) {
        throw new Error('User information not found. Please login again.');
      }

      // Get CSRF token
      const csrfToken = getCookie('csrftoken');

      // Prepare payload
      const payload = {
        part_no: partNo,
        kit_no: kitNo,
        forwarding_quantity: forwardingQuantity,
        prodqc_done_by: empId.toString(), // Convert to string
        production_qc: true, // Boolean value indicating Prod QC is done
      };

      console.log('Payload:', payload);

      // API endpoint
      const API_ENDPOINT = '/api/v2/prod-qc-update/';

      const response = await fetch(API_ENDPOINT, {
        method: 'PUT',
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
        throw new Error(errorData.error || errorData.message || 'Failed to update Prod QC data');
      }

      const result = await response.json();
      showToast(result.message || 'Prod QC data updated successfully!', 'success');

      // Reset form after successful submission
      form.reset();

      // Clear all readonly fields as well
      if (soNoInput) {
        soNoInput.value = '';
      }
      if (prodQCAvailableQuantityInput) {
        prodQCAvailableQuantityInput.value = '';
      }

      // Update submit button state
      updateSubmitButtonState();

      // Optional: Show info about readyfor_production update
      if (result.readyfor_production) {
        console.log(`Updated readyfor_production field with ${result.readyfor_production.quantity_added} quantity. New total: ${result.readyfor_production.new_quantity}`);
      }

    } catch (error) {
      console.error('Prod QC form submission failed:', error);
      showToast(error.message || 'Unable to update Prod QC data. Please try again.', 'error');
    } finally {
      // Re-enable submit button
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.querySelector('span').textContent = originalButtonText;
      }
    }
  }

  /**
   * Initialize Prod QC form handler
   */
  function init() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
      return;
    }

    const kitNoInput = document.getElementById('kitNo');
    const searchBtn = document.getElementById('searchProdQCBtn');
    
    if (!kitNoInput) {
      console.warn('Kit No input field not found');
      return;
    }

    if (!searchBtn) {
      console.warn('Search button not found');
      return;
    }

    // Attach click event listener to search button
    searchBtn.addEventListener('click', handleSearchClick);

    // Attach Enter key press listener to Kit No input
    kitNoInput.addEventListener('keypress', handleKitNoKeyPress);

    // Attach form submit handler
    const form = document.getElementById('prodQCForm');
    if (form) {
      form.addEventListener('submit', handleFormSubmit);
      
      // Listen for changes in Prod QC Available Quantity to update submit button state
      const prodQCAvailableQuantityInput = document.getElementById('prodQCAvailableQuantity');
      if (prodQCAvailableQuantityInput) {
        prodQCAvailableQuantityInput.addEventListener('input', updateSubmitButtonState);
        prodQCAvailableQuantityInput.addEventListener('change', updateSubmitButtonState);
      }
      
      // Listen for changes in Forwarding Quantity to update submit button state
      const forwardingQuantityInput = document.getElementById('forwardingQuantity');
      if (forwardingQuantityInput) {
        forwardingQuantityInput.addEventListener('input', updateSubmitButtonState);
        forwardingQuantityInput.addEventListener('change', updateSubmitButtonState);
      }
      
      // Initial state check
      updateSubmitButtonState();
    } else {
      console.warn('Prod QC form not found');
    }

    console.log('Prod QC API handler initialized');
  }

  // Initialize when script loads
  init();
})();
