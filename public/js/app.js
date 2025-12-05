import { state } from './state.js';
import { api } from './api.js';
import * as ui from './ui.js';
import { initDashboardPage } from './pages/dashboard.js';
import { initRolesPage } from './pages/roles.js';
import { initMembersPage } from './pages/members.js';
import { initStatsPage } from './pages/stats.js';
import { initInvitesPage } from './pages/invites.js'; // Bu satır zaten varsa, tekrar eklemeyin.
import { initLeaderboardPage } from './pages/leaderboard.js';
import { initAuditLogPage } from './pages/audit-log.js';
import { initModLogPage } from './pages/mod-log.js';
import { initCustomCommandsPage } from './pages/customCommands.js'; // YENİ
import { initBackupsPage } from './pages/backups.js';
import { initWarningsPage } from './pages/warnings.js'; // YENİ
import { initBansPage } from './pages/bans.js'; // YENİ
import { initAuthorizedUsersPage } from './pages/authorized-users.js'; // YENİ
import { initPanelLogsPage } from './pages/panel-logs.js'; // YENİ
import { initMusicPlayerPage } from './pages/music.js'; // YENİ
import { initPluginsPage, setupPluginPageListeners } from './pages/plugins.js';

const pageInitializers = {
    'dashboard-page': initDashboardPage,
    'roles-page': initRolesPage,
    'members-page': initMembersPage,
    'stats-page': initStatsPage,
    'invites-page': initInvitesPage,
    'leaderboard-page': initLeaderboardPage,
    'audit-log-page': initAuditLogPage,
    'mod-log-page': initModLogPage,
    'custom-commands-page': initCustomCommandsPage,
    'backups-page': initBackupsPage,
    'bans-page': initBansPage, // YENİ
    'warnings-page': initWarningsPage, // YENİ
    'authorized-users-page': initAuthorizedUsersPage, // YENİ
    'music-player-page': initMusicPlayerPage, // YENİ
    'panel-logs-page': initPanelLogsPage, // YENİ
    'plugins-page': initPluginsPage,
};

async function switchPage(pageId, force = false) {
    const hasUnsaved = !!document.querySelector('.save-button.has-unsaved-changes');
    
    if (hasUnsaved && !force) {
        const userChoice = await ui.showConfirmModal(
            'Kaydedilmemiş Değişiklikler', 
            'Bu sayfada kaydedilmemiş değişiklikleriniz var. Ne yapmak istersiniz?',
            { showSaveButton: true } // YENİ: Kaydet butonunu göster
        );

        if (userChoice === 'save') {
            // Tüm değişiklikleri kaydet
            const saveAllButton = document.getElementById('save-all-changes-btn');
            if (saveAllButton) saveAllButton.click(); // "Tümünü Kaydet" butonunun mantığını tetikle
            // Kaydetme işleminin bitmesini beklemek için küçük bir gecikme
            await new Promise(resolve => setTimeout(resolve, 500)); 
        } else if (userChoice === 'discard') {
            // Hiçbir şey yapma, sadece devam et
        } else { // 'false' (iptal) veya başka bir durum
            return; // Sayfa geçişini iptal et
        }
    }

    // Tüm sayfaları gizle
    document.querySelectorAll('.page-content').forEach(page => page.style.display = 'none');
    
    // Eklenti sayfasının özel kapsayıcılarını da gizle
    document.querySelectorAll('.plugins-grid-container').forEach(container => {
        container.style.display = 'none';
    });


    // Tüm navigasyon linklerinden 'active' sınıfını kaldır
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));

    const targetPage = document.getElementById(pageId);
    const targetLink = document.querySelector(`.nav-link[data-page="${pageId}"]`);

    if (targetPage) {
        // Sadece hedef sayfayı göster
        targetPage.style.display = 'block';

        // Eğer hedef sayfa eklentiler sayfasıysa, onun özel kapsayıcılarını da göster
        if (pageId === 'plugins-page') {
            document.querySelectorAll('.plugins-grid-container').forEach(container => {
                container.style.display = 'block';
            });
        }

        if (targetLink) {
            targetLink.classList.add('active'); // İlgili menü öğesini aktif yap
        }

        // GÜNCELLENDİ: Yetki kontrolü ve sayfa yükleme mantığı düzeltildi.
        const ownerPages = ['authorized-users-page', 'panel-logs-page'];
        if (ownerPages.includes(pageId) && !window.isBotOwner) {
            // Yetki yoksa, sadece uyarı göster ve başka bir işlem yapma.
            targetPage.innerHTML = `
                <div class="access-denied-notice">
                    <i class="fa-solid fa-user-lock"></i>
                    <h3>Erişim Reddedildi</h3>
                    <p>Bu sayfayı görüntüleme yetkiniz bulunmamaktadır.</p>
                </div>`;
            // Bu durumda içerik yükleme fonksiyonu çağrılmaz.
        } else {
            // Yetki varsa veya sayfa herkese açıksa, içeriği yükle.
            const initializer = pageInitializers[pageId];
            if (initializer) {
                const dataKey = pageId.split('-')[0];
                const alwaysReload = ['plugins', 'roles', 'custom-commands', 'backups', 'stats', 'dashboard', 'authorized-users', 'panel-logs', 'music-player'];
                if (force || alwaysReload.includes(dataKey) || !state.isDataLoaded(dataKey)) {
                    await initializer();
                }
            }
        }
    }
}

