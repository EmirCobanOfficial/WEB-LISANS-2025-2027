import { api } from '../api.js';
import { state } from '../state.js';
import { showConfirmModal, showToast } from '../ui.js';

const permissionTranslations = {
    'AddReactions': 'Tepki Ekle', 'Administrator': 'Yönetici', 'AttachFiles': 'Dosya Ekle', 'BanMembers': 'Üyeleri Yasakla',
    'ChangeNickname': 'Kullanıcı Adı Değiştir', 'Connect': 'Bağlan', 'CreateInstantInvite': 'Anlık Davet Oluştur',
    'CreatePrivateThreads': 'Özel Konu Oluştur', 'CreatePublicThreads': 'Herkese Açık Konu Oluştur', 'DeafenMembers': 'Üyeleri Sağırlaştır',
    'EmbedLinks': 'Bağlantı Göm', 'KickMembers': 'Üyeleri At', 'ManageChannels': 'Kanalları Yönet', 'ManageEmojisAndStickers': 'Emojileri ve Çıkartmaları Yönet',
    'ManageEvents': 'Etkinlikleri Yönet', 'ManageGuild': 'Sunucuyu Yönet', 'ManageMessages': 'Mesajları Yönet', 'ManageNicknames': 'Kullanıcı Adlarını Yönet',
    'ManageRoles': 'Rolleri Yönet', 'ManageThreads': 'Konuları Yönet', 'ManageWebhooks': 'Webhook\'ları Yönet', 'MentionEveryone': '@everyone, @here ve Tüm Rollerden Bahset',
    'ModerateMembers': 'Üyeleri Denetle', 'MoveMembers': 'Üyeleri Taşı', 'MuteMembers': 'Üyeleri Sustur', 'PrioritySpeaker': 'Öncelikli Konuşmacı',
    'ReadMessageHistory': 'Mesaj Geçmişini Oku', 'RequestToSpeak': 'Konuşma İsteğinde Bulun', 'SendMessages': 'Mesaj Gönder',
    'SendMessagesInThreads': 'Konularda Mesaj Gönder', 'SendTTSMessages': 'Metin Okuma Mesajı Gönder', 'SendVoiceMessages': 'Sesli Mesaj Gönder',
    'Speak': 'Konuş', 'Stream': 'Yayın Yap', 'UseApplicationCommands': 'Uygulama Komutlarını Kullan', 'UseEmbeddedActivities': 'Gömülü Etkinlikleri Kullan',
    'UseExternalEmojis': 'Harici Emojiler Kullan', 'UseExternalStickers': 'Harici Çıkartmalar Kullan', 'UseVAD': 'Ses Eylemini Kullan',
    'ViewAuditLog': 'Denetim Kaydını Görüntüle', 'ViewChannel': 'Kanalı Görüntüle', 'ViewGuildInsights': 'Sunucu İstatistiklerini Görüntüle',
    'UseSoundboard': 'Ses Tahtası Kullan', 'UseExternalSounds': 'Harici Sesler Kullan', 'ViewCreatorMonetizationAnalytics': 'İçerik Üreticisi Para Kazanma Analizlerini Görüntüle'
};

const permissionGroups = {
    'Genel Sunucu İzinleri': ['ViewChannel', 'ManageChannels', 'ManageRoles', 'ManageEmojisAndStickers', 'ViewAuditLog', 'ManageWebhooks', 'ManageGuild', 'CreateInstantInvite', 'ChangeNickname', 'ManageNicknames', 'ManageEvents', 'ViewCreatorMonetizationAnalytics', 'ViewGuildInsights', 'Administrator'],
    'Üyelik İzinleri': ['KickMembers', 'BanMembers', 'ModerateMembers'],
    'Metin Kanalı İzinleri': ['SendMessages', 'SendMessagesInThreads', 'CreatePublicThreads', 'CreatePrivateThreads', 'EmbedLinks', 'AttachFiles', 'AddReactions', 'UseExternalEmojis', 'UseExternalStickers', 'MentionEveryone', 'ManageMessages', 'ManageThreads', 'ReadMessageHistory', 'SendTTSMessages', 'UseApplicationCommands', 'SendVoiceMessages'],
    'Ses Kanalı İzinleri': ['Connect', 'Speak', 'Stream', 'UseVAD', 'PrioritySpeaker', 'MuteMembers', 'DeafenMembers', 'MoveMembers', 'UseSoundboard', 'UseExternalSounds', 'RequestToSpeak', 'UseEmbeddedActivities']
};

