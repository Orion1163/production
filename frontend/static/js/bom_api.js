(() => {
  const API_URL = 'https://1.sunshineiot.in/api/v2/design/public/approved-products-bom';
  let bomData = [];
  let selectedModelNo = null;

  /**
   * Fetches BOM data from the API
   */
  const fetchBOMData = async () => {
    try {
      const response = await fetch(API_URL);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      bomData = await response.json();
      populateModelNoDropdown();
    } catch (error) {
      console.error('Error fetching BOM data:', error);
      // Show error message to user
      const modelNoSelect = document.getElementById('modelNo');
      if (modelNoSelect) {
        modelNoSelect.innerHTML = '<option value="">Error loading models. Please refresh the page.</option>';
      }
    }
  };

  /**
   * Populates the model_no dropdown with data from API
   */
  const populateModelNoDropdown = () => {
    const modelNoSelect = document.getElementById('modelNo');
    if (!modelNoSelect || !bomData.length) {
      return;
    }

    // Clear existing options except the first one
    const firstOption = modelNoSelect.querySelector('option[value=""]');
    modelNoSelect.innerHTML = '';
    if (firstOption) {
      modelNoSelect.appendChild(firstOption);
    } else {
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = 'Select Model Number';
      modelNoSelect.appendChild(defaultOption);
    }

    // Add model numbers from API
    bomData.forEach((item) => {
      const option = document.createElement('option');
      option.value = item.model_no;
      option.textContent = item.model_no;
      option.dataset.modelId = item.id;
      modelNoSelect.appendChild(option);
    });
  };

  /**
   * Gets parts for a selected model number
   */
  const getPartsForModel = (modelNo) => {
    if (!modelNo || !bomData.length) {
      return [];
    }

    const model = bomData.find((item) => item.model_no === modelNo);
    if (!model || !model.part) {
      return [];
    }

    return model.part.map((part) => part.part_model_no);
  };

  /**
   * Populates all part dropdowns with parts for the selected model
   */
  const populatePartDropdowns = (modelNo) => {
    const parts = getPartsForModel(modelNo);
    const partSelects = document.querySelectorAll('select[name="part_no[]"]');

    partSelects.forEach((select) => {
      // Save the current selected value
      const currentValue = select.value;

      // Clear existing options except the first one
      const firstOption = select.querySelector('option[value=""]');
      select.innerHTML = '';
      if (firstOption) {
        select.appendChild(firstOption);
      } else {
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select Part Number';
        select.appendChild(defaultOption);
      }

      // Add parts from API
      parts.forEach((partNo) => {
        const option = document.createElement('option');
        option.value = partNo;
        option.textContent = partNo;
        select.appendChild(option);
      });

      // Restore previous selection if it still exists
      if (currentValue && parts.includes(currentValue)) {
        select.value = currentValue;
      }
    });
  };

  /**
   * Handles model number selection change
   */
  const handleModelNoChange = (event) => {
    const modelNo = event.target.value;
    selectedModelNo = modelNo;
    populatePartDropdowns(modelNo);
  };

  /**
   * Updates part dropdown when a new part entry is added
   */
  const updateNewPartDropdown = (partSelect) => {
    if (!selectedModelNo) {
      return;
    }
    const parts = getPartsForModel(selectedModelNo);

    // Clear existing options except the first one
    const firstOption = partSelect.querySelector('option[value=""]');
    partSelect.innerHTML = '';
    if (firstOption) {
      partSelect.appendChild(firstOption);
    } else {
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = 'Select Part Number';
      partSelect.appendChild(defaultOption);
    }

    // Add parts from API
    parts.forEach((partNo) => {
      const option = document.createElement('option');
      option.value = partNo;
      option.textContent = partNo;
      partSelect.appendChild(option);
    });
  };

  /**
   * Initialize BOM API functionality
   */
  const initBOMAPI = () => {
    const modelNoSelect = document.getElementById('modelNo');

    if (!modelNoSelect) {
      return;
    }

    // Convert text input to select if it's still an input
    if (modelNoSelect.tagName === 'INPUT') {
      const parent = modelNoSelect.parentElement;
      const label = parent.querySelector('label');
      const newSelect = document.createElement('select');
      newSelect.id = 'modelNo';
      newSelect.name = 'model_no';
      newSelect.required = true;

      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = 'Loading models...';
      newSelect.appendChild(defaultOption);

      modelNoSelect.replaceWith(newSelect);
    }

    // Add change event listener
    const select = document.getElementById('modelNo');
    if (select) {
      select.addEventListener('change', handleModelNoChange);
    }

    // Fetch BOM data
    fetchBOMData();
  };

  // Expose function to update part dropdowns when new entries are added
  window.updatePartDropdown = updateNewPartDropdown;
  window.getSelectedModelNo = () => selectedModelNo;

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBOMAPI);
  } else {
    initBOMAPI();
  }
})();

