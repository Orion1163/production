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

    // List of all possible sections
    const sections = [
      'smd', 'leaded', 'prod_qc', 'qc', 'testing',
      'glueing', 'cleaning', 'spraying', 'dispatch'
    ];

    sections.forEach(section => {
      // Find the checkbox for this section
      const checkbox = partEntry.querySelector(
        `input[data-panel-target="${section}"]`
      );
      
      if (!checkbox) {
        config[section] = { enabled: false };
        return;
      }

      const isEnabled = checkbox.checked;
      const sectionConfig = { enabled: isEnabled };

      if (!isEnabled) {
        config[section] = sectionConfig;
        return;
      }

      // Find the detail panel for this section
      const panelId = checkbox.dataset.panelId;
      const panel = panelId ? document.getElementById(panelId) : null;

      if (!panel) {
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
        'smd': 'smd_done_by',
        'leaded': 'leaded_done_by',
        'prod_qc': 'prodqc_done_by',
        'qc': 'qc_done_by',
        'testing': 'testing_done_by',
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

      // Get checkbox fields
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

