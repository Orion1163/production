/**
 * Glueing Dynamic Fields Handler
 * Manages dynamic addition and removal of Serial Number and USID input fields
 * Handles serial number search and USID population
 */

(() => {
  'use strict';

  const GLUEING_SERIAL_SEARCH_URL = '/api/v2/glueing-serial-number-search/';
  const GLUEING_SUBMIT_URL = '/api/v2/glueing-submit/';
  
  // Get part_no from window (set in base_section.html)
  const PART_NO = window.PART_NO;
  
  let rowIndex = 0;

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
   * Search for serial number and populate USID if found
   */
  async function searchSerialNumber(serialNumber, usidInput) {
    if (!PART_NO) {
      console.error('Part number not available');
      showToast('Part number not available', 'error');
      return;
    }
    
    if (!serialNumber || !serialNumber.trim()) {
      return;
    }
    
    try {
      const params = new URLSearchParams({
        part_no: PART_NO,
        serial_number: serialNumber.trim()
      });
      
      const response = await fetch(`${GLUEING_SERIAL_SEARCH_URL}?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin'
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        // Handle error response
        const errorMessage = data.message || data.error || 'Failed to search serial number';
        showToast(errorMessage, 'error');
        if (usidInput) {
          usidInput.value = '';
        }
        return;
      }
      
      // Success - populate USID field
      if (data.usid && usidInput) {
        usidInput.value = data.usid;
        console.log('USID found and populated:', data.usid);
      } else {
        showToast('USID not found in response', 'error');
      }
      
    } catch (error) {
      console.error('Error searching serial number:', error);
      showToast('Error searching serial number. Please try again.', 'error');
      if (usidInput) {
        usidInput.value = '';
      }
    }
  }

  /**
   * Add a new field row with Serial Number and USID inputs
   */
  function addFieldRow() {
    // Change all existing add buttons to remove buttons
    const addButtons = document.querySelectorAll('.add-btn');
    addButtons.forEach(btn => {
      btn.className = 'remove-btn';
      btn.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      `;
      btn.setAttribute('onclick', 'window.glueingAPI.removeFieldRow(this)');
      btn.setAttribute('title', 'Remove this row');
    });

    // Create new row
    rowIndex++;
    const fieldsContainer = document.getElementById('fieldsContainer');
    if (!fieldsContainer) {
      console.error('Fields container not found');
      return;
    }

    const fieldRow = document.createElement('div');
    fieldRow.className = 'field-row';
    fieldRow.setAttribute('data-row-index', rowIndex);
    
    fieldRow.innerHTML = `
      <div class="input-group">
        <label class="input-label" for="serialNumber_${rowIndex}">
          <span class="label-text">Serial Number</span>
        </label>
        <div class="input-wrapper">
          <input 
            type="text" 
            id="serialNumber_${rowIndex}" 
            name="serialNumber[]" 
            class="input-field serial-number-input" 
            placeholder="Enter Serial Number"
            autocomplete="off"
            data-row-index="${rowIndex}"
          />
          <span class="input-underline"></span>
        </div>
      </div>
      <div class="input-group">
        <label class="input-label" for="usid_${rowIndex}">
          <span class="label-text">USID</span>
        </label>
        <div class="input-wrapper">
          <input 
            type="text" 
            id="usid_${rowIndex}" 
            name="usid[]" 
            class="input-field usid-input" 
            placeholder="Enter USID"
            autocomplete="off"
            readonly
            data-row-index="${rowIndex}"
          />
          <span class="input-underline"></span>
        </div>
      </div>
      <button type="button" class="add-btn" id="addBtn_${rowIndex}" onclick="window.glueingAPI.addFieldRow()" title="Add another row">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
    `;
    
    fieldsContainer.appendChild(fieldRow);

    // Add focus/blur handlers to new inputs
    const newInputs = fieldRow.querySelectorAll('.input-field');
    newInputs.forEach(input => {
      input.addEventListener('focus', handleInputFocus);
      input.addEventListener('blur', handleInputBlur);
    });

    // Setup serial number search for the new row
    const serialNumberInput = fieldRow.querySelector('.serial-number-input');
    const usidInput = fieldRow.querySelector('.usid-input');
    
    if (serialNumberInput && usidInput) {
      setupSerialNumberSearch(serialNumberInput, usidInput);
    }

    // Animate the new row
    setTimeout(() => {
      fieldRow.style.opacity = '1';
      fieldRow.style.transform = 'translateY(0)';
    }, 10);
  }

  /**
   * Remove a field row
   */
  function removeFieldRow(button) {
    const fieldRow = button.closest('.field-row');
    const fieldsContainer = document.getElementById('fieldsContainer');
    if (!fieldsContainer) return;
    
    const allRows = fieldsContainer.querySelectorAll('.field-row');
    
    if (allRows.length <= 1) {
      // Don't allow removing the last row
      return;
    }
    
    if (fieldRow) {
      // Animate out
      fieldRow.style.opacity = '0';
      fieldRow.style.transform = 'translateY(-10px)';
      
      setTimeout(() => {
        fieldRow.remove();
        
        // Update the last remaining row to have add button
        const remainingRows = fieldsContainer.querySelectorAll('.field-row');
        if (remainingRows.length > 0) {
          const lastRow = remainingRows[remainingRows.length - 1];
          const lastRowButton = lastRow.querySelector('button');
          if (lastRowButton) {
            lastRowButton.className = 'add-btn';
            lastRowButton.innerHTML = `
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            `;
            lastRowButton.setAttribute('onclick', 'window.glueingAPI.addFieldRow()');
            lastRowButton.setAttribute('title', 'Add another row');
          }
        }
      }, 300);
    }
  }

  /**
   * Handle input focus event
   */
  function handleInputFocus(event) {
    const input = event.target;
    const wrapper = input.closest('.input-wrapper');
    if (wrapper) {
      const underline = wrapper.querySelector('.input-underline');
      if (underline) {
        underline.classList.add('active');
      }
    }
    input.parentElement?.classList.add('focused');
  }

  /**
   * Handle input blur event
   */
  function handleInputBlur(event) {
    const input = event.target;
    const wrapper = input.closest('.input-wrapper');
    if (wrapper) {
      const underline = wrapper.querySelector('.input-underline');
      if (underline) {
        underline.classList.remove('active');
      }
    }
    input.parentElement?.classList.remove('focused');
    if (!input.value) {
      input.parentElement?.classList.remove('has-value');
    } else {
      input.parentElement?.classList.add('has-value');
    }
  }

  /**
   * Setup serial number search functionality for a row
   */
  function setupSerialNumberSearch(serialNumberInput, usidInput) {
    let lastCheckedValue = '';
    
    serialNumberInput.addEventListener('input', function(e) {
      const serialNumber = this.value.trim();
      
      // Clear USID field when serial number changes
      if (usidInput) {
        usidInput.value = '';
      }
      
      // Hide message if input is cleared
      if (serialNumber.length === 0) {
        lastCheckedValue = '';
        return;
      }
      
      // Only search when exactly 4 digits are entered
      if (/^\d{4}$/.test(serialNumber) && serialNumber !== lastCheckedValue) {
        lastCheckedValue = serialNumber;
        // Search immediately when 4 digits are entered
        searchSerialNumber(serialNumber, usidInput);
      } else if (serialNumber.length > 4) {
        // If more than 4 digits, truncate to 4
        this.value = serialNumber.substring(0, 4);
        if (this.value !== lastCheckedValue && /^\d{4}$/.test(this.value)) {
          lastCheckedValue = this.value;
          searchSerialNumber(this.value, usidInput);
        }
      }
      // If less than 4 digits, do nothing - don't search
    });
    
    // Also search on blur (when user leaves the field) if exactly 4 digits
    serialNumberInput.addEventListener('blur', function(e) {
      const serialNumber = this.value.trim();
      if (/^\d{4}$/.test(serialNumber) && serialNumber !== lastCheckedValue) {
        lastCheckedValue = serialNumber;
        searchSerialNumber(serialNumber, usidInput);
      }
    });
  }

  /**
   * Initialize Glueing form handler
   */
  function init() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
      return;
    }

    const fieldsContainer = document.getElementById('fieldsContainer');
    if (!fieldsContainer) {
      console.warn('Fields container not found');
      return;
    }

    // Add focus/blur handlers to existing inputs
    const existingInputs = fieldsContainer.querySelectorAll('.input-field');
    existingInputs.forEach(input => {
      input.addEventListener('focus', handleInputFocus);
      input.addEventListener('blur', handleInputBlur);
      input.addEventListener('input', function() {
        if (this.value) {
          this.parentElement?.classList.add('has-value');
        } else {
          this.parentElement?.classList.remove('has-value');
        }
      });
    });

    // Setup serial number search for existing rows
    const existingSerialInputs = fieldsContainer.querySelectorAll('.serial-number-input');
    existingSerialInputs.forEach(serialInput => {
      const rowIndex = serialInput.getAttribute('data-row-index');
      const usidInput = document.getElementById(`usid_${rowIndex}`);
      if (usidInput) {
        setupSerialNumberSearch(serialInput, usidInput);
      }
    });

    // Initialize form submission handler
    const form = document.getElementById('glueingForm');
    if (form) {
      form.addEventListener('submit', handleFormSubmit);
    }

    console.log('Glueing API handler initialized');
  }

  /**
   * Handle form submission
   */
  async function handleFormSubmit(event) {
    event.preventDefault();

    const form = event.target;
    const submitButton = form.querySelector('.submit-btn');
    const originalButtonText = submitButton ? submitButton.textContent : 'Submit Data';

    try {
      // Disable submit button
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Submitting...';
      }

      if (!PART_NO) {
        throw new Error('Part number not available');
      }

      // Collect all entries from the form
      const entries = [];
      const serialNumberInputs = document.querySelectorAll('.serial-number-input');
      
      serialNumberInputs.forEach(input => {
        const serialNumber = input.value?.trim();
        const rowIndex = input.getAttribute('data-row-index');
        const usidInput = document.getElementById(`usid_${rowIndex}`);
        const usid = usidInput?.value?.trim();

        // Only add entries with both serial_number and usid
        if (serialNumber && usid) {
          entries.push({
            serial_number: serialNumber,
            usid: usid
          });
        }
      });

      if (entries.length === 0) {
        throw new Error('Please enter at least one Serial Number and USID pair');
      }

      // Get user emp_id
      const empId = await getUserEmpId();
      if (!empId) {
        throw new Error('Unable to get user information. Please log in again.');
      }

      // Prepare payload
      const payload = {
        part_no: PART_NO,
        entries: entries,
        glueing: true
      };

      console.log('Glueing Payload:', payload);

      // Get CSRF token
      const csrfToken = getCookie('csrftoken');

      // Submit to API (PUT request to update existing entries)
      const response = await fetch(GLUEING_SUBMIT_URL, {
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
        throw new Error(errorData.error || errorData.message || 'Failed to submit Glueing data');
      }

      const result = await response.json();
      
      // Show success message
      let successMessage = result.message || 'Glueing data submitted successfully!';
      if (result.failed_count && result.failed_count > 0) {
        successMessage += ` (${result.failed_count} entry/entries failed)`;
      }
      
      showToast(successMessage, 'success');

      // Reset form after successful submission
      form.reset();

      // Reset all field rows to initial state (keep only first row)
      const fieldsContainer = document.getElementById('fieldsContainer');
      if (fieldsContainer) {
        const allRows = fieldsContainer.querySelectorAll('.field-row');
        // Remove all rows except the first one
        for (let i = allRows.length - 1; i > 0; i--) {
          allRows[i].remove();
        }
        
        // Reset the first row
        const firstRow = fieldsContainer.querySelector('.field-row');
        if (firstRow) {
          const firstSerialInput = firstRow.querySelector('.serial-number-input');
          const firstUsidInput = firstRow.querySelector('.usid-input');
          if (firstSerialInput) firstSerialInput.value = '';
          if (firstUsidInput) firstUsidInput.value = '';
          
          // Make sure first row has add button
          const firstButton = firstRow.querySelector('button');
          if (firstButton) {
            firstButton.className = 'add-btn';
            firstButton.innerHTML = `
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            `;
            firstButton.setAttribute('onclick', 'window.glueingAPI.addFieldRow()');
            firstButton.setAttribute('title', 'Add another row');
          }
        }
      }

      // Reset rowIndex
      rowIndex = 0;

    } catch (error) {
      console.error('Glueing form submission failed:', error);
      showToast(error.message || 'Unable to submit Glueing data. Please try again.', 'error');
    } finally {
      // Re-enable submit button
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
      }
    }
  }

  // Expose functions to global scope
  window.glueingAPI = {
    addFieldRow,
    removeFieldRow,
    handleFormSubmit,
    init
  };

  // Initialize when script loads
  init();
})();