async function updatePluginCardsUI() {
    // Her UI güncellemesinde, kaydedilmemiş değişiklik göstergelerini temizle
    document.querySelectorAll('.save-button.has-unsaved-changes').forEach(btn => {
        btn.classList.remove('has-unsaved-changes');
    });
    ui.updateUnsavedChangesBar();

    const { settings, channels, roles } = state.guildData;
    if (!settings || !channels || !roles) return;

    // YENİ: Bot sahibi kartını göster/gizle
    ui.updateBotOwnerCardVisibility();

    document.querySelectorAll('.plugin-card').forEach(card => {
        const moduleName = card.dataset.module;
        const moduleSettings = settings[moduleName];
        if (!moduleSettings) return;

        // Eklentinin aktif/pasif durumunu ayarla
        const enableToggle = card.querySelector('.enable-toggle');
        if (enableToggle) {
            enableToggle.checked = moduleSettings.enabled;
            card.classList.toggle('enabled', moduleSettings.enabled);
        }

        // Diğer tüm ayar girdilerini doldur
        card.querySelectorAll('[data-setting]').forEach(input => {
            const settingName = input.dataset.setting;
            const savedValue = moduleSettings[settingName] ?? (input.type === 'checkbox' ? false : '');

            if (input.type === 'checkbox') {
                input.checked = savedValue;
            } else if (input.tagName.toLowerCase() === 'select') {
                // YENİ: Daha esnek doldurma mantığı
                const channelTypesAttr = input.dataset.channelTypes;
                if (channelTypesAttr) {
                    let dataSource = [];
                    if (channelTypesAttr === 'voice') {
                        dataSource = channels.filter(c => c.type === 2); // Sadece ses kanalları
                    } else if (channelTypesAttr === 'category') {
                        dataSource = channels.filter(c => c.type === 4); // Sadece kategoriler
                    } else {
                        dataSource = channels.filter(c => [0, 5, 10, 11, 12].includes(c.type)); // Varsayılan metin kanalları
                    }
                    ui.populateSelect(input, dataSource, savedValue, { defaultText: 'Bir kanal seçin...' });
                } else if (settingName.toLowerCase().includes('channelid') || settingName.toLowerCase().includes('categoryid')) {
                    // Eski mantıkla uyumluluk için
                    const isCategory = settingName.toLowerCase().includes('categoryid');
                    const dataSource = isCategory ? channels.filter(c => c.type === 4) : channels.filter(c => [0, 5, 10, 11, 12].includes(c.type));
                    ui.populateSelect(input, dataSource, savedValue, { defaultText: 'Bir kanal seçin...' });
                } else if (settingName.toLowerCase().includes('roleid') || input.id.toLowerCase().includes('role-select')) {
                    // Rol menülerini doldur
                    ui.populateSelect(input, roles, savedValue, { defaultText: 'Bir rol seçin...' });
                } else if (settingName.toLowerCase().includes('roleid')) {
                    ui.populateSelect(input, roles, savedValue, { defaultText: 'Bir rol seçin...' });
                } else {
                    input.value = savedValue;
                }
            } else if (input.type === 'number' && input.dataset.type) {
                // YENİ: Saat veya saniye gibi özel veri türlerini dönüştürerek göster
                let displayValue = savedValue;
                if (input.dataset.type === 'seconds') displayValue /= 1000;
                if (input.dataset.type === 'hours') displayValue /= 3600000;
                input.value = displayValue;
            } else {
                input.value = savedValue;
            }
        });

        // YENİ: Resim önizlemelerini ayarla
        const welcomeBg = settings.welcome?.welcomeBackgroundImage;
        const goodbyeBg = settings.welcome?.goodbyeBackgroundImage;
        const welcomePreview = document.getElementById('welcome-bg-preview');
        const goodbyePreview = document.getElementById('goodbye-bg-preview');
        if (welcomeBg && welcomePreview) { welcomePreview.src = `/uploads/${welcomeBg}`; welcomePreview.style.display = 'block'; }
        else if (welcomePreview) { welcomePreview.style.display = 'none'; }
        if (goodbyeBg && goodbyePreview) { goodbyePreview.src = `/uploads/${goodbyeBg}`; goodbyePreview.style.display = 'block'; }
        else if (goodbyePreview) { goodbyePreview.style.display = 'none'; }
    });

    // Özel liste render fonksiyonlarını çağır (ui.js'den gelenler)
    if (settings.moderation) {
        ui.renderProtectedChannelsList(channels, settings.moderation.protectedChannelIds);
        ui.renderAutoPunishmentsList(settings.moderation.autoPunishments); // YENİ
    }
    if (settings.inviteTracker) {
        ui.renderInviteRewardsList(roles, settings.inviteTracker.rewardRoles);
    }
    if (settings.antiSpam) {
        ui.renderAntiSpamAllowedRoles(roles, settings.antiSpam.allowedRoles);
    }
    if (settings.announcements) { // YENİ EKLENDİ
        ui.renderAnnouncementsAllowedRoles(roles, settings.announcements.allowedRoles);
    }
    if (settings.economy) { // YENİ: Market ürünlerini render et
        ui.renderMarketItemsList(roles, settings.economy.marketItems);
    }
    if (settings.tickets) {
        ui.renderTicketTopicsList(settings.tickets.topics);
    }
    // YENİ: Otomatik Moderasyon listelerini render et
    if (settings.autoModeration) {
        ui.renderBannedWordsList(settings.autoModeration.bannedWords);
        ui.renderAutoModIgnoredRoles(roles, settings.autoModeration.ignoredRoles);
    }

    // Bilet sistemi gibi daha karmaşık listeler için de buraya ekleme yapılabilir.
}

