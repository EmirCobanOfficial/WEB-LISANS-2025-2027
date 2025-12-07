import { api } from '../api.js';
import { state } from '../state.js';
import { showToast } from '../ui.js';

let memberStatusChart = null;
let channelTypeChart = null;

function resetStatsUI() {
    // Kartlardaki metinleri temizle
    document.getElementById('stats-owner-tag').textContent = '...';
    document.getElementById('stats-created-at').textContent = '...';
    document.getElementById('stats-verification-level').textContent = '...';
    document.getElementById('stats-boost-tier').textContent = '...';
    document.getElementById('stats-boost-count').textContent = '...';
    document.getElementById('stats-role-count').textContent = '...';

    // Grafikleri temizle ve "Yükleniyor" göster
    if (memberStatusChart) {
        memberStatusChart.destroy();
        memberStatusChart = null;
    }
    if (channelTypeChart) {
        channelTypeChart.destroy();
        channelTypeChart = null;
    }
    const memberChartCtx = document.getElementById('member-status-chart')?.getContext('2d');
    const channelChartCtx = document.getElementById('channel-type-chart')?.getContext('2d');
    if(memberChartCtx) memberChartCtx.clearRect(0, 0, memberChartCtx.canvas.width, memberChartCtx.canvas.height);
    if(channelChartCtx) channelChartCtx.clearRect(0, 0, channelChartCtx.canvas.width, channelChartCtx.canvas.height);
}

function updateStatsUI(stats) {
    // Kartları doldur
    document.getElementById('stats-owner-tag').textContent = stats.ownerTag || '...';
    document.getElementById('stats-created-at').textContent = new Date(stats.createdAt).toLocaleDateString('tr-TR');
    document.getElementById('stats-verification-level').textContent = stats.verificationLevel || '...';
    document.getElementById('stats-boost-tier').textContent = stats.boostTier || '...';
    document.getElementById('stats-boost-count').textContent = stats.boostCount || '0';
    document.getElementById('stats-role-count').textContent = stats.roleCount || '0';

    // Üye Durum Grafiği
    const memberCtx = document.getElementById('member-status-chart')?.getContext('2d');
    if (!memberCtx) return;

    memberStatusChart = new Chart(memberCtx, {
        type: 'doughnut',
        data: {
            labels: ['Çevrimiçi', 'Boşta', 'Rahatsız Etmeyin', 'Çevrimdışı'],
            datasets: [{
                label: 'Üye Durumu',
                data: [
                    stats.memberStats.online,
                    stats.memberStats.idle,
                    stats.memberStats.dnd,
                    stats.memberStats.offline
                ],
                backgroundColor: [
                    'rgba(16, 185, 129, 0.6)', // Green
                    'rgba(245, 158, 11, 0.6)', // Orange
                    'rgba(239, 68, 68, 0.6)',  // Red
                    'rgba(107, 114, 128, 0.4)' // Gray
                ],
                borderColor: [
                    '#10b981',
                    '#f59e0b',
                    '#ef4444',
                    '#6b7280'
                ],
                borderWidth: 2,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: 'var(--text-secondary)',
                        font: { family: "'Inter', sans-serif", size: 13, weight: 500 },
                        padding: 20,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: 'var(--bg-tertiary)',
                    titleColor: 'var(--text-primary)',
                    bodyColor: 'var(--text-secondary)',
                    titleFont: { size: 14, weight: 'bold' },
                    bodyFont: { size: 13 },
                    padding: 12,
                    cornerRadius: 8,
                    boxPadding: 4
                }
            }
        }
    });

    // Kanal Türü Grafiği
    const channelCtx = document.getElementById('channel-type-chart')?.getContext('2d');
    if (!channelCtx) return;

    const channelData = stats.channelStats;
    const channelLabels = ['Metin', 'Ses', 'Kategori', 'Duyuru', 'Sahne', 'Forum'];
    const channelValues = [
        channelData.text, channelData.voice, channelData.category,
        channelData.announcement, channelData.stage, channelData.forum
    ];

    channelTypeChart = new Chart(channelCtx, {
        type: 'pie',
        data: {
            labels: channelLabels,
            datasets: [{
                label: 'Kanal Sayısı',
                data: channelValues,
                backgroundColor: [
                    'rgba(59, 130, 246, 0.6)',  // Blue
                    'rgba(139, 92, 246, 0.6)', // Purple
                    'rgba(107, 114, 128, 0.4)',// Gray
                    'rgba(6, 182, 212, 0.6)',  // Cyan
                    'rgba(245, 158, 11, 0.6)', // Orange
                    'rgba(236, 72, 153, 0.6)'  // Pink
                ],
                borderColor: 'var(--bg-tertiary)',
                borderWidth: 2,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: 'var(--text-secondary)',
                        font: { family: "'Inter', sans-serif", size: 13, weight: 500 },
                        padding: 20,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: 'var(--bg-tertiary)',
                    titleColor: 'var(--text-primary)',
                    bodyColor: 'var(--text-secondary)',
                    titleFont: { size: 14, weight: 'bold' },
                    bodyFont: { size: 13 },
                    padding: 12,
                    cornerRadius: 8,
                    boxPadding: 4
                }
            }
        }
    });
}

export async function initStatsPage() {
    resetStatsUI();
    try {
        const stats = await api.getGuildStats(state.selectedGuildId);
        state.updateGuildData({ stats });
        updateStatsUI(stats);
    } catch (error) {
        showToast(`İstatistikler alınamadı: ${error.message}`, 'error');
        console.error("İstatistikler yüklenirken hata:", error);
        document.getElementById('stats-page').innerHTML = `<p style="color: var(--red);">${error.message}</p>`;
    }
}