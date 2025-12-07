import { api } from '../api.js';
import { state } from '../state.js';

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
                <div id="user-profile-created">Hesap Oluşturma: ${new Date(user.createdAt).toLocaleDateString('tr-TR')}</div>
            </div>
        `;
    } catch (error) {
        content.innerHTML = `<div style="text-align: center; padding: 20px;"><i class="fa-solid fa-circle-xmark" style="font-size: 2em; color: var(--red);"></i><p style="color: var(--red);">${error.message}</p></div>`;
    }
}

function displayAuthorizedUsers(users) {
    const container = document.getElementById('authorized-users-list');
    container.innerHTML = '';

    if (!users || users.length === 0) {
        container.innerHTML = '<p>Panele henüz kimse giriş yapmamış.</p>';
        return;
    }

    // Kullanıcıları en son giriş yapana göre sırala
    const sortedUsers = users.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    sortedUsers.forEach(user => {
        const entryDiv = document.createElement('div');
        entryDiv.className = 'user-entry';
        const timestamp = new Date(user.timestamp).toLocaleString('tr-TR', {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });

        entryDiv.innerHTML = `
            <div class="user-info">
                <img src="${user.avatar}" alt="${user.tag}'s avatar" class="avatar">
                <div class="user-details">
                    <span class="user-tag">${user.tag}</span>
                    <span class="user-id">${user.id}</span>
                </div>
            </div>
            <div class="list-item-actions">
                <div class="login-timestamp" style="text-align: right; margin-right: 15px;">
                    <strong>Son Giriş:</strong> ${timestamp}
                </div>
                <!-- YENİ: Profil Görüntüle Butonu -->
                <button class="action-btn edit view-user-profile-btn" data-user-id="${user.id}">
                    <i class="fa-solid fa-eye"></i> Profili Görüntüle
                </button>
            </div>
        `;
        container.appendChild(entryDiv);
    });
}

export async function initAuthorizedUsersPage() {
    const container = document.getElementById('authorized-users-list');
    if (!container) return;

    container.innerHTML = '<p>Giriş yapan kullanıcılar yükleniyor...</p>';

    try {
        // YENİ: Olay dinleyicisini sadece bir kez kur
        if (!container.dataset.listenerAttached) {
            container.addEventListener('click', (e) => {
                const profileBtn = e.target.closest('.view-user-profile-btn');
                if (profileBtn) {
                    showUserProfileModal(profileBtn.dataset.userId);
                }
            });
            document.getElementById('user-profile-modal-close')?.addEventListener('click', () => {
                document.getElementById('user-profile-modal').style.display = 'none';
            });
            container.dataset.listenerAttached = 'true';
        }
        // API'den kullanıcı listesini çekmek için yeni bir endpoint çağıracağız.
        const users = await api.getAuthorizedUsers();
        displayAuthorizedUsers(users);
    } catch (error) {
        // YENİ: Yetki hatası geldiğinde modern bir uyarı göster
        container.innerHTML = `
            <div class="access-denied-notice">
                <i class="fa-solid fa-shield-halved"></i>
                <h3>Erişim Reddedildi</h3>
                <p>Bu sayfayı görüntüleme yetkiniz bulunmamaktadır.</p>
            </div>
        `;
    }
}
