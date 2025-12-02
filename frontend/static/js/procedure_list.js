(() => {
  'use strict';

  const API_BASE_URL = '/api/v2/model-parts/';

  /**
   * Fetch procedures from API and populate the table
   */
  const loadProcedures = async () => {
    try {
      const response = await fetch(API_BASE_URL);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      populateTable(data);
    } catch (error) {
      console.error('Error loading procedures:', error);
      showError('Failed to load procedures. Please refresh the page.');
    }
  };

  /**
   * Populate the table with procedure data
   */
  const populateTable = (procedures) => {
    const tbody = document.querySelector('.procedure-table tbody');
    if (!tbody) {
      console.error('Table body not found');
      return;
    }

    // Clear existing rows (except loading/error states)
    tbody.innerHTML = '';

    if (!procedures || procedures.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 2rem;">
            <p>No procedures found. <a href="/production-procedure/add/">Create your first procedure</a></p>
          </td>
        </tr>
      `;
      return;
    }

    // Create rows for each procedure
    procedures.forEach((procedure, index) => {
      const row = createTableRow(procedure, index + 1);
      tbody.appendChild(row);
    });
  };

  /**
   * Create a table row for a procedure
   */
  const createTableRow = (procedure, serialNumber) => {
    const tr = document.createElement('tr');
    tr.setAttribute('data-state', 'active');

    // Serial Number
    const tdSerial = document.createElement('td');
    tdSerial.setAttribute('data-label', 'Sr No');
    const serialBadge = document.createElement('span');
    serialBadge.className = 'serial-badge';
    serialBadge.textContent = String(serialNumber).padStart(2, '0');
    tdSerial.appendChild(serialBadge);

    // Image
    const tdImage = document.createElement('td');
    tdImage.setAttribute('data-label', 'Image');
    const figure = document.createElement('figure');
    figure.className = 'procedure-thumb';
    const img = document.createElement('img');
    if (procedure.display_image) {
      img.src = procedure.display_image;
      img.alt = procedure.model_no;
    }// else {
    //   // Use a placeholder or default image
    //   img.src = '/static/img/eics114.png';
    //   img.alt = 'No image';
    // }
    img.onerror = function() {
      this.src = '/static/img/eics114.png';
    };
    figure.appendChild(img);
    tdImage.appendChild(figure);

    // Product Name
    const tdProduct = document.createElement('td');
    tdProduct.setAttribute('data-label', 'Product Name');
    const strong = document.createElement('strong');
    strong.textContent = procedure.model_no || 'Unknown Model';
    const subcopy = document.createElement('span');
    subcopy.className = 'subcopy';
    subcopy.textContent = procedure.model_no || '';
    tdProduct.appendChild(strong);
    tdProduct.appendChild(document.createTextNode(' '));
    tdProduct.appendChild(subcopy);

    // Part Numbers
    const tdParts = document.createElement('td');
    tdParts.setAttribute('data-label', 'Part No');
    tdParts.textContent = procedure.part_numbers || 'No parts';

    // Action
    const tdAction = document.createElement('td');
    tdAction.setAttribute('data-label', 'Action');
    const actionCell = document.createElement('div');
    actionCell.className = 'action-cell';
    const viewBtn = document.createElement('button');
    viewBtn.type = 'button';
    viewBtn.className = 'icon-btn view-btn';
    viewBtn.setAttribute('aria-label', `View ${procedure.model_no}`);
    viewBtn.addEventListener('click', () => {
      showProcedureModal(procedure.model_no);
    });
    
    // View icon SVG
    viewBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    `;
    
    actionCell.appendChild(viewBtn);
    tdAction.appendChild(actionCell);

    // Append all cells to row
    tr.appendChild(tdSerial);
    tr.appendChild(tdImage);
    tr.appendChild(tdProduct);
    tr.appendChild(tdParts);
    tr.appendChild(tdAction);

    return tr;
  };

  /**
   * Show error message
   */
  const showError = (message) => {
    const tbody = document.querySelector('.procedure-table tbody');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 2rem; color: #dc3545;">
            <p>${message}</p>
          </td>
        </tr>
      `;
    }
  };

  /**
   * Show procedure detail modal
   */
  const showProcedureModal = async (modelNo) => {
    try {
      // Show loading state
      const modal = createModal();
      modal.querySelector('.modal-content').innerHTML = `
        <div class="modal-loading">
          <div class="spinner"></div>
          <p>Loading procedure details...</p>
        </div>
      `;
      document.body.appendChild(modal);
      modal.classList.add('active');

      // Fetch procedure details
      const response = await fetch(`/api/v2/procedure-detail/${modelNo}/`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      
      // Populate modal with data
      populateModal(modal, data);
    } catch (error) {
      console.error('Error loading procedure details:', error);
      showModalError('Failed to load procedure details. Please try again.');
    }
  };

  /**
   * Create modal structure
   */
  const createModal = () => {
    // Remove existing modal if any
    const existingModal = document.querySelector('.procedure-modal');
    if (existingModal) {
      existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.className = 'procedure-modal';
    modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-container">
        <div class="modal-header">
          <h2 class="modal-title">Procedure Details</h2>
          <button class="modal-close" aria-label="Close modal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="modal-content"></div>
      </div>
    `;

    // Close handlers
    const closeBtn = modal.querySelector('.modal-close');
    const overlay = modal.querySelector('.modal-overlay');
    
    const closeModal = () => {
      modal.classList.remove('active');
      setTimeout(() => modal.remove(), 300);
    };

    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);
    
    // Close on Escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape' && modal.classList.contains('active')) {
        closeModal();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);

    return modal;
  };

  /**
   * Populate modal with procedure data
   */
  const populateModal = (modal, data) => {
    const content = modal.querySelector('.modal-content');
    const modelNo = data.model_no;
    const parts = data.parts || [];

    if (parts.length === 0) {
      content.innerHTML = `
        <div class="modal-empty">
          <p>No procedure details found for ${modelNo}</p>
        </div>
      `;
      return;
    }

    let html = `
      <div class="procedure-details">
        <div class="model-header">
          <h3>${modelNo}</h3>
          <span class="parts-count">${parts.length} Part${parts.length > 1 ? 's' : ''}</span>
        </div>
        <div class="parts-container">
    `;

    parts.forEach((part, index) => {
      const config = part.procedure_config || {};
      const enabledSections = Object.keys(config).filter(key => 
        config[key] && config[key].enabled
      );

      html += `
        <div class="part-card" data-part-index="${index}">
          <div class="part-header">
            <div class="part-info">
              <h4>${part.part_no}</h4>
              ${part.part_image_url ? `
                <div class="part-image-preview">
                  <img src="${part.part_image_url}" alt="${part.part_no}" />
                </div>
              ` : ''}
            </div>
            <div class="part-badge">
              <span class="badge-text">${enabledSections.length} Section${enabledSections.length > 1 ? 's' : ''} Enabled</span>
            </div>
          </div>
          <div class="sections-grid">
      `;

      // Section titles mapping
      const sectionTitles = {
        'smd': 'SMD',
        'leaded': 'Leaded',
        'prod_qc': 'Production QC',
        'qc': 'QC',
        'testing': 'Testing',
        'glueing': 'Glueing',
        'cleaning': 'Cleaning',
        'spraying': 'Spraying',
        'dispatch': 'Dispatch'
      };

      // Show enabled sections
      enabledSections.forEach(sectionKey => {
        const section = config[sectionKey];
        const sectionTitle = sectionTitles[sectionKey] || sectionKey.toUpperCase();
        
        html += `
          <div class="section-card ${sectionKey}">
            <div class="section-header">
              <h5>${sectionTitle}</h5>
              <span class="section-badge active">Active</span>
            </div>
            <div class="section-content">
        `;

        // Default fields
        if (section.default_fields && section.default_fields.length > 0) {
          html += `
            <div class="field-group">
              <label class="field-label">Default Fields:</label>
              <div class="field-tags">
          `;
          section.default_fields.forEach(field => {
            html += `<span class="field-tag">${field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>`;
          });
          html += `</div></div>`;
        }

        // Custom checkboxes
        if (section.custom_checkboxes && section.custom_checkboxes.length > 0) {
          html += `
            <div class="field-group">
              <label class="field-label">Custom Checkboxes:</label>
              <div class="checkbox-list">
          `;
          section.custom_checkboxes.forEach(checkbox => {
            html += `
              <div class="checkbox-item">
                <svg class="checkbox-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                <span>${checkbox.label || checkbox.name}</span>
              </div>
            `;
          });
          html += `</div></div>`;
        }

        // Testing mode
        if (sectionKey === 'testing' && section.mode) {
          html += `
            <div class="field-group">
              <label class="field-label">Mode:</label>
              <span class="mode-badge ${section.mode}">${section.mode.charAt(0).toUpperCase() + section.mode.slice(1)}</span>
            </div>
          `;
        }

        html += `
            </div>
          </div>
        `;
      });

      // Show disabled sections (collapsed)
      const allSections = Object.keys(sectionTitles);
      const disabledSections = allSections.filter(key => 
        !enabledSections.includes(key)
      );

      if (disabledSections.length > 0) {
        html += `
          <div class="disabled-sections">
            <details>
              <summary>Disabled Sections (${disabledSections.length})</summary>
              <div class="disabled-list">
        `;
        disabledSections.forEach(sectionKey => {
          const sectionTitle = sectionTitles[sectionKey] || sectionKey.toUpperCase();
          html += `<span class="disabled-badge">${sectionTitle}</span>`;
        });
        html += `</div></details></div>`;
      }

      html += `
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;

    content.innerHTML = html;
  };

  /**
   * Show error in modal
   */
  const showModalError = (message) => {
    const modal = document.querySelector('.procedure-modal');
    if (modal) {
      const content = modal.querySelector('.modal-content');
      content.innerHTML = `
        <div class="modal-error">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          <p>${message}</p>
        </div>
      `;
    }
  };

  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    loadProcedures();
  });
})();

