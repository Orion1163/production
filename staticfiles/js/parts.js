/**
 * Parts Page JavaScript
 * Handles part loading and card rendering for a specific model
 */

(function () {
    'use strict';

    const MODEL_NO = window.MODEL_NO;
    const API_ENDPOINT = `/api/v2/user/models/${MODEL_NO}/parts/`;
    const container = document.getElementById('partsContainer');
    const modelTitle = document.getElementById('modelTitle');

    function getCookie(name) {
        const cookieValue = document.cookie
            .split(';')
            .map(cookie => cookie.trim())
            .find(cookie => cookie.startsWith(`${name}=`));
        return cookieValue ? decodeURIComponent(cookieValue.split('=')[1]) : '';
    }

    function createPartCard(part) {
        const card = document.createElement('div');
        card.className = 'part-card model-card';
        card.setAttribute('data-part-no', part.part_no.toLowerCase());

        // Use part_image_url first, then try local image, then placeholder
        const apiImageUrl = part.part_image_url || part.form_image_url;
        const localImageUrl = `/static/img/${part.part_no.toLowerCase()}.png`;

        let imageHtml;
        // Note: class attribute unquoted to avoid quote nesting hell in inline onerror handler
        const placeholderHtml = `<div class=model-card-placeholder>${part.part_no.charAt(0)}</div>`;

        if (apiImageUrl && apiImageUrl.trim() !== '') {
            imageHtml = `<img src="${apiImageUrl}" alt="${part.part_no}" loading="lazy" onerror="this.onerror=null; this.src='${localImageUrl}'; this.onerror=function(){ this.parentElement.innerHTML='${placeholderHtml}'; }">`;
        } else {
            imageHtml = `<img src="${localImageUrl}" alt="${part.part_no}" loading="lazy" onerror="this.style.display='none'; this.parentElement.innerHTML='${placeholderHtml}';">`;
        }

        card.innerHTML = `
            <div class="model-card-image">
                ${imageHtml}
            </div>
            <div class="model-card-content">
                <div class="model-card-title">${part.part_no}</div>
                <div class="part-meta">
                    <div class="meta-item">
                        <span class="meta-label">Model:</span>
                        <span class="meta-value">${part.model_no}</span>
                    </div>
                </div>
            </div>
        `;

        // Add click handler - navigate to first enabled section
        card.addEventListener('click', async function (e) {
            e.preventDefault();
            e.stopPropagation();

            // Fetch enabled sections for this part
            try {
                const sectionsResponse = await fetch(`/api/v2/user/parts/${encodeURIComponent(part.part_no)}/sections/`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'X-CSRFToken': getCookie('csrftoken'),
                    },
                    credentials: 'same-origin',
                });

                if (!sectionsResponse.ok) {
                    if (sectionsResponse.status === 403) {
                        // Access denied
                        const errorData = await sectionsResponse.json().catch(() => ({}));
                        const errorMessage = errorData.message || 'You do not have permission to access this part.';

                        if (typeof showError === 'function') {
                            showError(errorMessage, { duration: 6000 });
                        } else if (typeof window.showToast === 'function') {
                            window.showToast(errorMessage, 'error', { duration: 6000 });
                        }
                        return;
                    }
                    throw new Error(`HTTP error! status: ${sectionsResponse.status}`);
                }

                const sectionsData = await sectionsResponse.json();

                // Get the first enabled section
                if (sectionsData && sectionsData.sections && sectionsData.sections.length > 0) {
                    const firstSection = sectionsData.sections[0];
                    const url = `/user/parts/${encodeURIComponent(part.part_no)}/section/${encodeURIComponent(firstSection.key)}/`;
                    window.location.href = url;
                } else {
                    // No sections enabled for this part
                    const message = `No sections are enabled for part ${part.part_no}. Please contact an administrator.`;
                    if (typeof showWarning === 'function') {
                        showWarning(message, { duration: 5000 });
                    } else if (typeof window.showToast === 'function') {
                        window.showToast(message, 'warning', { duration: 5000 });
                    }
                }
            } catch (error) {
                console.error('Error fetching sections:', error);
                const message = `Unable to load sections for part ${part.part_no}. Please try again later.`;
                if (typeof showError === 'function') {
                    showError(message, { duration: 5000 });
                } else if (typeof window.showToast === 'function') {
                    window.showToast(message, 'error', { duration: 5000 });
                }
            }
        });

        return card;
    }

    function showEmptyState() {
        container.innerHTML = `
            <div class="empty-state" style="width: 100%;">
                <div class="empty-state-icon">📦</div>
                <h3>No Parts Available</h3>
                <p>There are no parts available for model ${MODEL_NO}.</p>
            </div>
        `;
    }

    function showError(message) {
        container.innerHTML = `
            <div class="empty-state" style="width: 100%;">
                <div class="empty-state-icon">⚠️</div>
                <h3>Error Loading Parts</h3>
                <p>${message}</p>
            </div>
        `;
    }

    async function loadParts() {
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

            if (!data || !data.parts || data.parts.length === 0) {
                showEmptyState();
                return;
            }

            // Update title if needed
            if (data.model_no && modelTitle) {
                modelTitle.textContent = data.model_no;
            }

            // Clear container
            container.innerHTML = '';

            // Render all parts
            data.parts.forEach(part => {
                const card = createPartCard(part);
                container.appendChild(card);
            });

        } catch (error) {
            console.error('Error fetching parts:', error);
            showError('Failed to load parts. Please refresh the page.');
        }
    }

    function init() {
        // Load parts when page loads
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', loadParts);
        } else {
            loadParts();
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