/**
 * YENİ: Botun sunucudaki izinlerini kontrol eder ve eksikse uyarı gösterir.
 * @param {string} guildId 
 */
async function checkAndShowPermissionsWarning(guildId) {
    const warningContainer = document.getElementById('permission-warning-container');
    const warningText = document.getElementById('permission-warning-text');
    if (!warningContainer || !warningText) return;

    warningContainer.style.display = 'none'; // Kontrol öncesi uyarıyı gizle

    try {
        await api.checkPermissions(guildId);
    } catch (error) {
        const missingPermissionsList = error.missing ? `<ul>${error.missing.map(p => `<li>${p}</li>`).join('')}</ul>` : '';
        warningText.innerHTML = `<strong>Bot İzinleri Eksik!</strong><br>Panelin düzgün çalışması için botun aşağıdaki izinlere sahip olduğundan emin olun:${missingPermissionsList}`;
        warningContainer.style.display = 'flex';
    }
}

async function loadGuildData(guildId) {
    try {
        const [settings, channels, roles] = await Promise.all([
            api.getGuildSettings(guildId),
            api.getGuildChannels(guildId),
            api.getGuildRoles(guildId),
        ]);

        // YENİ: İzinleri kontrol et ve uyarı göster
        await checkAndShowPermissionsWarning(guildId);

        state.updateGuildData({ settings, channels, roles });
        updatePluginCardsUI(); // EKLENEN SATIR: Arayüzü gelen verilerle doldur.
        console.log("Sunucu verileri yüklendi ve arayüz güncellendi.", state.guildData);
        await switchPage('dashboard-page', true); // Sayfayı zorla değiştir (kaydedilmemiş değişiklik uyarısı olmadan)
    } catch (error) {
        ui.showToast(`Sunucu verileri yüklenemedi: ${error.message}`, 'error');
        showServerSelector();
    }
}

