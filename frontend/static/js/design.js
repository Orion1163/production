(() => {
  const partEntries = document.getElementById('partEntries');
  const template = document.getElementById('partEntryTemplate');
  let partCounter = 0;

  const generateId = (prefix) => `${prefix}-${Date.now()}-${partCounter++}`;

  const mapPanels = (entry, entryId) => {
    const panelMap = {};
    entry.querySelectorAll('.detail-panel').forEach((panel) => {
      const key = panel.dataset.panel;
      if (!key) {
        return;
      }
      const uniqueId = `${key}-${entryId}`;
      panelMap[key] = uniqueId;
      panel.id = uniqueId;
      panel.style.display = 'none';
    });

    entry.querySelectorAll('input[data-panel-target]').forEach((input) => {
      const target = input.dataset.panelTarget;
      if (panelMap[target]) {
        input.dataset.panelId = panelMap[target];
      }
    });
  };

  const createDynamicField = (button, placeholder) => {
    const panelCard = button.closest('.panel-card');
    if (!panelCard) {
      return;
    }
    const list = panelCard.querySelector('.input-list');
    if (!list) {
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'dynamic-field';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = placeholder;
    input.required = true;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'tiny-btn ghost';
    removeBtn.innerHTML = '&times;';
    removeBtn.addEventListener('click', () => wrapper.remove());

    wrapper.append(input, removeBtn);
    list.appendChild(wrapper);
  };

  // const updateDispatchAvailability = () => {
  //   if (!partEntries) {
  //     return;
  //   }
  //   const entries = Array.from(partEntries.querySelectorAll('.part-entry'));
  //   entries.forEach((entry, index) => {
  //     const dispatchItem = entry.querySelector('[data-dispatch-item]');
  //     const dispatchPanel = entry.querySelector('[data-dispatch-panel]');
  //     if (!dispatchItem || !dispatchPanel) {
  //       return;
  //     }
  //     const dispatchCheckbox = dispatchItem.querySelector('input[type="checkbox"]');
  //     const isPrimary = index === 0;
  //     dispatchItem.style.display = isPrimary ? '' : 'none';
  //     if (dispatchCheckbox) {
  //       dispatchCheckbox.disabled = !isPrimary;
  //       if (!isPrimary && dispatchCheckbox.checked) {
  //         dispatchCheckbox.checked = false;
  //       }
  //     }
  //     dispatchPanel.style.display =
  //       isPrimary && dispatchCheckbox && dispatchCheckbox.checked ? 'block' : 'none';
  //   });
  // };

  const addPartEntry = () => {
    if (!template || !partEntries) {
      return;
    }
    const entryId = generateId('part');
    const fragment = template.content.cloneNode(true);
    const entry = fragment.querySelector('.part-entry');

    mapPanels(entry, entryId);
    partEntries.appendChild(fragment);

    // Initialize part image handler for the new entry
    const newEntry = partEntries.lastElementChild;

    // Update part dropdown if model is selected
    if (typeof window.updatePartDropdown === 'function') {
      const partSelect = newEntry?.querySelector('select[name="part_no[]"]');
      if (partSelect) {
        window.updatePartDropdown(partSelect);
        // Initialize custom select
        if (typeof window.initCustomSelect === 'function') {
          window.initCustomSelect(partSelect);
        }
      }
    }


    const partImageInput = newEntry?.querySelector('[data-part-image-input]');
    if (partImageInput) {
      const dropzone = partImageInput.closest('[data-dropzone]');
      if (dropzone) {
        const label = dropzone.querySelector('[data-dropzone-label]');
        const defaultLabel = label?.textContent ?? '';

        const activate = (event) => {
          event.preventDefault();
          event.stopPropagation();
          dropzone.classList.add('is-dragover');
        };

        const deactivate = (event) => {
          event.preventDefault();
          event.stopPropagation();
          dropzone.classList.remove('is-dragover');
        };

        partImageInput.addEventListener('change', () => {
          handlePartImageChange(partImageInput);
          dropzone.classList.remove('is-dragover');
        });

        dropzone.addEventListener('dragenter', activate);
        dropzone.addEventListener('dragover', (event) => {
          activate(event);
          if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'copy';
          }
        });
        dropzone.addEventListener('dragleave', deactivate);
        dropzone.addEventListener('dragend', deactivate);

        dropzone.addEventListener('drop', (event) => {
          deactivate(event);
          const { dataTransfer } = event;
          if (!dataTransfer || !dataTransfer.files || !dataTransfer.files.length) {
            return;
          }

          const dt = new DataTransfer();
          Array.from(dataTransfer.files).forEach((file) => dt.items.add(file));
          partImageInput.files = dt.files;
          partImageInput.dispatchEvent(new Event('change', { bubbles: true }));
        });
      }
    }

    // updateDispatchAvailability();
  };

  const removePart = (button) => {
    const entry = button.closest('.part-entry');
    if (entry && partEntries) {
      partEntries.removeChild(entry);
      updateDispatchAvailability();
    }
  };

  const togglePanel = (checkbox) => {
    const panelId = checkbox.dataset.panelId;
    if (!panelId) {
      return;
    }
    const panel = document.getElementById(panelId);
    if (!panel) {
      return;
    }
    panel.style.display = checkbox.checked ? 'block' : 'none';
  };

  const toggleTestingMode = (select) => {
    const panel = select.closest('.detail-panel');
    if (!panel) {
      return;
    }
    const manualSection = panel.querySelector('.manual-only');
    if (!manualSection) {
      return;
    }
    manualSection.style.display = select.value === 'Manual' ? 'block' : 'none';
  };

  const addInputField = (button) => {
    createDynamicField(button, 'Enter field label');
  };

  const addCheckboxField = (button) => {
    createDynamicField(button, 'Enter checkbox label');
  };

  const resetWorkflow = (entry) => {
    entry.querySelectorAll('.workflow-card input[type="checkbox"]').forEach((checkbox) => {
      checkbox.checked = false;
      togglePanel(checkbox);
    });
    entry.querySelectorAll('.manual-only').forEach((section) => {
      section.style.display = 'none';
    });
  };

  const handlePartSelection = (select) => {
    const entry = select.closest('.part-entry');
    if (!entry) {
      return;
    }
    const builder = entry.querySelector('.workflow-builder');
    if (!builder) {
      return;
    }
    if (select.value) {
      builder.classList.add('is-active');
    } else {
      builder.classList.remove('is-active');
      resetWorkflow(entry);
    }
  };

  const handlePartImageChange = (input) => {
    const entry = input.closest('.part-entry');
    if (!entry) return;

    const preview = entry.querySelector('[data-part-image-preview]');
    const fileName = entry.querySelector('[data-part-image-name]');
    const label = entry.querySelector('[data-dropzone-label]');

    if (!preview || !fileName) return;

    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      fileName.textContent = file.name;
      preview.style.display = 'flex';
      if (label) {
        label.textContent = 'Choose image';
      }
    } else {
      preview.style.display = 'none';
      fileName.textContent = '';
    }
  };

  const cancelPartImage = (button) => {
    const entry = button.closest('.part-entry');
    if (!entry) return;

    const input = entry.querySelector('[data-part-image-input]');
    const preview = entry.querySelector('[data-part-image-preview]');
    const fileName = entry.querySelector('[data-part-image-name]');

    if (input) {
      input.value = '';
      if (preview) {
        preview.style.display = 'none';
      }
      if (fileName) {
        fileName.textContent = '';
      }
    }
  };

  const initDropzones = () => {
    const dropzones = document.querySelectorAll('[data-dropzone]');
    if (!dropzones.length) {
      return;
    }

    dropzones.forEach((zone) => {
      const input = zone.querySelector('input[type="file"]');
      const label = zone.querySelector('[data-dropzone-label]');
      const defaultLabel = label?.textContent ?? '';

      const setLabel = (text) => {
        if (label) {
          label.textContent = text || defaultLabel;
        }
      };

      const activate = (event) => {
        event.preventDefault();
        event.stopPropagation();
        zone.classList.add('is-dragover');
      };

      const deactivate = (event) => {
        event.preventDefault();
        event.stopPropagation();
        zone.classList.remove('is-dragover');
      };

      const handleFiles = (files) => {
        if (!files || !files.length) {
          setLabel(defaultLabel);
          return;
        }
        const names = Array.from(files)
          .map((file) => file.name)
          .join(', ');
        setLabel(names);
      };

      if (input) {
        // Handle part image inputs separately
        if (input.hasAttribute('data-part-image-input')) {
          input.addEventListener('change', () => {
            handlePartImageChange(input);
            zone.classList.remove('is-dragover');
          });
        } else {
          input.addEventListener('change', () => {
            handleFiles(input.files);
            zone.classList.remove('is-dragover');
          });
        }
      }

      zone.addEventListener('dragenter', activate);
      zone.addEventListener('dragover', (event) => {
        activate(event);
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = 'copy';
        }
      });
      zone.addEventListener('dragleave', deactivate);
      zone.addEventListener('dragend', deactivate);

      zone.addEventListener('drop', (event) => {
        deactivate(event);
        const { dataTransfer } = event;
        if (!dataTransfer || !dataTransfer.files || !dataTransfer.files.length || !input) {
          return;
        }

        const dt = new DataTransfer();
        Array.from(dataTransfer.files).forEach((file) => dt.items.add(file));
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
  };

  window.addPartEntry = addPartEntry;
  window.removePart = removePart;
  /* 🎨 Custom Dropdown Logic with MutationObserver for Dynamic updates */
  class CustomSelect {
    constructor(nativeSelect) {
      if (nativeSelect.dataset.customized === 'true') return;

      this.nativeSelect = nativeSelect;
      this.nativeSelect.dataset.customized = 'true';
      this.wrapper = null;
      this.customSelect = null;
      this.trigger = null;
      this.optionsContainer = null;

      this.init();
    }

    init() {
      // 1. Create UI Structure
      this.createStructure();

      // 2. Initial sync
      this.syncOptions();
      this.syncSelection();

      // 3. Setup Listeners
      this.setupListeners();

      // 4. Setup Observer for dynamic option changes (e.g. from API)
      this.setupObserver();
    }

    createStructure() {
      // Create wrapper
      this.wrapper = document.createElement('div');
      this.wrapper.className = 'custom-select-wrapper';

      // Insert wrapper before select
      this.nativeSelect.parentNode.insertBefore(this.wrapper, this.nativeSelect);
      this.wrapper.appendChild(this.nativeSelect); // Move native select inside wrapper

      // Create Interface
      this.customSelect = document.createElement('div');
      this.customSelect.className = 'custom-select';

      this.trigger = document.createElement('div');
      this.trigger.className = 'custom-select-trigger';
      const span = document.createElement('span');
      this.trigger.appendChild(span);

      this.optionsContainer = document.createElement('div');
      this.optionsContainer.className = 'custom-options';

      this.customSelect.appendChild(this.trigger);
      this.customSelect.appendChild(this.optionsContainer);
      this.wrapper.appendChild(this.customSelect);
    }

    syncOptions() {
      this.optionsContainer.innerHTML = '';
      const options = Array.from(this.nativeSelect.options);

      options.forEach(opt => {
        // Skip hidden placeholders if desired, or style them
        const optionDiv = document.createElement('div');
        optionDiv.className = 'custom-option';
        optionDiv.textContent = opt.textContent;
        optionDiv.dataset.value = opt.value;

        if (opt.selected) optionDiv.classList.add('selected');
        if (opt.disabled) optionDiv.classList.add('disabled');

        if (!opt.disabled) {
          optionDiv.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleOptionClick(opt.value);
          });
        }

        this.optionsContainer.appendChild(optionDiv);
      });
    }

    syncSelection() {
      if (this.nativeSelect.options.length === 0) return;

      const selectedIndex = this.nativeSelect.selectedIndex;
      const selectedOption = this.nativeSelect.options[selectedIndex];

      if (selectedOption) {
        const span = this.trigger.querySelector('span');
        span.textContent = selectedOption.textContent;

        if (selectedOption.value === '') {
          this.trigger.classList.add('placeholder');
        } else {
          this.trigger.classList.remove('placeholder');
        }

        // Update visual selection in list
        const customOptions = this.optionsContainer.querySelectorAll('.custom-option');
        customOptions.forEach(el => el.classList.remove('selected'));
        if (customOptions[selectedIndex]) {
          customOptions[selectedIndex].classList.add('selected');
        }
      }
    }

    handleOptionClick(value) {
      this.nativeSelect.value = value;
      this.nativeSelect.dispatchEvent(new Event('change', { bubbles: true }));
      this.syncSelection();
      this.close();
    }

    open() {
      // Close all others
      document.querySelectorAll('.custom-select.open').forEach((el) => {
        if (el !== this.customSelect) el.classList.remove('open');
      });
      this.customSelect.classList.add('open');
    }

    close() {
      this.customSelect.classList.remove('open');
    }

    toggle() {
      if (this.customSelect.classList.contains('open')) {
        this.close();
      } else {
        this.open();
      }
    }

    setupListeners() {
      // Toggle dropdown
      this.trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!this.nativeSelect.disabled) {
          this.toggle();
        }
      });

      // Listen for external changes to the native select (e.g. set by script)
      this.nativeSelect.addEventListener('change', () => {
        this.syncSelection();
      });

      // Close on outside click is handled globally
    }

    setupObserver() {
      // Watch for changes in childList (options added/removed) and attributes
      const observer = new MutationObserver((mutations) => {
        let optionsChanged = false;
        mutations.forEach(mutation => {
          if (mutation.type === 'childList') {
            optionsChanged = true;
          }
          if (mutation.type === 'attributes' && mutation.attributeName === 'disabled') {
            if (this.nativeSelect.disabled) {
              this.wrapper.style.opacity = '0.6';
              this.trigger.style.cursor = 'not-allowed';
            } else {
              this.wrapper.style.opacity = '1';
              this.trigger.style.cursor = 'pointer';
            }
          }
        });

        if (optionsChanged) {
          this.syncOptions();
          this.syncSelection();
        }
      });

      observer.observe(this.nativeSelect, {
        childList: true,
        attributes: true,
        characterData: true,
        subtree: true
      });
    }
  }

  // 🌍 Global Click Listener to close dropdowns
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-select-wrapper')) {
      document.querySelectorAll('.custom-select.open').forEach(el => el.classList.remove('open'));
    }
  });

  // 🚀 Initialize function exposed
  window.initCustomSelect = (element) => {
    if (element && element.tagName === 'SELECT') {
      new CustomSelect(element);
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    initDropzones();
    if (partEntries && !partEntries.children.length) {
      addPartEntry();
    }

    // Initialize ModelDropdown
    const modelSelect = document.getElementById('modelNo');
    if (modelSelect) {
      new CustomSelect(modelSelect);
    }
  });
})();

