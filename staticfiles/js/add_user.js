function syncRolesHiddenField() {
  const selectedRoles = Array.from(
    document.querySelectorAll('.options input[type="checkbox"]:checked')
  ).map((checkbox) => checkbox.value);
  const hiddenField = document.getElementById("roles");
  if (hiddenField) {
    hiddenField.value = selectedRoles.join(",");
  }
  return selectedRoles;
}

function validateForm() {
  const selectedRoles = syncRolesHiddenField();
  if (selectedRoles.length === 0) {
    showWarning("Please select at least one role.");
    return false;
  }

  const pinInputs = document.querySelectorAll(".otp-input");
  let pinValue = "";
  pinInputs.forEach((inp) => (pinValue += inp.value));

  if (pinValue.length !== 4) {
    showWarning("Please enter a complete 4-digit PIN.");
    return false;
  }

  return true;
}

function moveNext(input, index) {
  const inputs = document.querySelectorAll(".otp-input");
  const pinHidden = document.getElementById("pin");
  const toggleButton = document.getElementById("toggle-visibility");

  input.value = input.value.replace(/[^0-9]/g, "");

  if (input.value && index < inputs.length - 1) {
    inputs[index + 1].focus();
  }

  let pinValue = "";
  inputs.forEach((inp) => (pinValue += inp.value));
  pinHidden.value = pinValue;

  if (toggleButton && toggleButton.classList.contains("is-active")) {
    updatePinPreview(true);
  }
}

function handleBackspace(event, input, index) {
  const inputs = document.querySelectorAll(".otp-input");

  if (event.key === "Backspace" && !input.value && index > 0) {
    inputs[index - 1].value = "";
    inputs[index - 1].focus();
  }
}

function toggleVisibility() {
  const inputs = document.querySelectorAll(".otp-input");
  const button = document.getElementById("toggle-visibility");

  if (!inputs.length || !button) return;

  const shouldShow = inputs[0].type === "password";
  inputs.forEach((input) => (input.type = shouldShow ? "text" : "password"));
  button.classList.toggle("is-active", shouldShow);
  button.setAttribute("aria-pressed", shouldShow ? "true" : "false");
  button.setAttribute("aria-label", shouldShow ? "Hide PIN" : "Show PIN");

  updatePinPreview(shouldShow);
}

function updatePinPreview(isVisible) {
  const preview = document.getElementById("pin-preview");
  if (!preview) return;

  if (!isVisible) {
    preview.textContent = "";
    preview.classList.remove("is-visible");
    return;
  }

  const digits = Array.from(document.querySelectorAll(".otp-input")).map((input) => input.value || "•");
  const previewValue = digits.join(" ");
  preview.textContent = previewValue.trim() ? previewValue : "—";
  preview.classList.add("is-visible");
}

function toggleDropdown(trigger) {
  const multiSelect = trigger.closest(".multi-select");
  if (!multiSelect) return;

  const options = multiSelect.querySelector(".options");
  if (!options) return;

  const isOpen = options.style.display === "block";
  options.style.display = isOpen ? "none" : "block";
  trigger.setAttribute("aria-expanded", (!isOpen).toString());
}

function updateSelection(changedCheckbox) {
  const adminCheckbox = document.querySelector('.options input[value="1"]');
  const allCheckboxes = document.querySelectorAll('.options input[type="checkbox"]');

  if (adminCheckbox) {
    if (adminCheckbox.checked) {
      allCheckboxes.forEach((checkbox) => {
        checkbox.checked = true;
      });
    } else if (changedCheckbox === adminCheckbox) {
      allCheckboxes.forEach((checkbox) => {
        checkbox.checked = false;
      });
    }
  }

  const selectedContainer = document.getElementById("selected-items");
  if (!selectedContainer) return;

  selectedContainer.innerHTML = "";

  document
    .querySelectorAll('.options input[type="checkbox"]:checked')
    .forEach((option) => {
      const displayName = option.getAttribute("data-name");
      const span = document.createElement("span");
      span.classList.add("selected-item");
      span.innerHTML = `${displayName} <span class="remove" onclick="removeSelection('${option.value}')">×</span>`;
      selectedContainer.appendChild(span);
    });

  if (selectedContainer.children.length === 0) {
    selectedContainer.textContent = "Select options";
    selectedContainer.classList.add("is-empty");
  } else {
    selectedContainer.classList.remove("is-empty");
  }

  syncRolesHiddenField();
}

function removeSelection(value) {
  const option = document.querySelector(`.options input[value="${value}"]`);
  if (option) {
    option.checked = false;
  }
  updateSelection();
}

document.addEventListener("click", function (event) {
  document.querySelectorAll(".multi-select").forEach((multiSelect) => {
    if (!multiSelect.contains(event.target)) {
      const options = multiSelect.querySelector(".options");
      const trigger = multiSelect.querySelector(".select-box");
      if (options) {
        options.style.display = "none";
      }
      if (trigger) {
        trigger.setAttribute("aria-expanded", "false");
      }
    }
  });
});

document.addEventListener("DOMContentLoaded", updateSelection);