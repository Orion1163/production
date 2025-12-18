/**
 * QC API - Handles fetching and rendering dynamic QC fields
 * Fetches custom_fields and custom_checkboxes from procedure_config
 */

(function() {
    'use strict';

    const API_BASE_URL = '/api/v2/qc-procedure-config/';
    const USID_API_URL = '/api/v2/usid-generate/';
    const QC_SUBMIT_URL = '/api/v2/qc-submit/';
    const SERIAL_STATUS_URL = '/api/v2/serial-number-status/';
    const PART_NO = window.PART_NO || '';

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
            if (type === 'error') {
                alert(message);
            }
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
     * Fetch and populate USID
     */
    async function fetchAndPopulateUSID() {
        if (!PART_NO) {
            console.error('Part number not available for USID generation');
            return;
        }

        try {
            const params = new URLSearchParams({
                part_no: PART_NO
            });

            const response = await fetch(`${USID_API_URL}?${params.toString()}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'same-origin'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const usidInput = document.getElementById('usid');
            
            if (usidInput && data.usid) {
                usidInput.value = data.usid;
            }
        } catch (error) {
            console.error('Error fetching USID:', error);
        }
    }

    /**
     * Fetch QC procedure configuration from API
     */
    async function fetchQCConfig() {
        if (!PART_NO) {
            console.error('Part number not available');
            return null;
        }

        try {
            const response = await fetch(`${API_BASE_URL}${PART_NO}/`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'same-origin'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching QC config:', error);
            return null;
        }
    }

    /**
     * Create an input field element
     */
    function createInputField(fieldConfig, index) {
        const fieldName = fieldConfig.name || `custom_field_${index}`;
        const fieldLabel = fieldConfig.label || fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const fieldType = fieldConfig.type || 'text';
        const fieldPlaceholder = fieldConfig.placeholder || `Enter ${fieldLabel}`;
        const isRequired = fieldConfig.required !== false; // Default to required

        const inputGroup = document.createElement('div');
        inputGroup.className = 'input-group';
        inputGroup.style.animationDelay = `${0.3 + (index * 0.1)}s`;

        const label = document.createElement('label');
        label.className = 'input-label';
        label.setAttribute('for', fieldName);
        
        // Icon SVG
        const iconSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        iconSvg.setAttribute('class', 'input-icon');
        iconSvg.setAttribute('fill', 'none');
        iconSvg.setAttribute('stroke', 'currentColor');
        iconSvg.setAttribute('viewBox', '0 0 24 24');
        iconSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
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
        if (isRequired) {
            input.required = true;
        }
        input.autocomplete = 'off';

        // Add icon inside input
        const inputIconSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        inputIconSvg.setAttribute('class', 'input-field-icon');
        inputIconSvg.setAttribute('fill', 'none');
        inputIconSvg.setAttribute('stroke', 'currentColor');
        inputIconSvg.setAttribute('viewBox', '0 0 24 24');
        inputIconSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
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

    /**
     * Create a checkbox field element
     */
    function createCheckboxField(checkboxConfig, index) {
        const checkboxName = checkboxConfig.name || `custom_checkbox_${index}`;
        const checkboxLabel = checkboxConfig.label || checkboxName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

        // Skip QC checkbox itself
        if (checkboxName.toLowerCase() === 'qc') {
            return null;
        }

        const checkboxGroup = document.createElement('div');
        checkboxGroup.className = 'checkbox-group';
        checkboxGroup.style.animationDelay = `${index * 0.1}s`;

        const checkboxWrapper = document.createElement('div');
        checkboxWrapper.className = 'checkbox-wrapper';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = checkboxName;
        checkbox.name = checkboxName;
        checkbox.className = 'custom-checkbox';
        checkbox.value = 'true';

        // Custom checkbox indicator
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

        // Add click handler to wrapper to toggle checkbox
        // This makes the entire wrapper clickable, not just the label
        checkboxWrapper.addEventListener('click', function(e) {
            // If clicking on the label, let it handle via 'for' attribute
            // Otherwise, toggle the checkbox manually
            if (e.target === checkboxWrapper || e.target === checkboxIndicator) {
                e.preventDefault();
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });

        // Add event listener to toggle checked class
        checkbox.addEventListener('change', function() {
            if (this.checked) {
                checkboxWrapper.classList.add('checked');
            } else {
                checkboxWrapper.classList.remove('checked');
            }
        });

        return checkboxGroup;
    }

    /**
     * Render dynamic fields to the form
     */
    function renderDynamicFields(config) {
        const formGrid = document.querySelector('#qcForm .form-grid');
        const checkboxesSection = document.querySelector('#checkboxesSection');
        const checkboxesGrid = document.querySelector('#checkboxesGrid');
        
        if (!formGrid) {
            console.error('Form grid not found');
            return;
        }

        if (!checkboxesGrid) {
            console.error('Checkboxes grid not found');
            return;
        }

        // Clear existing dynamic fields (keep the first 3 static fields)
        const existingDynamicFields = formGrid.querySelectorAll('.dynamic-field');
        existingDynamicFields.forEach(field => field.remove());
        
        // Clear existing checkboxes
        checkboxesGrid.innerHTML = '';

        if (!config || !config.enabled) {
            if (checkboxesSection) {
                checkboxesSection.style.display = 'none';
            }
            return;
        }

        const customFields = config.custom_fields || [];
        const customCheckboxes = config.custom_checkboxes || [];

        // Filter out QC checkbox
        const filteredCheckboxes = customCheckboxes.filter(cb => {
            const name = (cb.name || '').toLowerCase();
            return name !== 'qc';
        });

        // Render custom input fields
        customFields.forEach((field, index) => {
            const fieldElement = createInputField(field, index);
            fieldElement.classList.add('dynamic-field');
            formGrid.appendChild(fieldElement);
        });

        // Render custom checkboxes in separate section
        if (filteredCheckboxes.length > 0) {
            if (checkboxesSection) {
                checkboxesSection.style.display = 'block';
            }
            
            filteredCheckboxes.forEach((checkbox, index) => {
                const checkboxElement = createCheckboxField(checkbox, index);
                if (checkboxElement) {
                    checkboxesGrid.appendChild(checkboxElement);
                }
            });
        } else {
            if (checkboxesSection) {
                checkboxesSection.style.display = 'none';
            }
        }
    }

    /**
     * Initialize QC form
     */
    async function initQCForm() {
        // Fetch and populate USID first
        await fetchAndPopulateUSID();

        // Show loading state
        const formGrid = document.querySelector('#qcForm .form-grid');
        if (formGrid) {
            const loadingIndicator = document.createElement('div');
            loadingIndicator.className = 'loading-indicator';
            loadingIndicator.textContent = 'Loading QC configuration...';
            loadingIndicator.style.cssText = 'text-align: center; color: var(--text-muted, rgba(229, 231, 235, 0.8)); padding: 2rem;';
            formGrid.appendChild(loadingIndicator);
        }

        // Fetch configuration
        const config = await fetchQCConfig();

        // Remove loading indicator
        const loadingIndicator = formGrid?.querySelector('.loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.remove();
        }

        if (config) {
            renderDynamicFields(config);
        } else {
            console.warn('No QC configuration found or QC section is not enabled');
        }

        // Setup form submission handler
        setupFormSubmission();

        // Setup serial number validation
        setupSerialNumberValidation();

        // Ensure submit button is enabled initially
        const form = document.getElementById('qcForm');
        const submitButton = form ? form.querySelector('button[type="submit"]') || form.querySelector('input[type="submit"]') : null;
        if (submitButton) {
            submitButton.disabled = false;
        }
    }

    /**
     * Setup form submission handler
     */
    function setupFormSubmission() {
        const form = document.getElementById('qcForm');
        if (!form) {
            console.error('QC form not found');
            return;
        }

        form.addEventListener('submit', handleFormSubmit);
    }

    /**
     * Setup serial number validation
     * Checks serial number status when 4 digits are entered
     */
    function setupSerialNumberValidation() {
        const serialNumberInput = document.getElementById('serialNumber');
        const statusMessage = document.getElementById('serialStatusMessage');
        
        if (!serialNumberInput || !statusMessage) {
            return;
        }

        let debounceTimer = null;
        let lastCheckedValue = '';

        serialNumberInput.addEventListener('input', function() {
            const value = this.value.trim();
            
            // Clear previous timer
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }

            // Hide message if input is cleared
            if (value.length === 0) {
                statusMessage.classList.remove('show');
                statusMessage.textContent = '';
                lastCheckedValue = '';
                // Re-enable submit button when input is cleared
                const form = document.getElementById('qcForm');
                const submitButton = form ? form.querySelector('button[type="submit"]') || form.querySelector('input[type="submit"]') : null;
                if (submitButton) {
                    submitButton.disabled = false;
                }
                return;
            }

            // Check if exactly 4 digits (numbers only)
            if (/^\d{4}$/.test(value) && value !== lastCheckedValue) {
                lastCheckedValue = value;
                
                // Show loading state
                statusMessage.className = 'serial-status-message loading show';
                statusMessage.textContent = 'Checking status...';

                // Debounce API call by 500ms
                debounceTimer = setTimeout(() => {
                    checkSerialNumberStatus(value);
                }, 500);
            } else if (value.length < 4) {
                // Hide message if less than 4 digits
                statusMessage.classList.remove('show');
                statusMessage.textContent = '';
            } else if (value.length > 4) {
                // If more than 4 digits, still check but update message
                if (value !== lastCheckedValue) {
                    lastCheckedValue = value;
                    statusMessage.className = 'serial-status-message loading show';
                    statusMessage.textContent = 'Checking status...';
                    
                    debounceTimer = setTimeout(() => {
                        checkSerialNumberStatus(value);
                    }, 500);
                }
            }
        });
    }

    /**
     * Check serial number status via API
     */
    async function checkSerialNumberStatus(serialNumber) {
        const statusMessage = document.getElementById('serialStatusMessage');
        const form = document.getElementById('qcForm');
        const submitButton = form ? form.querySelector('button[type="submit"]') || form.querySelector('input[type="submit"]') : null;
        
        if (!PART_NO) {
            statusMessage.className = 'serial-status-message error show';
            statusMessage.textContent = 'Part number not available';
            // Disable submit button on error
            if (submitButton) {
                submitButton.disabled = true;
            }
            return;
        }

        try {
            const params = new URLSearchParams({
                part_no: PART_NO,
                serial_number: serialNumber
            });

            const response = await fetch(`${SERIAL_STATUS_URL}?${params.toString()}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'same-origin'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // Update status message and submit button based on response
            if (data.is_new_entry) {
                statusMessage.className = 'serial-status-message new-entry show';
                statusMessage.textContent = '✓ New entry';
                // Enable submit button for new entry
                if (submitButton) {
                    submitButton.disabled = false;
                }
            } else if (data.incomplete_sections && data.incomplete_sections.length > 0) {
                statusMessage.className = 'serial-status-message incomplete show';
                const sectionsText = data.incomplete_sections.join(', ');
                statusMessage.textContent = `⚠ Stuck at: ${sectionsText}`;
                // Disable submit button when stuck
                if (submitButton) {
                    submitButton.disabled = true;
                }
            } else {
                statusMessage.className = 'serial-status-message complete show';
                statusMessage.textContent = '✓ All sections completed';
                // Disable submit button if all sections completed (already processed)
                if (submitButton) {
                    submitButton.disabled = true;
                }
            }

        } catch (error) {
            console.error('Error checking serial number status:', error);
            statusMessage.className = 'serial-status-message error show';
            statusMessage.textContent = 'Error checking status. Please try again.';
            // Disable submit button on error
            if (submitButton) {
                submitButton.disabled = true;
            }
        }
    }

    /**
     * Handle form submission
     */
    async function handleFormSubmit(event) {
        event.preventDefault();

        if (!PART_NO) {
            showToast('Part number not found. Please refresh the page.', 'error');
            return;
        }

        const form = event.target;
        const submitButton = form.querySelector('button[type="submit"]') || form.querySelector('input[type="submit"]');
        const originalButtonText = submitButton ? submitButton.textContent || submitButton.value : 'Submit';

        // Disable submit button
        if (submitButton) {
            submitButton.disabled = true;
            if (submitButton.textContent) {
                submitButton.textContent = 'Submitting...';
            } else if (submitButton.value) {
                submitButton.value = 'Submitting...';
            }
        }

        try {
            // Get form values
            const usid = document.getElementById('usid')?.value?.trim();
            const serialNumber = document.getElementById('serialNumber')?.value?.trim();
            const incomingBatchNo = document.getElementById('incomingBatchNo')?.value?.trim();

            if (!usid) {
                throw new Error('USID is required');
            }

            if (!serialNumber) {
                throw new Error('Serial Number is required');
            }

            // Get user emp_id
            const empId = await getUserEmpId();

            // Collect custom fields (dynamic fields)
            const customFields = {};
            const customCheckboxes = {};

            // Get all input fields (excluding static ones)
            const allInputs = form.querySelectorAll('input[type="text"], input[type="number"], input[type="email"], textarea');
            allInputs.forEach(input => {
                const fieldName = input.name || input.id;
                // Skip static fields
                if (fieldName && !['usid', 'serialNumber', 'incomingBatchNo'].includes(fieldName)) {
                    const value = input.value?.trim();
                    if (value) {
                        customFields[fieldName] = value;
                    }
                }
            });

            // Get all checkboxes
            const allCheckboxes = form.querySelectorAll('input[type="checkbox"]');
            allCheckboxes.forEach(checkbox => {
                const checkboxName = checkbox.name || checkbox.id;
                if (checkboxName && checkboxName.toLowerCase() !== 'qc') {
                    customCheckboxes[checkboxName] = checkbox.checked;
                }
            });

            // Get CSRF token
            const csrfToken = getCookie('csrftoken');

            // Prepare payload
            const payload = {
                part_no: PART_NO,
                usid: usid,
                serial_number: serialNumber,
                incoming_batch_no: incomingBatchNo || '',
                qc_done_by: empId ? empId.toString() : '',
                custom_fields: customFields,
                custom_checkboxes: customCheckboxes
            };

            console.log('Payload:', payload);

            // Submit to API
            const response = await fetch(QC_SUBMIT_URL, {
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
                throw new Error(errorData.error || errorData.message || 'Failed to submit QC data');
            }

            const result = await response.json();
            showToast(result.message || 'QC data submitted successfully!', 'success');

            // Reset form after successful submission
            form.reset();

            // Clear status message
            const statusMessage = document.getElementById('serialStatusMessage');
            if (statusMessage) {
                statusMessage.classList.remove('show');
                statusMessage.textContent = '';
            }

            // Re-enable submit button after reset
            if (submitButton) {
                submitButton.disabled = false;
            }

            // Re-fetch USID for next entry
            await fetchAndPopulateUSID();

        } catch (error) {
            console.error('QC form submission failed:', error);
            showToast(error.message || 'Unable to submit QC data. Please try again.', 'error');
        } finally {
            // Re-enable submit button
            if (submitButton) {
                submitButton.disabled = false;
                if (submitButton.textContent !== undefined) {
                    submitButton.textContent = originalButtonText;
                } else if (submitButton.value !== undefined) {
                    submitButton.value = originalButtonText;
                }
            }
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initQCForm);
    } else {
        initQCForm();
    }

})();

