// Dashboard JavaScript
// Handles data fetching, chart rendering, and UI updates

const API_BASE_URL = '/api/v2';

// Chart instances
let modelsOverTimeChart = null;
let partsByModelChart = null;
let productionBySectionChart = null;

// Initialize dashboard on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
    setupInteractiveEffects();
    
    // Refresh button handler
    const refreshBtn = document.getElementById('refreshDashboard');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            refreshBtn.classList.add('spinning');
            initializeDashboard().finally(() => {
                setTimeout(() => {
                    refreshBtn.classList.remove('spinning');
                }, 500);
            });
        });
    }
});

// Setup interactive effects for stat cards
function setupInteractiveEffects() {
    const statCards = document.querySelectorAll('.stat-card');
    
    statCards.forEach(card => {
        card.addEventListener('mousemove', function(e) {
            const rect = card.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            
            card.style.setProperty('--mouse-x', x + '%');
            card.style.setProperty('--mouse-y', y + '%');
        });
        
        card.addEventListener('mouseleave', function() {
            card.style.setProperty('--mouse-x', '50%');
            card.style.setProperty('--mouse-y', '50%');
        });
    });
}

// Initialize dashboard
async function initializeDashboard() {
    try {
        // Show loading states
        showLoadingStates();
        
        // Fetch data in parallel
        const [statsData, chartData] = await Promise.all([
            fetchDashboardStats(),
            fetchDashboardCharts()
        ]);
        
        // Update UI
        updateStatsCards(statsData);
        // Charts removed - only render activity
        renderRecentActivity(chartData.recent_activity || []);
        
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        showError('Failed to load dashboard data. Please try again.');
    }
}

// Fetch dashboard statistics
async function fetchDashboardStats() {
    try {
        const response = await fetch(`${API_BASE_URL}/dashboard/stats/`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching stats:', error);
        throw error;
    }
}

// Fetch dashboard chart data
async function fetchDashboardCharts() {
    try {
        const response = await fetch(`${API_BASE_URL}/dashboard/charts/`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching charts:', error);
        throw error;
    }
}

// Update statistics cards
function updateStatsCards(stats) {
    // Animate numbers
    animateValue('totalModels', 0, stats.total_models || 0, 1000);
    animateValue('totalParts', 0, stats.total_parts || 0, 1000);
    animateValue('totalUsers', 0, stats.total_users || 0, 1000);
    animateValue('totalProcedures', 0, stats.total_procedures || 0, 1000);
    animateValue('totalProduction', 0, stats.total_production_entries || 0, 1000);
    
    // Update recent counts
    const recentModelsEl = document.getElementById('recentModels');
    const recentPartsEl = document.getElementById('recentParts');
    
    if (recentModelsEl) {
        recentModelsEl.textContent = `+${stats.recent_models_count || 0} this week`;
    }
    if (recentPartsEl) {
        recentPartsEl.textContent = `+${stats.recent_parts_count || 0} this week`;
    }
}

// Animate number counting
function animateValue(id, start, end, duration) {
    const element = document.getElementById(id);
    if (!element) return;
    
    const safeStart = Number(start) || 0;
    const safeEnd = Number(end) || 0;

    // If values are the same (e.g., no data), just set and exit to avoid
    // negative counting or divide-by-zero timing.
    if (safeStart === safeEnd) {
        element.textContent = safeEnd.toLocaleString();
        return;
    }

    const range = safeEnd - safeStart;
    const increment = range > 0 ? 1 : -1;
    const stepTime = Math.max(Math.floor(duration / Math.abs(range)), 16);
    let current = safeStart;
    
    const timer = setInterval(function() {
        current += increment;
        element.textContent = current.toLocaleString();
        if (current === safeEnd) {
            clearInterval(timer);
        }
    }, stepTime);
}

// Render all charts (charts removed per user request)
function renderCharts(data) {
    // Charts have been removed from the dashboard
    // Keeping function for potential future use
}

// Render models over time line chart
function renderModelsOverTimeChart(data) {
    const ctx = document.getElementById('modelsOverTimeChart');
    if (!ctx) return;
    
    // Destroy existing chart if it exists
    if (modelsOverTimeChart) {
        modelsOverTimeChart.destroy();
    }
    
    const labels = data.map(item => {
        const date = new Date(item.date);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    const values = data.map(item => item.count);
    
    modelsOverTimeChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Models Created',
                data: values,
                borderColor: 'rgb(96, 165, 250)',
                backgroundColor: 'rgba(96, 165, 250, 0.15)',
                tension: 0.4,
                fill: true,
                pointRadius: 6,
                pointHoverRadius: 8,
                pointBackgroundColor: 'rgb(96, 165, 250)',
                pointBorderColor: 'rgba(30, 41, 59, 0.8)',
                pointBorderWidth: 2,
                borderWidth: 3,
                shadowOffsetX: 0,
                shadowOffsetY: 4,
                shadowBlur: 10,
                shadowColor: 'rgba(96, 165, 250, 0.3)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    padding: 14,
                    titleColor: '#e2e8f0',
                    bodyColor: '#cbd5e1',
                    borderColor: 'rgba(96, 165, 250, 0.5)',
                    borderWidth: 1,
                    titleFont: {
                        size: 14,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 13
                    },
                    cornerRadius: 10,
                    displayColors: false,
                    boxPadding: 8
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        color: '#94a3b8',
                        font: {
                            size: 11,
                            weight: '500'
                        }
                    },
                    grid: {
                        color: 'rgba(148, 163, 184, 0.1)',
                        lineWidth: 1
                    },
                    border: {
                        color: 'rgba(148, 163, 184, 0.2)'
                    }
                },
                x: {
                    ticks: {
                        color: '#94a3b8',
                        font: {
                            size: 11,
                            weight: '500'
                        }
                    },
                    grid: {
                        display: false
                    },
                    border: {
                        color: 'rgba(148, 163, 184, 0.2)'
                    }
                }
            }
        }
    });
}

