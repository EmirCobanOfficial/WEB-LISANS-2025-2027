import { api } from '../api.js';
import { state } from '../state.js';
import * as ui from '../ui.js';
import { saveSettings } from '../app.js';

function initializeSortable(gridId) {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    new Sortable(grid, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
    });
}

export async function initPluginsPage() {
    // Sürükle-bırak özelliğini başlat
    document.querySelectorAll('.plugins-grid').forEach(grid => initializeSortable(grid.id));

    // Bu sayfaya özel olay dinleyicilerini kur
    setupPluginPageListeners();
}

export function setupPluginPageListeners() {
    const pluginsPage = document.getElementById('plugins-page');
    if (!pluginsPage || pluginsPage.dataset.listenerAttached === 'true') {
        return; // Dinleyici zaten kuruluysa, tekrar kurma.
    }

    pluginsPage.addEventListener('click', (e) => {
        const target = e.target;

        // Eklenti kartlarını daralt/genişlet
        const header = target.closest('.plugin-header');
        if (header && !target.closest('.switch')) {
            header.closest('.plugin-card')?.classList.toggle('collapsed');
        } // Bu kısım app.js'e taşındı, ancak burada kalması zararsızdır.

        // Listeye öğe ekleme butonları
        if (target.id === 'add-protected-channel-btn') {
            const select = document.getElementById('channel-to-protect-select');
            const list = document.getElementById('protected-channels-list');
            const idToAdd = select.value;
            if (!idToAdd || list.querySelector(`.remove-item-btn[data-id="${idToAdd}"]`)) return;
            const name = select.options[select.selectedIndex].text;
            const listItem = document.createElement('div');
            listItem.className = 'protected-item';
            listItem.innerHTML = `<span>#${name}</span><button type="button" class="remove-item-btn" data-id="${idToAdd}" data-type="protected-channel">&times;</button>`;
            list.appendChild(listItem);
            if (select.selectedIndex > 0) select.options[select.selectedIndex].disabled = true;
            select.selectedIndex = 0;
            ui.markUnsavedChanges(target);
        } else if (target.id === 'add-antispam-role-btn') {
            const select = document.getElementById('antispam-role-select');
            const list = document.getElementById('antispam-allowed-roles-list');
            const idToAdd = select.value;
            if (!idToAdd || list.querySelector(`.remove-item-btn[data-id="${idToAdd}"]`)) return;
            const role = state.guildData.roles.find(r => r.id === idToAdd);
            if (role) {
                const listItem = document.createElement('div');
                listItem.className = 'protected-item';
                listItem.innerHTML = `<span><span class="role-color-dot" style="background-color: ${role.color};"></span>@${role.name}</span><button type="button" class="remove-item-btn" data-id="${idToAdd}" data-type="antispam-role">&times;</button>`;
                list.appendChild(listItem);
                if (select.selectedIndex > 0) select.options[select.selectedIndex].disabled = true;
                select.selectedIndex = 0;
                ui.markUnsavedChanges(target);
            }
        } else if (target.id === 'add-announcements-role-btn') {
            const select = document.getElementById('announcements-role-select');
            const list = document.getElementById('announcements-allowed-roles-list');
            const idToAdd = select.value;
            if (!idToAdd || list.querySelector(`.remove-item-btn[data-id="${idToAdd}"]`)) return;

            const role = state.guildData.roles.find(r => r.id === idToAdd);
            if (role) {
                const listItem = document.createElement('div');
                listItem.className = 'protected-item';
                listItem.innerHTML = `<span><span class="role-color-dot" style="background-color: ${role.color};"></span>@${role.name}</span><button type="button" class="remove-item-btn" data-id="${idToAdd}" data-type="announcements-role">&times;</button>`;
                list.appendChild(listItem);
                // Seçeneği devre dışı bırak ve seçimi sıfırla
                if (select.selectedIndex > 0) select.options[select.selectedIndex].disabled = true;
                select.selectedIndex = 0;
                ui.markUnsavedChanges(target);
            }
        } else if (target.id === 'add-guard-safe-role-btn') { // YENİ: Guard için güvenli rol ekleme
            const select = document.getElementById('guard-safe-role-select');
            const list = document.getElementById('guard-safe-roles-list');
            const idToAdd = select.value;
            if (!idToAdd || list.querySelector(`.remove-item-btn[data-id="${idToAdd}"]`)) return;

            const role = state.guildData.roles.find(r => r.id === idToAdd);
            if (role) {
                const listItem = document.createElement('div');
                listItem.className = 'protected-item';
                listItem.innerHTML = `<span><span class="role-color-dot" style="background-color: ${role.color};"></span>@${role.name}</span><button type="button" class="remove-item-btn" data-id="${idToAdd}" data-type="guard-safe-role">&times;</button>`;
                list.appendChild(listItem);
                // Seçeneği devre dışı bırak ve seçimi sıfırla
                if (select.selectedIndex > 0) select.options[select.selectedIndex].disabled = true;
                select.selectedIndex = 0;
                ui.markUnsavedChanges(target);
            }
        } else if (target.id === 'add-invite-reward-btn') {
            const countInput = document.getElementById('new-reward-count');
            const roleSelect = document.getElementById('new-reward-role-select');
            const list = document.getElementById('invite-rewards-list');

            const count = parseInt(countInput.value, 10);
            const roleId = roleSelect.value;

            if (!count || count < 1 || !roleId) {
                ui.showToast('Lütfen geçerli bir davet sayısı ve rol seçin.', 'warning');
                return;
            }

            // Mevcut ayarları al ve yeni ödülü ekle
            const settings = state.guildData.settings.inviteTracker;
            if (!settings.rewardRoles) settings.rewardRoles = [];

            settings.rewardRoles.push({ inviteCount: count, roleId: roleId });
            ui.renderInviteRewardsList(state.guildData.roles, settings.rewardRoles); // Listeyi yeniden çiz
            ui.markUnsavedChanges(target); // Değişikliği işaretle
            countInput.value = '';
            roleSelect.selectedIndex = 0;
        }
        // =================================================================
        // YENİ: Ekonomi Marketi Yönetim Mantığı
        // =================================================================
        else if (target.id === 'add-market-item-btn') {
            // "Ürün Ekle" butonuna tıklandığında formu gösterir.
            document.getElementById('add-market-item-form').style.display = 'flex';
            target.style.display = 'none';
        } else if (target.id === 'cancel-new-market-item-btn') {
            // "İptal" butonuna tıklandığında formu gizler.
            document.getElementById('add-market-item-form').style.display = 'none';
            document.getElementById('add-market-item-btn').style.display = 'block';
        } else if (target.id === 'save-new-market-item-btn') {
            // Yeni market ürününü geçici olarak listeye ekler ve kaydetmeye hazır hale getirir.
            const roleSelect = document.getElementById('new-market-item-role-select');
            const priceInput = document.getElementById('new-market-item-price');
            const roleId = roleSelect.value;
            const price = parseInt(priceInput.value, 10);

            if (!roleId || !price || price < 1) {
                ui.showToast('Lütfen geçerli bir rol ve fiyat girin.', 'warning');
                return;
            }

            const settings = state.guildData.settings.economy;
            if (!settings.marketItems) settings.marketItems = [];

            // Rolün zaten markette olup olmadığını kontrol et
            if (settings.marketItems.some(item => item.roleId === roleId)) {
                ui.showToast('Bu rol zaten markette satılıyor.', 'warning');
                return;
            }

            settings.marketItems.push({ roleId, price });
            ui.renderMarketItemsList(state.guildData.roles, settings.marketItems);
            ui.markUnsavedChanges(target);

            // Formu temizle ve gizle
            priceInput.value = '';
            roleSelect.selectedIndex = 0;
            document.getElementById('add-market-item-form').style.display = 'none';
            document.getElementById('add-market-item-btn').style.display = 'block';
        }

        // Market ürününü listeden silme
        const deleteMarketItemBtn = target.closest('.delete-market-item-btn');
        if (deleteMarketItemBtn) {
            const roleIdToRemove = deleteMarketItemBtn.dataset.id;
            state.guildData.settings.economy.marketItems = state.guildData.settings.economy.marketItems.filter(item => item.roleId !== roleIdToRemove);
            ui.renderMarketItemsList(state.guildData.roles, state.guildData.settings.economy.marketItems);
            ui.markUnsavedChanges(deleteMarketItemBtn);
        }

        // =================================================================
        // YENİ: Otomatik Ceza Yönetim Mantığı
        // =================================================================
        else if (target.id === 'add-punishment-btn') {
            document.getElementById('add-punishment-form').style.display = 'flex';
            target.style.display = 'none';
        } else if (target.id === 'cancel-new-punishment-btn') {
            document.getElementById('add-punishment-form').style.display = 'none';
            document.getElementById('add-punishment-btn').style.display = 'block';
        } else if (target.id === 'save-new-punishment-btn') {
            const countInput = document.getElementById('new-punishment-count');
            const actionSelect = document.getElementById('new-punishment-action');
            const durationInput = document.getElementById('new-punishment-duration');

            const warnCount = parseInt(countInput.value, 10);
            const action = actionSelect.value;
            const duration = action === 'timeout' ? parseInt(durationInput.value, 10) * 60000 : undefined;

            if (!warnCount || warnCount < 1) {
                return ui.showToast('Lütfen geçerli bir uyarı sayısı girin.', 'warning');
            }
            if (action === 'timeout' && (!duration || duration < 60000)) {
                return ui.showToast('Susturma eylemi için en az 1 dakika süre girilmelidir.', 'warning');
            }

            const settings = state.guildData.settings.moderation;
            if (!settings.autoPunishments) settings.autoPunishments = [];

            // Aynı uyarı sayısı için kural var mı kontrol et
            if (settings.autoPunishments.some(p => p.warnCount === warnCount)) {
                return ui.showToast('Bu uyarı sayısı için zaten bir kural mevcut.', 'warning');
            }

            settings.autoPunishments.push({ warnCount, action, duration });
            ui.renderAutoPunishmentsList(settings.autoPunishments);
            ui.markUnsavedChanges(target);

            // Formu temizle ve gizle
            countInput.value = '';
            durationInput.value = '';
            actionSelect.selectedIndex = 0;
            document.getElementById('add-punishment-form').style.display = 'none';
            document.getElementById('add-punishment-btn').style.display = 'block';
        }

        const deletePunishmentBtn = target.closest('.delete-punishment-btn');
        if (deletePunishmentBtn) {
            const countToRemove = parseInt(deletePunishmentBtn.dataset.count, 10);
            state.guildData.settings.moderation.autoPunishments = state.guildData.settings.moderation.autoPunishments.filter(p => p.warnCount !== countToRemove);
            ui.renderAutoPunishmentsList(state.guildData.settings.moderation.autoPunishments);
            ui.markUnsavedChanges(deletePunishmentBtn);
        }
        // YENİ: Bilet konusu ekleme modalını açan buton
        else if (target.id === 'add-ticket-topic-btn') {
            // ui.js'deki openTicketTopicModal fonksiyonunu çağırır.
            // İlk parametre olarak tüm sunucu verisini, ikinci parametre olarak null (yeni konu olduğu için) gönderir.
            ui.openTicketTopicModal(state.guildData, null);
        }

        // Listeden öğe silme butonu (remove-item-btn)
        const removeBtn = target.closest('.remove-item-btn');
        if (removeBtn) {
            const idToRemove = removeBtn.dataset.id;
            // İlgili select menüsündeki opsiyonu tekrar aktif etme mantığı buraya eklenebilir.
            removeBtn.parentElement.remove();
            ui.markUnsavedChanges(removeBtn);
        }
    });

    // Ayar girdilerinde değişiklik olduğunda kaydetme butonunu işaretle
    pluginsPage.addEventListener('change', (e) => {
        const settingInput = e.target.closest('[data-setting]');
        if (settingInput) {
            ui.markUnsavedChanges(settingInput);
        }
        if (e.target.classList.contains('enable-toggle')) {
            e.target.closest('.plugin-card, .sub-plugin')?.classList.toggle('enabled', e.target.checked);
        }
    });

    pluginsPage.addEventListener('input', (e) => {
        const settingInput = e.target.closest('[data-setting]');
        if (settingInput) {
            ui.markUnsavedChanges(settingInput);
        }
    });

    pluginsPage.dataset.listenerAttached = 'true'; // Dinleyicinin kurulduğunu işaretle.

    // =================================================================
    // YENİ: Bilet Konusu Modal Formu Yönetimi
    // =================================================================
    const ticketTopicForm = document.getElementById('ticket-topic-form');
    if (ticketTopicForm) {
        ticketTopicForm.addEventListener('submit', (e) => {
            e.preventDefault(); // Formun sayfayı yenilemesini engelle

            const topicId = document.getElementById('ticket-topic-id').value;
            const newTopic = {
                id: topicId,
                label: document.getElementById('ticket-topic-label').value,
                description: document.getElementById('ticket-topic-description').value,
                emoji: document.getElementById('ticket-topic-emoji').value,
                categoryId: document.getElementById('ticket-topic-category').value || null,
                supportRoleId: document.getElementById('ticket-topic-support-role').value || null,
            };

            if (!newTopic.label) {
                ui.showToast('Konu başlığı boş bırakılamaz.', 'error');
                return;
            }

            const settings = state.guildData.settings.tickets;
            if (!settings.topics) settings.topics = [];

            const existingIndex = settings.topics.findIndex(t => t.id === topicId);

            if (existingIndex > -1) {
                // Var olanı güncelle
                settings.topics[existingIndex] = newTopic;
            } else {
                // Yeni ekle
                settings.topics.push(newTopic);
            }

            // Arayüzü güncelle ve değişikliği kaydetmeye hazırla
            ui.renderTicketTopicsList(settings.topics);
            ui.markUnsavedChanges(ticketTopicForm);

            // Modalı kapat
            document.getElementById('ticket-topic-modal').style.display = 'none';
            ui.showToast('Bilet konusu başarıyla kaydedildi. Değişiklikleri uygulamak için ana "Ayarları Kaydet" butonuna tıklayın.', 'info');
        });
    }
}