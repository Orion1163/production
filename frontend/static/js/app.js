const inputs = document.querySelectorAll(".input-field");
const bullets = document.querySelectorAll(".bullets span");
const images = document.querySelectorAll(".image");

inputs.forEach((inp) => {
  inp.addEventListener("focus", () => {
    inp.classList.add("active");
  });
  inp.addEventListener("blur", () => {
    if (inp.value != "") return;
    inp.classList.remove("active");
  });
});

let currentSlideIndex = 1;
const totalSlides = 3;

function moveSlider(index) {
  // Remove show class from all images
  images.forEach((img) => img.classList.remove("show"));
  
  // Add show class to current image
  const currentImage = document.querySelector(`.img-${index}`);
  if (currentImage) {
    currentImage.classList.add("show");
  }

  // Update text slider position
  const textSlider = document.querySelector(".text-group");
  if (textSlider) {
    textSlider.style.transform = `translateY(${-(index - 1) * 2.2}rem)`;
  }

  // Update active bullet
  bullets.forEach((bull) => {
    bull.classList.remove("active");
    if (bull.dataset.value == index) {
      bull.classList.add("active");
    }
  });
}

// Manual slider function for bullet clicks
function moveSliderOnClick() {
  let index = parseInt(this.dataset.value);
  currentSlideIndex = index;
  moveSlider(index);
  // Reset auto-rotation timer when manually clicked
  clearInterval(autoRotateInterval);
  startAutoRotation();
}

bullets.forEach((bullet) => {
  bullet.addEventListener("click", moveSliderOnClick);
});

// Auto-rotation function
function startAutoRotation() {
  autoRotateInterval = setInterval(() => {
    currentSlideIndex++;
    if (currentSlideIndex > totalSlides) {
      currentSlideIndex = 1;
    }
    moveSlider(currentSlideIndex);
  }, 1000); // Rotate every 1 second (1000ms)
}

// Start auto-rotation when page loads
let autoRotateInterval;
startAutoRotation();

// Admin Login Form Handler
(function() {
  'use strict';

  const adminForm = document.querySelector('.admin-form');
  if (!adminForm) return;

  // Get CSRF token helper
  function getCookie(name) {
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
  }

  function getCsrfToken(form) {
    if (form) {
      const csrfInput = form.querySelector('input[name="csrfmiddlewaretoken"]');
      if (csrfInput && csrfInput.value) {
        return csrfInput.value;
      }
    }

    const metaTag = document.querySelector('meta[name="csrf-token"]');
    if (metaTag && metaTag.content) {
      return metaTag.content;
    }

    return getCookie('csrftoken');
  }

  // Extract error message from response
  async function extractErrorMessage(response) {
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
  }

  adminForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(adminForm);
    const empId = formData.get('admin_emp_id');
    const pin = formData.get('admin_pin');

    // Validate inputs
    if (!empId || !pin) {
      if (typeof showError === 'function') {
        showError('Please enter both Employee ID and PIN');
      } else {
        alert('Please enter both Employee ID and PIN');
      }
      return;
    }

    // Validate PIN length
    if (pin.length !== 4) {
      if (typeof showError === 'function') {
        showError('PIN must be 4 digits');
      } else {
        alert('PIN must be 4 digits');
      }
      return;
    }

    const csrfToken = getCsrfToken(adminForm);
    const submitButton = adminForm.querySelector('.sign-btn');
    const originalButtonText = submitButton.value;

    try {
      // Disable submit button
      submitButton.disabled = true;
      submitButton.value = 'Signing In...';

      const response = await fetch('/api/v2/admin/login/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRFToken': csrfToken || '',
        },
        credentials: 'same-origin', // Include cookies for session
        body: JSON.stringify({
          emp_id: parseInt(empId),
          pin: parseInt(pin),
        }),
      });

      if (!response.ok) {
        const errorMessage = await extractErrorMessage(response);
        throw new Error(errorMessage);
      }

      const data = await response.json();

      // Show success message
      if (typeof showSuccess === 'function') {
        showSuccess('Login successful! Redirecting...');
      } else {
        alert('Login successful!');
      }

      // Redirect to home page after a short delay
      setTimeout(() => {
        window.location.href = '/home/';
      }, 1000);

    } catch (error) {
      console.error('Login failed:', error);
      const message = error.message || 'Unable to login. Please check your credentials.';
      if (typeof showError === 'function') {
        showError(message);
      } else {
        alert(message);
      }
    } finally {
      // Re-enable submit button
      submitButton.disabled = false;
      submitButton.value = originalButtonText;
    }
  });
})();

