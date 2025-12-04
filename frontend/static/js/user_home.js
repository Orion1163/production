/**
 * User Home Page JavaScript
 * Handles model loading, search functionality, and card rendering
 */

(function() {
    'use strict';

    const API_ENDPOINT = '/api/v2/user/models/';
    const container = document.getElementById('modelsContainer');
    const searchInput = document.getElementById('searchInput');
    let allModels = [];

    function getCookie(name) {
        const cookieValue = document.cookie
            .split(';')
            .map(cookie => cookie.trim())
            .find(cookie => cookie.startsWith(`${name}=`));
        return cookieValue ? decodeURIComponent(cookieValue.split('=')[1]) : '';
    }

    function createModelCard(model) {
        const card = document.createElement('div');
        card.className = 'model-card';
        card.setAttribute('data-model-no', model.model_no.toLowerCase());

        const imageUrl = model.image_url || '';
        const hasImage = imageUrl && imageUrl.trim() !== '';

        const imageHtml = hasImage
            ? `<img src="${imageUrl}" alt="${model.model_no}" loading="lazy">`
            : `<div class="model-card-placeholder">${model.model_no.charAt(0)}</div>`;

        const partsHtml = model.part_numbers && model.part_numbers.length > 0
            ? model.part_numbers.map(partNo => 
                `<span class="part-badge">${partNo}</span>`
              ).join('')
            : '<span class="part-badge" style="opacity: 0.6;">No parts</span>';

        card.innerHTML = `
            <div class="model-card-image">
                ${imageHtml}
            </div>
            <div class="model-card-content">
                <div class="model-card-title">${model.model_no}</div>
                <div class="model-card-parts">
                    <div class="parts-label">Parts (${model.part_count || 0})</div>
                    <div class="parts-list">
                        ${partsHtml}
                    </div>
                </div>
            </div>
        `;

        card.addEventListener('click', function() {
            window.location.href = `/procedure-detail/${model.model_no}/`;
        });

        return card;
    }

    function filterModels(searchTerm) {
        const term = searchTerm.toLowerCase().trim();
        
        if (!term) {
            renderModels(allModels);
            return;
        }

        const filtered = allModels.filter(model => 
            model.model_no.toLowerCase().includes(term) ||
            model.part_numbers.some(part => part.toLowerCase().includes(term))
        );

        renderModels(filtered);
    }

    function renderModels(models) {
        container.innerHTML = '';

        if (models.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="width: 100%;">
                    <div class="empty-state-icon">🔍</div>
                    <h3>No Models Found</h3>
                    <p>Try adjusting your search terms</p>
                </div>
            `;
            return;
        }

        models.forEach(model => {
            const card = createModelCard(model);
            container.appendChild(card);
        });
    }

    function showEmptyState() {
        container.innerHTML = `
            <div class="empty-state" style="width: 100%;">
                <div class="empty-state-icon">📦</div>
                <h3>No Models Available</h3>
                <p>There are no production models available at the moment.</p>
            </div>
        `;
    }

    function showError(message) {
        container.innerHTML = `
            <div class="empty-state" style="width: 100%;">
                <div class="empty-state-icon">⚠️</div>
                <h3>Error Loading Models</h3>
                <p>${message}</p>
            </div>
        `;
    }

    async function loadModels() {
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

            if (!data || data.length === 0) {
                showEmptyState();
                return;
            }

            allModels = data;
            renderModels(allModels);

        } catch (error) {
            console.error('Error fetching models:', error);
            showError('Failed to load models. Please refresh the page.');
        }
    }

    function init() {
        // Search functionality
        if (searchInput) {
            searchInput.addEventListener('input', function(e) {
                filterModels(e.target.value);
            });
        }

        // Load models when page loads
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', loadModels);
        } else {
            loadModels();
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

