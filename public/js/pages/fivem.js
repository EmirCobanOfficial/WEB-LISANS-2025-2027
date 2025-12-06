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
                <button class="action-btn edit fivem-set-stat-btn" data-player-id="${player.id}" data-player-name="${player.name}" data-stat-type="health" title="Can Ayarla">
                    <i class="fa-solid fa-heart-pulse"></i> Can
                </button>
                <button class="action-btn edit fivem-set-stat-btn" data-player-id="${player.id}" data-player-name="${player.name}" data-stat-type="armor" title="Zırh Ayarla">
                    <i class="fa-solid fa-shield-halved"></i> Zırh
                </button>
                <button class="action-btn edit fivem-give-money-btn" data-player-id="${player.id}" data-player-name="${player.name}" title="Para Ver">
                    <i class="fa-solid fa-coins"></i> Para Ver
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

async function checkFiveMStatus(page) {
    const statusIcon = document.getElementById('fivem-status-icon');
    const statusText = document.getElementById('fivem-status-text');
    const playerCount = document.getElementById('fivem-player-count');
    const checkBtn = document.getElementById('fivem-check-status-btn');

    checkBtn.disabled = true;

    // YENİ: Eklenti aktif değilse, diğer kartları gizle ve uyarı göster
    // DÜZELTME: Ayarların UI'a yansıması için state yerine doğrudan checkbox'ın durumunu kontrol et.
    const isEnabled = document.querySelector('#fivem-page .plugin-card[data-module="fivem"] .enable-toggle')?.checked;
    const fivemSettings = state.guildData.settings?.fivem; // Ayarların varlığını kontrol etmek için yine de gerekli.

    if (!isEnabled) {
        document.querySelectorAll('#fivem-page .management-card').forEach(el => el.style.display = 'none');
        if (!page.dataset.initialWarningShown) {
            ui.showToast('FiveM modülü aktif değil. Lütfen önce Ayarlar kartından modülü etkinleştirin.', 'warning');
        }
        return;
    }

    if (!fivemSettings || !fivemSettings.enabled) {
        // Ayarlar kaydedilmemişse, API isteği göndermeden önce uyarı ver.
        return ui.showToast('Ayarları etkinleştirdikten sonra "Ayarları Kaydet" butonuna basmalısınız.', 'warning');
    }

    document.querySelectorAll('#fivem-page .management-card').forEach(el => el.style.display = 'flex');
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

    // YENİ: Modül aktif değilse işlemi durdur.
    const fivemSettings = state.guildData.settings?.fivem;
    if (!fivemSettings || !fivemSettings.enabled) {
        return;
    }

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
 * YENİ: Oyuncuya özel mesaj gönderme işlemini yönetir.
 * @param {string} playerId - Oyuncunun sunucu içi ID'si.
 * @param {string} playerName - Oyuncunun adı.
 */
async function handlePlayerDm(playerId, playerName) {
    const message = prompt(`'${playerName}' adlı oyuncuya göndermek istediğiniz özel mesajı girin:`);

    if (!message) { // Kullanıcı iptal etti veya boş mesaj girdi
        return;
    }

    try {
        const result = await api.sendFivemDm(state.selectedGuildId, playerId, message);
        ui.showToast(result.message, 'success');
    } catch (error) {
        ui.showToast(`Hata: ${error.message}`, 'error');
    }
}

/**
 * YENİ: Oyuncuyu sunucudan atma veya yasaklama işlemini yönetir.
 * @param {'kick' | 'ban'} action - Yapılacak eylem (kick veya ban).
 * @param {string} playerId - Oyuncunun sunucu içi ID'si.
 * @param {string} playerName - Oyuncunun adı.
 */
async function handlePlayerAction(action, playerId, playerName) {
    const reason = prompt(`'${playerName}' adlı oyuncuyu ${action === 'kick' ? 'atmak' : 'yasaklamak'} için bir sebep girin:`);

    if (!reason) { // Kullanıcı iptal etti veya boş sebep girdi
        return;
    }

    try {
        const apiFunction = action === 'kick' ? api.kickFivemPlayer : api.banFivemPlayer;
        const result = await apiFunction(state.selectedGuildId, playerId, reason);
        ui.showToast(result.message, 'success'); // Oyuncu listesini yenilemek için durumu tekrar kontrol et
        await checkFiveMStatus(document.getElementById('fivem-page'));
    } catch (error) {
        ui.showToast(`Hata: ${error.message}`, 'error');
    }
}

/**
 * YENİ: Oyuncunun can veya zırhını ayarlama işlemini yönetir.
 * @param {string} playerId - Oyuncunun sunucu içi ID'si.
 * @param {string} playerName - Oyuncunun adı.
 * @param {'health' | 'armor'} statType - Ayarlanacak stat (can veya zırh).
 */
async function handleSetPlayerStat(playerId, playerName, statType) {
    const statName = statType === 'health' ? 'can' : 'zırh';
    const amount = prompt(`'${playerName}' adlı oyuncunun yeni ${statName} değerini girin (Genellikle 0-100):`);

    if (amount === null || amount.trim() === '' || isNaN(amount)) {
        if (amount !== null) ui.showToast('Lütfen geçerli bir sayı girin.', 'error');
        return;
    }

    try {
        const result = await api.setFivemPlayerStat(state.selectedGuildId, playerId, statType, amount);
        ui.showToast(result.message, 'success');
    } catch (error) {
        ui.showToast(`Hata: ${error.message}`, 'error');
    }
}

/**
 * YENİ: Oyuncuya para verme işlemini yönetir.
 * @param {string} playerId - Oyuncunun sunucu içi ID'si.
 * @param {string} playerName - Oyuncunun adı.
 */
async function handleGivePlayerMoney(playerId, playerName) {
    const amount = prompt(`'${playerName}' adlı oyuncuya vermek istediğiniz para miktarını girin:`);

    if (amount === null || amount.trim() === '' || isNaN(amount)) {
        if (amount !== null) ui.showToast('Lütfen geçerli bir sayı girin.', 'error');
        return;
    }

    try {
        const result = await api.giveFivemPlayerMoney(state.selectedGuildId, playerId, amount);
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
            // DÜZELTME: Olayın daha fazla yayılmasını engelle.
            // Bu, profile tıklandığında yanlışlıkla whitelist ekleme/kaldırma
            // butonlarının da tetiklenmesini önler.
            e.stopPropagation(); 
            e.preventDefault();
            showUserProfileModal(profileLink.dataset.userId);
        }

        // YENİ: Oyuncu aksiyon butonlarını dinle
        const kickBtn = e.target.closest('.fivem-kick-btn');
        const banBtn = e.target.closest('.fivem-ban-btn');
        const dmBtn = e.target.closest('.fivem-dm-btn');
        const statBtn = e.target.closest('.fivem-set-stat-btn');
        const moneyBtn = e.target.closest('.fivem-give-money-btn'); // YENİ

        if (kickBtn) handlePlayerAction('kick', kickBtn.dataset.playerId, kickBtn.dataset.playerName);
        else if (banBtn) handlePlayerAction('ban', banBtn.dataset.playerId, banBtn.dataset.playerName);
        else if (dmBtn) handlePlayerDm(dmBtn.dataset.playerId, dmBtn.dataset.playerName);
        else if (statBtn) handleSetPlayerStat(statBtn.dataset.playerId, statBtn.dataset.playerName, statBtn.dataset.statType);
        else if (moneyBtn) handleGivePlayerMoney(moneyBtn.dataset.playerId, moneyBtn.dataset.playerName); // YENİ


        // YENİ: Ayarlar kartındaki enable/disable toggle'ını dinle
        if (e.target.closest('.plugin-card[data-module="fivem"] .enable-toggle')) {
            // Değişikliğin UI'a yansıması için kısa bir gecikme
            setTimeout(() => {
                checkFiveMStatus(page);
                page.dataset.initialWarningShown = 'true'; // Uyarıyı tekrar gösterme
                renderWhitelist();
            }, 100);
        }
    });

    // DÜZELTME: Buton olaylarını ana olay dinleyicisine taşıyarak kod tekrarını azalt ve hataları önle.
    // document.getElementById('fivem-whitelist-add-btn').addEventListener('click', () => handleWhitelist('add'));
    // document.getElementById('fivem-whitelist-remove-btn').addEventListener('click', () => handleWhitelist('remove'));
    // document.getElementById('fivem-giveitem-btn').addEventListener('click', handleGiveItem);
    document.getElementById('fivem-setjob-btn').addEventListener('click', handleSetJob);
    document.getElementById('fivem-refresh-whitelist-btn').addEventListener('click', renderWhitelist);

    // Sayfa ilk yüklendiğinde durumu ve whitelist'i kontrol et
    document.getElementById('user-profile-modal-close').addEventListener('click', () => {
        document.getElementById('user-profile-modal').style.display = 'none';
    });
    document.getElementById('fivem-check-status-btn').addEventListener('click', () => checkFiveMStatus(page));

    // YENİ: Buton olaylarını merkezi dinleyiciye ekle
    const managementCards = page.querySelector('.management-card');
    if (managementCards) {
        page.addEventListener('click', (e) => {
            if (e.target.id === 'fivem-whitelist-add-btn') handleWhitelist('add');
            if (e.target.id === 'fivem-whitelist-remove-btn') handleWhitelist('remove');
            if (e.target.id === 'fivem-giveitem-btn') handleGiveItem();
            if (e.target.id === 'fivem-send-announcement-btn') {
                const message = document.getElementById('fivem-announcement-message').value;
                if (message) api.sendFivemAnnouncement(state.selectedGuildId, message).then(res => ui.showToast(res.message, 'success')).catch(err => ui.showToast(err.message, 'error'));
            }
        });
    }

    checkFiveMStatus(page);
    page.dataset.initialWarningShown = 'true'; // İlk yüklemede uyarıyı gösterdik olarak işaretle
    renderWhitelist();

    page.dataset.listenerAttached = 'true';
}
