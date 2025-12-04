import { api } from '../api.js';
import { state } from '../state.js';

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
            <div class="login-timestamp">
                <strong>Son Giriş:</strong> ${timestamp}
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
        // API'den kullanıcı listesini çekmek için yeni bir endpoint çağıracağız.
        const users = await api.getAuthorizedUsers(); // DÜZELTME: Bu global bir veri olduğu için guildId göndermeye gerek yok.
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
