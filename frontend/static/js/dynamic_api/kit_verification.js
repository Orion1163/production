/**
 * Kit Verification API Integration
 * Fetches kit procedure config (custom_fields, custom_checkboxes), renders dynamic fields,
 * and submits kit verification data including custom data.
 */

(() => {
  'use strict';

  const API_BASE_URL = '/api/v2/kit-verification/';
  const KIT_CONFIG_URL = '/api/v2/kit-procedure-config/';

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

  function showToast(message, type = 'success') {
    if (typeof window.showToast === 'function') {
      window.showToast(message, type, { duration: 3000 });
    } else if (typeof showSuccess === 'function' && type === 'success') {
      showSuccess(message);
    } else if (typeof showError === 'function' && type === 'error') {
      showError(message);
    } else {
      alert(message);
    }
  }

  async function getUserEmpId() {
    if (window.USER_EMP_ID) {
      return window.USER_EMP_ID;
    }
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

  function getPartNo() {
    if (window.PART_NO) {
      return window.PART_NO;
    }
    const pathParts = window.location.pathname.split('/');
    const partIndex = pathParts.indexOf('part');
    if (partIndex !== -1 && partIndex + 1 < pathParts.length) {
      return pathParts[partIndex + 1];
    }
    return null;
  }

  async function fetchKitConfig() {
    const partNo = getPartNo();
    if (!partNo) return null;
    try {
      const response = await fetch(`${KIT_CONFIG_URL}${partNo}/`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching kit config:', error);
      return null;
    }
  }

  function createInputField(fieldConfig, index) {
    const fieldName = fieldConfig.name || `custom_field_${index}`;
    const fieldLabel = fieldConfig.label || fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const fieldType = fieldConfig.type || 'text';
    const fieldPlaceholder = fieldConfig.placeholder || `Enter ${fieldLabel}`;
    const isRequired = fieldConfig.required !== false;

    const inputGroup = document.createElement('div');
    inputGroup.className = 'input-group dynamic-field';

    const label = document.createElement('label');
    label.className = 'input-label';
    label.setAttribute('for', fieldName);
    const iconSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    iconSvg.setAttribute('class', 'input-icon');
    iconSvg.setAttribute('fill', 'none');
    iconSvg.setAttribute('stroke', 'currentColor');
    iconSvg.setAttribute('viewBox', '0 0 24 24');
    const iconPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    iconPath.setAttribute('stroke-linecap', 'round');
    iconPath.setAttribute('stroke-linejoin', 'round');
    iconPath.setAttribute('stroke-width', '2');
    iconPath.setAttribute('d', 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z');
    iconSvg.appendChild(iconPath);
    label.appendChild(iconSvg);
    label.appendChild(document.createTextNode(fieldLabel));

    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'input-field-wrapper';
    const input = document.createElement('input');
    input.type = fieldType;
    input.id = fieldName;
    input.name = fieldName;
    input.className = 'input-field';
    input.placeholder = fieldPlaceholder;
    if (isRequired) input.required = true;
    input.autocomplete = 'off';

    const inputIconSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    inputIconSvg.setAttribute('class', 'input-field-icon');
    inputIconSvg.setAttribute('fill', 'none');
    inputIconSvg.setAttribute('stroke', 'currentColor');
    inputIconSvg.setAttribute('viewBox', '0 0 24 24');
    const inputIconPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    inputIconPath.setAttribute('stroke-linecap', 'round');
    inputIconPath.setAttribute('stroke-linejoin', 'round');
    inputIconPath.setAttribute('stroke-width', '2');
    inputIconPath.setAttribute('d', 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z');
    inputIconSvg.appendChild(inputIconPath);
    inputWrapper.appendChild(input);
    inputWrapper.appendChild(inputIconSvg);
    inputGroup.appendChild(label);
    inputGroup.appendChild(inputWrapper);
    return inputGroup;
  }

  function createCheckboxField(checkboxConfig, index) {
    const checkboxName = checkboxConfig.name || `custom_checkbox_${index}`;
    const checkboxLabel = checkboxConfig.label || checkboxName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    if (checkboxName.toLowerCase() === 'kit') return null;

    const checkboxGroup = document.createElement('div');
    checkboxGroup.className = 'checkbox-group';
    const checkboxWrapper = document.createElement('div');
    checkboxWrapper.className = 'checkbox-wrapper';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = checkboxName;
    checkbox.name = checkboxName;
    checkbox.className = 'custom-checkbox';
    checkbox.value = 'true';
    const checkboxIndicator = document.createElement('span');
    checkboxIndicator.className = 'custom-checkbox-indicator';
    const label = document.createElement('label');
    label.className = 'checkbox-label';
    label.setAttribute('for', checkboxName);
    label.appendChild(document.createTextNode(checkboxLabel));
    checkboxWrapper.appendChild(checkbox);
    checkboxWrapper.appendChild(checkboxIndicator);
    checkboxWrapper.appendChild(label);
    checkboxGroup.appendChild(checkboxWrapper);

    checkboxWrapper.addEventListener('click', function(e) {
      if (e.target === checkboxWrapper || e.target === checkboxIndicator) {
        e.preventDefault();
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    checkbox.addEventListener('change', function() {
      checkboxWrapper.classList.toggle('checked', this.checked);
    });
    return checkboxGroup;
  }

  function renderDynamicFields(config) {
    const form = document.getElementById('kitVerificationForm');
    const formGrid = form ? form.querySelector('.form-grid') : null;
    const checkboxesSection = document.getElementById('checkboxesSection');
    const checkboxesGrid = document.getElementById('checkboxesGrid');

    if (!formGrid || !checkboxesGrid) return;

    formGrid.querySelectorAll('.dynamic-field').forEach(field => field.remove());
    checkboxesGrid.innerHTML = '';

    if (!config || !config.enabled) {
      if (checkboxesSection) checkboxesSection.style.display = 'none';
      return;
    }

    const customFields = config.custom_fields || [];
    const customCheckboxes = config.custom_checkboxes || [];
    const filteredCheckboxes = customCheckboxes.filter(cb => (cb.name || '').toLowerCase() !== 'kit');

    customFields.forEach((field, index) => {
      const fieldElement = createInputField(field, index);
      formGrid.appendChild(fieldElement);
    });

    if (filteredCheckboxes.length > 0) {
      if (checkboxesSection) checkboxesSection.style.display = 'block';
      filteredCheckboxes.forEach((checkbox, index) => {
        const el = createCheckboxField(checkbox, index);
        if (el) checkboxesGrid.appendChild(el);
      });
    } else {
      if (checkboxesSection) checkboxesSection.style.display = 'none';
    }
  }

  function collectFormData(form) {
    const soNoInput = document.getElementById('soNo');
    const kitNoInput = document.getElementById('kitNo');
    const kitQuantityInput = document.getElementById('kitQuantity');
    if (!soNoInput || !kitNoInput || !kitQuantityInput) {
      throw new Error('Form fields not found');
    }

    const customFields = {};
    const customCheckboxes = {};

    form.querySelectorAll('input[type="text"], input[type="number"], input[type="email"]').forEach(input => {
      const name = input.name || input.id;
      if (name && !['soNo', 'kitNo', 'kitQuantity'].includes(name)) {
        const value = input.value?.trim();
        if (value !== undefined) customFields[name] = value;
      }
    });
    form.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      const name = checkbox.name || checkbox.id;
      if (name) customCheckboxes[name] = checkbox.checked;
    });

    return {
      so_no: soNoInput.value.trim(),
      kit_no: kitNoInput.value.trim(),
      kit_quantity: parseInt(kitQuantityInput.value, 10) || 0,
      custom_fields: customFields,
      custom_checkboxes: customCheckboxes,
    };
  }

  function validateFormData(formData) {
    const errors = [];
    if (!formData.so_no || formData.so_no.trim() === '') errors.push('SO No is required');
    if (!formData.kit_no || formData.kit_no.trim() === '') errors.push('Kit No is required');
    if (!formData.kit_quantity || formData.kit_quantity <= 0 || isNaN(formData.kit_quantity)) errors.push('Kit Quantity must be a valid number greater than 0');
    return errors;
  }

  async function handleFormSubmit(event) {
    event.preventDefault();
    event.stopPropagation();
    const form = event.target;
    if (!form) return;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const kitCheckboxesSection = document.getElementById('checkboxesSection');
    const kitCheckboxes = document.querySelectorAll('#checkboxesGrid .custom-checkbox');
    if (kitCheckboxesSection && kitCheckboxesSection.style.display !== 'none' && kitCheckboxes.length > 0) {
      const allChecked = Array.prototype.every.call(kitCheckboxes, function (cb) { return cb.checked; });
      if (!allChecked) {
        showToast('Please check all required checkboxes before submitting.', 'error');
        return;
      }
    }

    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonText = submitButton ? submitButton.textContent : 'Verify Kit';

    try {
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Verifying...';
      }

      let formData;
      try {
        formData = collectFormData(form);
      } catch (error) {
        showToast(error.message, 'error');
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = originalButtonText;
        }
        return;
      }

      const validationErrors = validateFormData(formData);
      if (validationErrors.length > 0) {
        showToast(validationErrors.join(', '), 'error');
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = originalButtonText;
        }
        return;
      }

      const partNo = getPartNo();
      if (!partNo) {
        showToast('Part number not found. Please refresh the page.', 'error');
        return;
      }

      const empId = await getUserEmpId();
      if (!empId) {
        showToast('User information not found. Please login again.', 'error');
        setTimeout(() => { window.location.href = '/login/'; }, 2000);
        return;
      }

      const payload = {
        part_no: partNo,
        kit_done_by: empId.toString(),
        kit_no: formData.kit_no,
        kit_quantity: formData.kit_quantity,
        kit_verification: true,
        so_no: formData.so_no,
        custom_fields: formData.custom_fields,
        custom_checkboxes: formData.custom_checkboxes,
      };

      const csrfToken = getCookie('csrftoken');
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
        throw new Error(errorMessage);
      }

      const result = await response.json();
      showToast(result.message || 'Kit verified successfully!', 'success');
      form.reset();
      document.querySelectorAll('#checkboxesGrid .custom-checkbox').forEach(cb => {
        cb.checked = false;
        const wrapper = cb.closest('.checkbox-wrapper');
        if (wrapper) wrapper.classList.remove('checked');
      });
    } catch (error) {
      console.error('Kit verification failed:', error);
      showToast(error.message || 'Unable to verify kit. Please try again.', 'error');
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
      }
    }
  }

  async function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
      return;
    }

    const form = document.getElementById('kitVerificationForm');
    if (!form) {
      console.warn('Kit verification form not found');
      return;
    }

    const partNo = getPartNo();
    if (partNo) {
      const formGrid = form.querySelector('.form-grid');
      if (formGrid) {
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'loading-indicator';
        loadingIndicator.textContent = 'Loading kit configuration...';
        loadingIndicator.style.cssText = 'grid-column: 1 / -1; text-align: center; color: var(--text-muted, rgba(229, 231, 235, 0.8)); padding: 2rem;';
        formGrid.appendChild(loadingIndicator);
      }
      const config = await fetchKitConfig();
      const loadingIndicator = form.querySelector('.form-grid .loading-indicator');
      if (loadingIndicator) loadingIndicator.remove();
      if (config) renderDynamicFields(config);
    }

    form.addEventListener('submit', handleFormSubmit);
  }

  init();
})();