// Render parts by model bar chart
function renderPartsByModelChart(data) {
    const ctx = document.getElementById('partsByModelChart');
    if (!ctx) return;
    
    // Destroy existing chart if it exists
    if (partsByModelChart) {
        partsByModelChart.destroy();
    }
    
    // Sort by count and take top 10
    const sortedData = [...data].sort((a, b) => b.count - a.count).slice(0, 10);
    
    const labels = sortedData.map(item => item.model_no);
    const values = sortedData.map(item => item.count);
    
    // Generate colors
    const colors = generateColors(values.length);
    
    partsByModelChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Parts Count',
                data: values,
                backgroundColor: colors.map(c => c.background),
                borderColor: colors.map(c => c.border),
                borderWidth: 2,
                borderRadius: 10,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    padding: 14,
                    titleColor: '#e2e8f0',
                    bodyColor: '#cbd5e1',
                    borderColor: 'rgba(96, 165, 250, 0.5)',
                    borderWidth: 1,
                    titleFont: {
                        size: 14,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 13
                    },
                    cornerRadius: 10,
                    displayColors: true,
                    boxPadding: 8
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        color: '#94a3b8',
                        font: {
                            size: 11,
                            weight: '500'
                        }
                    },
                    grid: {
                        color: 'rgba(148, 163, 184, 0.1)',
                        lineWidth: 1
                    },
                    border: {
                        color: 'rgba(148, 163, 184, 0.2)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        color: '#94a3b8',
                        font: {
                            size: 11,
                            weight: '500'
                        }
                    },
                    border: {
                        color: 'rgba(148, 163, 184, 0.2)'
                    }
                }
            }
        }
    });
}