// User Login Form Handler
(function() {
  'use strict';

  // Wait for DOM to be ready
  function initUserLogin() {
    const userForm = document.querySelector('.sign-in-form');
    if (!userForm) {
      console.warn('User login form not found');
      return;
    }

    // Get CSRF token helper
    function getCookie(name) {
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
    }

    function getCsrfToken(form) {
      if (form) {
        const csrfInput = form.querySelector('input[name="csrfmiddlewaretoken"]');
        if (csrfInput && csrfInput.value) {
          return csrfInput.value;
        }
      }

      const metaTag = document.querySelector('meta[name="csrf-token"]');
      if (metaTag && metaTag.content) {
        return metaTag.content;
      }

      return getCookie('csrftoken');
    }

    // Extract error message from response
    async function extractErrorMessage(response) {
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
    }

    userForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      // Get PIN from hidden input (populated by moveNext function)
      const pinInput = document.getElementById('pin');
      const empIdInput = userForm.querySelector('input[name="emp_id"]');
      
      let empId = empIdInput ? empIdInput.value.trim() : '';
      let pin = pinInput ? pinInput.value.trim() : '';

      // Fallback: Collect PIN directly from OTP inputs if hidden field is empty
      if (!pin || pin.length !== 4) {
        const otpInputs = userForm.querySelectorAll('.otp-input:not(.admin-otp-input)');
        pin = '';
        otpInputs.forEach((input) => {
          pin += input.value || '';
        });
      }

      // Validate inputs
      if (!empId || !pin) {
        const message = 'Please enter both Employee ID and PIN';
        console.error(message);
        if (typeof showError === 'function') {
          showError(message);
        } else if (typeof showToast === 'function') {
          showToast(message, 'error', { duration: 4000 });
        } else {
          alert(message);
        }
        return;
      }

      // Validate PIN length
      if (pin.length !== 4) {
        const message = 'PIN must be 4 digits';
        console.error(message);
        if (typeof showError === 'function') {
          showError(message);
        } else if (typeof showToast === 'function') {
          showToast(message, 'error', { duration: 4000 });
        } else {
          alert(message);
        }
        return;
      }

      const csrfToken = getCsrfToken(userForm);
      const submitButton = userForm.querySelector('.sign-btn');
      const originalButtonText = submitButton ? submitButton.value : 'Sign In';

      try {
        // Disable submit button
        if (submitButton) {
          submitButton.disabled = true;
          submitButton.value = 'Signing In...';
        }

        const response = await fetch('/api/v2/user/login/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-CSRFToken': csrfToken || '',
          },
          credentials: 'same-origin', // Include cookies for session
          body: JSON.stringify({
            emp_id: parseInt(empId, 10),
            pin: parseInt(pin, 10),
          }),
        });

        if (!response.ok) {
          const errorMessage = await extractErrorMessage(response);
          console.error('Login error:', errorMessage);
          throw new Error(errorMessage);
        }

        const data = await response.json();

        // Show success message (non-blocking)
        if (typeof showSuccess === 'function') {
          showSuccess('Login successful! Redirecting...');
        } else if (typeof showToast === 'function') {
          showToast('Login successful! Redirecting...', 'success', { duration: 2000 });
        }

        // Redirect to user home page immediately
        // Force redirect - try multiple methods to ensure it works
        try {
          window.location.replace('/user/home/');
        } catch (e) {
          console.warn('window.location.replace failed, trying window.location.href:', e);
          window.location.href = '/user/home/';
        }
        
        // Fallback redirect after short delay if above didn't work
        setTimeout(() => {
          if (window.location.pathname !== '/user/home/') {
            console.warn('Redirect did not work, forcing redirect');
            window.location.href = '/user/home/';
          }
        }, 500);

      } catch (error) {
        console.error('Login failed:', error);
        const message = error.message || 'Unable to login. Please check your credentials.';
        if (typeof showError === 'function') {
          showError(message);
        } else if (typeof showToast === 'function') {
          showToast(message, 'error', { duration: 4000 });
        } else {
          alert(message);
        }
      } finally {
        // Re-enable submit button
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.value = originalButtonText;
        }
      }
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUserLogin);
  } else {
    // DOM is already ready
    initUserLogin();
  }
})();
