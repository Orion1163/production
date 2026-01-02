/**
 * 🚚 Dispatch API - Handles fetching and rendering dynamic Dispatch fields
 * Fetches custom_fields and custom_checkboxes from procedure_config for all parts with dispatch enabled
 * Shows primary part first, then additional parts as cards
 */

(function () {
    'use strict';

    const API_BASE_URL = '/api/v2/dispatch-procedure-config/';
    const DISPATCH_SERIAL_SEARCH_URL = '/api/v2/dispatch-serial-number-search/';
    const DISPATCH_SUBMIT_URL = '/api/v2/dispatch-submit/';
    const DISPATCH_SO_NUMBERS_URL = '/api/v2/dispatch-so-numbers/';
    const PART_NO = window.PART_NO || '';

    // 🎯 Track row indices per part
    const rowIndices = {};

    /**
     * 🍪 Get CSRF token from cookies
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
     * 🎭 Show toast notification
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
            if (type === 'error') {
                alert(message);
            }
        }
    }

    /**
     * 👤 Get user emp_id from session or window variable
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
     * 🎨 Create an input field element
     */
    function createInputField(fieldConfig, index, partNo) {
        const fieldName = fieldConfig.name || `custom_field_${index}`;
        const prefixedName = `dispatch_${fieldName}`;
        const fieldLabel = fieldConfig.label || fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const fieldType = fieldConfig.type || 'text';
        const fieldPlaceholder = fieldConfig.placeholder || `Enter ${fieldLabel}`;
        const isRequired = fieldConfig.required !== false;

        const inputGroup = document.createElement('div');
        inputGroup.className = 'input-group';
        inputGroup.style.animationDelay = `${0.3 + (index * 0.1)}s`;
        inputGroup.setAttribute('data-part-no', partNo);

        const label = document.createElement('label');
        label.className = 'input-label';
        label.setAttribute('for', `${prefixedName}_${partNo}`);

        // 🎨 Icon SVG
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
        input.id = `${prefixedName}_${partNo}`;
        input.name = prefixedName;
        input.className = 'input-field';
        input.placeholder = fieldPlaceholder;
        input.setAttribute('data-part-no', partNo);
        if (isRequired) {
            input.required = true;
        }
        input.autocomplete = 'off';

        // 🎨 Add icon inside input
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
     * ☑️ Create a checkbox field element
     */
    function createCheckboxField(checkboxConfig, index, partNo) {
        const checkboxName = checkboxConfig.name || `custom_checkbox_${index}`;
        const prefixedName = `dispatch_${checkboxName}`;
        const checkboxLabel = checkboxConfig.label || checkboxName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

        // ⏭️ Skip dispatch checkbox itself
        if (checkboxName.toLowerCase() === 'dispatch') {
            return null;
        }

        const checkboxGroup = document.createElement('div');
        checkboxGroup.className = 'checkbox-group';
        checkboxGroup.style.animationDelay = `${index * 0.1}s`;
        checkboxGroup.setAttribute('data-part-no', partNo);

        const checkboxWrapper = document.createElement('div');
        checkboxWrapper.className = 'checkbox-wrapper';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `${prefixedName}_${partNo}`;
        checkbox.name = checkboxName;
        checkbox.className = 'custom-checkbox';
        checkbox.value = 'true';
        checkbox.setAttribute('data-part-no', partNo);

        // ☑️ Custom checkbox indicator
        const checkboxIndicator = document.createElement('span');
        checkboxIndicator.className = 'custom-checkbox-indicator';

        const label = document.createElement('label');
        label.className = 'checkbox-label';
        label.setAttribute('for', `${prefixedName}_${partNo}`);
        label.appendChild(document.createTextNode(checkboxLabel));

        checkboxWrapper.appendChild(checkbox);
        checkboxWrapper.appendChild(checkboxIndicator);
        checkboxWrapper.appendChild(label);
        checkboxGroup.appendChild(checkboxWrapper);

        // 🖱️ Add click handler to wrapper to toggle checkbox
        checkboxWrapper.addEventListener('click', function (e) {
            if (e.target === checkboxWrapper || e.target === checkboxIndicator) {
                e.preventDefault();
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });

        // 🎯 Add event listener to toggle checked class
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
     * 🔍 Search for serial number and populate USID if found
     */
    async function searchSerialNumber(serialNumber, usidInput, partNo) {
        if (!partNo) {
            console.error('Part number not available');
            showToast('Part number not available', 'error');
            return;
        }

        if (!serialNumber || !serialNumber.trim()) {
            return;
        }

        try {
            const params = new URLSearchParams({
                part_no: partNo,
                serial_number: serialNumber.trim()
            });

            const response = await fetch(`${DISPATCH_SERIAL_SEARCH_URL}?${params.toString()}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'same-origin'
            });

            const data = await response.json();

            if (!response.ok) {
                const errorMessage = data.message || data.error || 'Failed to search serial number';
                showToast(errorMessage, 'error');
                if (usidInput) {
                    usidInput.value = '';
                }
                return;
            }

            // ✅ Success - populate USID field
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
     * ➕ Add a new field row with Serial Number and USID inputs
     */
    function addFieldRow(partNo) {
        if (!rowIndices[partNo]) {
            rowIndices[partNo] = 0;
        }

        const fieldsContainer = document.getElementById(`fieldsContainer_${partNo}`);
        if (!fieldsContainer) {
            console.error(`Fields container not found for part ${partNo}`);
            return;
        }

        // 🔄 Change all existing add buttons to remove buttons
        const addButtons = fieldsContainer.querySelectorAll('.add-btn');
        addButtons.forEach(btn => {
            btn.className = 'remove-btn';
            btn.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            `;
            btn.setAttribute('onclick', `window.dispatchAPI.removeFieldRow('${partNo}', this)`);
            btn.setAttribute('title', 'Remove this row');
        });

        // ➕ Create new row
        rowIndices[partNo]++;
        const rowIndex = rowIndices[partNo];

        const fieldRow = document.createElement('div');
        fieldRow.className = 'field-row';
        fieldRow.setAttribute('data-row-index', rowIndex);
        fieldRow.setAttribute('data-part-no', partNo);

        fieldRow.innerHTML = `
            <div class="input-group">
                <label class="input-label" for="serialNumber_${partNo}_${rowIndex}">
                    <span class="label-text">Serial Number</span>
                </label>
                <div class="input-wrapper">
                    <input 
                        type="text" 
                        id="serialNumber_${partNo}_${rowIndex}" 
                        name="serialNumber[]" 
                        class="input-field serial-number-input" 
                        placeholder="Enter Serial Number"
                        autocomplete="off"
                        data-row-index="${rowIndex}"
                        data-part-no="${partNo}"
                    />
                </div>
            </div>
            <div class="input-group">
                <label class="input-label" for="usid_${partNo}_${rowIndex}">
                    <span class="label-text">USID</span>
                </label>
                <div class="input-wrapper">
                    <input 
                        type="text" 
                        id="usid_${partNo}_${rowIndex}" 
                        name="usid[]" 
                        class="input-field usid-input" 
                        placeholder="Enter USID"
                        autocomplete="off"
                        readonly
                        data-row-index="${rowIndex}"
                        data-part-no="${partNo}"
                    />
                </div>
            </div>
        `;

        fieldsContainer.appendChild(fieldRow);

        // 🎯 Setup serial number search for the new row
        const serialNumberInput = fieldRow.querySelector('.serial-number-input');
        const usidInput = fieldRow.querySelector('.usid-input');

        if (serialNumberInput && usidInput) {
            setupSerialNumberSearch(serialNumberInput, usidInput, partNo);
        }

        // 🎨 Animate the new row
        setTimeout(() => {
            fieldRow.style.opacity = '1';
            fieldRow.style.transform = 'translateY(0)';
        }, 10);
    }

    /**
     * ➖ Remove a field row
     */
    function removeFieldRow(partNo, button) {
        const fieldRow = button.closest('.field-row');
        const fieldsContainer = document.getElementById(`fieldsContainer_${partNo}`);
        if (!fieldsContainer) return;

        const allRows = fieldsContainer.querySelectorAll('.field-row');

        if (allRows.length <= 1) {
            // ⚠️ Don't allow removing the last row
            return;
        }

        if (fieldRow) {
            // 🎨 Animate out
            fieldRow.style.opacity = '0';
            fieldRow.style.transform = 'translateY(-10px)';

            setTimeout(() => {
                fieldRow.remove();

                // 🔄 Update the last remaining row to have add button
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
                        lastRowButton.setAttribute('onclick', `window.dispatchAPI.addFieldRow('${partNo}')`);
                        lastRowButton.setAttribute('title', 'Add another row');
                    }
                }
            }, 300);
        }
    }

    /**
     * 🎯 Setup serial number search functionality for a row
     */
    function setupSerialNumberSearch(serialNumberInput, usidInput, partNo) {
        let lastCheckedValue = '';

        serialNumberInput.addEventListener('input', function (e) {
            const serialNumber = this.value.trim();

            // 🧹 Clear USID field when serial number changes
            if (usidInput) {
                usidInput.value = '';
            }

            // ⏭️ Hide message if input is cleared
            if (serialNumber.length === 0) {
                lastCheckedValue = '';
                return;
            }

            // 🔍 Only search when exactly 4 digits are entered
            if (/^\d{4}$/.test(serialNumber) && serialNumber !== lastCheckedValue) {
                lastCheckedValue = serialNumber;
                // 🔍 Search immediately when 4 digits are entered
                searchSerialNumber(serialNumber, usidInput, partNo);
            } else if (serialNumber.length > 4) {
                // ✂️ If more than 4 digits, truncate to 4
                this.value = serialNumber.substring(0, 4);
                if (this.value !== lastCheckedValue && /^\d{4}$/.test(this.value)) {
                    lastCheckedValue = this.value;
                    searchSerialNumber(this.value, usidInput, partNo);
                }
            }
        });

        // 🔍 Also search on blur (when user leaves the field) if exactly 4 digits
        serialNumberInput.addEventListener('blur', function (e) {
            const serialNumber = this.value.trim();
            if (/^\d{4}$/.test(serialNumber) && serialNumber !== lastCheckedValue) {
                lastCheckedValue = serialNumber;
                searchSerialNumber(serialNumber, usidInput, partNo);
            }
        });
    }

    /**
     * 🔍 Fetch SO numbers from API for the primary part
     */
    async function fetchSONumbers(partNo) {
        if (!partNo) {
            console.error('Part number not available');
            return [];
        }

        try {
            const response = await fetch(`${DISPATCH_SO_NUMBERS_URL}${partNo}/`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'same-origin'
            });

            const data = await response.json();

            if (!response.ok) {
                const errorMessage = data.message || data.error || 'Failed to fetch SO numbers';
                console.error('Error fetching SO numbers:', errorMessage);
                showToast(errorMessage, 'error');
                return [];
            }

            return data.so_numbers || [];

        } catch (error) {
            console.error('Error fetching SO numbers:', error);
            showToast('Error fetching SO numbers. Please try again.', 'error');
            return [];
        }
    }

    /**
     * 🎨 Create a custom dropdown element
     */
    function createCustomSelect(config) {
        const { id, name, placeholder, options, dataPartNo } = config;

        const wrapper = document.createElement('div');
        wrapper.className = 'custom-select-wrapper input-field-wrapper';

        // 🕵️ Hidden input to store value
        const hiddenInput = document.createElement('input');
        hiddenInput.type = 'hidden';
        hiddenInput.id = id;
        hiddenInput.name = name;
        if (dataPartNo) {
            hiddenInput.setAttribute('data-part-no', dataPartNo);
        }

        // 📦 Custom select container
        const customSelect = document.createElement('div');
        customSelect.className = 'custom-select';

        // 🎯 Trigger
        const trigger = document.createElement('div');
        trigger.className = 'custom-select-trigger placeholder';
        const span = document.createElement('span');
        span.textContent = placeholder || 'Select Option';
        trigger.appendChild(span);

        // 📋 Options container
        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'custom-options';

        options.forEach(opt => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'custom-option';
            optionDiv.textContent = opt.label;
            optionDiv.setAttribute('data-value', opt.value);

            optionDiv.addEventListener('click', (e) => {
                e.stopPropagation();
                span.textContent = opt.label;
                trigger.classList.remove('placeholder');
                hiddenInput.value = opt.value;

                optionsContainer.querySelectorAll('.custom-option').forEach(s => s.classList.remove('selected'));
                optionDiv.classList.add('selected');
                customSelect.classList.remove('open');

                hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
            });
            optionsContainer.appendChild(optionDiv);
        });

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.custom-select.open').forEach(el => {
                if (el !== customSelect) el.classList.remove('open');
            });
            customSelect.classList.toggle('open');
        });

        customSelect.appendChild(trigger);
        customSelect.appendChild(optionsContainer);
        wrapper.appendChild(hiddenInput);
        wrapper.appendChild(customSelect);

        return wrapper;
    }

    // 🌍 Close dropdowns when clicking outside
    if (!window._customSelectListenerAttached) {
        document.addEventListener('click', (e) => {
            // If click is not inside any custom-select, close all
            if (!e.target.closest('.custom-select')) {
                document.querySelectorAll('.custom-select.open').forEach(el => el.classList.remove('open'));
            }
        });
        window._customSelectListenerAttached = true;
    }

    /**
     * 🎨 Create outgoing batch and serial number fields (only for primary part)
     */
    async function createOutgoingFields(partNo) {
        const outgoingSection = document.createElement('div');
        outgoingSection.className = 'outgoing-fields-section';

        // Outgoing Batch No (Custom Dropdown)
        const batchGroup = document.createElement('div');
        batchGroup.className = 'input-group';
        const batchLabel = document.createElement('label');
        batchLabel.className = 'input-label';
        batchLabel.setAttribute('for', `outgoingBatchNo_${partNo}`);
        batchLabel.textContent = 'Outgoing Batch No';

        // Fetch and populate SO numbers
        const soNumbers = await fetchSONumbers(partNo);
        const options = soNumbers.map(so => ({ label: so, value: so }));

        const customDropdown = createCustomSelect({
            id: `outgoingBatchNo_${partNo}`,
            name: 'outgoingBatchNo',
            placeholder: 'Select SO Number',
            options: options,
            dataPartNo: partNo
        });

        batchGroup.appendChild(batchLabel);
        batchGroup.appendChild(customDropdown);

        // Outgoing Serial No
        const serialGroup = document.createElement('div');
        serialGroup.className = 'input-group';
        const serialLabel = document.createElement('label');
        serialLabel.className = 'input-label';
        serialLabel.setAttribute('for', `outgoingSerialNo_${partNo}`);
        serialLabel.textContent = 'Outgoing Serial No';
        const serialWrapper = document.createElement('div');
        serialWrapper.className = 'input-field-wrapper';
        const serialInput = document.createElement('input');
        serialInput.type = 'text';
        serialInput.id = `outgoingSerialNo_${partNo}`;
        serialInput.name = 'outgoingSerialNo';
        serialInput.className = 'input-field';
        serialInput.placeholder = 'Enter Outgoing Serial No';
        serialInput.setAttribute('data-part-no', partNo);
        serialWrapper.appendChild(serialInput);
        serialGroup.appendChild(serialLabel);
        serialGroup.appendChild(serialWrapper);

        outgoingSection.appendChild(batchGroup);
        outgoingSection.appendChild(serialGroup);

        return outgoingSection;
    }

    /**
     * 🎨 Render primary part section (first section in the card)
     */
    async function renderPrimaryPart(partData, cardElement) {
        // 🎯 Initialize row index for this part
        rowIndices[partData.part_no] = 0;

        // 🎪 Create primary part section
        const partSection = document.createElement('div');
        partSection.className = 'part-section primary-section';
        partSection.setAttribute('data-part-no', partData.part_no);

        const sectionHeader = document.createElement('div');
        sectionHeader.className = 'section-header';
        const headerTitle = document.createElement('h3');
        headerTitle.textContent = `Primary: ${partData.part_no}`;
        headerTitle.className = 'section-title';
        sectionHeader.appendChild(headerTitle);
        partSection.appendChild(sectionHeader);

        // 📝 Create form for primary part
        const form = document.createElement('form');
        form.className = 'dispatch-form';
        form.id = `dispatchForm_${partData.part_no}`;
        form.setAttribute('data-part-no', partData.part_no);

        // 🎯 Outgoing Batch No and Outgoing Serial No (only for primary)
        const outgoingFields = await createOutgoingFields(partData.part_no);
        form.appendChild(outgoingFields);

        // 🎯 Serial Number and USID Fields Container
        const fieldsContainer = document.createElement('div');
        fieldsContainer.className = 'fields-container';
        fieldsContainer.id = `fieldsContainer_${partData.part_no}`;

        // 🎨 Initial Field Row
        const initialRow = document.createElement('div');
        initialRow.className = 'field-row';
        initialRow.setAttribute('data-row-index', '0');
        initialRow.setAttribute('data-part-no', partData.part_no);
        initialRow.style.opacity = '1';
        initialRow.style.transform = 'translateY(0)';

        initialRow.innerHTML = `
            <div class="input-group">
                <label class="input-label" for="serialNumber_${partData.part_no}_0">
                    <span class="label-text">Serial Number</span>
                </label>
                <div class="input-wrapper">
                    <input 
                        type="text" 
                        id="serialNumber_${partData.part_no}_0" 
                        name="serialNumber[]" 
                        class="input-field serial-number-input" 
                        placeholder="Enter Serial Number"
                        autocomplete="off"
                        data-row-index="0"
                        data-part-no="${partData.part_no}"
                    />
                </div>
            </div>
            <div class="input-group">
                <label class="input-label" for="usid_${partData.part_no}_0">
                    <span class="label-text">USID</span>
                </label>
                <div class="input-wrapper">
                    <input 
                        type="text" 
                        id="usid_${partData.part_no}_0" 
                        name="usid[]" 
                        class="input-field usid-input" 
                        placeholder="Enter USID"
                        autocomplete="off"
                        readonly
                        data-row-index="0"
                        data-part-no="${partData.part_no}"
                    />
                </div>
            </div>
        `;

        fieldsContainer.appendChild(initialRow);
        form.appendChild(fieldsContainer);

        // 🎯 Setup serial number search for initial row
        const initialSerialInput = initialRow.querySelector('.serial-number-input');
        const initialUsidInput = initialRow.querySelector('.usid-input');
        if (initialSerialInput && initialUsidInput) {
            setupSerialNumberSearch(initialSerialInput, initialUsidInput, partData.part_no);
        }

        // 🎨 Form grid for custom input fields
        const formGrid = document.createElement('div');
        formGrid.className = 'form-grid';

        // 🎯 Render custom input fields
        const customFields = partData.custom_fields || [];
        customFields.forEach((field, index) => {
            const fieldElement = createInputField(field, index, partData.part_no);
            formGrid.appendChild(fieldElement);
        });

        if (customFields.length > 0) {
            form.appendChild(formGrid);
        }

        // ☑️ Checkboxes section
        const checkboxesSection = document.createElement('div');
        checkboxesSection.className = 'checkboxes-section';
        checkboxesSection.id = `checkboxesSection_${partData.part_no}`;

        const checkboxesGrid = document.createElement('div');
        checkboxesGrid.className = 'checkboxes-grid';
        checkboxesGrid.id = `checkboxesGrid_${partData.part_no}`;

        const customCheckboxes = partData.custom_checkboxes || [];
        const filteredCheckboxes = customCheckboxes.filter(cb => {
            const name = (cb.name || '').toLowerCase();
            return name !== 'dispatch';
        });

        if (filteredCheckboxes.length > 0) {
            filteredCheckboxes.forEach((checkbox, index) => {
                const checkboxElement = createCheckboxField(checkbox, index, partData.part_no);
                if (checkboxElement) {
                    checkboxesGrid.appendChild(checkboxElement);
                }
            });
            checkboxesSection.appendChild(checkboxesGrid);
            form.appendChild(checkboxesSection);
        }

        partSection.appendChild(form);
        cardElement.appendChild(partSection);
    }

    /**
     * 🎨 Render additional part section
     */
    function renderAdditionalPart(partData, cardElement) {
        // 🎯 Initialize row index for this part
        rowIndices[partData.part_no] = 0;

        // 🎪 Create additional part section
        const partSection = document.createElement('div');
        partSection.className = 'part-section additional-section';
        partSection.setAttribute('data-part-no', partData.part_no);

        const sectionHeader = document.createElement('div');
        sectionHeader.className = 'section-header';
        const headerTitle = document.createElement('h3');
        headerTitle.textContent = `Additional: ${partData.part_no}`;
        headerTitle.className = 'section-title';
        sectionHeader.appendChild(headerTitle);
        partSection.appendChild(sectionHeader);

        // 📝 Create form for additional part
        const form = document.createElement('form');
        form.className = 'dispatch-form';
        form.id = `dispatchForm_${partData.part_no}`;
        form.setAttribute('data-part-no', partData.part_no);

        // 🎯 Serial Number and USID Fields Container
        const fieldsContainer = document.createElement('div');
        fieldsContainer.className = 'fields-container';
        fieldsContainer.id = `fieldsContainer_${partData.part_no}`;

        // 🎨 Initial Field Row
        const initialRow = document.createElement('div');
        initialRow.className = 'field-row';
        initialRow.setAttribute('data-row-index', '0');
        initialRow.setAttribute('data-part-no', partData.part_no);
        initialRow.style.opacity = '1';
        initialRow.style.transform = 'translateY(0)';

        initialRow.innerHTML = `
            <div class="input-group">
                <label class="input-label" for="serialNumber_${partData.part_no}_0">
                    <span class="label-text">Serial Number</span>
                </label>
                <div class="input-wrapper">
                    <input 
                        type="text" 
                        id="serialNumber_${partData.part_no}_0" 
                        name="serialNumber[]" 
                        class="input-field serial-number-input" 
                        placeholder="Enter Serial Number"
                        autocomplete="off"
                        data-row-index="0"
                        data-part-no="${partData.part_no}"
                    />
                </div>
            </div>
            <div class="input-group">
                <label class="input-label" for="usid_${partData.part_no}_0">
                    <span class="label-text">USID</span>
                </label>
                <div class="input-wrapper">
                    <input 
                        type="text" 
                        id="usid_${partData.part_no}_0" 
                        name="usid[]" 
                        class="input-field usid-input" 
                        placeholder="Enter USID"
                        autocomplete="off"
                        readonly
                        data-row-index="0"
                        data-part-no="${partData.part_no}"
                    />
                </div>
            </div>
        `;

        fieldsContainer.appendChild(initialRow);
        form.appendChild(fieldsContainer);

        // 🎯 Setup serial number search for initial row
        const initialSerialInput = initialRow.querySelector('.serial-number-input');
        const initialUsidInput = initialRow.querySelector('.usid-input');
        if (initialSerialInput && initialUsidInput) {
            setupSerialNumberSearch(initialSerialInput, initialUsidInput, partData.part_no);
        }

        // 🎨 Form grid for custom input fields
        const formGrid = document.createElement('div');
        formGrid.className = 'form-grid';

        // 🎯 Render custom input fields
        const customFields = partData.custom_fields || [];
        customFields.forEach((field, index) => {
            const fieldElement = createInputField(field, index, partData.part_no);
            formGrid.appendChild(fieldElement);
        });

        if (customFields.length > 0) {
            form.appendChild(formGrid);
        }

        // ☑️ Checkboxes section
        const checkboxesSection = document.createElement('div');
        checkboxesSection.className = 'checkboxes-section';
        checkboxesSection.id = `checkboxesSection_${partData.part_no}`;

        const checkboxesGrid = document.createElement('div');
        checkboxesGrid.className = 'checkboxes-grid';
        checkboxesGrid.id = `checkboxesGrid_${partData.part_no}`;

        const customCheckboxes = partData.custom_checkboxes || [];
        const filteredCheckboxes = customCheckboxes.filter(cb => {
            const name = (cb.name || '').toLowerCase();
            return name !== 'dispatch';
        });

        if (filteredCheckboxes.length > 0) {
            filteredCheckboxes.forEach((checkbox, index) => {
                const checkboxElement = createCheckboxField(checkbox, index, partData.part_no);
                if (checkboxElement) {
                    checkboxesGrid.appendChild(checkboxElement);
                }
            });
            checkboxesSection.appendChild(checkboxesGrid);
            form.appendChild(checkboxesSection);
        }

        partSection.appendChild(form);
        cardElement.appendChild(partSection);
    }

    /**
     * 🎭 Fetch Dispatch procedure configuration from API
     */
    async function fetchDispatchConfig() {
        if (!PART_NO) {
            console.error('Part number not available');
            showToast('Part number not available', 'error');
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
            console.error('Error fetching Dispatch config:', error);
            showToast('Error fetching Dispatch configuration. Please try again.', 'error');
            return null;
        }
    }

    /**
     * 🎨 Render all dispatch parts in one card
     */
    async function renderDispatchParts(data) {
        const container = document.getElementById('dispatchContainer');
        if (!container) {
            console.error('Dispatch container not found');
            return;
        }

        // 🧹 Clear existing content
        container.innerHTML = '';

        if (!data || !data.parts || data.parts.length === 0) {
            const noPartsMsg = document.createElement('div');
            noPartsMsg.className = 'no-parts-message';
            noPartsMsg.textContent = 'No parts with Dispatch section enabled found for this model.';
            container.appendChild(noPartsMsg);
            return;
        }

        // 🎪 Create single card for all parts
        const dispatchCard = document.createElement('div');
        dispatchCard.className = 'dispatch-card';

        const cardHeader = document.createElement('div');
        cardHeader.className = 'card-header';
        const headerTitle = document.createElement('h2');
        headerTitle.textContent = 'Dispatch';
        headerTitle.className = 'card-title';
        cardHeader.appendChild(headerTitle);
        dispatchCard.appendChild(cardHeader);

        // 🎯 Render primary part first
        const primaryPart = data.parts.find(p => p.is_primary);
        if (primaryPart) {
            await renderPrimaryPart(primaryPart, dispatchCard);
        }

        // 🎪 Render additional parts
        const additionalParts = data.parts.filter(p => !p.is_primary);
        additionalParts.forEach(part => {
            renderAdditionalPart(part, dispatchCard);
        });

        // 🎯 Add submit button at the end
        const submitSection = document.createElement('div');
        submitSection.className = 'submit-section';
        const submitButton = document.createElement('button');
        submitButton.type = 'button';
        submitButton.className = 'submit-btn';
        submitButton.innerHTML = '<span>Submit All Dispatch</span>';
        submitButton.addEventListener('click', handleDispatchSubmit);
        submitSection.appendChild(submitButton);
        dispatchCard.appendChild(submitSection);

        container.appendChild(dispatchCard);
    }

    /**
     * 📦 Collect form data for a specific part
     */
    function collectPartData(partNo) {
        const form = document.getElementById(`dispatchForm_${partNo}`);
        if (!form) {
            return null;
        }

        // Collect entries (serial_number and usid)
        const entries = [];
        const fieldRows = form.querySelectorAll('.field-row');
        fieldRows.forEach(row => {
            const serialInput = row.querySelector('.serial-number-input');
            const usidInput = row.querySelector('.usid-input');
            
            if (serialInput && usidInput) {
                const serialNumber = serialInput.value.trim();
                const usid = usidInput.value.trim();
                
                if (serialNumber && usid) {
                    entries.push({
                        serial_number: serialNumber,
                        usid: usid
                    });
                }
            }
        });

        // Collect custom fields (dispatch_ prefixed fields, excluding outgoing fields)
        const customFields = {};
        const customInputs = form.querySelectorAll('input.input-field[name^="dispatch_"]');
        customInputs.forEach(input => {
            const fieldName = input.name;
            // Skip outgoing batch and serial number fields
            if (fieldName === 'outgoingBatchNo' || fieldName === 'outgoingSerialNo') {
                return;
            }
            // Remove dispatch_ prefix to get the actual field name
            const actualFieldName = fieldName.replace('dispatch_', '');
            if (input.value && input.value.trim()) {
                customFields[actualFieldName] = input.value.trim();
            }
        });

        // Collect custom checkboxes (checkboxes with name, excluding dispatch itself)
        const customCheckboxes = {};
        const checkboxes = form.querySelectorAll('input.custom-checkbox[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            const checkboxName = checkbox.name;
            // Skip dispatch checkbox itself
            if (checkboxName && checkboxName.toLowerCase() !== 'dispatch') {
                customCheckboxes[checkboxName] = checkbox.checked;
            }
        });

        return {
            part_no: partNo,
            entries: entries,
            custom_fields: customFields,
            custom_checkboxes: customCheckboxes
        };
    }

    /**
     * 🔄 Reset all dispatch forms to initial state
     */
    function resetDispatchForms() {
        const dispatchCard = document.querySelector('.dispatch-card');
        if (!dispatchCard) {
            return;
        }

        // Get all part sections (primary + additional)
        const allSections = dispatchCard.querySelectorAll('.part-section');
        
        allSections.forEach(section => {
            const partNo = section.getAttribute('data-part-no');
            if (!partNo) return;

            const form = document.getElementById(`dispatchForm_${partNo}`);
            if (!form) return;

            // Reset the form (clears all inputs)
            form.reset();

            // Clear outgoing batch no and outgoing serial no (primary part only)
            const isPrimary = section.classList.contains('primary-section');
            if (isPrimary) {
                // Clear outgoing batch no (custom select)
                const outgoingBatchNoInput = form.querySelector('input[name="outgoingBatchNo"]');
                if (outgoingBatchNoInput) {
                    outgoingBatchNoInput.value = '';
                    // Reset custom select trigger
                    const customSelect = form.querySelector('.custom-select');
                    if (customSelect) {
                        const trigger = customSelect.querySelector('.custom-select-trigger');
                        if (trigger) {
                            trigger.classList.add('placeholder');
                            const span = trigger.querySelector('span');
                            if (span) {
                                span.textContent = 'Select SO Number';
                            }
                        }
                    }
                }

                // Clear outgoing serial no
                const outgoingSerialNoInput = form.querySelector('input[name="outgoingSerialNo"]');
                if (outgoingSerialNoInput) {
                    outgoingSerialNoInput.value = '';
                }
            }

            // Reset field rows - keep only the first row, remove others
            const fieldsContainer = document.getElementById(`fieldsContainer_${partNo}`);
            if (fieldsContainer) {
                const allRows = fieldsContainer.querySelectorAll('.field-row');
                // Remove all rows except the first one
                for (let i = allRows.length - 1; i > 0; i--) {
                    allRows[i].remove();
                }

                // Reset the first row
                const firstRow = fieldsContainer.querySelector('.field-row');
                if (firstRow) {
                    const serialInput = firstRow.querySelector('.serial-number-input');
                    const usidInput = firstRow.querySelector('.usid-input');
                    if (serialInput) serialInput.value = '';
                    if (usidInput) usidInput.value = '';

                    // Change remove button back to add button if it exists
                    const button = firstRow.querySelector('button');
                    if (button && button.classList.contains('remove-btn')) {
                        button.className = 'add-btn';
                        button.innerHTML = `
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                        `;
                        button.setAttribute('onclick', `window.dispatchAPI.addFieldRow('${partNo}')`);
                        button.setAttribute('title', 'Add another row');
                    }
                }

                // Reset row index
                rowIndices[partNo] = 0;
            }

            // Clear all custom input fields
            const customInputs = form.querySelectorAll('input.input-field[name^="dispatch_"]');
            customInputs.forEach(input => {
                input.value = '';
            });

            // Uncheck all custom checkboxes
            const customCheckboxes = form.querySelectorAll('input.custom-checkbox[type="checkbox"]');
            customCheckboxes.forEach(checkbox => {
                checkbox.checked = false;
                const checkboxWrapper = checkbox.closest('.checkbox-wrapper');
                if (checkboxWrapper) {
                    checkboxWrapper.classList.remove('checked');
                }
            });
        }
    }

    /**
     * 🚀 Handle dispatch form submission
     */
    async function handleDispatchSubmit(event) {
        event.preventDefault();
        event.stopPropagation();
        
        // Find the submit button (could be clicked on button or span inside)
        let submitButton = event.target;
        if (submitButton.tagName === 'SPAN') {
            submitButton = submitButton.closest('.submit-btn');
        }
        if (!submitButton || !submitButton.classList.contains('submit-btn')) {
            submitButton = document.querySelector('.submit-btn');
        }
        if (!submitButton) return;

        // Disable submit button
        submitButton.disabled = true;
        submitButton.innerHTML = '<span>Submitting...</span>';

        try {
            // Get all part sections
            const dispatchCard = document.querySelector('.dispatch-card');
            if (!dispatchCard) {
                throw new Error('Dispatch card not found');
            }

            const primarySection = dispatchCard.querySelector('.primary-section');
            const additionalSections = dispatchCard.querySelectorAll('.additional-section');

            if (!primarySection) {
                throw new Error('Primary part section not found');
            }

            // Get primary part number
            const primaryPartNo = primarySection.getAttribute('data-part-no');
            if (!primaryPartNo) {
                throw new Error('Primary part number not found');
            }

            // Get outgoing batch no and outgoing serial no from primary part
            const primaryForm = document.getElementById(`dispatchForm_${primaryPartNo}`);
            if (!primaryForm) {
                throw new Error('Primary part form not found');
            }

            // Get outgoing batch no (from custom select hidden input)
            // The custom select creates a hidden input with name="outgoingBatchNo"
            let outgoingBatchNoInput = primaryForm.querySelector('input[name="outgoingBatchNo"]');
            // Also check by ID pattern
            if (!outgoingBatchNoInput) {
                outgoingBatchNoInput = primaryForm.querySelector(`input#outgoingBatchNo_${primaryPartNo}`);
            }
            const outgoingBatchNo = outgoingBatchNoInput ? outgoingBatchNoInput.value.trim() : '';

            // Get outgoing serial no
            let outgoingSerialNoInput = primaryForm.querySelector('input[name="outgoingSerialNo"]');
            // Also check by ID pattern
            if (!outgoingSerialNoInput) {
                outgoingSerialNoInput = primaryForm.querySelector(`input#outgoingSerialNo_${primaryPartNo}`);
            }
            const outgoingSerialNo = outgoingSerialNoInput ? outgoingSerialNoInput.value.trim() : '';

            // Validate required fields
            if (!outgoingBatchNo) {
                showToast('Please select Outgoing Batch No', 'error');
                submitButton.disabled = false;
                submitButton.innerHTML = '<span>Submit All Dispatch</span>';
                return;
            }

            if (!outgoingSerialNo) {
                showToast('Please enter Outgoing Serial No', 'error');
                submitButton.disabled = false;
                submitButton.innerHTML = '<span>Submit All Dispatch</span>';
                return;
            }

            // Collect primary part data
            const primaryPartData = collectPartData(primaryPartNo);
            if (!primaryPartData || primaryPartData.entries.length === 0) {
                showToast('Please enter at least one Serial Number and USID for the primary part', 'error');
                submitButton.disabled = false;
                submitButton.innerHTML = '<span>Submit All Dispatch</span>';
                return;
            }

            // Collect additional parts data
            const additionalPartsData = [];
            additionalSections.forEach(section => {
                const partNo = section.getAttribute('data-part-no');
                if (partNo) {
                    const partData = collectPartData(partNo);
                    if (partData && partData.entries.length > 0) {
                        additionalPartsData.push(partData);
                    }
                }
            });

            // Get user emp_id for dispatch_done_by
            const empId = await getUserEmpId();
            const dispatchDoneBy = empId ? empId.toString() : '';

            // Prepare request data
            const requestData = {
                primary_part: primaryPartData,
                outgoing_batch_no: outgoingBatchNo,
                outgoing_serial_no: outgoingSerialNo,
                dispatch_done_by: dispatchDoneBy,
                additional_parts: additionalPartsData,
                dispatch: true
            };

            console.log('Submitting dispatch data:', requestData);

            // Get CSRF token
            const csrftoken = getCookie('csrftoken');

            // Submit to API
            const response = await fetch(DISPATCH_SUBMIT_URL, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken
                },
                credentials: 'same-origin',
                body: JSON.stringify(requestData)
            });

            const data = await response.json();

            if (!response.ok) {
                const errorMessage = data.error || data.message || 'Failed to submit dispatch data';
                showToast(errorMessage, 'error');
                console.error('Dispatch submit error:', data);
                submitButton.disabled = false;
                submitButton.innerHTML = '<span>Submit All Dispatch</span>';
                return;
            }

            // Success
            showToast('Dispatch data submitted successfully!', 'success');
            console.log('Dispatch submit success:', data);

            // Show summary if available
            if (data.summary) {
                const summaryMsg = `Processed ${data.summary.total_parts_processed} part(s), linked ${data.summary.total_entries_linked} entry/entries`;
                console.log(summaryMsg);
            }

            // Reset all forms and fields
            resetDispatchForms();

            // Refresh page after a short delay to show success message
            setTimeout(() => {
                window.location.reload();
            }, 2000);

        } catch (error) {
            console.error('Error submitting dispatch data:', error);
            showToast('An error occurred while submitting dispatch data. Please try again.', 'error');
            submitButton.disabled = false;
            submitButton.innerHTML = '<span>Submit All Dispatch</span>';
        }
    }

    /**
     * 🚀 Initialize Dispatch form handler
     */
    async function init() {
        // ⏳ Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
            return;
        }

        const container = document.getElementById('dispatchContainer');
        if (!container) {
            console.warn('Dispatch container not found');
            return;
        }

        // 🎭 Fetch and render dispatch config
        const data = await fetchDispatchConfig();
        if (data) {
            await renderDispatchParts(data);
        }

        console.log('Dispatch API handler initialized');
    }

    // 🌐 Expose functions to global scope
    window.dispatchAPI = {
        addFieldRow,
        removeFieldRow,
        init
    };

    // 🚀 Initialize when script loads
    init();
})();

