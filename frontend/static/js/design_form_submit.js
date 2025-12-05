(() => {
  'use strict';

  const API_BASE_URL = '/api/v2/production-procedure/';

  const getCookie = (name) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  };

  const showSuccess = (message) => {
    if (typeof window.showSuccess === 'function') {
      window.showSuccess(message);
    } else {
      alert(message);
    }
  };

  const showError = (message) => {
    if (typeof window.showError === 'function') {
      window.showError(message);
    } else {
      alert(message);
    }
  };

  const showWarning = (message) => {
    if (typeof window.showWarning === 'function') {
      window.showWarning(message);
    } else {
      alert(message);
    }
  };

  const toggleSubmittingState = (isSubmitting) => {
    const form = document.querySelector('.procedure-form form');
    if (!form) return;

    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) {
      submitButton.disabled = isSubmitting;
      if (isSubmitting) {
        submitButton.textContent = 'Saving...';
      } else {
        submitButton.textContent = 'Save Procedure';
      }
    }

    // Disable all form inputs
    const inputs = form.querySelectorAll('input, select, button');
    inputs.forEach(input => {
      if (input !== submitButton) {
        input.disabled = isSubmitting;
      }
    });
  };

  const extractProcedureConfig = (partEntry) => {
    /**
     * Extract procedure configuration from a part entry.
     * Returns a JSON object with all sections and their configurations.
     */
    const config = {};

    // List of all possible sections (matching the form HTML)
    const sections = [
      'kit', 'smd', 'smd_qc', 'pre_forming_qc', 'accessories_packing',
      'leaded_qc', 'prod_qc', 'qc', 'testing',
      'heat_run', 'glueing', 'cleaning', 'spraying', 'dispatch'
    ];

    // Debug: Log all available checkboxes in the part entry
    const allCheckboxesInEntry = partEntry.querySelectorAll('input[type="checkbox"][data-panel-target]');
    const availableSections = Array.from(allCheckboxesInEntry).map(chk => ({
      section: chk.getAttribute('data-panel-target'),
      checked: chk.checked,
      element: chk
    }));
    console.log('🔍 All checkboxes found in part entry:', availableSections);
    console.log(`📊 Total checkboxes found: ${availableSections.length}, Expected sections: ${sections.length}`);

    sections.forEach(section => {
      // Find the checkbox for this section - use the most reliable method first
      let checkbox = null;
      
      // Most reliable: Search ALL checkboxes in part entry and match by data-panel-target attribute
      // This works regardless of DOM structure
      const allCheckboxes = partEntry.querySelectorAll('input[type="checkbox"]');
      for (const chk of allCheckboxes) {
        const panelTarget = chk.getAttribute('data-panel-target');
        if (panelTarget === section) {
          checkbox = chk;
          break;
        }
      }
      
      // Fallback: Try querySelector (should work but sometimes fails with complex selectors)
      if (!checkbox) {
        checkbox = partEntry.querySelector(`input[data-panel-target="${section}"]`);
      }
      
      // If still not found, try searching within workflow structure
      if (!checkbox) {
        const workflowBuilder = partEntry.querySelector('.workflow-builder');
        if (workflowBuilder) {
          const workflowCheckboxes = workflowBuilder.querySelectorAll('input[type="checkbox"]');
          for (const chk of workflowCheckboxes) {
            if (chk.getAttribute('data-panel-target') === section) {
              checkbox = chk;
              break;
            }
          }
        }
      }
      
      // Last resort: Find by matching panel and then finding checkbox in same workflow-item
      if (!checkbox) {
        const workflowItems = partEntry.querySelectorAll('.workflow-item');
        for (const item of workflowItems) {
          const panel = item.querySelector(`.detail-panel[data-panel="${section}"]`);
          if (panel) {
            const chk = item.querySelector(`input[data-panel-target="${section}"]`);
            if (chk) {
              checkbox = chk;
              break;
            }
          }
        }
      }
      
      if (!checkbox) {
        console.warn(`❌ Checkbox not found for section: ${section}`);
        // Debug: Show all available checkboxes
        const allAvailable = partEntry.querySelectorAll('input[type="checkbox"][data-panel-target]');
        const availableSections = Array.from(allAvailable).map(chk => ({
          section: chk.getAttribute('data-panel-target'),
          checked: chk.checked
        }));
        console.warn(`Available checkboxes:`, availableSections);
        // Still add to config as disabled so it's in the output
        config[section] = { enabled: false };
        return;
      }

      // Get checkbox checked state
      const isEnabled = checkbox.checked === true;
      const sectionConfig = { enabled: isEnabled };
      
      // Debug logging
      console.log(`Section ${section}: checkbox found, checked=${isEnabled}`);

      if (!isEnabled) {
        config[section] = sectionConfig;
        return;
      }

      // Find the detail panel for this section
      // Try multiple methods to find the panel
      let panel = null;
      
      // Method 1: Try using panelId from checkbox dataset
      const panelId = checkbox.dataset.panelId;
      if (panelId) {
        panel = document.getElementById(panelId);
      }
      
      // Method 2: If not found, try finding by data-panel attribute directly within the part entry
      if (!panel) {
        panel = partEntry.querySelector(`.detail-panel[data-panel="${section}"]`);
      }
      
      // Method 3: If still not found, try finding by traversing from checkbox
      if (!panel) {
        const workflowItem = checkbox.closest('.workflow-item');
        if (workflowItem) {
          panel = workflowItem.querySelector(`.detail-panel[data-panel="${section}"]`);
        }
      }

      // If panel still not found, still mark as enabled but log warning
      if (!panel) {
        console.warn(`Panel not found for section: ${section}, but checkbox is checked. Marking as enabled without fields.`);
        config[section] = sectionConfig;
        return;
      }

      // Extract default fields from token-list (only names)
      const defaultFields = [];
      const tokenList = panel.querySelector('.token-list');
      if (tokenList) {
        tokenList.querySelectorAll('.token').forEach(token => {
          const fieldName = token.textContent.trim();
          if (fieldName) {
            defaultFields.push(fieldName.toLowerCase().replace(/\s+/g, '_'));
          }
        });
      }
      
      // Add section-specific "_done_by" field to default fields
      const doneByFieldMap = {
        'kit': 'kit_done_by',
        'smd': 'smd_done_by',
        'smd_qc': 'smd_qc_done_by',
        'pre_forming_qc': 'pre_forming_qc_done_by',
        'accessories_packing': 'accessories_packing_done_by',
        'leaded_qc': 'leaded_qc_done_by',
        'prod_qc': 'prodqc_done_by',
        'qc': 'qc_done_by',
        'testing': 'testing_done_by',
        'heat_run': 'heat_run_done_by',
        'glueing': 'glueing_done_by',
        'cleaning': 'cleaning_done_by',
        'spraying': 'spraying_done_by',
        'dispatch': 'dispatch_done_by'
      };
      
      if (doneByFieldMap[section] && !defaultFields.includes(doneByFieldMap[section])) {
        defaultFields.push(doneByFieldMap[section]);
      }

      // Extract custom checkboxes only (no custom fields in the desired structure)
      const customCheckboxes = [];

      // Automatically add section checkbox as a default field when section is enabled
      // This creates a checkbox field in the dynamic table with the section name as label
      if (isEnabled) {
        // Map section names to display labels
        const sectionLabelMap = {
          'kit': 'Kit Verification',
          'smd': 'SMD',
          'smd_qc': 'SMD QC',
          'pre_forming_qc': 'Pre-Forming QC',
          'accessories_packing': 'Accessories Packing',
          'leaded_qc': 'Leaded QC',
          'prod_qc': 'Production QC',
          'qc': 'QC',
          'testing': 'Testing',
          'heat_run': 'Heat Run',
          'glueing': 'Glueing',
          'cleaning': 'Cleaning',
          'spraying': 'Spraying',
          'dispatch': 'Dispatch'
        };
        
        // Use section name as label (capitalized)
        const checkboxLabel = sectionLabelMap[section] || section.charAt(0).toUpperCase() + section.slice(1);
        
        // Automatically add section checkbox to custom checkboxes (will be created as BooleanField in dynamic table)
        customCheckboxes.push({
          name: section.toLowerCase().replace(/\s+/g, '_'),
          label: checkboxLabel
        });
      }

      // Get checkbox fields from the accent panel (custom checkboxes added by user)
      const checkboxList = panel.querySelectorAll('.panel-card.accent .input-list');
      checkboxList.forEach(list => {
        list.querySelectorAll('.dynamic-field input[type="text"]').forEach(input => {
          if (input.value.trim()) {
            customCheckboxes.push({
              name: input.value.trim().toLowerCase().replace(/\s+/g, '_'),
              label: input.value.trim()
            });
          }
        });
      });

      // Add default fields (just array of names)
      if (defaultFields.length > 0) {
        sectionConfig.default_fields = defaultFields;
      }

      // Add custom checkboxes if any
      if (customCheckboxes.length > 0) {
        sectionConfig.custom_checkboxes = customCheckboxes;
      }

      // Special handling for testing section
      if (section === 'testing') {
        const modeSelect = panel.querySelector('select[onchange*="toggleTestingMode"]');
        if (modeSelect && modeSelect.value) {
          sectionConfig.mode = modeSelect.value;
          
          // For automatic mode, don't include custom checkboxes
          if (modeSelect.value === 'automatic') {
            delete sectionConfig.custom_checkboxes;
          }
          // For manual mode, custom checkboxes are already extracted above
        }
      }

      config[section] = sectionConfig;
    });

    // Ensure ALL sections are in the config (even if not found, mark as disabled)
    sections.forEach(section => {
      if (!(section in config)) {
        console.warn(`⚠️ Section ${section} was not processed, adding as disabled`);
        config[section] = { enabled: false };
      }
    });

    // Debug: Log the extracted config
    console.log('📋 Extracted procedure config:', JSON.stringify(config, null, 2));
    const enabledSections = Object.keys(config).filter(s => config[s].enabled);
    console.log('✅ Enabled sections:', enabledSections);
    const disabledSections = Object.keys(config).filter(s => !config[s].enabled);
    console.log('❌ Disabled sections:', disabledSections);

    return config;
  };

  const collectFormData = () => {
    /**
     * Collect all form data and build the payload.
     */
    const form = document.querySelector('.procedure-form form');
    if (!form) {
      throw new Error('Form not found');
    }

    // Get model number
    const modelNoSelect = form.querySelector('#modelNo');
    const modelNo = modelNoSelect ? modelNoSelect.value : '';
    
    if (!modelNo) {
      throw new Error('Model number is required');
    }

    // Create FormData for file uploads
    const formData = new FormData();
    formData.append('model_no', modelNo);

    // Add form-level files
    const formImageInput = form.querySelector('#formImage');
    if (formImageInput && formImageInput.files.length > 0) {
      formData.append('form_image', formImageInput.files[0]);
    }

    const qcVideoInput = form.querySelector('#qcVideo');
    if (qcVideoInput && qcVideoInput.files.length > 0) {
      formData.append('qc_video', qcVideoInput.files[0]);
    }

    const testingVideoInput = form.querySelector('#testingVideo');
    if (testingVideoInput && testingVideoInput.files.length > 0) {
      formData.append('testing_video', testingVideoInput.files[0]);
    }

    // Collect parts data
    const partEntries = form.querySelectorAll('.part-entry');
    if (partEntries.length === 0) {
      throw new Error('At least one part is required');
    }

    const parts = [];
    partEntries.forEach((entry, index) => {
      const partNoSelect = entry.querySelector('select[name="part_no[]"]');
      const partNo = partNoSelect ? partNoSelect.value : '';

      if (!partNo) {
        // Skip empty parts
        return;
      }

      // Extract procedure configuration
      const procedureConfig = extractProcedureConfig(entry);

      // Build part data
      const partData = {
        part_no: partNo,
        procedure_config: procedureConfig
      };

      // Add part image if exists
      const partImageInput = entry.querySelector('[data-part-image-input]');
      if (partImageInput && partImageInput.files.length > 0) {
        // Append image with index for reference
        formData.append(`part_image_${index}`, partImageInput.files[0]);
        partData.part_image_index = index;
      }

      parts.push(partData);
    });

    if (parts.length === 0) {
      throw new Error('At least one valid part is required');
    }

    // Add parts as JSON
    formData.append('parts', JSON.stringify(parts));

    return formData;
  };

  const handleFormSubmit = async (event) => {
    event.preventDefault();

    const form = event.target;
    if (!form) return;

    // Validate form
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    let formData;
    try {
      formData = collectFormData();
    } catch (error) {
      showError(error.message);
      return;
    }

    const csrfToken = getCookie('csrftoken') || formData.get('csrfmiddlewaretoken');

    try {
      toggleSubmittingState(true);

      const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: {
          'X-CSRFToken': csrfToken || '',
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || errorData.message || 'Failed to save procedure';
        throw new Error(errorMessage);
      }

      const result = await response.json();
      
      showSuccess(result.message || 'Procedure saved successfully!');

      // Redirect after success
      setTimeout(() => {
        window.location.href = '/production-procedure/';
      }, 1500);

    } catch (error) {
      console.error('Failed to save procedure:', error);
      showError(error.message || 'Unable to save procedure. Please try again.');
    } finally {
      toggleSubmittingState(false);
    }
  };

  // Initialize form submission handler
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('.procedure-form form');
    if (form) {
      form.addEventListener('submit', handleFormSubmit);
    }
  });
})();

