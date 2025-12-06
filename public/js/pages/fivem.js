// c:\Users\emirc\OneDrive\Desktop\web-panelli-lisans\web-panelli-discord-bot\public\js\pages\fivem.js

/**
 * YENİ: Oyuncu listesini arayüzde render eder.
 * @param {Array} players - Sunucudan gelen oyuncu dizisi.
 */
function renderPlayerList(players) {
    const listContainer = document.getElementById('fivem-player-list');
    if (!listContainer) return;

    listContainer.innerHTML = ''; // Önceki listeyi temizle

    if (!players || players.length === 0) {
        listContainer.innerHTML = '<p class="setting-description" style="text-align: center;">Sunucuda aktif oyuncu bulunmuyor.</p>';
        return;
    }

    players.forEach(player => {
        const item = document.createElement('div');
        item.className = 'list-item';
        // Oyuncunun adını, sunucu içi ID'sini ve ping'ini göster
        item.innerHTML = `
            <div class="list-item-content">
                <span class="list-item-label">${player.name}</span>
                <span class="list-item-description">ID: ${player.id} | Ping: ${player.ping}</span>
            </div>
            <div class="list-item-actions">
                <button class="action-btn edit fivem-dm-btn" data-player-id="${player.id}" data-player-name="${player.name}" title="Özel Mesaj Gönder">
                    <i class="fa-solid fa-message"></i> Mesaj
                </button>
                <button class="action-btn edit fivem-kick-btn" data-player-id="${player.id}" data-player-name="${player.name}" title="Oyuncuyu At">
                    <i class="fa-solid fa-user-minus"></i> Kick
                </button>
                <button class="action-btn danger fivem-ban-btn" data-player-id="${player.id}" data-player-name="${player.name}" title="Oyuncuyu Yasakla">
                    <i class="fa-solid fa-user-slash"></i> Ban
                </button>
            </div>
        `;
        listContainer.appendChild(item);
    });
}

import { api } from '../api.js';
import { state } from '../state.js';
import * as ui from '../ui.js';

async function checkFiveMStatus() {
    const statusIcon = document.getElementById('fivem-status-icon');
    const statusText = document.getElementById('fivem-status-text');
    const playerCount = document.getElementById('fivem-player-count');
    const checkBtn = document.getElementById('fivem-check-status-btn');

    checkBtn.disabled = true;
    statusText.textContent = 'Kontrol Ediliyor...';
    statusIcon.className = 'fa-solid fa-spinner fa-spin';

    try {
        const result = await api.getFivemStatus(state.selectedGuildId);
        if (result.online) {
            statusText.textContent = 'Sunucu Aktif';
            playerCount.textContent = `Oyuncu: ${result.players.length} / ${result.maxplayers}`;
            statusIcon.className = 'fa-solid fa-check-circle';
            statusIcon.style.color = 'var(--green)';
            // YENİ: Oyuncu listesini render et
            renderPlayerList(result.players);
        } else {
            throw new Error('Sunucu çevrimdışı veya yanıt vermiyor.');
        }
    } catch (error) {
        statusText.textContent = 'Sunucu Çevrimdışı';
        playerCount.textContent = 'Oyuncu: -/-';
        // YENİ: Sunucu çevrimdışıysa oyuncu listesini temizle
        renderPlayerList([]);
        statusIcon.className = 'fa-solid fa-xmark-circle';
        statusIcon.style.color = 'var(--red)';
        ui.showToast(error.message, 'error');
    } finally {
        checkBtn.disabled = false;
    }
}

async function renderWhitelist() {
    const listContainer = document.getElementById('fivem-whitelist-list');
    const refreshBtn = document.getElementById('fivem-refresh-whitelist-btn');
    if (!listContainer || !refreshBtn) return;

    refreshBtn.disabled = true;
    listContainer.innerHTML = '<p class="setting-description" style="text-align: center;">Liste yükleniyor...</p>';

    try {
        const whitelist = await api.getFivemWhitelist(state.selectedGuildId);
        listContainer.innerHTML = ''; // Listeyi temizle

        if (!whitelist || whitelist.length === 0) {
            listContainer.innerHTML = '<p class="setting-description" style="text-align: center;">Whitelist boş veya alınamadı.</p>';
            return;
        }

        whitelist.forEach(id => {
            const item = document.createElement('div');
            item.className = 'list-item';
            // YENİ: ID'yi tıklanabilir yap
            item.innerHTML = `
                <a href="#" class="list-item-label view-user-profile" data-user-id="${id}" title="Profili Görüntüle">${id}</a>
                <div class="list-item-actions"></div>
            `;
            listContainer.appendChild(item);
        });
    } catch (error) {
        listContainer.innerHTML = `<p class="setting-description" style="text-align: center; color: var(--red);">${error.message}</p>`;
    } finally {
        refreshBtn.disabled = false;
    }
}