async function showServerSelector() {
    try {
        const [userGuilds, botGuildIds] = await Promise.all([api.getUserGuilds(), api.getBotGuilds()]);
        ui.elements.serverListContainer.innerHTML = '';
        userGuilds.forEach(guild => {
            const icon = guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png';
            const card = document.createElement('div');
            card.className = 'server-card';
            card.dataset.guildId = guild.id;
            card.dataset.guildName = guild.name;
            card.dataset.guildIcon = icon;
            const isBotInGuild = botGuildIds.includes(guild.id);
            card.innerHTML = `<img class="server-icon" src="${icon}" alt="icon"><span class="server-name">${guild.name}</span>`;
            if (!isBotInGuild) {
                card.classList.add('not-in-server');
                card.dataset.inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&permissions=8&scope=bot%20applications.commands&guild_id=${guild.id}&disable_guild_select=true`;
                card.innerHTML += `<span class="warning-text"><i class="fa-solid fa-triangle-exclamation"></i> Bot sunucuda değil. Ekleme için tıklayın.</span>`;
            }
            ui.elements.serverListContainer.appendChild(card);
        });
        ui.elements.modal.style.display = 'flex';
    } catch (error) {
        ui.showToast(`Sunucu listesi alınamadı: ${error.message}`, 'error');
    }
}

function setupEventListeners() {
    ui.elements.sidebarNav.addEventListener('click', (e) => {
        const navLink = e.target.closest('.nav-link');
        if (navLink && navLink.dataset.page) {
            e.preventDefault();
            switchPage(navLink.dataset.page);
        }
    });

    ui.elements.serverListContainer.addEventListener('click', (e) => {
        const card = e.target.closest('.server-card');
        if (!card) return;

        if (card.classList.contains('not-in-server')) {
            window.open(card.dataset.inviteUrl, '_blank');
            return;
        }

        // YENİ: Sunucu değiştirirken kaydedilmemiş değişiklikleri temizle
        document.querySelectorAll('.save-button.has-unsaved-changes').forEach(btn => {
            btn.classList.remove('has-unsaved-changes');
        });
        
        state.setSelectedGuild(card.dataset.guildId, card.dataset.guildName, card.dataset.guildIcon);
        ui.elements.currentServerIcon.src = card.dataset.guildIcon;
        ui.elements.currentServerName.textContent = card.dataset.guildName;
        ui.elements.modal.style.display = 'none';
        ui.elements.mainContent.style.display = 'block';
        loadGuildData(card.dataset.guildId);
    });

    ui.elements.currentServerHeader.addEventListener('click', () => {
        // Kullanıcının sunucu değiştirmesine izin ver
        showServerSelector();
    });

    // =================================================================
    // MERKEZİ OLAY YÖNETİCİSİ (GLOBAL EVENT DELEGATION)
    // =================================================================
    document.body.addEventListener('click', async (e) => {
        const target = e.target;

        // --- 1. data-action niteliğine sahip butonları işle ---
        const actionTarget = target.closest('[data-action]');
        if (actionTarget) {
            const action = actionTarget.dataset.action;
            switch (action) {
                // Çıkış yapma butonu için data-action eklendi
                case 'logout':
                    window.location.href = '/auth/logout';
                    break;

                case 'save-all': {
                    const saveButtons = document.querySelectorAll('.save-button.has-unsaved-changes');
                    console.log(`[Save All] Found ${saveButtons.length} settings to save.`);
                    ui.showToast(`Tüm ayarlar kaydediliyor... (${saveButtons.length} adet)`, 'info');
                    const savePromises = Array.from(saveButtons).map(btn => saveSettings(btn));
                    try {
                        await Promise.all(savePromises);
                        ui.showToast('Tüm değişiklikler başarıyla kaydedildi!', 'success');
                    } catch (error) {
                        console.error("Toplu kaydetme sırasında hata:", error);
                        ui.showToast('Bazı ayarlar kaydedilirken bir hata oluştu.', 'error');
                    }
                    break;
                }

                case 'save-plugin':
                    await saveSettings(actionTarget);
                    break;

                case 'collapse-plugin':
                    if (!target.closest('.switch')) {
                        actionTarget.closest('.plugin-card')?.classList.toggle('collapsed');
                    }
                    break;

                case 'reset-all-settings': {
                    const confirmed = await ui.showConfirmModal('Tüm Ayarları Sıfırla', 'Bu sunucu için yapılandırılmış TÜM eklenti ayarlarını varsayılan değerlerine sıfırlamak istediğinizden emin misiniz? Bu işlem geri alınamaz.');
                    if (!confirmed) return;
                    try {
                        await api.resetAllSettings(state.selectedGuildId);
                        ui.showToast('Tüm ayarlar başarıyla sıfırlandı. Panel yenileniyor...', 'success');
                        setTimeout(() => loadGuildData(state.selectedGuildId), 1500);
                    } catch (error) {
                        ui.showToast(`Hata: ${error.message}`, 'error');
                    }
                    break;
                }

                case 'export-settings': {
                    const settingsToExport = state.guildData.settings;
                    if (!settingsToExport || Object.keys(settingsToExport).length === 0) {
                        ui.showToast('Dışa aktarılacak ayar bulunamadı.', 'warning');
                        return;
                    }
                    const dataStr = JSON.stringify(settingsToExport, null, 4);
                    const blob = new Blob([dataStr], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `sunucu-ayarlari-${state.selectedGuildId}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    break;
                }
                case 'import-settings':
                    document.getElementById('import-settings-input')?.click();
                    break;
            }
        }

        // YENİ: Kullanıcı Engelleme Butonu
        if (target.id === 'block-user-btn') {
            const input = document.getElementById('user-id-to-block');
            const userId = input.value.trim();
            if (!/^\d{17,19}$/.test(userId)) {
                return ui.showToast('Lütfen geçerli bir Discord kullanıcı ID\'si girin.', 'error');
            }
            try {
                const result = await api.blockUser(userId);
                ui.showToast(result.message, 'success');
                input.value = '';
            } catch (error) {
                ui.showToast(`Engelleme hatası: ${error.message}`, 'error');
            }
            // YENİ: Listeyi güncelle
            const blockedUsers = await api.getBlockedUsers();
            renderBlockedUsersList(blockedUsers);
        }

        // YENİ: Kullanıcı Engelini Kaldırma Butonu
        const unblockBtn = target.closest('.unblock-user-btn');
        if (unblockBtn) {
            handleUnblockUser(unblockBtn.dataset.id);
        }

        // --- 2. Otomatik Moderasyon kartındaki özel butonları işle ---
        const autoModCard = target.closest('.plugin-card[data-module="autoModeration"]');
        if (autoModCard) {
            const settings = state.guildData.settings.autoModeration;
            if (!settings) return;

            // Yasaklı kelime ekle
            if (target.id === 'add-banned-word-btn') {
                const input = document.getElementById('new-banned-word');
                const word = input.value.trim().toLowerCase();
                if (word && !settings.bannedWords.includes(word)) {
                    settings.bannedWords.push(word);
                    ui.renderBannedWordsList(settings.bannedWords);
                    input.value = '';
                    autoModCard.querySelector('.save-button').classList.add('has-unsaved-changes');
                    ui.updateUnsavedChangesBar();
                }
            }
            // Yasaklı kelime sil
            else if (target.closest('.remove-item-btn')?.dataset.word) {
                const wordToRemove = target.closest('.remove-item-btn').dataset.word;
                settings.bannedWords = settings.bannedWords.filter(w => w !== wordToRemove);
                ui.renderBannedWordsList(settings.bannedWords);
                autoModCard.querySelector('.save-button').classList.add('has-unsaved-changes');
                ui.updateUnsavedChangesBar();
            }
            // Görmezden gelinecek rol ekle
            else if (target.id === 'add-automod-ignored-role-btn') {
                const select = document.getElementById('automod-ignored-role-select');
                const roleId = select.value;
                if (roleId && !settings.ignoredRoles.includes(roleId)) {
                    settings.ignoredRoles.push(roleId);
                    ui.renderAutoModIgnoredRoles(state.guildData.roles, settings.ignoredRoles);
                    autoModCard.querySelector('.save-button').classList.add('has-unsaved-changes');
                    ui.updateUnsavedChangesBar();
                }
            }
            // Görmezden gelinecek rol sil
            else if (target.closest('#automod-ignored-roles-list .remove-item-btn')) {
                const roleIdToRemove = target.closest('.remove-item-btn').dataset.id;
                settings.ignoredRoles = settings.ignoredRoles.filter(id => id !== roleIdToRemove);
                ui.renderAutoModIgnoredRoles(state.guildData.roles, settings.ignoredRoles);
                autoModCard.querySelector('.save-button').classList.add('has-unsaved-changes');
                ui.updateUnsavedChangesBar();
            }
        }
    });

    // Dosya seçildiğinde içe aktarma işlemini tetikle
    document.getElementById('import-settings-input')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const newSettings = JSON.parse(event.target.result);
                const confirmed = await ui.showConfirmModal('Ayarları İçe Aktar', 'Mevcut tüm ayarlarınızın üzerine bu dosyadaki ayarların yazılmasını onaylıyor musunuz? Bu işlem geri alınamaz.');
                if (!confirmed) return;

                await api.importSettings(state.selectedGuildId, newSettings);
                ui.showToast('Ayarlar başarıyla içe aktarıldı. Panel yenileniyor...', 'success');
                setTimeout(() => loadGuildData(state.selectedGuildId), 1500);
            } catch (error) {
                ui.showToast(`İçe aktarma hatası: ${error.message}`, 'error');
            } finally {
                // Aynı dosyayı tekrar seçebilmek için input'u sıfırla
                e.target.value = '';
            }
        };
        reader.readAsText(file);
    });

    document.addEventListener('change', async (e) => {
        if (e.target.classList.contains('image-upload-input')) {
            const fileInput = e.target;
            const file = fileInput.files[0];
            if (!file) return;

            const imageType = fileInput.dataset.type; // 'welcome' veya 'goodbye'
            const formData = new FormData();
            formData.append('backgroundImage', file);

            try {
                const response = await fetch(`/api/guild/${state.selectedGuildId}/upload-welcome-image/${imageType}`, {
                    method: 'POST',
                    body: formData,
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error);

                ui.showToast('Resim başarıyla yüklendi ve kaydedildi!', 'success');
                document.getElementById(`${imageType}-bg-preview`).src = result.filePath;
                document.getElementById(`${imageType}-bg-preview`).style.display = 'block';
            } catch (error) {
                ui.showToast(`Resim yüklenemedi: ${error.message}`, 'error');
            }
        }
    });

}

