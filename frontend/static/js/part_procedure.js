/**
 * Part Procedure Page JavaScript
 * Handles loading enabled sections and populating the sidebar
 */

(function() {
    'use strict';

    const PART_NO = window.PART_NO;
    const API_ENDPOINT = `/api/v2/user/parts/${PART_NO}/sections/`;
    const sidebarList = document.getElementById('sidebar-list');
    const partTitle = document.getElementById('partTitle');
    const partSubtitle = document.getElementById('partSubtitle');

    function getCookie(name) {
        const cookieValue = document.cookie
            .split(';')
            .map(cookie => cookie.trim())
            .find(cookie => cookie.startsWith(`${name}=`));
        return cookieValue ? decodeURIComponent(cookieValue.split('=')[1]) : '';
    }

    // Section icon mapping
    const sectionIcons = {
        'kit': `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e8eaed">
            <path d="M200-120q-33 0-56.5-23.5T120-200v-480q0-33 23.5-56.5T200-760h80v-80q0-33 23.5-56.5T360-920h240q33 0 56.5 23.5T680-840v80h80q33 0 56.5 23.5T840-680v480q0 33-23.5 56.5T760-120H200Zm160-640h240v-80H360v80Zm-80 400h320v-80H280v80Zm0 160h320v-80H280v80Z"/>
        </svg>`,
        'smd': `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e8eaed">
            <path d="M480-120 200-400v-280h80v-200h400v200h80v280L480-120Zm-40-200 120-120v-200h-120v200l-120 120 120 120Zm40 100 200-200v-200H280v200l200 200Zm0-340h80v-40h-80v40Zm-160 80h40v-80h-40v80Zm400 0h40v-80h-40v80ZM280-480h400v-120H280v120Zm200 280v-200h-40v200h40Z"/>
        </svg>`,
        'smd_qc': `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e8eaed">
            <path d="M480-120q-134 0-227-93t-93-227q0-60 20-115t58-103l182-182 182 182q38 45 58 103t20 115q0 134-93 227t-227 93Zm0-80q83 0 141.5-58.5T680-440q0-42-16-80.5T624-584L480-728 336-584q-24 28-40 66.5T280-440q0 83 58.5 141.5T480-240Zm-40-280h80v-80h-80v80Zm0-120h80v-80h-80v80Zm160 240v-80h80v80h-80Zm-240-80v-80h80v80h-80Z"/>
        </svg>`,
        'pre_forming_qc': `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e8eaed">
            <path d="M200-200v-560q0-33 23.5-56.5T280-840h400q33 0 56.5 23.5T760-760v560H200Zm80-80h400v-400H280v400Zm0-480h400v-80H280v80Zm120 280h160v-80H400v80Zm0-160h160v-80H400v80Z"/>
        </svg>`,
        'accessories_packing': `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e8eaed">
            <path d="M200-120q-33 0-56.5-23.5T120-200v-480q0-33 23.5-56.5T200-760h80v-80q0-33 23.5-56.5T360-920h240q33 0 56.5 23.5T680-840v80h80q33 0 56.5 23.5T840-680v480q0 33-23.5 56.5T760-120H200Zm160-640h240v-80H360v80Zm-80 400h320v-80H280v80Zm0 160h320v-80H280v80Z"/>
        </svg>`,
        'leaded_qc': `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e8eaed">
            <path d="M480-120q-134 0-227-93t-93-227q0-60 20-115t58-103l182-182 182 182q38 45 58 103t20 115q0 134-93 227t-227 93Zm0-80q83 0 141.5-58.5T680-440q0-42-16-80.5T624-584L480-728 336-584q-24 28-40 66.5T280-440q0 83 58.5 141.5T480-240Zm-200-200h400v-80H280v80Z"/>
        </svg>`,
        'prod_qc': `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e8eaed">
            <path d="M480-120q-75 0-140.5-28.5t-114-77q-48.5-48.5-77-114T120-480q0-75 28.5-140.5t77-114q48.5-48.5 114-77T480-840q75 0 140.5 28.5t114 77q48.5 48.5 77 114T840-480q0 75-28.5 140.5t-77 114q-48.5 48.5-114 77T480-120Zm0-80q117 0 198.5-81.5T760-480q0-117-81.5-198.5T480-760q-117 0-198.5 81.5T200-480q0 117 81.5 198.5T480-200Zm-40-280 200-200 56 56-144 144 144 144-56 56-200-200Z"/>
        </svg>`,
        'qc': `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e8eaed">
            <path d="m424-296 282-282-56-56-226 226-114-114-56 56 170 170Zm56 216q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/>
        </svg>`,
        'testing': `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e8eaed">
            <path d="M320-240 80-480l240-240 57 57-184 184 184 183-57 56Zm320 0-57-57 184-183-184-184 57-56 240 240-240 240Z"/>
        </svg>`,
        'heat_run': `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e8eaed">
            <path d="M480-120q-134 0-227-93t-93-227q0-60 20-115t58-103l182-182 182 182q38 45 58 103t20 115q0 134-93 227t-227 93Zm0-80q83 0 141.5-58.5T680-440q0-42-16-80.5T624-584L480-728 336-584q-24 28-40 66.5T280-440q0 83 58.5 141.5T480-240Zm-40-280h80v-80h-80v80Zm0-120h80v-80h-80v80Z"/>
        </svg>`,
        'glueing': `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e8eaed">
            <path d="M280-200v-280h400v280H280Zm80-200h240v120H360v-120Zm-80-200v-80h400v80H280Zm0-120v-80h400v80H280Z"/>
        </svg>`,
        'cleaning': `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e8eaed">
            <path d="M480-120 200-400v-280h80v-200h400v200h80v280L480-120Zm-40-200 120-120v-200h-120v200l-120 120 120 120Zm40 100 200-200v-200H280v200l200 200Zm0-340h80v-40h-80v40Zm-160 80h40v-80h-40v80Zm400 0h40v-80h-40v80ZM280-480h400v-120H280v120Zm200 280v-200h-40v200h40Z"/>
        </svg>`,
        'spraying': `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e8eaed">
            <path d="M480-120q-134 0-227-93t-93-227q0-60 20-115t58-103l182-182 182 182q38 45 58 103t20 115q0 134-93 227t-227 93Zm0-80q83 0 141.5-58.5T680-440q0-42-16-80.5T624-584L480-728 336-584q-24 28-40 66.5T280-440q0 83 58.5 141.5T480-240Zm-40-280h80v-80h-80v80Zm0-120h80v-80h-80v80Z"/>
        </svg>`,
        'dispatch': `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e8eaed">
            <path d="M240-200q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Zm0-80q17 0 28.5-11.5T280-320q0-17-11.5-28.5T240-360q-17 0-28.5 11.5T200-320q0 17 11.5 28.5T240-280Zm520 80q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Zm0-80q17 0 28.5-11.5T800-320q0-17-11.5-28.5T760-360q-17 0-28.5 11.5T720-320q0 17 11.5 28.5T760-280ZM280-440h400v-80H280v80Zm-40-120h480l-58-160H242l-58 160Zm-58 80-22-60h604l-22 60H182Zm98 280q-23 0-39.5-18T226-320l74-200h360l74 200q4 24-12.5 42T680-80H280Zm200-280H280h400Z"/>
        </svg>`
    };

    function createSidebarItem(section) {
        const li = document.createElement('li');
        const a = document.createElement('a');
        
        // Create URL for the section page
        const sectionUrl = `/user/parts/${encodeURIComponent(PART_NO)}/section/${encodeURIComponent(section.key)}/`;
        a.href = sectionUrl;
        a.setAttribute('data-section', section.key);
        
        // Get specific icon for section or use default
        const iconSvg = sectionIcons[section.key] || `
            <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e8eaed">
                <path d="M240-200h120v-200q0-17 11.5-28.5T400-440h160q17 0 28.5 11.5T600-400v200h120v-360L480-740 240-560v360Zm-80 0v-360q0-19 8.5-36t23.5-28l240-180q21-16 48-16t48 16l240 180q15 11 23.5 28t8.5 36v360q0 33-23.5 56.5T720-120H560q-17 0-28.5-11.5T520-160v-200h-80v200q0 17-11.5 28.5T400-120H240q-33 0-56.5-23.5T160-200Zm320-270Z"/>
            </svg>
        `;
        
        a.innerHTML = iconSvg + `<span>${section.name}</span>`;
        
        li.appendChild(a);
        return li;
    }

    async function loadSections() {
        try {
            const response = await fetch(API_ENDPOINT, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken'),
                },
                credentials: 'same-origin',
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (!data || !data.sections || data.sections.length === 0) {
                // No sections enabled
                if (partSubtitle) {
                    partSubtitle.textContent = 'No sections enabled for this part';
                }
                return;
            }

            // Update title if needed
            if (data.part_no && partTitle) {
                partTitle.textContent = data.part_no;
            }
            if (data.model_no && partSubtitle) {
                partSubtitle.textContent = `Model: ${data.model_no} - ${data.count} section(s) enabled`;
            }
            
            // Update sidebar logo with part number
            const sidebarLogo = document.getElementById('sidebar-logo');
            if (data.part_no && sidebarLogo) {
                sidebarLogo.textContent = data.part_no;
            }

            // Get the first li (logo/toggle button) to preserve it
            const firstLi = sidebarList.querySelector('li:first-child');
            
            // Clear all items except the first one
            while (sidebarList.children.length > 1) {
                sidebarList.removeChild(sidebarList.lastChild);
            }

            // Add enabled sections
            data.sections.forEach(section => {
                const item = createSidebarItem(section);
                sidebarList.appendChild(item);
            });

            // Add logout link at the end
            const logoutLi = document.createElement('li');
            const logoutLink = document.createElement('a');
            logoutLink.href = '/user/logout/';
            logoutLink.className = 'logout-link';
            logoutLink.innerHTML = `
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  height="24px"
                  viewBox="0 -960 960 960"
                  width="24px"
                  fill="#e8eaed"
                >
                  <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h280v80H200v560h280v80H200Zm440-160-55-58 102-102H360v-80h327L585-622l55-58 200 200-200 200Z"/>
                </svg>
                <span>Logout</span>
            `;
            logoutLi.appendChild(logoutLink);
            sidebarList.appendChild(logoutLi);

        } catch (error) {
            console.error('Error fetching sections:', error);
            if (partSubtitle) {
                partSubtitle.textContent = 'Error loading sections. Please refresh the page.';
            }
        }
    }

    function init() {
        // Load sections when page loads
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', loadSections);
        } else {
            loadSections();
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