function displayRoles(roles) {
    const container = document.getElementById('roles-list-container');
    if (!container) return;
    container.innerHTML = '';

    if (roles.length === 0) {
        container.innerHTML = '<p>Bu filtreyle eşleşen rol bulunamadı.</p>';
        return;
    }

    roles.forEach(role => {
        const card = document.createElement('div');
        card.className = 'role-card';
        card.innerHTML = `
            <div class="role-card-header">
                <span class="role-color-dot" style="background-color: ${role.color};"></span>
                <span class="role-name">${role.name}</span>
            </div>
            <div class="role-card-actions">
                <button class="role-action-btn edit" data-role-id="${role.id}">Düzenle</button>
                <button class="role-action-btn delete" data-role-id="${role.id}" data-role-name="${role.name}">Sil</button>
            </div>
        `;
        container.appendChild(card);
    });
}

function renderPermissionsGrid(currentPermissions = 0n) {
    const container = document.getElementById('permissions-grid-container');
    if (!container) return;
    container.innerHTML = '';

    const allPermissions = Object.entries(state.guildData.permissions);

    for (const groupName in permissionGroups) {
        const groupPermissions = permissionGroups[groupName];
        const groupContainer = document.createElement('div');
        groupContainer.className = 'permission-group';
        const groupHeader = document.createElement('h4');
        groupHeader.className = 'permission-group-header';
        groupHeader.textContent = groupName;
        groupContainer.appendChild(groupHeader);
        const grid = document.createElement('div');
        grid.className = 'permissions-grid';

        const permissionsInGroup = allPermissions
            .filter(([name]) => groupPermissions.includes(name))
            .sort((a, b) => (permissionTranslations[a[0]] || a[0]).localeCompare(permissionTranslations[b[0]] || b[0]));

        for (const [name, value] of permissionsInGroup) {
            const permissionValue = BigInt(value);
            const isChecked = (currentPermissions & permissionValue) === permissionValue;
            const item = document.createElement('div');
            item.className = 'permission-item';
            const checkboxId = `perm-${name}`;
            item.innerHTML = `
                <input type="checkbox" id="${checkboxId}" value="${permissionValue}" ${isChecked ? 'checked' : ''}>
                <label for="${checkboxId}">${permissionTranslations[name] || name.replace(/([A-Z])/g, ' $1').trim()}</label>
            `;
            grid.appendChild(item);
        }
        groupContainer.appendChild(grid);
        container.appendChild(groupContainer);
    }
}

function openRoleModal(role = null) {
    const modal = document.getElementById('role-edit-modal');
    const form = document.getElementById('role-edit-form');
    const title = document.getElementById('role-modal-title');
    if (!modal || !form || !title) return;

    form.reset();
    document.getElementById('role-edit-id').value = role ? role.id : '';
    title.textContent = role ? 'Rolü Düzenle' : 'Yeni Rol Oluştur';

    if (role) {
        document.getElementById('role-name-input').value = role.name;
        document.getElementById('role-color-input').value = role.color;
        renderPermissionsGrid(BigInt(role.permissions));
    } else {
        document.getElementById('role-color-input').value = '#99aab5';
        renderPermissionsGrid(0n);
    }

    modal.style.display = 'flex';
}

