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
            <!-- Aksiyon butonları kaldırıldı -->
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


export async function initFivemPage() {
    const page = document.getElementById('fivem-page');
    if (!page) return;

    // Olay dinleyicilerinin tekrar tekrar eklenmesini önlemek için,
    // fonksiyon her çağrıldığında önce mevcut dinleyicileri kontrol edip kuruyoruz.
    if (page.dataset.listenerAttached !== 'true') {
        page.addEventListener('click', (e) => {
            const profileLink = e.target.closest('.view-user-profile');
            if (profileLink) {
                e.stopPropagation();
                e.preventDefault();
                showUserProfileModal(profileLink.dataset.userId);
            }
        });

        const checkBtn = document.getElementById('fivem-check-status-btn');
        if (checkBtn) {
            checkBtn.addEventListener('click', () => checkFiveMStatus(page));
        }

        page.dataset.listenerAttached = 'true';
    }

    // Sayfa her yüklendiğinde durumu otomatik olarak kontrol et.
    await checkFiveMStatus(page);
}
