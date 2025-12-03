import { api } from '../api.js';
import { state } from '../state.js';
import { showToast, showConfirmModal } from '../ui.js';

let allBans = [];

function renderBans(bansToRender) {
    const tableBody = document.getElementById('bans-list-body');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    if (bansToRender.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Bu sunucuda yasaklı kullanıcı bulunmuyor.</td></tr>';
        return;
    }

    bansToRender.forEach(ban => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div class="member-info-cell">
                    <img src="${ban.avatar}" alt="${ban.userTag}'s avatar">
                    <span class="member-tag">${ban.userTag}</span>
                </div>
            </td>
            <td>${ban.reason}</td>
            <td style="text-align: center;">
                <button class="action-btn danger unban-btn" data-user-id="${ban.userId}" data-user-tag="${ban.userTag}">
                    <i class="fa-solid fa-gavel"></i> Yasağı Kaldır
                </button>
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

function filterBans() {
    const filterText = document.getElementById('bans-user-filter').value.toLowerCase();
    if (!filterText) {
        renderBans(allBans);
        return;
    }
    const filtered = allBans.filter(ban => ban.userTag.toLowerCase().includes(filterText));
    renderBans(filtered);
}

async function handleUnban(userId, userTag) {
    const confirmed = await showConfirmModal('Yasağı Kaldır', `'${userTag}' kullanıcısının yasağını kaldırmak istediğinizden emin misiniz?`);
    if (!confirmed) return;

    try {
        await api.unbanUser(state.selectedGuildId, userId);
        showToast('Kullanıcının yasağı başarıyla kaldırıldı.', 'success');
        initBansPage(); // Listeyi yenile
    } catch (error) {
        showToast(`Yasak kaldırılamadı: ${error.message}`, 'error');
    }
}

export async function initBansPage() {
    try {
        allBans = await api.getGuildBans(state.selectedGuildId);
        renderBans(allBans);

        document.getElementById('bans-user-filter').addEventListener('input', filterBans);

        document.getElementById('bans-list-body').addEventListener('click', (e) => {
            const unbanBtn = e.target.closest('.unban-btn');
            if (unbanBtn) {
                const { userId, userTag } = unbanBtn.dataset;
                handleUnban(userId, userTag);
            }
        });

    } catch (error) {
        showToast(`Yasaklı kullanıcılar yüklenirken hata oluştu: ${error.message}`, 'error');
    }
}