async function handleWhitelist(action) {
    const discordId = document.getElementById('fivem-whitelist-id').value;
    if (!discordId) {
        return ui.showToast('Lütfen bir Discord ID girin.', 'error');
    }
    try {
        const result = await api.manageFivemWhitelist(state.selectedGuildId, discordId, action);
        ui.showToast(result.message, 'success');
        // İşlem sonrası listeyi yenile
        await renderWhitelist();
    } catch (error) {
        ui.showToast(`Hata: ${error.message}`, 'error');
    }
}

async function handleGiveItem() {
    const playerId = document.getElementById('fivem-giveitem-playerid').value;
    const itemName = document.getElementById('fivem-giveitem-itemname').value;
    const amount = document.getElementById('fivem-giveitem-amount').value;

    if (!playerId || !itemName || !amount) {
        return ui.showToast('Lütfen tüm alanları doldurun.', 'error');
    }

    try {
        const result = await api.giveFivemItem(state.selectedGuildId, playerId, itemName, amount);
        ui.showToast(result.message, 'success');
    } catch (error) {
        ui.showToast(`Hata: ${error.message}`, 'error');
    }
}

async function handleSetJob() {
    const playerId = document.getElementById('fivem-setjob-playerid').value;
    const jobName = document.getElementById('fivem-setjob-jobname').value;
    const grade = document.getElementById('fivem-setjob-grade').value;

    if (!playerId || !jobName || grade === '') {
        return ui.showToast('Lütfen tüm alanları doldurun.', 'error');
    }

    try {
        const result = await api.setFivemJob(state.selectedGuildId, playerId, jobName, grade);
        ui.showToast(result.message, 'success');
    } catch (error) {
        ui.showToast(`Hata: ${error.message}`, 'error');
    }
}

/**
 * YENİ: Kullanıcı profili modal'ını açar ve bilgileri yükler.
 * @param {string} userId 
 */
async function showUserProfileModal(userId) {
    const modal = document.getElementById('user-profile-modal');
    const content = document.getElementById('user-profile-content');
    if (!modal || !content) return;

    modal.style.display = 'flex';
    content.innerHTML = `<div style="text-align: center; padding: 20px;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 2em;"></i><p>Kullanıcı bilgileri yükleniyor...</p></div>`;

    try {
        const user = await api.getUserProfile(userId);
        const bannerStyle = user.banner ? `background-image: url('${user.banner}')` : 'background: var(--bg-quaternary)';
        content.innerHTML = `
            <div id="user-profile-banner" style="${bannerStyle}"></div>
            <div style="text-align: center;">
                <img id="user-profile-avatar" src="${user.avatar}" alt="Avatar">
                <div id="user-profile-tag">${user.tag} ${user.bot ? '<i class="fa-solid fa-robot" title="Bu bir bot hesabıdır"></i>' : ''}</div>
                <div id="user-profile-id">${user.id}</div>
                <div id="user-profile-created">Hesap Oluşturma: ${new Date(user.createdAt).toLocaleDateString()}</div>
            </div>
        `;
    } catch (error) {
        content.innerHTML = `<div style="text-align: center; padding: 20px;"><i class="fa-solid fa-circle-xmark" style="font-size: 2em; color: var(--red);"></i><p style="color: var(--red);">${error.message}</p></div>`;
    }
}


export function initFivemPage() {
    const page = document.getElementById('fivem-page');
    if (!page || page.dataset.listenerAttached === 'true') return;

    // YENİ: Merkezi olay dinleyiciye geçiş
    page.addEventListener('click', (e) => {
        const profileLink = e.target.closest('.view-user-profile');
        if (profileLink) {
            e.preventDefault();
            showUserProfileModal(profileLink.dataset.userId);
        }
    });

    document.getElementById('fivem-whitelist-add-btn').addEventListener('click', () => handleWhitelist('add'));
    document.getElementById('fivem-whitelist-remove-btn').addEventListener('click', () => handleWhitelist('remove'));
    document.getElementById('fivem-giveitem-btn').addEventListener('click', handleGiveItem);
    document.getElementById('fivem-setjob-btn').addEventListener('click', handleSetJob);
    document.getElementById('fivem-refresh-whitelist-btn').addEventListener('click', renderWhitelist);

    // Sayfa ilk yüklendiğinde durumu ve whitelist'i kontrol et
    document.getElementById('user-profile-modal-close').addEventListener('click', () => {
        document.getElementById('user-profile-modal').style.display = 'none';
    });
    document.getElementById('fivem-check-status-btn').addEventListener('click', checkFiveMStatus);


    checkFiveMStatus();
    renderWhitelist();

    page.dataset.listenerAttached = 'true';
}