// Render production by section pie chart
function renderProductionBySectionChart(data) {
    const ctx = document.getElementById('productionBySectionChart');
    if (!ctx) return;
    
    // Destroy existing chart if it exists
    if (productionBySectionChart) {
        productionBySectionChart.destroy();
    }
    
    const labels = data.map(item => item.section);
    const values = data.map(item => item.count);
    
    // Generate colors for pie chart
    const colors = generateColors(values.length);
    
    productionBySectionChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: colors.map(c => c.background),
                borderColor: 'rgba(15, 23, 42, 0.8)',
                borderWidth: 3,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        padding: 18,
                        usePointStyle: true,
                        pointStyle: 'circle',
                        font: {
                            size: 12,
                            weight: '500'
                        },
                        color: '#cbd5e1',
                        generateLabels: function(chart) {
                            const data = chart.data;
                            if (data.labels.length && data.datasets.length) {
                                return data.labels.map((label, i) => {
                                    const dataset = data.datasets[0];
                                    const value = dataset.data[i];
                                    const total = dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = ((value / total) * 100).toFixed(1);
                                    return {
                                        text: `${label} (${percentage}%)`,
                                        fillStyle: dataset.backgroundColor[i],
                                        strokeStyle: dataset.borderColor,
                                        lineWidth: dataset.borderWidth,
                                        hidden: false,
                                        index: i
                                    };
                                });
                            }
                            return [];
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    padding: 14,
                    titleColor: '#e2e8f0',
                    bodyColor: '#cbd5e1',
                    borderColor: 'rgba(96, 165, 250, 0.5)',
                    borderWidth: 1,
                    titleFont: {
                        size: 14,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 13
                    },
                    cornerRadius: 10,
                    displayColors: true,
                    boxPadding: 8,
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Generate color palette (dark theme optimized)
function generateColors(count) {
    const colorPalette = [
        { background: 'rgba(96, 165, 250, 0.8)', border: 'rgb(96, 165, 250)' },
        { background: 'rgba(52, 211, 153, 0.8)', border: 'rgb(52, 211, 153)' },
        { background: 'rgba(251, 191, 36, 0.8)', border: 'rgb(251, 191, 36)' },
        { background: 'rgba(248, 113, 113, 0.8)', border: 'rgb(248, 113, 113)' },
        { background: 'rgba(139, 92, 246, 0.8)', border: 'rgb(139, 92, 246)' },
        { background: 'rgba(236, 72, 153, 0.8)', border: 'rgb(236, 72, 153)' },
        { background: 'rgba(56, 189, 248, 0.8)', border: 'rgb(56, 189, 248)' },
        { background: 'rgba(34, 197, 94, 0.8)', border: 'rgb(34, 197, 94)' },
        { background: 'rgba(251, 146, 60, 0.8)', border: 'rgb(251, 146, 60)' },
        { background: 'rgba(168, 85, 247, 0.8)', border: 'rgb(168, 85, 247)' }
    ];
    
    const colors = [];
    for (let i = 0; i < count; i++) {
        colors.push(colorPalette[i % colorPalette.length]);
    }
    return colors;
}

// Render recent activity
function renderRecentActivity(activities) {
    const activityList = document.getElementById('activityList');
    if (!activityList) return;
    
    if (activities.length === 0) {
        activityList.innerHTML = `
            <div class="activity-empty">
                <p>No recent activity</p>
            </div>
        `;
        return;
    }
    
    activityList.innerHTML = activities.map(activity => {
        const date = new Date(activity.timestamp);
        const timeAgo = getTimeAgo(date);
        const icon = getActivityIcon(activity.type);
        
        return `
            <div class="activity-item">
                <div class="activity-icon ${activity.type}">
                    ${icon}
                </div>
                <div class="activity-content">
                    <p class="activity-description">${activity.description}</p>
                    <span class="activity-time">${timeAgo}</span>
                </div>
            </div>
        `;
    }).join('');
}

// Get activity icon
function getActivityIcon(type) {
    const icons = {
        'part_created': `
            <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor">
                <path d="M280-80q-33 0-56.5-23.5T200-160v-400q0-33 23.5-56.5T280-640h400q33 0 56.5 23.5T760-560v400q0 33-23.5 56.5T680-80H280Zm0-80h400v-400H280v400Z"/>
            </svg>
        `,
        'procedure_created': `
            <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor">
                <path d="M320-240 80-480l240-240 57 57-184 184 184 184-57 57Zm320 0-57-57 184-184-184-184 57-57 240 240-240 240Z"/>
            </svg>
        `
    };
    return icons[type] || icons['part_created'];
}

// Get time ago string
function getTimeAgo(date) {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) {
        return 'Just now';
    } else if (diffInSeconds < 3600) {
        const minutes = Math.floor(diffInSeconds / 60);
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600);
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
        const days = Math.floor(diffInSeconds / 86400);
        return `${days} day${days > 1 ? 's' : ''} ago`;
    }
}

// Show loading states
function showLoadingStates() {
    const activityList = document.getElementById('activityList');
    if (activityList) {
        activityList.innerHTML = `
            <div class="activity-loading">
                <div class="spinner"></div>
                <p>Loading activity...</p>
            </div>
        `;
    }
}

// Show error message
function showError(message) {
    // You can integrate with toast.js here if available
    console.error(message);
    const activityList = document.getElementById('activityList');
    if (activityList) {
        activityList.innerHTML = `
            <div class="activity-error">
                <p>${message}</p>
            </div>
        `;
    }
}