async function handleRoleSave(event) {
    event.preventDefault();
    const form = event.target;
    const saveButton = form.querySelector('#role-modal-save');
    saveButton.disabled = true;
    saveButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Kaydediliyor...';

    const roleId = form.querySelector('#role-edit-id').value;
    const name = form.querySelector('#role-name-input').value.trim();
    const color = form.querySelector('#role-color-input').value;

    // İzinleri topla
    let permissions = 0n; // BigInt olarak başlat
    form.querySelectorAll('#permissions-grid-container input[type="checkbox"]:checked').forEach(checkbox => {
        permissions |= BigInt(checkbox.value);
    });

    const roleData = {
        name,
        color,
        permissions: permissions.toString(), // API'ye string olarak gönder
    };

    try {
        if (roleId) {
            // Rolü güncelle
            await api.updateRole(state.selectedGuildId, roleId, roleData);
            showToast('Rol başarıyla güncellendi.', 'success');
        } else {
            // Yeni rol oluştur
            await api.createRole(state.selectedGuildId, roleData);
            showToast('Rol başarıyla oluşturuldu.', 'success');
        }
        document.getElementById('role-edit-modal').style.display = 'none';
        initRolesPage(); // Sayfayı yenile
    } catch (error) {
        showToast(`Hata: ${error.message}`, 'error');
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = 'Kaydet';
    }
}

async function handleRoleDelete(roleId, roleName) {
    const confirmed = await showConfirmModal('Rolü Sil', `'${roleName}' rolünü silmek istediğinizden emin misiniz?`);
    if (confirmed) {
        try {
            await api.deleteRole(state.selectedGuildId, roleId);
            showToast('Rol başarıyla silindi.', 'success');
            initRolesPage(); // Refresh the page
        } catch (error) {
            showToast(`Hata: ${error.message}`, 'error');
        }
    }
}

export async function initRolesPage() {
    const container = document.getElementById('roles-list-container');
    const filterSelect = document.getElementById('role-permission-filter');
    if (!container) return;

    container.innerHTML = '<p>Roller yükleniyor...</p>';

    // Populate filter dropdown only if it's empty
    if (filterSelect && (!state.guildData.permissions || filterSelect.options.length <= 1)) {
        filterSelect.innerHTML = '<option value="all">Tüm İzinler</option>';
        const permissions = await api.getPermissions();
        state.updateGuildData({ permissions });
        const sortedPermissions = Object.entries(permissionTranslations).sort((a, b) => a[1].localeCompare(b[1]));
        for (const [key, name] of sortedPermissions) {
            const permissionValue = permissions[key];
            if (permissionValue) {
                const option = new Option(name, permissionValue);
                filterSelect.add(option);
            }
        }
    }
    if (filterSelect) filterSelect.value = 'all'; // Reset filter on page load

    try {
        const roles = await api.getGuildRoles(state.selectedGuildId);
        state.updateGuildData({ roles });
        displayRoles(roles);
    } catch (error) {
        container.innerHTML = `<p style="color: var(--red);">${error.message}</p>`;
    }
}

document.getElementById('roles-list-container')?.addEventListener('click', e => {
    const deleteBtn = e.target.closest('.role-action-btn.delete');
    if (deleteBtn) {
        handleRoleDelete(deleteBtn.dataset.roleId, deleteBtn.dataset.roleName);
    }
    const editBtn = e.target.closest('.role-action-btn.edit');
    if (editBtn) {
        const roleId = editBtn.dataset.roleId;
        const role = state.guildData.roles.find(r => r.id === roleId);
        if (role) openRoleModal(role);
    }
});

document.getElementById('create-role-btn')?.addEventListener('click', () => openRoleModal(null));
document.getElementById('role-edit-form')?.addEventListener('submit', handleRoleSave);

const roleEditModal = document.getElementById('role-edit-modal');
if (roleEditModal) {
    roleEditModal.addEventListener('click', (e) => {
        if (e.target === roleEditModal || e.target.id === 'role-modal-cancel') {
            roleEditModal.style.display = 'none';
        }
    });
}