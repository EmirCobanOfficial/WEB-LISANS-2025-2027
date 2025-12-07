import { api } from '../api.js';
import { showToast, showConfirmModal } from '../ui.js';

let allLogs = []; // Tüm logları hafızada tutmak için

function applyFiltersAndRender() {
    const container = document.getElementById('panel-logs-list');
    if (!container) return;
    
    const userFilter = document.getElementById('panel-logs-user-filter').value.toLowerCase();
    const dateFilter = document.getElementById('panel-logs-date-filter').value;
    
    let filteredLogs = allLogs;
    
    // Kullanıcıya göre filtrele (ID veya Tag)
    if (userFilter) {
        filteredLogs = filteredLogs.filter(log =>
            log.userTag.toLowerCase().includes(userFilter) ||
            log.userId.includes(userFilter)
        );
    }
    
    // Tarihe göre filtrele
    if (dateFilter) {
        filteredLogs = filteredLogs.filter(log => log.timestamp.startsWith(dateFilter));
    }

    displayPanelLogs(filteredLogs);
}

function displayPanelLogs(logsToDisplay) {
    const container = document.getElementById('panel-logs-list');
    if (!container) return;
    container.innerHTML = '';

    if (!logsToDisplay || logsToDisplay.length === 0) {
        container.innerHTML = '<p>Kaydedilmiş panel işlemi bulunmuyor.</p>';
        return;
    }

    // Logları en yeniden eskiye doğru sırala
    const sortedLogs = logsToDisplay.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    sortedLogs.forEach(log => {
        const entryDiv = document.createElement('div');
        entryDiv.className = 'audit-log-entry'; // Mevcut stili kullanalım

        const timestamp = new Date(log.timestamp).toLocaleString('tr-TR', {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });

        entryDiv.innerHTML = `
            <div class="audit-log-header">
                <div class="audit-log-executor-info">
                    <span class="audit-log-executor">${log.userTag}</span>
                    <span class="audit-log-action" style="color: var(--accent-cyan);">${log.action}</span>
                </div>
                <span class="audit-log-timestamp">${timestamp}</span>
            </div>
            <div class="audit-log-body">
                <div class="audit-log-target">
                    <strong>Sunucu:</strong> ${log.guildName} (${log.guildId})
                </div>
            </div>
        `;
        container.appendChild(entryDiv);
    });
}

export async function initPanelLogsPage() {
    const container = document.getElementById('panel-logs-list');
    if (!container) return;

    container.innerHTML = '<p>Panel logları yükleniyor...</p>';

    // Filtreleme elemanlarına olay dinleyicileri ekle
    document.getElementById('panel-logs-user-filter').addEventListener('input', applyFiltersAndRender);
    document.getElementById('panel-logs-date-filter').addEventListener('change', applyFiltersAndRender);
    const clearLogsBtn = document.getElementById('clear-panel-logs-btn');
    
    // YENİ: Filtreleri temizleme butonu
    document.getElementById('panel-logs-clear-filters').addEventListener('click', () => {
        document.getElementById('panel-logs-user-filter').value = '';
        document.getElementById('panel-logs-date-filter').value = '';
        applyFiltersAndRender(); // Filtreleri temizledikten sonra listeyi yeniden render et
    });

    // YENİ: Tüm logları silme butonu
    if (clearLogsBtn) {
        clearLogsBtn.addEventListener('click', async () => {
            const confirmed = await showConfirmModal('Tüm Panel Loglarını Sil', 'Bu işlem, kaydedilmiş TÜM panel işlem loglarını kalıcı olarak silecektir. Bu işlem geri alınamaz. Emin misiniz?');
            if (confirmed) {
                try {
                    const result = await api.clearPanelLogs();
                    showToast(result.message, 'success');
                    initPanelLogsPage(); // Sayfayı yeniden başlat
                } catch (error) {
                    showToast(`Loglar silinirken hata: ${error.message}`, 'error');
                }
            }
        });
    }

    try {
        allLogs = await api.getPanelLogs(); // Logları bir kez çek ve hafızaya al
        applyFiltersAndRender(); // Filtreleri uygula ve render et
    } catch (error) {
        allLogs = []; // Hata durumunda listeyi temizle
        container.innerHTML = `
            <div class="access-denied-notice">
                <i class="fa-solid fa-shield-halved"></i>
                <h3>Erişim Reddedildi</h3>
                <p>Bu sayfayı görüntüleme yetkiniz bulunmamaktadır.</p>
            </div>
        `;
    }
}
