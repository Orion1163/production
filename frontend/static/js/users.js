(() => {
  'use strict';

  const API_BASE_URL = '/api/v2/users/';
  const tableBody = document.querySelector('.procedure-table tbody');
  const profileModal = document.getElementById('userProfileModal');
  const profileModalBody = profileModal ? profileModal.querySelector('[data-profile-body]') : null;
  const profileModalCard = profileModal ? profileModal.querySelector('.profile-modal__card') : null;
  const editModal = document.getElementById('editUserModal');
  const editModalCard = editModal ? editModal.querySelector('.edit-modal__card') : null;
  const editForm = document.getElementById('editUserForm');
  const editSubmitButton = editForm ? editForm.querySelector('[data-edit-submit]') : null;
  const editSubmitButtonInitialMarkup = editSubmitButton ? editSubmitButton.innerHTML : '';
  const editNameInput = editForm ? editForm.querySelector('#editName') : null;
  const editEmpIdInput = editForm ? editForm.querySelector('#editEmpId') : null;
  const editPinHiddenInput = editForm ? editForm.querySelector('#editPin') : null;
  const editOtpInputs = editForm ? Array.from(editForm.querySelectorAll('[data-edit-otp-input]')) : [];
  const editPinVisibilityButton = editForm ? editForm.querySelector('[data-edit-pin-toggle]') : null;
  const editDropdownToggle = editForm ? editForm.querySelector('[data-edit-dropdown-toggle]') : null;
  const editSelectedItems = editForm ? editForm.querySelector('#edit-selected-items') : null;
  const editRoleCheckboxes = editForm ? Array.from(editForm.querySelectorAll('[data-edit-role-checkbox]')) : [];
  const editOptions = editForm ? editForm.querySelector('.edit-options') : null;
  let editPinIsVisible = false;
  let currentEditingUserId = null;
  let currentEditRoles = [];

  const ROLE_LABELS = {
    1: 'Administrator',
    2: 'Quality Control',
    3: 'Tester',
    4: 'Glueing',
    5: 'Cleaning',
    6: 'Spraying',
    7: 'Dispatch',
  };

  const applyEditPinVisibilityState = (shouldShow) => {
    if (!editOtpInputs.length) return;
    editOtpInputs.forEach((input) => {
      input.type = shouldShow ? 'text' : 'password';
    });
    if (editPinVisibilityButton) {
      editPinVisibilityButton.setAttribute('aria-pressed', shouldShow ? 'true' : 'false');
      editPinVisibilityButton.setAttribute('aria-label', shouldShow ? 'Hide PIN' : 'Show PIN');
      editPinVisibilityButton.classList.toggle('is-active', shouldShow);
    }
    editPinIsVisible = shouldShow;
  };

  const toggleEditPinVisibility = () => {
    applyEditPinVisibilityState(!editPinIsVisible);
  };

  if (editOtpInputs.length) {
    applyEditPinVisibilityState(false);
  }

  const syncEditPinHiddenField = () => {
    if (!editOtpInputs.length || !editPinHiddenInput) return '';
    const pinValue = editOtpInputs.map((input) => input.value || '').join('');
    editPinHiddenInput.value = pinValue;
    return pinValue;
  };

  const clearEditPinInputs = () => {
    editOtpInputs.forEach((input) => {
      input.value = '';
    });
    syncEditPinHiddenField();
  };

  const setEditPinValue = (pinValue = '') => {
    if (!editOtpInputs.length) return;
    const digits = String(pinValue).padStart(4, '0').slice(0, 4).split('');
    editOtpInputs.forEach((input, index) => {
      input.value = digits[index] || '';
    });
    syncEditPinHiddenField();
  };

  const moveEditOtpFocus = (index, direction) => {
    if (!editOtpInputs.length) return;
    const nextIndex = index + direction;
    if (nextIndex >= 0 && nextIndex < editOtpInputs.length) {
      editOtpInputs[nextIndex].focus();
      editOtpInputs[nextIndex].select();
    }
  };

  const handleEditOtpInput = (event, index) => {
    const input = event.target;
    input.value = input.value.replace(/[^0-9]/g, '');
    if (input.value && index < editOtpInputs.length - 1) {
      moveEditOtpFocus(index, 1);
    }
    syncEditPinHiddenField();
  };

  const handleEditOtpKeydown = (event, index) => {
    if (event.key === 'Backspace' && !event.target.value) {
      moveEditOtpFocus(index, -1);
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      moveEditOtpFocus(index, -1);
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      moveEditOtpFocus(index, 1);
    }
  };

  const getCookie = (name) => {
    if (!name) return null;
    const cookieString = document.cookie || '';
    const cookies = cookieString.split(';');
    for (const cookie of cookies) {
      const trimmed = cookie.trim();
      if (trimmed.startsWith(`${name}=`)) {
        return decodeURIComponent(trimmed.substring(name.length + 1));
      }
    }
    return null;
  };

  const extractErrorMessage = async (response) => {
    const fallback = `Request failed (status ${response.status})`;
    try {
      const data = await response.json();
      if (!data) return fallback;
      if (typeof data === 'string') return data;
      if (data.error) return data.error;
      const flattened = Object.values(data)
        .map((value) => {
          if (Array.isArray(value)) return value.join(' ');
          if (typeof value === 'string') return value;
          return JSON.stringify(value);
        })
        .join(' ');
      return flattened || fallback;
    } catch (error) {
      return fallback;
    }
  };

  /**
   * Format employee ID to display
   * @param {number} empId - Employee ID number
   * @returns {string} - Formatted employee ID
   */
  const formatEmpId = (empId) => {
    if (!empId && empId !== 0) return 'N/A';
    return `${String(empId)}`;
  };

  /**
   * Normalize employee ID for sorting (ascending)
   * @param {number|string} empId
   * @returns {number}
   */
  const getEmpIdSortValue = (empId) => {
    if (empId === null || empId === undefined || empId === '') {
      return Number.POSITIVE_INFINITY;
    }
    const numeric = Number(empId);
    if (!Number.isNaN(numeric)) {
      return numeric;
    }
    const parsed = parseInt(String(empId).replace(/\D+/g, ''), 10);
    return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
  };

  /**
   * Format PIN with padding or fallback
   * @param {number|string} pin
   * @returns {string}
   */
  const formatPin = (pin) => {
    if (pin === null || pin === undefined || pin === '') {
      return 'Not set';
    }
    return String(pin).padStart(4, '0');
  };

  /**
   * Return a masked representation of the PIN using asterisks
   * @param {string} formattedPin
   * @returns {string}
   */
  const maskPinValue = (formattedPin) => {
    if (!formattedPin || formattedPin === 'Not set') {
      return 'Not set';
    }
    return '*'.repeat(formattedPin.length);
  };

  /**
   * Extract initials from name
   * @param {string} name
   * @returns {string}
   */
  const getInitials = (name = '') => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '??';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  /**
   * Populate modal body with loading state
   */
  const renderProfileLoading = () => {
    if (!profileModalBody) return;
    profileModalBody.innerHTML = `
      <div class="profile-modal__loading">
        <p>Fetching user profile…</p>
      </div>
    `;
  };

  /**
   * Resolve role identifier to friendly label
   * @param {number|string} role
   * @returns {string}
   */
  const resolveRoleLabel = (role) => {
    if (role === null || role === undefined || role === '') {
      return null;
    }

    const normalized = typeof role === 'number' ? role : String(role).trim();
    const key = typeof normalized === 'number' ? normalized : Number(normalized);

    if (!Number.isNaN(key) && ROLE_LABELS[key]) {
      return ROLE_LABELS[key];
    }

    // If API already returns friendly name, use it as-is
    const fallback = typeof normalized === 'string' ? normalized : '';
    return fallback || null;
  };

  /**
   * Render roles as tag pills
   * @param {Array} roles
   * @returns {string}
   */
  const renderRoleTags = (roles) => {
    if (!roles || !Array.isArray(roles) || roles.length === 0) {
      return `<span class="profile-tag">No role assigned</span>`;
    }

    const uniqueLabels = Array.from(
      new Set(
        roles
          .map((role) => resolveRoleLabel(role))
          .filter((label) => typeof label === 'string' && label.length > 0)
      )
    );

    if (uniqueLabels.length === 0) {
      return `<span class="profile-tag">No role assigned</span>`;
    }

    return uniqueLabels.map((label) => `<span class="profile-tag">${label}</span>`).join('');
  };

  const normalizeRoleValues = (roles) => {
    if (!roles || !Array.isArray(roles)) {
      return [];
    }
    return roles
      .map((role) => {
        if (typeof role === 'number') {
          return String(role);
        }
        const numericRole = Number(role);
        if (!Number.isNaN(numericRole)) {
          return String(numericRole);
        }
        return String(role).trim();
      })
      .filter(Boolean);
  };

  const setEditModalState = (state) => {
    if (!editModal) return;
    editModal.setAttribute('data-state', state);
    editModal.setAttribute('aria-hidden', state === 'closed' ? 'true' : 'false');
    document.body.classList.toggle('edit-modal-open', state === 'open');
  };

  const toggleEditDropdown = () => {
    if (!editOptions || !editDropdownToggle) return;
    const isOpen = editOptions.style.display === 'block';
    
    if (!isOpen) {
      // Open dropdown
      editOptions.style.display = 'block';
      editDropdownToggle.setAttribute('aria-expanded', 'true');
      
      // On mobile, ensure dropdown is positioned at bottom and scrollable
      if (window.innerWidth <= 640) {
        // Force reflow to ensure styles are applied
        void editOptions.offsetHeight;
        // Scroll dropdown into view if needed
        setTimeout(() => {
          if (editOptions) {
            editOptions.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }, 50);
      }
    } else {
      // Close dropdown
      editOptions.style.display = 'none';
      editDropdownToggle.setAttribute('aria-expanded', 'false');
    }
  };

  const updateEditSelection = () => {
    if (!editSelectedItems) return;
    editSelectedItems.innerHTML = '';
    const selected = editRoleCheckboxes.filter((cb) => cb.checked);
    currentEditRoles = selected.map((cb) => cb.value);

    if (selected.length === 0) {
      editSelectedItems.textContent = 'Select roles';
      editSelectedItems.classList.add('is-empty');
    } else {
      selected.forEach((checkbox) => {
        const displayName = checkbox.getAttribute('data-name');
        const span = document.createElement('span');
        span.classList.add('selected-item');
        span.innerHTML = `${displayName} <span class="remove" data-edit-remove-role="${checkbox.value}">×</span>`;
        editSelectedItems.appendChild(span);
      });
      editSelectedItems.classList.remove('is-empty');
    }
  };

  const removeEditRole = (value) => {
    const checkbox = editRoleCheckboxes.find((cb) => cb.value === value);
    if (checkbox) {
      checkbox.checked = false;
      updateEditSelection();
    }
  };

  const resetEditForm = () => {
    if (!editForm) return;
    editForm.reset();
    currentEditRoles = [];
    editRoleCheckboxes.forEach((cb) => {
      cb.checked = false;
    });
    updateEditSelection();
    if (editOptions) {
      editOptions.style.display = 'none';
    }
    if (editDropdownToggle) {
      editDropdownToggle.setAttribute('aria-expanded', 'false');
    }
    clearEditPinInputs();
    applyEditPinVisibilityState(false);
  };

  const closeEditModal = () => {
    setEditModalState('closed');
    resetEditForm();
    currentEditingUserId = null;
    toggleEditSubmittingState(false);
  };

  const toggleEditSubmittingState = (isSubmitting) => {
    if (!editSubmitButton) return;
    editSubmitButton.disabled = isSubmitting;
    editSubmitButton.innerHTML = isSubmitting ? 'Saving…' : editSubmitButtonInitialMarkup;
  };

  const populateEditForm = (user = {}) => {
    if (!editForm) return;
    if (editNameInput) {
      editNameInput.value = user.name || '';
    }
    if (editEmpIdInput) {
      editEmpIdInput.value = user.emp_id ?? '';
    }
    currentEditRoles = normalizeRoleValues(user.roles || []);
    
    // Update checkboxes based on current roles
    editRoleCheckboxes.forEach((checkbox) => {
      const value = String(checkbox.value);
      checkbox.checked = currentEditRoles.includes(value);
    });
    updateEditSelection();
    
    setEditPinValue(
      user.pin !== undefined && user.pin !== null ? String(user.pin).padStart(4, '0') : ''
    );
  };

  const buildEditPayload = () => {
    if (!editForm) return null;
    const name = (editNameInput?.value || '').trim();
    const empIdRaw = (editEmpIdInput?.value || '').trim();
    const pinRaw = (editPinHiddenInput?.value || '').trim();
    const selectedRoles = currentEditRoles.map((value) => {
      const numeric = Number(value);
      return Number.isNaN(numeric) ? value : numeric;
    });

    if (!name) {
      throw new Error('Name is required.');
    }

    if (!/^\d+$/.test(empIdRaw)) {
      throw new Error('Employee ID must be numeric.');
    }

    if (!selectedRoles.length) {
      throw new Error('Select at least one role.');
    }

    if (pinRaw.length !== 4 || !/^\d{4}$/.test(pinRaw)) {
      throw new Error('PIN must contain exactly 4 digits.');
    }

    return {
      name,
      emp_id: Number(empIdRaw),
      roles: selectedRoles,
      pin: Number(pinRaw),
    };
  };

  /**
   * Render profile banner message (optional)
   * @param {string} message
   * @returns {string}
   */
  const renderProfileBanner = (message) => {
    if (!message) return '';
    return `<div class="profile-banner">${message}</div>`;
  };

  /**
   * Wire up show/hide toggle for security PIN if present
   */
  const initializePinToggle = () => {
    if (!profileModalBody) return;
    const toggleBtn = profileModalBody.querySelector('[data-pin-toggle]');
    const pinValueEl = profileModalBody.querySelector('[data-pin-value]');

    if (!toggleBtn || !pinValueEl) return;

    toggleBtn.addEventListener('click', () => {
      const isVisible = pinValueEl.getAttribute('data-pin-visible') === 'true';
      const originalValue = pinValueEl.getAttribute('data-pin-original') || '';
      const nextVisibleState = !isVisible;

      pinValueEl.textContent = nextVisibleState ? originalValue : maskPinValue(originalValue);
      pinValueEl.setAttribute('data-pin-visible', String(nextVisibleState));
      pinValueEl.classList.toggle('pin-value--visible', nextVisibleState);

      // lightweight pulse animation on toggle
      pinValueEl.classList.remove('pin-value--pulse');
      void pinValueEl.offsetWidth;
      pinValueEl.classList.add('pin-value--pulse');

      toggleBtn.setAttribute('aria-pressed', String(nextVisibleState));
      toggleBtn.setAttribute(
        'aria-label',
        nextVisibleState ? 'Hide security PIN' : 'Show security PIN'
      );
      toggleBtn.classList.toggle('is-active', nextVisibleState);
    });
  };

  /**
   * Render profile view inside modal
   * @param {Object} user
   * @param {Object} options
   */
  const renderUserProfile = (user = {}, options = {}) => {
    if (!profileModalBody) return;
    const bannerMarkup = renderProfileBanner(options.notice);
    const formattedPin = formatPin(user.pin);
    const pinIsSet = formattedPin !== 'Not set';
    const pinMarkup = pinIsSet
      ? `
          <div class="pin-field">
            <strong class="pin-value" data-pin-value data-pin-visible="false" data-pin-original="${formattedPin}">
              ${maskPinValue(formattedPin)}
            </strong>
            <button
              type="button"
              class="icon-btn pin-toggle"
              aria-label="Show security PIN"
              aria-pressed="false"
              data-pin-toggle
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
                stroke-linejoin="round" aria-hidden="true">
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
        `
      : `<strong>${formattedPin}</strong>`;

    profileModalBody.innerHTML = `
      ${bannerMarkup}
      <div class="profile-hero">
        <div class="profile-avatar" aria-hidden="true">${getInitials(user.name)}</div>
        <div class="profile-meta">
          <h2 id="userProfileTitle">${user.name || 'Unnamed user'}</h2>
          <p>Employee • ${formatEmpId(user.emp_id)}</p>
        </div>
      </div>
      <div class="profile-tags">
        ${renderRoleTags(user.roles)}
      </div>
      <div class="profile-details">
        <div class="profile-details__card" data-card-label="ID">
          <span>Employee ID</span>
          <strong>${formatEmpId(user.emp_id)}</strong>
        </div>
        <div class="profile-details__card profile-details__card--highlight" data-card-label="PIN">
          <span>Security PIN</span>
          ${pinMarkup}
        </div>
      </div>
    `;

    initializePinToggle();
  };

  /**
   * Render profile error state
   * @param {string} message
   */
  const renderProfileError = (message) => {
    if (!profileModalBody) return;
    profileModalBody.innerHTML = `
      <div class="profile-modal__error">
        <p>${message || 'Unable to load user profile right now.'}</p>
        <button type="button" class="btn btn-light" data-close-modal>Close</button>
      </div>
    `;
  };

  /**
   * Control modal visibility
   * @param {'open'|'closed'} state
   */
  const setModalState = (state) => {
    if (!profileModal) return;
    profileModal.setAttribute('data-state', state);
    profileModal.setAttribute('aria-hidden', state === 'closed' ? 'true' : 'false');
    document.body.classList.toggle('profile-modal-open', state === 'open');
  };

  /**
   * Close modal helper
   */
  const closeProfileModal = () => setModalState('closed');

  /**
   * Fetch single user detail
   * @param {number|string} userId
   * @returns {Promise<Object>}
   */
  const fetchUserDetails = async (userId) => {
    const response = await fetch(`${API_BASE_URL}${userId}/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error(`Could not load profile (status ${response.status})`);
    }
    return response.json();
  };

  /**
   * Open modal and show fetched user data
   * @param {Object} user
   */
  const handleViewUser = async (user) => {
    if (!user || !profileModal) return;
    setModalState('open');
    renderProfileLoading();
    try {
      const freshUser = await fetchUserDetails(user.id);
      renderUserProfile(freshUser);
    } catch (error) {
      console.error('Error loading user profile:', error);
      if (user) {
        renderUserProfile(user, {
          notice: 'Live data is unavailable. Showing the latest cached details instead.',
        });
      } else {
        renderProfileError(error.message);
      }
    }
  };

  /**
   * Create a table row element for a user
   * @param {Object} user - User object from API
   * @returns {HTMLElement} - Table row element
   */
  const createUserRow = (user) => {
    const tr = document.createElement('tr');
    tr.setAttribute('data-state', 'active');
    tr.setAttribute('data-user-id', user.id);

    tr.innerHTML = `
      <td data-label="Employee ID">
        <span class="serial-badge">${formatEmpId(user.emp_id)}</span>
      </td>
      <td data-label="Name">
        <strong>${user.name || 'N/A'}</strong>
      </td>
      <td data-label="Action">
        <div class="action-cell">
          <button type="button" class="icon-btn view-btn" aria-label="View User" data-user-id="${user.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
              stroke-linejoin="round">
              <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
          <button type="button" class="icon-btn edit-btn" aria-label="Edit User" style="margin-left: 8px;" data-user-id="${user.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
              stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        </div>
      </td>
    `;

    // Add event listeners for view and edit buttons
    const viewBtn = tr.querySelector('.view-btn');
    const editBtn = tr.querySelector('.edit-btn');

    if (viewBtn) {
      viewBtn.addEventListener('click', () => handleViewUser(user));
    }

    if (editBtn) {
      editBtn.addEventListener('click', () => handleEditUser(user));
    }

    return tr;
  };

  /**
   * Handle edit user action
   * @param {Object} user - User object
   */
  const handleEditUser = async (user) => {
    if (!user || !editModal) {
      return;
    }

    const openModalWithUser = (payload) => {
      currentEditingUserId = payload.id;
      populateEditForm(payload);
      setEditModalState('open');
    };

    openModalWithUser(user);
    applyEditPinVisibilityState(false);
    if (editOtpInputs.length) {
      editOtpInputs[0].focus();
      editOtpInputs[0].select();
    }

    try {
      const latestUser = await fetchUserDetails(user.id);
      currentEditingUserId = latestUser.id;
      populateEditForm(latestUser);
    } catch (error) {
      console.error('Error loading latest user data for edit:', error);
      if (typeof showWarning === 'function') {
        showWarning('Live user data unavailable. Editing cached details instead.');
      }
    }
  };

  /**
   * Display error message in the table
   * @param {string} message - Error message to display
   */
  const displayError = (message) => {
    if (!tableBody) return;

    tableBody.innerHTML = `
      <tr>
        <td colspan="3" style="text-align: center; padding: 2rem; color: #dc3545;">
          <strong>Error loading users:</strong> ${message}
        </td>
      </tr>
    `;
  };

  /**
   * Display empty state message
   */
  const displayEmptyState = () => {
    if (!tableBody) return;

    tableBody.innerHTML = `
      <tr>
        <td colspan="3" style="text-align: center; padding: 2rem; color: #6c757d;">
          No users found. <a href="/admin/add-user/" style="color: #007bff;">Add a user</a> to get started.
        </td>
      </tr>
    `;
  };

  /**
   * Fetch users from API and populate the table
   */
  const loadUsers = async () => {
    if (!tableBody) {
      console.error('Table body not found');
      return;
    }

    try {
      // Show loading state
      tableBody.innerHTML = `
        <tr>
          <td colspan="3" style="text-align: center; padding: 2rem; color: #6c757d;">
            Loading users...
          </td>
        </tr>
      `;

      const response = await fetch(API_BASE_URL, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const users = await response.json();

      // Clear existing rows
      tableBody.innerHTML = '';

      if (!users || users.length === 0) {
        displayEmptyState();
        return;
      }

      // Sort by employee ID ascending for consistent ordering
      const sortedUsers = [...users].sort(
        (a, b) => getEmpIdSortValue(a?.emp_id) - getEmpIdSortValue(b?.emp_id)
      );

      // Create and append rows for each user
      sortedUsers.forEach((user) => {
        const row = createUserRow(user);
        tableBody.appendChild(row);
      });
    } catch (error) {
      console.error('Error fetching users:', error);
      displayError(error.message || 'Failed to load users. Please try again later.');
    }
  };

  // Wire up modal dismissal controls
  if (profileModal) {
    profileModal.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      if (target.closest('[data-close-modal]')) {
        closeProfileModal();
        return;
      }

      const clickedOutsideCard =
        profileModalCard && !profileModalCard.contains(target);

      if (target === profileModal || clickedOutsideCard) {
        closeProfileModal();
      }
    });
  }

  if (editModal) {
    editModal.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      if (target.closest('[data-close-edit-modal]')) {
        closeEditModal();
        return;
      }

      const clickedOutsideCard = editModalCard && !editModalCard.contains(target);

      if (target === editModal || clickedOutsideCard) {
        closeEditModal();
      }
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') {
      return;
    }
    if (profileModal && profileModal.getAttribute('data-state') === 'open') {
      closeProfileModal();
    }
    if (editModal && editModal.getAttribute('data-state') === 'open') {
      closeEditModal();
    }
  });

  if (editForm) {
    editForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      if (!currentEditingUserId) {
        if (typeof showWarning === 'function') {
          showWarning('Select a user to edit first.');
        }
        return;
      }

      let payload;
      try {
        payload = buildEditPayload();
      } catch (validationError) {
        if (typeof showWarning === 'function') {
          showWarning(validationError.message);
        } else {
          alert(validationError.message);
        }
        return;
      }

      try {
        toggleEditSubmittingState(true);
        const csrfToken = getCookie('csrftoken');
        const response = await fetch(`${API_BASE_URL}${currentEditingUserId}/`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-CSRFToken': csrfToken || '',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const message = await extractErrorMessage(response);
          throw new Error(message);
        }

        await response.json();

        if (typeof showSuccess === 'function') {
          showSuccess('User updated successfully.');
        } else {
          alert('User updated successfully.');
        }

        closeEditModal();
        loadUsers();
      } catch (error) {
        console.error('Failed to update user:', error);
        const message = error.message || 'Unable to update user.';
        if (typeof showError === 'function') {
          showError(message);
        } else {
          alert(message);
        }
      } finally {
        toggleEditSubmittingState(false);
      }
    });

    editOtpInputs.forEach((input, index) => {
      input.addEventListener('input', (event) => handleEditOtpInput(event, index));
      input.addEventListener('keydown', (event) => handleEditOtpKeydown(event, index));
      input.addEventListener('focus', (event) => event.target.select());
    });

    if (editPinVisibilityButton) {
      editPinVisibilityButton.addEventListener('click', toggleEditPinVisibility);
    }

    // Multiselect dropdown functionality
    if (editDropdownToggle) {
      editDropdownToggle.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleEditDropdown();
      });
    }

    if (editRoleCheckboxes.length) {
      editRoleCheckboxes.forEach((checkbox) => {
        checkbox.addEventListener('change', () => {
          updateEditSelection();
        });
      });
    }

    // Handle remove role clicks
    if (editForm) {
      editForm.addEventListener('click', (event) => {
        const target = event.target;
        if (target && target.hasAttribute('data-edit-remove-role')) {
          event.stopPropagation();
          const value = target.getAttribute('data-edit-remove-role');
          removeEditRole(value);
        }
      });
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', (event) => {
      if (!editForm || !editOptions || !editDropdownToggle) return;
      const target = event.target;
      const isClickInside = editForm.contains(target) && 
        (editOptions.contains(target) || editDropdownToggle.contains(target) || target.closest('.edit-options'));
      
      if (!isClickInside && editOptions.style.display === 'block') {
        editOptions.style.display = 'none';
        editDropdownToggle.setAttribute('aria-expanded', 'false');
      }
    });

    // Close dropdown on Escape key
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && editOptions && editOptions.style.display === 'block') {
        editOptions.style.display = 'none';
        if (editDropdownToggle) {
          editDropdownToggle.setAttribute('aria-expanded', 'false');
        }
      }
    });

    // Handle window resize to adjust dropdown positioning
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (editOptions && editOptions.style.display === 'block') {
          // Force reflow to recalculate positioning on mobile
          const wasOpen = editOptions.style.display === 'block';
          editOptions.style.display = 'none';
          void editOptions.offsetHeight; // Force reflow
          if (wasOpen) {
            editOptions.style.display = 'block';
            if (window.innerWidth <= 640) {
              setTimeout(() => {
                if (editOptions) {
                  editOptions.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
              }, 50);
            }
          }
        }
      }, 150);
    });
  }

  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    loadUsers();
  });
})();

