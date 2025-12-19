/**
 * Heat Run Dynamic Fields Handler
 * Manages dynamic addition and removal of Serial Number and USID input fields
 * Handles serial number search and USID population
 */

(() => {
  'use strict';

  const HEAT_RUN_SERIAL_SEARCH_URL = '/api/v2/heat-run-serial-number-search/';
  
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
      
      const response = await fetch(`${HEAT_RUN_SERIAL_SEARCH_URL}?${params.toString()}`, {
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
      btn.setAttribute('onclick', 'window.heatRunAPI.removeFieldRow(this)');
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
      <button type="button" class="add-btn" id="addBtn_${rowIndex}" onclick="window.heatRunAPI.addFieldRow()" title="Add another row">
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
            lastRowButton.setAttribute('onclick', 'window.heatRunAPI.addFieldRow()');
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
   * Initialize Heat Run form handler
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

    // Initialize checkbox handler
    const checkbox = document.getElementById('heatRunCheckbox');
    const customCheckbox = document.querySelector('.custom-checkbox');
    
    if (checkbox) {
      // Handle checkbox change event
      checkbox.addEventListener('change', function() {
        const checkboxWrapper = this.closest('.checkbox-wrapper');
        if (checkboxWrapper) {
          if (this.checked) {
            checkboxWrapper.classList.add('checked');
          } else {
            checkboxWrapper.classList.remove('checked');
          }
        }
      });
      
      // The checkbox input is now positioned over the custom checkbox
      // so clicking on the custom checkbox area will trigger the actual checkbox
    }

    console.log('Heat Run API handler initialized');
  }

  // Expose functions to global scope
  window.heatRunAPI = {
    addFieldRow,
    removeFieldRow,
    init
  };

  // Initialize when script loads
  init();
})();

