/**
 * Admin authentication helpers for login/logout API integration.
 */
(function () {
  const LOGIN_ENDPOINT = "/api/v2/admin/login/";
  const LOGOUT_ENDPOINT = "/api/v2/admin/logout/";

  function getCookie(name) {
    const cookieValue = document.cookie
      .split(";")
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith(`${name}=`));
    return cookieValue ? decodeURIComponent(cookieValue.split("=")[1]) : "";
  }

  function showMessage(message, type = "info") {
    if (typeof window.showToast === "function") {
      window.showToast(message, type, { duration: 4000 });
    } else {
      window.alert(message);
    }
  }

  async function handleAdminLogin(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const empInput = form.querySelector('input[name="admin_emp_id"]');
    const pinValue = document.getElementById("admin-pin")
      ? document.getElementById("admin-pin").value
      : "";

    const empId = empInput ? empInput.value.trim() : "";

    if (!empId || !pinValue || pinValue.length !== 4) {
      showMessage("Enter a valid employee ID and 4-digit PIN.", "error");
      return;
    }

    const redirectUrl = form.dataset.successRedirect || "/";

    try {
      const response = await fetch(LOGIN_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCookie("csrftoken"),
        },
        credentials: "same-origin",
        body: JSON.stringify({
          emp_id: parseInt(empId, 10),
          pin: parseInt(pinValue, 10),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = data.error || "Unable to login as admin.";
        showMessage(message, "error");
        return;
      }

      showMessage("Logged in successfully.", "success");
      window.location.href = redirectUrl;
    } catch (error) {
      showMessage("Network error while logging in.", "error");
    }
  }

  async function handleAdminLogout(event) {
    event.preventDefault();
    const target = event.currentTarget;
    const redirectUrl = target.dataset.redirect || "/";

    try {
      const response = await fetch(LOGOUT_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCookie("csrftoken"),
        },
        credentials: "same-origin",
      });

      if (!response.ok) {
        showMessage("Unable to logout. Please try again.", "error");
        return;
      }

      showMessage("Logged out successfully.", "success");
      window.location.href = redirectUrl;
    } catch (error) {
      showMessage("Network error while logging out.", "error");
    }
  }

  function initAdminLoginForm() {
    const form = document.querySelector(".admin-form");
    if (!form) {
      return;
    }
    form.addEventListener("submit", handleAdminLogin);
  }

  function initLogoutLinks() {
    const logoutLinks = document.querySelectorAll(".logout-link");
    logoutLinks.forEach((link) => {
      link.addEventListener("click", handleAdminLogout);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initAdminLoginForm();
    initLogoutLinks();
  });
})();


