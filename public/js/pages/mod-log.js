import { api } from '../api.js';
import { state } from '../state.js';

function displayModLogs() {
    const container = document.getElementById('mod-log-list');
    const filterSelect = document.getElementById('mod-log-type-filter');
    if (!container || !filterSelect) return;

    const filterValue = filterSelect.value;
    const logs = state.guildData.modLogs;
    container.innerHTML = '';

    const filteredLogs = filterValue === 'all'
        ? logs
        : logs.filter(log => log.type === filterValue);

    if (filteredLogs.length === 0) {
        container.innerHTML = '<p>Bu filtreyle eşleşen moderasyon logu bulunamadı.</p>';
        return;
    }

    filteredLogs.forEach(log => {
        const entryDiv = document.createElement('div');
        entryDiv.className = 'audit-log-entry';
        const timestamp = new Date(log.timestamp).toLocaleString('tr-TR');
        entryDiv.style.borderLeftColor = 'var(--red)';

        entryDiv.innerHTML = `
            <div class="audit-log-header">
                <div class="audit-log-executor-info">
                    <span class="audit-log-executor">${log.type}</span>
                    <span class="audit-log-action">Yapan: ${log.moderatorTag}</span>
                </div>
            </div>
            <div class="audit-log-body" style="padding-left: 0;">
                <div class="audit-log-target"><strong>Hedef:</strong> <span>${log.userTag} (${log.userId})</span></div>
                <div class="audit-log-reason"><strong>Sebep:</strong> <span>${log.reason}</span></div>
            </div>
            <div class="audit-log-timestamp">${timestamp}</div>
        `;
        container.appendChild(entryDiv);
    });
}

export async function initModLogPage() {
    const container = document.getElementById('mod-log-list');
    if (!container) return;

    container.innerHTML = '<p>Moderasyon logları yükleniyor...</p>';
    document.getElementById('mod-log-type-filter').value = 'all';

    const modLogs = await api.getGuildModLogs(state.selectedGuildId);
    state.updateGuildData({ modLogs });
    displayModLogs();

    document.getElementById('mod-log-type-filter').onchange = displayModLogs;
}