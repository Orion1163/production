/**
 * Profile Modal JavaScript
 * Handles user profile modal display and data fetching
 */

(function() {
    'use strict';

    const PROFILE_API_ENDPOINT = '/api/v2/user/profile/';
    let profileModal = null;
    let profileOverlay = null;

    // Role mapping - matches the system role definitions
    const ROLE_LABELS = {
        1: 'Administrator',
        2: 'Quality Control',
        3: 'Tester',
        4: 'Glueing',
        5: 'Cleaning',
        6: 'Spraying',
        7: 'Dispatch',
        8: 'Kit Verification',
        9: 'SMD',
        10: 'SMD QC',
        11: 'Pre-Forming QC',
        12: 'Leaded QC',
        13: 'Production QC',
    };

    function getCookie(name) {
        const cookieValue = document.cookie
            .split(';')
            .map(cookie => cookie.trim())
            .find(cookie => cookie.startsWith(`${name}=`));
        return cookieValue ? decodeURIComponent(cookieValue.split('=')[1]) : '';
    }

    /**
     * Map role value to display name
     * Handles both numeric IDs and string names
     */
    function mapRoleToLabel(role) {
        // If role is already a string and exists in values, return it
        if (typeof role === 'string') {
            // Check if it's already a valid label
            const roleValues = Object.values(ROLE_LABELS);
            if (roleValues.includes(role)) {
                return role;
            }
            // Try to find by name (case-insensitive)
            const found = Object.entries(ROLE_LABELS).find(
                ([_, label]) => label.toLowerCase() === role.toLowerCase()
            );
            if (found) {
                return found[1];
            }
            // If it's a number as string, convert it
            const numRole = parseInt(role, 10);
            if (!isNaN(numRole) && ROLE_LABELS[numRole]) {
                return ROLE_LABELS[numRole];
            }
            // Return as-is if no mapping found
            return role;
        }
        
        // If role is a number, map it
        if (typeof role === 'number' && ROLE_LABELS[role]) {
            return ROLE_LABELS[role];
        }
        
        // Fallback: try to convert to number and map
        const numRole = parseInt(role, 10);
        if (!isNaN(numRole) && ROLE_LABELS[numRole]) {
            return ROLE_LABELS[numRole];
        }
        
        // Return original if no mapping found
        return role;
    }

    /**
     * Process and normalize roles array
     */
    function normalizeRoles(roles) {
        if (!roles || !Array.isArray(roles) || roles.length === 0) {
            return [];
        }
        
        // Map each role to its label and remove duplicates
        const mappedRoles = roles
            .map(role => mapRoleToLabel(role))
            .filter(role => role && role.trim().length > 0);
        
        // Remove duplicates and sort
        return Array.from(new Set(mappedRoles)).sort();
    }

    function createProfileModal() {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'profile-modal-overlay';
        overlay.id = 'profile-modal-overlay';

        // Create modal
        const modal = document.createElement('div');
        modal.className = 'profile-modal';
        modal.id = 'profile-modal';

        modal.innerHTML = `
            <div class="profile-modal-header">
                <h3 class="profile-modal-title">
                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor">
                        <path d="M480-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47ZM160-240v-32q0-34 17.5-62.5T224-378q62-31 126-46.5T480-440q66 0 130 15.5T736-378q29 15 46.5 43.5T800-272v32q0 33-23.5 56.5T720-160H240q-33 0-56.5-23.5T160-240Zm80 0h480v-32q0-11-5.5-20T700-306q-54-27-109-40.5T480-360q-56 0-111 13.5T260-306q-9 5-14.5 14t-5.5 20v32Zm240-320q33 0 56.5-23.5T560-640q0-33-23.5-56.5T480-720q-33 0-56.5 23.5T400-640q0 33 23.5 56.5T480-560Zm0-80Zm0 400Z"/>
                    </svg>
                    Profile
                </h3>
                <div class="profile-modal-header-actions">
                    <form action="/user/logout/" method="post" style="margin: 0; display: inline;">
                        <input type="hidden" name="csrfmiddlewaretoken" value="${getCookie('csrftoken')}">
                        <button type="submit" class="profile-logout-icon" title="Logout">
                            <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor">
                                <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h280v80H200v560h280v80H200Zm440-160-55-58 102-102H360v-80h327L585-622l55-58 200 200-200 200Z"/>
                            </svg>
                        </button>
                    </form>
                    <button class="profile-modal-close" onclick="closeProfileModal()" title="Close">
                        <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor">
                            <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="profile-modal-body">
                <div class="profile-loading">
                    <div class="profile-spinner"></div>
                    <p>Loading profile...</p>
                </div>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Close on overlay click
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                closeProfileModal();
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && overlay.classList.contains('active')) {
                closeProfileModal();
            }
        });

        return { overlay, modal };
    }

    function renderProfileLoading() {
        const body = profileModal.querySelector('.profile-modal-body');
        body.innerHTML = `
            <div class="profile-loading">
                <div class="profile-spinner"></div>
                <p>Loading profile...</p>
            </div>
        `;
    }

    function renderProfileError(message) {
        const body = profileModal.querySelector('.profile-modal-body');
        body.innerHTML = `
            <div class="profile-error">
                <svg xmlns="http://www.w3.org/2000/svg" height="48px" viewBox="0 -960 960 960" width="48px" fill="currentColor" style="margin-bottom: 1rem;">
                    <path d="M480-280q17 0 28.5-11.5T520-320q0-17-11.5-28.5T480-360q-17 0-28.5 11.5T440-320q0 17 11.5 28.5T480-280Zm-40-160h80v-240h-80v240Zm40 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/>
                </svg>
                <p>${message || 'Failed to load profile data'}</p>
            </div>
        `;
    }

    function renderProfileData(userData) {
        const user = userData.user || userData;
        const name = user.name || 'User';
        const empId = user.emp_id || 'N/A';
        const rawRoles = user.roles || [];
        const roles = normalizeRoles(rawRoles);
        const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

        const body = profileModal.querySelector('.profile-modal-body');
        body.innerHTML = `
            <div class="profile-avatar">${initials}</div>
            <div class="profile-name">
                <h2>${name}</h2>
                <p class="profile-emp-id">Employee ID: ${empId}</p>
            </div>

            <div class="profile-info-section">
                <div class="profile-info-label">Personal Information</div>
                <div class="profile-info-item">
                    <svg class="profile-info-icon" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor">
                        <path d="M480-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47ZM160-240v-32q0-34 17.5-62.5T224-378q62-31 126-46.5T480-440q66 0 130 15.5T736-378q29 15 46.5 43.5T800-272v32q0 33-23.5 56.5T720-160H240q-33 0-56.5-23.5T160-240Zm80 0h480v-32q0-11-5.5-20T700-306q-54-27-109-40.5T480-360q-56 0-111 13.5T260-306q-9 5-14.5 14t-5.5 20v32Zm240-320q33 0 56.5-23.5T560-640q0-33-23.5-56.5T480-720q-33 0-56.5 23.5T400-640q0 33 23.5 56.5T480-560Zm0-80Zm0 400Z"/>
                    </svg>
                    <div class="profile-info-content">
                        <div class="profile-info-label-text">Name</div>
                        <div class="profile-info-value">${name}</div>
                    </div>
                </div>
                <div class="profile-info-item">
                    <svg class="profile-info-icon" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor">
                        <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm280-240q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35ZM240-560h320v-80H240v80Z"/>
                    </svg>
                    <div class="profile-info-content">
                        <div class="profile-info-label-text">Employee ID</div>
                        <div class="profile-info-value">${empId}</div>
                    </div>
                </div>
            </div>

            ${roles.length > 0 ? `
            <div class="profile-info-section">
                <div class="profile-info-label">Roles & Permissions</div>
                <div class="profile-roles">
                    ${roles.map(role => `<span class="profile-role-badge">${role}</span>`).join('')}
                </div>
            </div>
            ` : ''}

            <div class="profile-actions">
                <a href="/user/home/" class="profile-action-btn profile-action-btn-primary">
                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor">
                        <path d="M240-200h120v-200q0-17 11.5-28.5T400-440h160q17 0 28.5 11.5T600-400v200h120v-360L480-740 240-560v360Zm-80 0v-360q0-19 8.5-36t23.5-28l240-180q21-16 48-16t48 16l240 180q15 11 23.5 28t8.5 36v360q0 33-23.5 56.5T720-120H560q-17 0-28.5-11.5T520-160v-200h-80v200q0 17-11.5 28.5T400-120H240q-33 0-56.5-23.5T160-200Zm320-270Z"/>
                    </svg>
                    Go to Models
                </a>
            </div>
        `;
    }

    async function fetchUserProfile() {
        renderProfileLoading();

        try {
            const response = await fetch(PROFILE_API_ENDPOINT, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken'),
                },
                credentials: 'same-origin',
            });

            if (!response.ok) {
                if (response.status === 401) {
                    renderProfileError('Session expired. Please login again.');
                    setTimeout(() => {
                        window.location.href = '/login/';
                    }, 2000);
                    return;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            renderProfileData(data);
        } catch (error) {
            console.error('Error fetching user profile:', error);
            renderProfileError('Failed to load profile data. Please try again.');
        }
    }

    function openProfileModal() {
        if (!profileModal || !profileOverlay) {
            const { overlay, modal } = createProfileModal();
            profileOverlay = overlay;
            profileModal = modal;
        }

        profileOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        fetchUserProfile();
    }

    function closeProfileModal() {
        if (profileOverlay) {
            profileOverlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    // Make functions globally available
    window.openProfileModal = openProfileModal;
    window.closeProfileModal = closeProfileModal;

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            // Modal will be created on first open
        });
    }
})();

