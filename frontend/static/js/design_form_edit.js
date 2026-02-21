(() => {
  'use strict';

  // Wait for DOM and other scripts to load
  document.addEventListener('DOMContentLoaded', async () => {
    if (!window.EDIT_MODE || !window.EDIT_MODEL_NO) {
      return;
    }

    try {
      // Fetch procedure details
      const response = await fetch(`/api/v2/procedure-detail/${window.EDIT_MODEL_NO}/`);
      if (!response.ok) {
        throw new Error(`Failed to load procedure: ${response.status}`);
      }

      const data = await response.json();
      await populateFormWithData(data);
    } catch (error) {
      console.error('Error loading procedure for edit:', error);
      alert('Failed to load procedure data. Please try again.');
    }
  });

  /**
   * Populate the form with existing procedure data
   */
  async function populateFormWithData(data) {
    const { model_no, parts } = data;

    // Set model number
    const modelSelect = document.getElementById('modelNo');
    if (modelSelect) {
      // Wait for BOM API to load model options
      await waitForModelOptions(modelSelect);
      modelSelect.value = model_no;
      modelSelect.dispatchEvent(new Event('change'));
    }

    // Set form-level images/videos if they exist
    // Note: We can't set file inputs directly for security reasons,
    // but we can show previews if needed

    // Clear existing part entries
    const partEntriesContainer = document.getElementById('partEntries');
    if (!partEntriesContainer) return;

    partEntriesContainer.innerHTML = '';

    // Add part entries for each part
    for (const part of parts) {
      await addPartEntryFromData(part);
    }
  }

  /**
   * Wait for model options to be loaded by bom_api.js
   */
  function waitForModelOptions(selectElement, maxWait = 5000) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const checkInterval = setInterval(() => {
        if (selectElement.options.length > 1 || Date.now() - startTime > maxWait) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  }

  /**
   * Add a part entry and populate it with data
   */
  async function addPartEntryFromData(partData) {
    // Call the addPartEntry function from design.js
    if (typeof window.addPartEntry === 'function') {
      window.addPartEntry();
    } else if (typeof addPartEntry === 'function') {
      addPartEntry();
    } else {
      // Fallback: manually create entry
      const template = document.getElementById('partEntryTemplate');
      if (!template) return;

      const partEntriesContainer = document.getElementById('partEntries');
      const entry = template.content.cloneNode(true);
      partEntriesContainer.appendChild(entry);
    }

    // Wait a bit for the entry to be added
    await new Promise(resolve => setTimeout(resolve, 100));

    // Get the last added entry
    const partEntries = document.querySelectorAll('.part-entry');
    const lastEntry = partEntries[partEntries.length - 1];
    if (!lastEntry) return;

    const partNo = partData.part_no;
    const procedureConfig = partData.procedure_config || {};

    // Set part number
    const partSelect = lastEntry.querySelector('select[name="part_no[]"]');
    if (partSelect) {
      // Wait for part options to load
      await waitForPartOptions(partSelect);
      partSelect.value = partNo;
      partSelect.dispatchEvent(new Event('change'));
      
      // Wait for part selection handler to complete
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Set part image preview if exists
    if (partData.part_image_url) {
      const partImageInput = lastEntry.querySelector('input[name="part_image[]"]');
      const dropzoneLabel = lastEntry.querySelector('[data-dropzone-label]');
      if (dropzoneLabel) {
        dropzoneLabel.textContent = 'Image: ' + partData.part_image_url.split('/').pop();
      }
    }

    // Populate procedure configuration
    populateProcedureConfig(lastEntry, procedureConfig);
  }

  /**
   * Wait for part options to be loaded
   */
  function waitForPartOptions(selectElement, maxWait = 3000) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const checkInterval = setInterval(() => {
        if (selectElement.options.length > 1 || Date.now() - startTime > maxWait) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  }

  /**
   * Populate procedure configuration for a part entry
   */
  function populateProcedureConfig(partEntry, config) {
    // List of all possible sections
    const sections = [
      'kit', 'smd', 'smd_qc', 'pre_forming_qc', 'accessories_packing',
      'leaded', 'leaded_qc', 'prod_qc', 'qc', 'qc_images', 'programming', 'testing',
      'heat_run', 'glueing', 'cleaning', 'spraying', 'dispatch'
    ];

    sections.forEach(sectionKey => {
      const sectionData = config[sectionKey];
      if (!sectionData || !sectionData.enabled) {
        return;
      }

      // Find and check the section checkbox
      const checkbox = partEntry.querySelector(`input[data-panel-target="${sectionKey}"]`);
      if (checkbox) {
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event('change'));
        
        // Wait for panel to open
        setTimeout(() => {
          const panel = partEntry.querySelector(`[data-panel="${sectionKey}"]`);
          if (!panel) return;

          // Handle testing mode
          if (sectionKey === 'testing' && sectionData.mode) {
            const modeSelect = panel.querySelector('select[onchange*="toggleTestingMode"]');
            if (modeSelect) {
              modeSelect.value = sectionData.mode;
              modeSelect.dispatchEvent(new Event('change'));
            }
          }

          // Add custom input fields
          if (sectionData.custom_fields && sectionData.custom_fields.length > 0) {
            sectionData.custom_fields.forEach(fieldObj => {
              const fieldName = typeof fieldObj === 'string' ? fieldObj : (fieldObj.name || fieldObj.label);
              // Format field name: replace underscores with spaces and capitalize words
              const formattedFieldName = fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
              const inputList = panel.querySelector('.panel-card .input-list');
              if (inputList && typeof addInputField === 'function') {
                // Find the add button in the input panel
                const addBtn = panel.querySelector('.panel-card .pill-input-row button[onclick*="addInputField"]');
                if (addBtn) {
                  // Create field manually
                  const wrapper = document.createElement('div');
                  wrapper.className = 'dynamic-field';
                  
                  const input = document.createElement('input');
                  input.type = 'text';
                  input.value = formattedFieldName;
                  input.required = true;
                  
                  const removeBtn = document.createElement('button');
                  removeBtn.type = 'button';
                  removeBtn.className = 'tiny-btn ghost';
                  removeBtn.innerHTML = '&times;';
                  removeBtn.onclick = function() {
                    wrapper.remove();
                  };
                  
                  wrapper.appendChild(input);
                  wrapper.appendChild(removeBtn);
                  inputList.appendChild(wrapper);
                }
              }
            });
          }

          // Add custom checkboxes (filter out section titles that are automatically added)
          if (sectionData.custom_checkboxes && sectionData.custom_checkboxes.length > 0) {
            // Filter out checkboxes that match the section key (these are automatically added section titles)
            const filteredCheckboxes = sectionData.custom_checkboxes.filter(checkboxObj => {
              const checkboxName = typeof checkboxObj === 'string' 
                ? checkboxObj 
                : (checkboxObj.name || checkboxObj.label || '');
              const checkboxNameLower = checkboxName.toLowerCase().replace(/\s+/g, '_');
              const sectionKeyLower = sectionKey.toLowerCase();
              // Exclude if checkbox name matches section key exactly
              return checkboxNameLower !== sectionKeyLower;
            });
            
            filteredCheckboxes.forEach(checkboxObj => {
              const checkboxName = typeof checkboxObj === 'string' 
                ? checkboxObj 
                : (checkboxObj.name || checkboxObj.label);
              // Format checkbox name: replace underscores with spaces and capitalize words
              const formattedCheckboxName = checkboxName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
              const checkboxList = panel.querySelector('.panel-card.accent .input-list');
              if (checkboxList && typeof addCheckboxField === 'function') {
                // Find the add button in the checkbox panel
                const addBtn = panel.querySelector('.panel-card.accent .pill-input-row button[onclick*="addCheckboxField"]');
                if (addBtn) {
                  // Create checkbox manually
                  const wrapper = document.createElement('div');
                  wrapper.className = 'dynamic-field';
                  
                  const input = document.createElement('input');
                  input.type = 'text';
                  input.value = formattedCheckboxName;
                  input.required = true;
                  
                  const removeBtn = document.createElement('button');
                  removeBtn.type = 'button';
                  removeBtn.className = 'tiny-btn ghost';
                  removeBtn.innerHTML = '&times;';
                  removeBtn.onclick = function() {
                    wrapper.remove();
                  };
                  
                  wrapper.appendChild(input);
                  wrapper.appendChild(removeBtn);
                  checkboxList.appendChild(wrapper);
                }
              }
            });
          }
        }, 300);
      }
    });
  }
})();
