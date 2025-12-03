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
    const memberCtx = document.getElementById('member-status-chart').getContext('2d');
    memberStatusChart = new Chart(memberCtx, {
        type: 'doughnut',
        data: {
            labels: ['Çevrimiçi', 'Boşta', 'Rahatsız Etmeyin', 'Çevrimdışı', 'Botlar'],
            datasets: [{
                label: 'Üye Durumu',
                data: [
                    stats.memberStats.online,
                    stats.memberStats.idle,
                    stats.memberStats.dnd,
                    stats.memberStats.offline,
                    stats.memberStats.bots
                ],
                backgroundColor: ['#43b581', '#faa61a', '#f04747', '#747f8d', '#7289da'],
                borderColor: 'var(--bg-secondary)',
                borderWidth: 2,
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'bottom', labels: { color: 'var(--text-primary)' } } }
        }
    });

    // Kanal Türü Grafiği
    const channelCtx = document.getElementById('channel-type-chart').getContext('2d');
    const channelData = stats.channelStats;
    const channelLabels = ['Metin', 'Ses', 'Kategori', 'Duyuru', 'Sahne', 'Forum'];
    const channelValues = [
        channelData.text, channelData.voice, channelData.category,
        channelData.announcement, channelData.stage, channelData.forum
    ];

    channelTypeChart = new Chart(channelCtx, {
        type: 'bar',
        data: {
            labels: channelLabels,
            datasets: [{
                label: 'Kanal Sayısı',
                data: channelValues,
                backgroundColor: 'rgba(88, 101, 242, 0.6)',
                borderColor: 'var(--brand-color)',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: 'var(--text-secondary)', stepSize: 1 } },
                y: { ticks: { color: 'var(--text-primary)' } }
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