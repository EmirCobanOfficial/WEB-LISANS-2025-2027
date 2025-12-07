import { api } from '../api.js';
import { state } from '../state.js';
import { showToast } from '../ui.js';

function displayAuditLogs() {
    const container = document.getElementById('audit-log-list');
    const eventFilterSelect = document.getElementById('audit-log-filter');
    const dateFilterInput = document.getElementById('audit-log-date-filter'); // YENİ
    const executorFilterInput = document.getElementById('audit-log-executor-filter');
    if (!container || !eventFilterSelect || !executorFilterInput || !dateFilterInput) return;

    const eventFilterValue = eventFilterSelect.value;
    const executorFilterValue = executorFilterInput.value.toLowerCase().trim();
    const dateFilterValue = dateFilterInput.value; // YENİ
    const logs = state.guildData.auditLogs;
    container.innerHTML = '';

    let filteredLogs = logs;

    if (eventFilterValue !== 'all') {
        filteredLogs = filteredLogs.filter(log => log.action === eventFilterValue);
    }

    if (executorFilterValue) {
        filteredLogs = filteredLogs.filter(log => log.executor.tag.toLowerCase().includes(executorFilterValue));
    }

    // YENİ: Tarihe göre filtrele
    if (dateFilterValue) {
        // ISO formatındaki timestamp'in başlangıcını (YYYY-MM-DD) kontrol et
        filteredLogs = filteredLogs.filter(log => new Date(log.timestamp).toISOString().startsWith(dateFilterValue));
    }

    if (filteredLogs.length === 0) {
        container.innerHTML = '<p>Bu filtreyle eşleşen kayıt bulunamadı.</p>';
        return;
    }

    filteredLogs.forEach(log => {
        const entryDiv = document.createElement('div');
        entryDiv.className = 'audit-log-entry';
        const timestamp = new Date(log.timestamp).toLocaleString('tr-TR');

        entryDiv.innerHTML = `
            <div class="audit-log-header">
                <img src="${log.executor.avatar}" alt="${log.executor.tag}'s avatar">
                <div class="audit-log-executor-info">
                    <span class="audit-log-executor">${log.executor.tag}</span>
                    <span class="audit-log-action">${log.action}</span>
                </div>
            </div>
            <div class="audit-log-body">
                <div class="audit-log-target"><strong>Hedef:</strong><span>${log.target}</span></div>
                <div class="audit-log-reason"><strong>Sebep:</strong><span>${log.reason}</span></div>
            </div>
            <div class="audit-log-timestamp">${timestamp}</div>
        `;
        container.appendChild(entryDiv);
    });
}

export async function initAuditLogPage() {
    const container = document.getElementById('audit-log-list');
    const filterSelect = document.getElementById('audit-log-filter');
    const dateFilterInput = document.getElementById('audit-log-date-filter'); // YENİ
    const clearBtn = document.getElementById('clear-audit-logs-btn'); // YENİ
    const executorFilterInput = document.getElementById('audit-log-executor-filter');
    const clearFiltersBtn = document.getElementById('audit-log-clear-filters');
    if (!container || !filterSelect || !executorFilterInput || !dateFilterInput || !clearFiltersBtn || !clearBtn) return;

    executorFilterInput.value = '';
    dateFilterInput.value = ''; // YENİ
    if (filterSelect.options.length <= 1) {
        filterSelect.innerHTML = '<option value="all">Tüm Eylemler</option>';
        const events = await api.getAuditLogEvents();
        state.updateGuildData({ auditLogEvents: events });
        const sortedEvents = Object.values(events).sort((a, b) => a.localeCompare(b));
        [...new Set(sortedEvents)].forEach(eventName => {
            filterSelect.add(new Option(eventName, eventName));
        });
    }

    container.innerHTML = '<p>Denetim kaydı yükleniyor...</p>';

    try {
        const auditLogs = await api.getGuildAuditLogs(state.selectedGuildId);
        state.updateGuildData({ auditLogs });
        displayAuditLogs();
    } catch (error) {
        container.innerHTML = `<p style="color: var(--red);">${error.message}</p>`;
    }

    filterSelect.onchange = displayAuditLogs;
    executorFilterInput.oninput = displayAuditLogs;
    dateFilterInput.onchange = displayAuditLogs; // YENİ

    // YENİ: Filtreleri temizleme butonu
    clearFiltersBtn.addEventListener('click', () => {
        executorFilterInput.value = '';
        dateFilterInput.value = '';
        filterSelect.value = 'all';
        displayAuditLogs();
    });

    // YENİ: Görünümü temizleme butonu
    clearBtn.addEventListener('click', () => {
        container.innerHTML = '<p>Denetim kaydı görünümü temizlendi. Sayfayı yenileyerek logları geri getirebilirsiniz.</p>';
        state.updateGuildData({ auditLogs: [] }); // Hafızadaki logları da temizle
        showToast('Denetim kaydı görünümü temizlendi.', 'info');
    });
}