export async function saveSettings(button) {
    const card = button.closest('.plugin-card');
    if (!card) return;
    const moduleName = card.dataset.module;
    const settings = {};

    card.querySelectorAll('[data-setting]').forEach(input => {
        let value;
        if (input.type === 'checkbox') {
            value = input.checked;
        } else if (input.type === 'number') {
            value = Number(input.value);
        } else {
            value = input.value;
        }
        if (input.dataset.type === 'seconds') {
            value *= 1000;
        } else if (input.dataset.type === 'hours') {
            value *= 3600000; // 1 saat = 3,600,000 milisaniye
        }
        settings[input.dataset.setting] = value;
    });

    // Listelerden gelen verileri de ayarlara ekle
    if (moduleName === 'moderation') {
        settings.protectedChannelIds = Array.from(document.querySelectorAll('#protected-channels-list .remove-item-btn')).map(btn => btn.dataset.id);
        settings.autoPunishments = state.guildData.settings.moderation?.autoPunishments || []; // YENİ
    }
    if (moduleName === 'inviteTracker') {
        settings.rewardRoles = Array.from(document.querySelectorAll('#invite-rewards-list .protected-item')).map(item => {
            const count = parseInt(item.querySelector('strong')?.textContent, 10) || 0;
            const roleId = item.querySelector('.remove-item-btn')?.dataset.id;
            return { inviteCount: count, roleId: roleId };
        }).filter(r => r.roleId && r.inviteCount > 0);
    }
    if (moduleName === 'antiSpam') {
        settings.allowedRoles = Array.from(document.querySelectorAll('#antispam-allowed-roles-list .remove-item-btn')).map(btn => btn.dataset.id);
    }
    // YENİ: Duyuru sistemi için izinli rolleri kaydet
    if (moduleName === 'announcements') {
        settings.allowedRoles = Array.from(document.querySelectorAll('#announcements-allowed-roles-list .remove-item-btn')).map(btn => btn.dataset.id);
    }
    // YENİ: Ekonomi marketi ürünlerini kaydetme verisine ekle
    if (moduleName === 'economy') {
        settings.marketItems = state.guildData.settings.economy?.marketItems || [];
    }
    if (moduleName === 'tickets') {
        // Bilet konularını doğrudan state'den alıp kaydetme verisine ekleyin
        settings.topics = state.guildData.settings.tickets?.topics || [];
    }
    // YENİ: Otomatik Moderasyon verilerini kaydet
    if (moduleName === 'autoModeration') {
        settings.bannedWords = state.guildData.settings.autoModeration?.bannedWords || [];
        settings.ignoredRoles = state.guildData.settings.autoModeration?.ignoredRoles || [];
    }

    const isGlobalModule = moduleName === 'botStatus';
    const guildIdToSave = isGlobalModule ? 'global' : state.selectedGuildId;

    try {
        await api.saveSettings(guildIdToSave, moduleName, settings);
        ui.showToast(`${moduleName} ayarları başarıyla kaydedildi!`);
        button.classList.remove('has-unsaved-changes');
        ui.updateUnsavedChangesBar();
    } catch (error) {
        ui.showToast(`Ayarlar kaydedilirken hata: ${error.message}`, 'error');
        throw error; // Promise.all'un hatayı yakalaması için fırlat
    }
}

