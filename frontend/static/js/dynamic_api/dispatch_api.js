/**
 * 🚚 Dispatch API - Handles fetching and rendering dynamic Dispatch fields
 * Fetches custom_fields and custom_checkboxes from procedure_config for all parts with dispatch enabled
 * Shows primary part first, then additional parts as cards
 */

(function() {
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
        checkboxWrapper.addEventListener('click', function(e) {
            if (e.target === checkboxWrapper || e.target === checkboxIndicator) {
                e.preventDefault();
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });

        // 🎯 Add event listener to toggle checked class
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
        
        serialNumberInput.addEventListener('input', function(e) {
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
        serialNumberInput.addEventListener('blur', function(e) {
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
     * 🎨 Create outgoing batch and serial number fields (only for primary part)
     */
    async function createOutgoingFields(partNo) {
        const outgoingSection = document.createElement('div');
        outgoingSection.className = 'outgoing-fields-section';

        // Outgoing Batch No (Dropdown)
        const batchGroup = document.createElement('div');
        batchGroup.className = 'input-group';
        const batchLabel = document.createElement('label');
        batchLabel.className = 'input-label';
        batchLabel.setAttribute('for', `outgoingBatchNo_${partNo}`);
        batchLabel.textContent = 'Outgoing Batch No';
        const batchWrapper = document.createElement('div');
        batchWrapper.className = 'input-field-wrapper';
        const batchSelect = document.createElement('select');
        batchSelect.id = `outgoingBatchNo_${partNo}`;
        batchSelect.name = 'outgoingBatchNo';
        batchSelect.className = 'input-field select-field';
        batchSelect.setAttribute('data-part-no', partNo);
        
        // Add default option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select SO Number';
        defaultOption.disabled = true;
        defaultOption.selected = true;
        batchSelect.appendChild(defaultOption);
        
        // Fetch and populate SO numbers
        const soNumbers = await fetchSONumbers(partNo);
        soNumbers.forEach(soNo => {
            const option = document.createElement('option');
            option.value = soNo;
            option.textContent = soNo;
            batchSelect.appendChild(option);
        });
        
        batchWrapper.appendChild(batchSelect);
        batchGroup.appendChild(batchLabel);
        batchGroup.appendChild(batchWrapper);

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
        submitSection.appendChild(submitButton);
        dispatchCard.appendChild(submitSection);

        container.appendChild(dispatchCard);
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

