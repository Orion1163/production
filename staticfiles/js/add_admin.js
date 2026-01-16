function validateForm() {
  const pinInputs = document.querySelectorAll(".otp-input");
  let pinValue = "";
  pinInputs.forEach((inp) => (pinValue += inp.value));

  if (pinValue.length !== 4) {
    showWarning("Please enter a complete 4-digit PIN.");
    return false;
  }

  const employeeId = document.getElementById("employeeId").value.trim();
  if (!employeeId || !/^\d+$/.test(employeeId)) {
    showWarning("Please enter a valid numeric Employee ID.");
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
  if (pinHidden) {
    pinHidden.value = pinValue;
  }

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