/**
 * YENİ: Engellenen kullanıcılar listesini arayüzde oluşturur.
 * @param {string[]} userIds Engellenen kullanıcı ID'lerinin dizisi.
 */
function renderBlockedUsersList(userIds) {
    const listContainer = document.getElementById('blocked-users-list'); // Bu ID'nin yeni kartta olduğundan emin olun
    if (!listContainer) return;

    listContainer.innerHTML = '';
    if (!userIds || userIds.length === 0) {
        listContainer.innerHTML = '<p class="setting-description" style="text-align: center; margin-top: 10px;">Engellenmiş kullanıcı yok.</p>';
        return;
    }

    userIds.forEach(userId => {
        const item = document.createElement('div');
        item.className = 'list-item'; // Daha genel bir sınıf adı kullanıldı
        item.innerHTML = `
            <span>${userId}</span>
            <button type="button" class="remove-item-btn unblock-user-btn" data-id="${userId}" title="Engeli Kaldır">
                <i class="fa-solid fa-unlock"></i>
            </button>
        `;
        listContainer.appendChild(item);
    });
}

/**
 * YENİ: Kullanıcı engelini kaldırma işlemini yönetir.
 * @param {string} userId Engeli kaldırılacak kullanıcı ID'si.
 */
async function handleUnblockUser(userId) {
    const result = await api.unblockUser(userId);
    ui.showToast(result.message, 'success');
    const blockedUsers = await api.getBlockedUsers();
    renderBlockedUsersList(blockedUsers);
}

async function init() {
    // Olay dinleyicilerini her zaman en başta kur, böylece sayfa yüklendiği andan itibaren aktif olurlar.
    setupEventListeners();

    const lastGuildId = localStorage.getItem('selectedGuildId');
    if (lastGuildId) {
        state.selectedGuildId = lastGuildId;
        ui.elements.currentServerIcon.src = localStorage.getItem('selectedGuildIcon');
        ui.elements.currentServerName.textContent = localStorage.getItem('selectedGuildName');
        ui.elements.mainContent.style.display = 'block';
        ui.elements.modal.style.display = 'none'; // EKRANI GİZLEMEK İÇİN EKLENEN SATIR
        await loadGuildData(lastGuildId); // Sunucu verilerinin yüklenmesini bekle

        // YENİ: Sayfa yüklendikten sonra engellenen kullanıcılar listesini de yükle
        if (window.isBotOwner) {
            const blockedUsers = await api.getBlockedUsers();
            renderBlockedUsersList(blockedUsers);
        }
    } else {
        await showServerSelector();
    }
}

init();