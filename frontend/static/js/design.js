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

  const updateDispatchAvailability = () => {
    if (!partEntries) {
      return;
    }
    const entries = Array.from(partEntries.querySelectorAll('.part-entry'));
    entries.forEach((entry, index) => {
      const dispatchItem = entry.querySelector('[data-dispatch-item]');
      const dispatchPanel = entry.querySelector('[data-dispatch-panel]');
      if (!dispatchItem || !dispatchPanel) {
        return;
      }
      const dispatchCheckbox = dispatchItem.querySelector('input[type="checkbox"]');
      const isPrimary = index === 0;
      dispatchItem.style.display = isPrimary ? '' : 'none';
      if (dispatchCheckbox) {
        dispatchCheckbox.disabled = !isPrimary;
        if (!isPrimary && dispatchCheckbox.checked) {
          dispatchCheckbox.checked = false;
        }
      }
      dispatchPanel.style.display =
        isPrimary && dispatchCheckbox && dispatchCheckbox.checked ? 'block' : 'none';
    });
  };

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
    
    updateDispatchAvailability();
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
    manualSection.style.display = select.value === 'manual' ? 'block' : 'none';
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
  window.togglePanel = togglePanel;
  window.toggleTestingMode = toggleTestingMode;
  window.addInputField = addInputField;
  window.addCheckboxField = addCheckboxField;
  window.handlePartSelection = handlePartSelection;
  window.cancelPartImage = cancelPartImage;

  document.addEventListener('DOMContentLoaded', () => {
    initDropzones();
    if (partEntries && !partEntries.children.length) {
      addPartEntry();
    }
    updateDispatchAvailability();
  });
})();

