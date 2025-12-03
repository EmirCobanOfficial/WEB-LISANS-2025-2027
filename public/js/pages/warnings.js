import { api } from '../api.js';
import { state } from '../state.js';
import { showToast, showConfirmModal } from '../ui.js';

let allWarnings = []; // Filtreleme için tüm uyarıları sakla

function renderWarnings(warningsToRender) {
    const listContainer = document.getElementById('warnings-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    if (warningsToRender.length === 0) {
        listContainer.innerHTML = '<div class="maintenance-notice"><i class="fa-solid fa-check-circle"></i><h3>Harika!</h3><p>Bu sunucuda kayıtlı hiçbir uyarı bulunmuyor.</p></div>';
        return;
    }

    // Uyarıları en yeniden eskiye doğru sırala
    const sortedWarnings = warningsToRender
        .flatMap(user => user.warnings.map(w => ({ ...w, userTag: user.userTag, userId: user.userId })))
        .sort((a, b) => b.timestamp - a.timestamp);

    sortedWarnings.forEach(warn => {
        const item = document.createElement('div');
        item.className = 'audit-log-entry';
        item.innerHTML = `
            <div class="log-header">
                <span class="log-action warn-action"><i class="fa-solid fa-bell"></i> KULLANICI UYARILDI</span>
                <span class="log-timestamp">${new Date(warn.timestamp).toLocaleString()}</span>
            </div>
            <div class="log-body">
                <div class="log-executor">
                    <img src="https://cdn.discordapp.com/embed/avatars/0.png" alt="mod">
                    <span>${warn.moderatorTag}</span>
                </div>
                <div class="log-details">
                    <span class="log-arrow">→</span>
                    <span class="log-target">${warn.userTag}</span>
                    <span class="log-reason"><strong>Sebep:</strong> ${warn.reason}</span>
                </div>
            </div>
            <div class="log-footer">
                <span>Uyarı ID: ${warn.id}</span>
                <button class="delete-warning-btn" data-user-id="${warn.userId}" data-warn-id="${warn.id}">Bu Uyarıyı Sil</button>
            </div>
        `;
        listContainer.appendChild(item);
    });
}

function filterWarnings() {
    const filterText = document.getElementById('warnings-user-filter').value.toLowerCase();
    if (!filterText) {
        renderWarnings(allWarnings);
        return;
    }
    const filtered = allWarnings.filter(user => user.userTag.toLowerCase().includes(filterText));
    renderWarnings(filtered);
}

export async function initWarningsPage() {
    try {
        allWarnings = await api.getGuildWarnings(state.selectedGuildId);
        renderWarnings(allWarnings);

        // Dinleyicileri kur
        document.getElementById('warnings-user-filter').addEventListener('input', filterWarnings);

        document.getElementById('warnings-list').addEventListener('click', async (e) => {
            if (e.target.classList.contains('delete-warning-btn')) {
                const button = e.target;
                const { userId, warnId } = button.dataset;

                const confirmed = await showConfirmModal(
                    'Uyarıyı Sil',
                    `Bu uyarıyı kalıcı olarak silmek istediğinizden emin misiniz? (ID: ${warnId})`
                );

                if (confirmed) {
                    try {
                        await api.deleteWarning(state.selectedGuildId, userId, warnId);
                        showToast('Uyarı başarıyla silindi.', 'success');
                        initWarningsPage(); // Listeyi anında yenile
                    } catch (error) {
                        showToast(`Uyarı silinemedi: ${error.message}`, 'error');
                    }
                }
            }
        });

    } catch (error) {
        showToast(`Uyarılar yüklenirken hata oluştu: ${error.message}`, 'error');
    }
}