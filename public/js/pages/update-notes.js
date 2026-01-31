import { api } from '../api.js';
import { showToast, showConfirmModal } from '../ui.js';

export async function initUpdateNotesPage() {
    const container = document.getElementById('update-notes-content');
    if (!container) return;

    container.innerHTML = '<p>Yükleniyor...</p>';

    try {
        const data = await api.getVersion();
        
        container.innerHTML = `
            <div class="stat-card wide" style="text-align: left; display: block; cursor: default; position: relative;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 10px; margin-bottom: 15px;">
                    <h3 style="font-size: 1.5em; color: var(--brand-color); margin: 0;">
                        <i class="fa-solid fa-code-branch"></i> Sürüm ${data.version}
                    </h3>
                    <button id="restart-bot-btn" class="header-action-btn danger">
                        <i class="fa-solid fa-power-off"></i> Botu Yeniden Başlat
                    </button>
                </div>
                <div style="font-size: 1.1em; color: var(--text-primary); line-height: 1.6;">
                    ${data.notes}
                </div>
            </div>
        `;

        // Yeniden başlatma butonu dinleyicisi
        document.getElementById('restart-bot-btn').addEventListener('click', async () => {
            const confirmed = await showConfirmModal('Botu Yeniden Başlat', 'Botu yeniden başlatmak istediğinize emin misiniz? Bu işlem sırasında panel kısa bir süre erişilemez olabilir.');
            if (confirmed) {
                try {
                    const result = await api.restartBot();
                    showToast(result.message, 'success');
                } catch (error) {
                    showToast(`Hata: ${error.message}`, 'error');
                }
            }
        });
    } catch (error) {
        container.innerHTML = `<p style="color: var(--red);">Notlar yüklenemedi: ${error.message}</p>`;
    }
}