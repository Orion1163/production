/**
 * Testing API - Handles serial number search, USID population, and dynamic field rendering
 * Fetches custom_fields and custom_checkboxes from procedure_config based on mode
 */

(function () {
    'use strict';

    // API endpoints
    const TESTING_SERIAL_SEARCH_URL = '/api/v2/testing-serial-number-search/';
    const TESTING_CONFIG_URL = '/api/v2/testing-procedure-config/';
    const TESTING_SUBMIT_URL = '/api/v2/testing-submit/';

    // Get part_no from window (set in base_section.html)
    const PART_NO = window.PART_NO;

    // Store current config globally for form submission
    let currentTestingConfig = null;

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
     * Show message to user using toast system
     */
    function showMessage(message, type) {
        // Check if toast system is available
        if (typeof window.showToast === 'function') {
            window.showToast(message, type === 'error' ? 'error' : 'success', { duration: 3000 });
        } else {
            // Fallback: log to console
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
    async function searchSerialNumber(serialNumber) {
        if (!PART_NO) {
            console.error('Part number not available');
            showMessage('Part number not available', 'error');
            return;
        }

        if (!serialNumber) {
            return;
        }

        try {
            const params = new URLSearchParams({
                part_no: PART_NO,
                serial_number: serialNumber
            });

            const response = await fetch(`${TESTING_SERIAL_SEARCH_URL}?${params.toString()}`, {
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
                showMessage(errorMessage, 'error');
                const usidInput = document.getElementById('usid');
                if (usidInput) {
                    usidInput.value = '';
                }
                return;
            }

            // Success - populate USID field
            const usidInput = document.getElementById('usid');
            if (data.usid && usidInput) {
                usidInput.value = data.usid;
                // Don't show success message on every keystroke, only log
                console.log('USID found and populated:', data.usid);
            } else {
                showMessage('USID not found in response', 'error');
            }

        } catch (error) {
            console.error('Error searching serial number:', error);
            showMessage('Error searching serial number. Please try again.', 'error');
            const usidInput = document.getElementById('usid');
            if (usidInput) {
                usidInput.value = '';
            }
        }
    }

    /**
     * Fetch Testing procedure configuration from API
     */
    async function fetchTestingConfig() {
        if (!PART_NO) {
            console.error('Part number not available');
            return null;
        }

        try {
            const response = await fetch(`${TESTING_CONFIG_URL}${PART_NO}/`, {
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
            console.error('Error fetching Testing config:', error);
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
        checkboxWrapper.addEventListener('click', function (e) {
            // If clicking on the label, let it handle via 'for' attribute
            // Otherwise, toggle the checkbox manually
            if (e.target === checkboxWrapper || e.target === checkboxIndicator) {
                e.preventDefault();
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });

        // Add event listener to toggle checked class
        checkbox.addEventListener('change', function () {
            if (this.checked) {
                checkboxWrapper.classList.add('checked');
            } else {
                checkboxWrapper.classList.remove('checked');
            }
        });

        return checkboxGroup;
    }

    /**
     * Render dynamic fields based on mode
     */
    function renderFieldsByMode(config) {
        const automaticContainer = document.getElementById('automaticModeContainer');
        const manualContainer = document.getElementById('manualModeContainer');
        const manualFieldsGrid = document.getElementById('manualFieldsGrid');
        const checkboxesSection = document.getElementById('checkboxesSection');
        const checkboxesGrid = document.getElementById('checkboxesGrid');

        if (!automaticContainer || !manualContainer) {
            console.error('Mode containers not found');
            return;
        }

        if (!config || !config.enabled) {
            // Hide both containers if testing is not enabled
            automaticContainer.classList.remove('active');
            manualContainer.classList.remove('active');
            return;
        }

        const mode = config.mode || 'Manual';

        // Clear existing dynamic fields
        if (manualFieldsGrid) {
            const existingFields = manualFieldsGrid.querySelectorAll('.dynamic-field');
            existingFields.forEach(field => field.remove());
        }

        if (checkboxesGrid) {
            checkboxesGrid.innerHTML = '';
        }

        if (mode === 'Automatic') {
            // Show automatic mode container, hide manual mode container
            automaticContainer.classList.add('active');
            manualContainer.classList.remove('active');

            // Set testMessage as required for automatic mode
            const testMessageField = document.getElementById('testMessage');
            if (testMessageField) {
                testMessageField.required = true;
                // Add input event listener to monitor textarea changes
                testMessageField.addEventListener('input', checkTestMessageAndUpdateSubmitButton);
            }

            // Disable submit button initially in automatic mode
            const submitButton = document.querySelector('#testingForm button[type="submit"]');
            if (submitButton) {
                submitButton.disabled = true;
            }

            // Initialize serial port controls for automatic mode
            setTimeout(() => {
                initSerialPort();
            }, 100);
        } else {
            // Show manual mode container, hide automatic mode container
            automaticContainer.classList.remove('active');
            manualContainer.classList.add('active');

            // Remove required from testMessage for manual mode (to avoid validation error when hidden)
            const testMessageField = document.getElementById('testMessage');
            if (testMessageField) {
                testMessageField.required = false;
            }

            // Disconnect serial port if connected when switching to manual mode
            if (keepReading && serialPort) {
                const toggleBtn = document.getElementById('toggleConnectBtn');
                if (toggleBtn && toggleBtn.classList.contains('connected')) {
                    toggleBtn.click();
                }
            }

            const customFields = config.custom_fields || [];
            const customCheckboxes = config.custom_checkboxes || [];

            // Render custom input fields
            if (manualFieldsGrid && customFields.length > 0) {
                customFields.forEach((field, index) => {
                    const fieldElement = createInputField(field, index);
                    fieldElement.classList.add('dynamic-field');
                    manualFieldsGrid.appendChild(fieldElement);
                });
            }

            // Render custom checkboxes (excluding "testing" checkbox in manual mode)
            // Filter out "testing" checkbox - it will be set to true automatically in background
            const visibleCheckboxes = customCheckboxes.filter(cb => {
                const checkboxName = (cb.name || '').toLowerCase();
                return checkboxName !== 'testing';
            });

            if (checkboxesGrid && visibleCheckboxes.length > 0) {
                if (checkboxesSection) {
                    checkboxesSection.style.display = 'block';
                }

                visibleCheckboxes.forEach((checkbox, index) => {
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
    }

    /**
     * Serial Port Management (for Automatic Mode only)
     */
    let serialPort = null;
    let serialReader = null;
    let keepReading = false;
    let serialPortInitialized = false;

    /**
     * Check if test message ends with "$TESTED OK$" and update submit button state
     */
    function checkTestMessageAndUpdateSubmitButton() {
        const testMessageField = document.getElementById('testMessage');
        const submitButton = document.querySelector('#testingForm button[type="submit"]');
        
        if (!testMessageField || !submitButton) {
            return;
        }

        const testMessage = testMessageField.value.trim();
        const endsWithTestedOk = testMessage.endsWith('$TESTED OK$');
        
        // Enable submit button only if message ends with "$TESTED OK$"
        submitButton.disabled = !endsWithTestedOk;
        
        if (endsWithTestedOk) {
            console.log('✅ Test message validated - Submit button enabled');
        }
    }

    /**
     * Initialize serial port connection handlers
     */
    function initSerialPort() {
        const toggleBtn = document.getElementById('toggleConnectBtn');
        const serialStatus = document.getElementById('serialStatus');
        const testMessageField = document.getElementById('testMessage');

        if (!toggleBtn || !serialStatus) {
            return;
        }

        if (serialPortInitialized) {
            return;
        }
        serialPortInitialized = true;

        if (!navigator.serial) {
            console.warn('Web Serial API is not supported in this browser');
            toggleBtn.disabled = true;
            toggleBtn.title = 'Web Serial API not supported';
            serialStatus.textContent = 'Serial API not supported';
            return;
        }

        toggleBtn.addEventListener('click', async () => {
            if (serialPort) {
                // Disconnect logic
                toggleBtn.disabled = true;
                keepReading = false;

                try {
                    if (serialReader) {
                        await serialReader.cancel();
                        // wait for the loop to exit? reader.cancel() should cause read() to return done usually
                        await serialReader.releaseLock();
                        serialReader = null;
                    }
                    if (serialPort) {
                        await serialPort.close();
                        serialPort = null;

                    if (serialStatus) {
                        serialStatus.textContent = '🔌 Disconnected from serial port';
                        serialStatus.classList.remove('connected');
                        serialStatus.classList.add('disconnected');
                    }

                    toggleBtn.classList.remove('connected');
                    toggleBtn.title = 'Connect Serial Port';
                    
                    // Disable submit button when disconnecting
                    const submitButton = document.querySelector('#testingForm button[type="submit"]');
                    if (submitButton && currentTestingConfig && currentTestingConfig.mode === 'Automatic') {
                        submitButton.disabled = true;
                    }
                    }
                } catch (err) {
                    console.error('❗ Error closing serial port:', err);
                    showMessage('Error closing serial port: ' + err.message, 'error');
                } finally {
                    toggleBtn.disabled = false;
                }
            } else {
                // Connect logic
                try {
                    // Reset reading flag just in case
                    keepReading = true; // Set to true BEFORE starting loop

                    const port = await navigator.serial.requestPort();
                    await port.open({ baudRate: 9600 });
                    serialPort = port;

                    if (serialStatus) {
                        serialStatus.textContent = '🔌 Connected to serial port...';
                        serialStatus.classList.remove('disconnected');
                        serialStatus.classList.add('connected');
                    }

                    toggleBtn.classList.add('connected');
                    toggleBtn.title = 'Disconnect Serial Port';

                    // Disable submit button when connecting (will be enabled when "$TESTED OK$" is received)
                    const submitButton = document.querySelector('#testingForm button[type="submit"]');
                    if (submitButton) {
                        submitButton.disabled = true;
                    }

                    const decoder = new TextDecoderStream();
                    const readableStreamClosed = serialPort.readable.pipeTo(decoder.writable);
                    serialReader = decoder.readable.getReader();

                    // Start reading loop
                    readSerialLoop();

                } catch (err) {
                    console.error('❗ Error connecting to serial port:', err);
                    if (err.name !== 'NotFoundError') { // Ignore if user cancelled
                        showMessage('Error connecting to serial port: ' + err.message, 'error');
                    }
                    if (serialStatus) {
                        serialStatus.textContent = 'Connection failed';
                        serialStatus.classList.remove('connected');
                        serialStatus.classList.add('disconnected');
                    }
                    serialPort = null;
                }
            }
        });

        async function readSerialLoop() {
            try {
                while (keepReading && serialPort) {
                    const { value, done } = await serialReader.read();
                    if (done) break;
                    if (value) {
                        console.log('🔄 Received:', value);
                        if (testMessageField) {
                            testMessageField.value += value;
                            testMessageField.scrollTop = testMessageField.scrollHeight;
                            // Check if message ends with "$TESTED OK$" and update submit button
                            checkTestMessageAndUpdateSubmitButton();
                        }
                    }
                }
            } catch (err) {
                console.error('Error reading from serial port:', err);
                if (serialStatus) {
                    serialStatus.textContent = 'Error reading from serial port';
                }
            } finally {
                // Reader lock release is handled in disconnect usually
            }
        }
    }

    /**
     * Initialize testing form handlers
     */
    async function initTestingForm() {
        // Show loading state
        const formGrid = document.querySelector('#testingForm .form-grid');
        if (formGrid) {
            const loadingIndicator = document.createElement('div');
            loadingIndicator.className = 'loading-indicator';
            loadingIndicator.textContent = 'Loading Testing configuration...';
            loadingIndicator.style.cssText = 'grid-column: 1 / -1; text-align: center; color: var(--text-muted, rgba(229, 231, 235, 0.8)); padding: 2rem;';
            formGrid.appendChild(loadingIndicator);
        }

        // Fetch configuration
        const config = await fetchTestingConfig();

        // Remove loading indicator
        const loadingIndicator = formGrid?.querySelector('.loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.remove();
        }

        if (config) {
            // Store config globally for form submission
            currentTestingConfig = config;
            renderFieldsByMode(config);

            // Initialize serial port if in automatic mode
            const mode = config.mode || 'Manual';
            if (mode === 'Automatic') {
                // Wait a bit for DOM to update, then initialize serial port
                setTimeout(() => {
                    initSerialPort();
                }, 100);
            } else {
                // Disconnect serial port if switching to manual mode
                if (keepReading && serialPort) {
                    const toggleBtn = document.getElementById('toggleConnectBtn');
                    if (toggleBtn && toggleBtn.classList.contains('connected')) {
                        toggleBtn.click();
                    }
                }
            }
        } else {
            console.warn('No Testing configuration found or Testing section is not enabled');
            // Default to manual mode if config not found
            currentTestingConfig = { mode: 'Manual', enabled: false };
            const manualContainer = document.getElementById('manualModeContainer');
            const automaticContainer = document.getElementById('automaticModeContainer');
            if (manualContainer) manualContainer.classList.add('active');
            if (automaticContainer) automaticContainer.classList.remove('active');
        }

        // Serial number input field
        const serialNumberInput = document.getElementById('serialNumber');
        const usidInput = document.getElementById('usid');

        let lastCheckedValue = '';

        // Setup serial number search
        if (serialNumberInput) {
            // Restrict input to numbers only
            serialNumberInput.addEventListener('input', function (e) {
                // Remove any non-digit characters
                this.value = this.value.replace(/\D/g, '');
            });

            serialNumberInput.addEventListener('input', function (e) {
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
                    searchSerialNumber(serialNumber);
                } else if (serialNumber.length > 4) {
                    // If more than 4 digits, truncate to 4
                    this.value = serialNumber.substring(0, 4);
                    if (this.value !== lastCheckedValue && /^\d{4}$/.test(this.value)) {
                        lastCheckedValue = this.value;
                        searchSerialNumber(this.value);
                    }
                }
                // If less than 4 digits, do nothing - don't search
            });

            // Also search on blur (when user leaves the field) if exactly 4 digits
            serialNumberInput.addEventListener('blur', function (e) {
                const serialNumber = this.value.trim();
                if (/^\d{4}$/.test(serialNumber) && serialNumber !== lastCheckedValue) {
                    lastCheckedValue = serialNumber;
                    searchSerialNumber(serialNumber);
                }
            });
        }

        // Setup form submission handler
        setupFormSubmission();
    }

    /**
     * Setup form submission handler
     */
    function setupFormSubmission() {
        const form = document.getElementById('testingForm');
        if (!form) {
            console.error('Testing form not found');
            return;
        }

        form.addEventListener('submit', handleFormSubmit);
    }

    /**
     * Handle form submission
     */
    async function handleFormSubmit(event) {
        event.preventDefault();

        if (!PART_NO) {
            showMessage('Part number not found. Please refresh the page.', 'error');
            return;
        }

        if (!currentTestingConfig || !currentTestingConfig.enabled) {
            showMessage('Testing configuration not available. Please refresh the page.', 'error');
            return;
        }

        // Ensure required attributes are set correctly based on mode before validation
        const mode = currentTestingConfig.mode || 'Manual';
        const testMessageField = document.getElementById('testMessage');
        if (testMessageField) {
            if (mode === 'Automatic') {
                testMessageField.required = true;
            } else {
                testMessageField.required = false;
            }
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

            if (!usid) {
                throw new Error('USID is required');
            }

            if (!serialNumber) {
                throw new Error('Serial Number is required');
            }

            // Get user emp_id
            const empId = await getUserEmpId();

            // Prepare payload based on mode (mode already declared above)
            const payload = {
                part_no: PART_NO,
                usid: usid,
                serial_number: serialNumber,
                testing_done_by: empId ? empId.toString() : '',
                mode: mode
            };

            if (mode === 'Automatic') {
                // Automatic mode: get test message
                const testMessage = document.getElementById('testMessage')?.value?.trim() || '';
                payload.test_message = testMessage;
            } else {
                // Manual mode: collect custom fields and checkboxes
                const customFields = {};
                const customCheckboxes = {};

                // Get all input fields from manual mode container (excluding static ones)
                const manualContainer = document.getElementById('manualModeContainer');
                if (manualContainer) {
                    const allInputs = manualContainer.querySelectorAll('input[type="text"], input[type="number"], input[type="email"], textarea');
                    allInputs.forEach(input => {
                        const fieldName = input.name || input.id;
                        // Skip static fields
                        if (fieldName && !['usid', 'serialNumber'].includes(fieldName)) {
                            const value = input.value?.trim();
                            if (value) {
                                customFields[fieldName] = value;
                            }
                        }
                    });

                    // Get all checkboxes (excluding "testing" checkbox which is hidden)
                    const allCheckboxes = manualContainer.querySelectorAll('input[type="checkbox"]');
                    allCheckboxes.forEach(checkbox => {
                        const checkboxName = checkbox.name || checkbox.id;
                        // Skip "testing" checkbox - it will be set to true automatically
                        if (checkboxName && checkboxName.toLowerCase() !== 'testing') {
                            customCheckboxes[checkboxName] = checkbox.checked;
                        }
                    });
                }

                // Automatically set "testing" checkbox to true in background for manual mode
                // This ensures the testing flag is set even though the checkbox is not visible
                customCheckboxes['testing'] = true;

                payload.custom_fields = customFields;
                payload.custom_checkboxes = customCheckboxes;
            }

            console.log('Testing Payload:', payload);

            // Get CSRF token
            const csrfToken = getCookie('csrftoken');

            // Submit to API (PUT request to update existing entry)
            const response = await fetch(TESTING_SUBMIT_URL, {
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
                throw new Error(errorData.error || errorData.message || 'Failed to submit Testing data');
            }

            const result = await response.json();
            showMessage(result.message || 'Testing data submitted successfully!', 'success');

            // Use mode already declared above to determine reset behavior
            if (mode === 'Automatic') {
                // In automatic mode: reset fields but keep serial port connected and continue reading
                const serialNumberInput = document.getElementById('serialNumber');
                const usidInput = document.getElementById('usid');
                const testMessageField = document.getElementById('testMessage');
                
                // Reset serial number and USID fields
                if (serialNumberInput) {
                    serialNumberInput.value = '';
                }
                if (usidInput) {
                    usidInput.value = '';
                }
                
                // Clear test message but keep textarea visible
                if (testMessageField) {
                    testMessageField.value = '';
                }
                
                // Disable submit button again (will be enabled when "$TESTED OK$" is received)
                if (submitButton) {
                    submitButton.disabled = true;
                }
                
                // Serial port should remain connected and continue reading
                // The readSerialLoop is already running and will continue
            } else {
                // In manual mode: full form reset
                form.reset();
                
                // Re-enable submit button after reset
                if (submitButton) {
                    submitButton.disabled = false;
                }
            }

        } catch (error) {
            console.error('Testing form submission failed:', error);
            showMessage(error.message || 'Unable to submit Testing data. Please try again.', 'error');
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
        document.addEventListener('DOMContentLoaded', initTestingForm);
    } else {
        initTestingForm();
    }

})();

