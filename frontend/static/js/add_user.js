function validateForm() {
    // Check if at least one role is selected
    const selectedRoles = document.querySelectorAll(
      '.options input[type="checkbox"]:checked'
    );
    if (selectedRoles.length === 0) {
      showWarning("Please select at least one role.");
      return false; // Prevent form submission
    }
    return true; // Allow form submission
  }
  function moveNext(input, index) {
    let inputs = document.querySelectorAll(".otp-input");
    let pinHidden = document.getElementById("pin");

    // Allow only numeric input
    input.value = input.value.replace(/[^0-9]/g, "");

    // Move to next input if filled
    if (input.value && index < inputs.length - 1) {
      inputs[index + 1].focus();
    }

    // Collect PIN value
    let pinValue = "";
    inputs.forEach((inp) => (pinValue += inp.value));
    pinHidden.value = pinValue; // Store in hidden input for form submission
  }

  function handleBackspace(input, index) {
    let inputs = document.querySelectorAll(".otp-input");

    // If backspace is pressed and field is empty, move to previous input
    if (event.key === "Backspace" && !input.value && index > 0) {
      inputs[index - 1].value = ""; // Clear previous field
      inputs[index - 1].focus(); // Move focus back
    }
  }

  function toggleVisibility() {
    let inputs = document.querySelectorAll(".otp-input");
    let button = document.getElementById("toggle-visibility");

    if (inputs[0].type === "password") {
      inputs.forEach((input) => (input.type = "text"));
      button.innerText = "Hide";
    } else {
      inputs.forEach((input) => (input.type = "password"));
      button.innerText = "Show";
    }
  }

  function toggleDropdown() {
    let options = document.querySelector(".options");
    options.style.display =
      options.style.display === "block" ? "none" : "block";
  }

  function updateSelection() {
    let selectedContainer = document.getElementById("selected-items");
    selectedContainer.innerHTML = "";

    document
      .querySelectorAll('.options input[type="checkbox"]:checked')
      .forEach((option) => {
        let displayName = option.getAttribute("data-name"); // Get the display name
        let span = document.createElement("span");
        span.classList.add("selected-item");
        span.innerHTML = `${displayName} <span class="remove" onclick="removeSelection(${option.value})">×</span>`;
        selectedContainer.appendChild(span);
      });

    if (selectedContainer.children.length === 0) {
      selectedContainer.innerText = "Select Options";
    }
  }

  function removeSelection(value) {
    document.querySelector(`.options input[value="${value}"]`).checked = false;
    updateSelection();
  }
  document.addEventListener("click", function (event) {
    if (!event.target.closest(".multi-select")) {
      document.querySelector(".options").style.display = "none";
    }
  });