import { api } from '../api.js';
import { state } from '../state.js';

function renderStatCards(summary) {
    const statsGrid = document.getElementById('dashboard-stats-grid');
    if (!statsGrid) return;

    statsGrid.innerHTML = `
        <div class="stat-card">
            <i class="fa-solid fa-users"></i>
            <div class="stat-info">
                <span class="stat-value">${summary.memberCount}</span>
                <span class="stat-label">Toplam Üye</span>
            </div>
        </div>
        <div class="stat-card">
            <i class="fa-solid fa-user-check"></i>
            <div class="stat-info">
                <span class="stat-value">${summary.onlineMemberCount}</span>
                <span class="stat-label">Çevrimiçi Üye</span>
            </div>
        </div>
        <div class="stat-card">
            <i class="fa-solid fa-hashtag"></i>
            <div class="stat-info">
                <span class="stat-value">${summary.channelCount}</span>
                <span class="stat-label">Kanal Sayısı</span>
            </div>
        </div>
        <div class="stat-card">
            <i class="fa-solid fa-shield-halved"></i>
            <div class="stat-info">
                <span class="stat-value">${summary.roleCount}</span>
                <span class="stat-label">Rol Sayısı</span>
            </div>
        </div>
    `;
}

function renderRecentActivity(summary) {
    const activityList = document.getElementById('recent-activity-list');
    if (!activityList) return;

    activityList.innerHTML = '';
    if (!summary.recentActivity || summary.recentActivity.length === 0) {
        activityList.innerHTML = '<div class="audit-log-entry"><p>Son aktivite bulunamadı.</p></div>';
        return;
    }

    summary.recentActivity.forEach(act => {
        const item = document.createElement('div');
        item.className = `audit-log-entry`;
        item.style.borderLeftColor = act.type === 'mod' ? 'var(--red)' : 'var(--brand-color)';
        const timestamp = new Date(act.timestamp).toLocaleString('tr-TR');

        item.innerHTML = `
            <div class="audit-log-header" style="gap: 8px;">
                 <i class="fa-solid ${act.type === 'mod' ? 'fa-gavel' : 'fa-clipboard-list'}"></i>
                <div class="audit-log-executor-info">
                    <span class="audit-log-executor">${act.action}</span>
                    <span class="audit-log-action">Yapan: ${act.executor} | Hedef: ${act.target}</span>
                </div>
            </div>
            <div class="audit-log-timestamp">${timestamp}</div>
        `;
        activityList.appendChild(item);
    });
}

export async function initDashboardPage() {
    const guildId = state.selectedGuildId;
    if (!guildId) return;

    const statsGrid = document.getElementById('dashboard-stats-grid');
    const activityList = document.getElementById('recent-activity-list');
    statsGrid.innerHTML = '<p>Genel bakış yükleniyor...</p>';
    activityList.innerHTML = '';

    const summary = await api.getGuildSummary(guildId);
    state.updateGuildData({ summary });
    renderStatCards(summary);
    renderRecentActivity(summary);
}