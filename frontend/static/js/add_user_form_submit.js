(() => {
  'use strict';

  const API_BASE_URL = '/api/v2/users/';
  const form = document.querySelector('.user-form');

  if (!form) {
    return;
  }

  const submitButton = form.querySelector('button[type="submit"]');
  const originalButtonLabel = submitButton ? submitButton.innerHTML : '';

  const getCookie = (name) => {
    if (!name) {
      return null;
    }
    const cookieString = document.cookie || '';
    const cookies = cookieString.split(';');
    for (let cookie of cookies) {
      const trimmed = cookie.trim();
      if (trimmed.startsWith(`${name}=`)) {
        return decodeURIComponent(trimmed.substring(name.length + 1));
      }
    }
    return null;
  };

  const toggleSubmittingState = (isSubmitting) => {
    if (!submitButton) {
      return;
    }

    submitButton.disabled = isSubmitting;
    submitButton.innerHTML = isSubmitting ? 'Creating…' : originalButtonLabel;
  };

  const parseRoles = (rawRoles) => {
    if (!rawRoles) {
      return [];
    }

    return rawRoles
      .split(',')
      .map((role) => role.trim())
      .filter(Boolean)
      .map((role) => {
        const numericRole = Number(role);
        return Number.isNaN(numericRole) ? role : numericRole;
      });
  };

  const resetFormState = () => {
    form.reset();

    if (typeof updateSelection === 'function') {
      updateSelection();
    }

    document.querySelectorAll('.otp-input').forEach((input) => {
      input.value = '';
    });

    const pinHidden = document.getElementById('pin');
    if (pinHidden) {
      pinHidden.value = '';
    }

    const selectedItems = document.getElementById('selected-items');
    if (selectedItems) {
      selectedItems.textContent = 'Select options';
      selectedItems.classList.add('is-empty');
    }
  };

  const buildPayload = (formData) => {
    const name = (formData.get('name') || '').trim();
    const employeeIdRaw = (formData.get('employee_id') || '').trim();
    const pinRaw = (formData.get('pin') || '').trim();
    const rolesRaw = formData.get('roles');

    if (!name) {
      throw new Error('Name is required.');
    }

    if (!/^\d+$/.test(employeeIdRaw)) {
      throw new Error('Employee ID must be numeric.');
    }

    const payload = {
      name,
      emp_id: Number(employeeIdRaw),
      roles: parseRoles(rolesRaw),
      pin: pinRaw ? Number(pinRaw) : null,
    };

    if (!payload.roles.length) {
      throw new Error('Select at least one role before submitting.');
    }

    if (pinRaw.length !== 4 || !/^\d{4}$/.test(pinRaw)) {
      throw new Error('PIN must contain exactly 4 digits.');
    }

    return payload;
  };

  const extractErrorMessage = async (response) => {
    let fallback = `Request failed (status ${response.status})`;
    try {
      const data = await response.json();
      if (!data) {
        return fallback;
      }

      if (typeof data === 'string') {
        return data;
      }

      if (data.error) {
        return data.error;
      }

      const flattened = Object.values(data)
        .map((value) => {
          if (Array.isArray(value)) {
            return value.join(' ');
          }
          if (typeof value === 'string') {
            return value;
          }
          return JSON.stringify(value);
        })
        .join(' ');

      return flattened || fallback;
    } catch (error) {
      return fallback;
    }
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (typeof validateForm === 'function' && !validateForm()) {
      return;
    }

    const formData = new FormData(form);
    const csrfToken = formData.get('csrfmiddlewaretoken') || getCookie('csrftoken');

    let payload;
    try {
      payload = buildPayload(formData);
    } catch (validationError) {
      if (typeof showWarning === 'function') {
        showWarning(validationError.message);
      } else {
        alert(validationError.message);
      }
      return;
    }

    try {
      toggleSubmittingState(true);
      const response = await fetch(API_BASE_URL, {
        method: 'POST',
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
        showSuccess('User created successfully.');
      } else {
        alert('User created successfully.');
      }

      resetFormState();

      const redirectUrl = form.dataset.redirectUrl;
      if (redirectUrl) {
        setTimeout(() => {
          window.location.href = redirectUrl;
        }, 1200);
      }
    } catch (error) {
      console.error('Failed to create user:', error);
      const message = error.message || 'Unable to create user.';
      if (typeof showError === 'function') {
        showError(message);
      } else {
        alert(message);
      }
    } finally {
      toggleSubmittingState(false);
    }
  });
})();

