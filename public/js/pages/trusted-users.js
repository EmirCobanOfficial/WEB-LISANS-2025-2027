import { api } from '../api.js';
import * as ui from '../ui.js';

async function renderTrustedUsers() {
    const listContainer = document.getElementById('trusted-users-list');
    if (!listContainer) return;

    listContainer.innerHTML = '<p class="setting-description" style="text-align: center;">Liste yükleniyor...</p>';

    try {
        const trustedUsers = await api.getTrustedUsers();
        listContainer.innerHTML = '';

        if (!trustedUsers || trustedUsers.length === 0) {
            listContainer.innerHTML = '<p class="setting-description" style="text-align: center;">Panelden eklenmiş güvenilir kullanıcı yok.</p>';
            return;
        }

        trustedUsers.forEach(userId => {
            const item = document.createElement('div');
            item.className = 'list-item';
            item.innerHTML = `
                <span class="list-item-label">${userId}</span>
                <div class="list-item-actions">
                    <button type="button" class="remove-item-btn remove-trusted-user-btn" data-id="${userId}" title="Güvenilirden Kaldır">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            `;
            listContainer.appendChild(item);
        });
    } catch (error) {
        listContainer.innerHTML = `<p class="setting-description" style="text-align: center; color: var(--red);">${error.message}</p>`;
    }
}

async function handleAddTrustedUser() {
    const input = document.getElementById('user-id-to-trust');
    const userId = input.value.trim();
    if (!/^\d{17,19}$/.test(userId)) {
        return ui.showToast('Lütfen geçerli bir Discord kullanıcı ID\'si girin.', 'error');
    }
    try {
        const result = await api.addTrustedUser(userId);
        ui.showToast(result.message, 'success');
        input.value = '';
        await renderTrustedUsers(); // Listeyi yenile
    } catch (error) {
        ui.showToast(`Ekleme hatası: ${error.message}`, 'error');
    }
}

async function handleRemoveTrustedUser(userId) {
    try {
        const result = await api.removeTrustedUser(userId);
        ui.showToast(result.message, 'success');
        await renderTrustedUsers(); // Listeyi yenile
    } catch (error) {
        ui.showToast(`Kaldırma hatası: ${error.message}`, 'error');
    }
}

export function initTrustedUsersPage() {
    const page = document.getElementById('trusted-users-page');
    if (!page || page.dataset.listenerAttached === 'true') return;

    page.addEventListener('click', (e) => {
        if (e.target.id === 'add-trusted-user-btn') {
            handleAddTrustedUser();
        }
        const removeBtn = e.target.closest('.remove-trusted-user-btn');
        if (removeBtn) {
            handleRemoveTrustedUser(removeBtn.dataset.id);
        }
    });

    renderTrustedUsers();
    page.dataset.listenerAttached = 'true';
}
