import { state } from './state.js';

// --- Element Selections ---
export const elements = {
    modal: document.getElementById('server-select-modal'),
    serverListContainer: document.getElementById('server-list'),
    mainContent: document.querySelector('.main-content'),
    currentServerHeader: document.getElementById('current-server'),
    currentServerIcon: document.getElementById('current-server-icon'),
    currentServerName: document.getElementById('current-server-name'),
    logoutBtn: document.getElementById('logout-btn'),
    sidebarNav: document.querySelector('.sidebar-nav'),
    unsavedChangesBar: document.getElementById('unsaved-changes-bar'), // EKLENDİ: Kaydedilmemiş değişiklikler çubuğu
    addServerBtn: document.getElementById('add-server-btn'),
};

// --- Toast Notification Functions ---
const createToastContainer = () => {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    return container;
};

export const showToast = (message, type = 'success', duration = 4000) => {
    const container = createToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const titles = {
        success: 'Başarılı',
        error: 'Hata',
        warning: 'Uyarı',
        info: 'Bilgi'
    };

    const icons = {
        success: 'fa-solid fa-circle-check',
        error: 'fa-solid fa-circle-xmark',
        warning: 'fa-solid fa-triangle-exclamation',
        info: 'fa-solid fa-circle-info'
    };

    toast.innerHTML = `
        <i class="${icons[type] || icons.info}"></i>
        <div class="toast-content">
            <div class="toast-title">${titles[type] || titles.info}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close-btn">&times;</button>
        <div class="toast-progress"></div>
    `;

    container.appendChild(toast);

    // Animasyon için gecikmeli olarak 'show' sınıfını ekle
    setTimeout(() => toast.classList.add('show'), 100);

    const closeToast = () => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove());
    };

    toast.querySelector('.toast-close-btn').addEventListener('click', closeToast);
    setTimeout(closeToast, duration);
};

// --- Confirmation Modal ---
export const showConfirmModal = (title, text, options = {}) => {
    return new Promise((resolve) => {
        const confirmModal = document.getElementById('confirm-modal');
        const titleEl = document.getElementById('confirm-modal-title');
        const textEl = document.getElementById('confirm-modal-text');
        const discardBtn = document.getElementById('confirm-modal-discard');
        const cancelBtn = document.getElementById('confirm-modal-cancel');
        const saveBtn = document.getElementById('confirm-modal-save');

        if (!confirmModal || !titleEl || !textEl || !discardBtn || !cancelBtn || !saveBtn) {
            resolve(window.confirm(`${title}\n${text}`));
            return;
        }

        titleEl.textContent = title;
        textEl.textContent = text;
        
        // YENİ: Butonları seçeneklere göre yönet
        if (options.showSaveButton) {
            saveBtn.style.display = 'inline-block';
            discardBtn.textContent = 'Atla ve Devam Et';
        } else {
            saveBtn.style.display = 'none';
            discardBtn.textContent = 'Onayla';
        }

        const close = (result) => {
            confirmModal.style.display = 'none';
            discardBtn.onclick = null;
            cancelBtn.onclick = null;
            saveBtn.onclick = null;
            document.removeEventListener('keydown', keydownHandler);
            resolve(result);
        };

        const keydownHandler = (e) => { if (e.key === 'Escape') close(false); };

        // YENİ: Butonlara tıklama olaylarını ayarla
        discardBtn.onclick = () => close(options.showSaveButton ? 'discard' : true);
        cancelBtn.onclick = () => close(false);
        saveBtn.onclick = () => close('save');

        document.addEventListener('keydown', keydownHandler);
        confirmModal.style.display = 'flex';
    });
};

// --- Unsaved Changes Bar ---
export const updateUnsavedChangesBar = () => {
    const bar = document.getElementById('unsaved-changes-bar');
    if (!bar) return;
    const hasUnsaved = !!document.querySelector('.save-button.has-unsaved-changes');
    bar.classList.toggle('visible', hasUnsaved);
};

export const markUnsavedChanges = (element) => {
    const card = element.closest('.plugin-card');
    if (card) {
        const saveButton = card.querySelector('.save-button');
        if (saveButton) {
            saveButton.classList.add('has-unsaved-changes');
        }
    }
    updateUnsavedChangesBar();
};

/**
 * YENİ: "protected-item" sınıfına sahip bir liste öğesi oluşturur.
 * Bu, farklı eklentilerde (Guard, AutoMod vb.) rol/kanal listeleri için yeniden kullanılır.
 * @param {string} name Öğenin adı (örn: rol adı)
 * @param {string} id Öğenin ID'si
 * @returns {HTMLElement} Oluşturulan div öğesi
 */
function createProtectedItem(name, id) {
    const item = document.createElement('div');
    item.className = 'protected-item';
    item.innerHTML = `<span>${name}</span><button type="button" class="remove-item-btn" data-id="${id}"><i class="fa-solid fa-trash-can"></i></button>`;
    return item;
}
/**
 * YENİ: Bot sahibi kartının görünürlüğünü ayarlar.
 * Bu fonksiyon, kullanıcının bot sahibi olup olmadığını kontrol eder ve
 * "Bot Durumu" kartını buna göre gösterir veya gizler.
 */
export function updateBotOwnerCardVisibility() {
    const botStatusCard = document.querySelector('.plugin-card[data-module="botStatus"]');
    if (botStatusCard) {
        botStatusCard.style.display = window.isBotOwner ? 'block' : 'none';
    }
}

// --- UI Update Functions ---
export const populateSelect = (select, items, selectedId, options = {}) => {
    const { defaultText, valueKey = 'id', nameKey = 'name' } = options;
    select.innerHTML = defaultText ? `<option value="">${defaultText}</option>` : '';
    if (items && Array.isArray(items)) {
        items.forEach(item => {
            const option = new Option(item[nameKey], item[valueKey]);
            option.selected = item[valueKey] === selectedId;
            select.add(option);
        });
    }
};

// YENİ: Yasaklı Kelime Listesini Render Et
export function renderBannedWordsList(words) {
    const listContainer = document.getElementById('banned-words-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';
    if (!words || words.length === 0) {
        listContainer.innerHTML = '<p class="setting-description" style="text-align: center; margin-top: 10px;">Henüz yasaklı kelime eklenmemiş.</p>';
        return;
    }
    words.forEach(word => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `
            <span class="list-item-label">${word}</span>
            <div class="list-item-actions">
                <button type="button" class="remove-item-btn" data-word="${word}"><i class="fa-solid fa-trash-can"></i></button>
            </div>
        `;
        listContainer.appendChild(item);
    });
}

// YENİ: Oto-Mod Görmezden Gelinecek Roller Listesini Render Et
export function renderAutoModIgnoredRoles(allRoles, ignoredRoleIds = []) {
    const listContainer = document.getElementById('automod-ignored-roles-list');
    const select = document.getElementById('automod-ignored-role-select');
    if (!listContainer || !select) return;

    listContainer.innerHTML = '';
    ignoredRoleIds.forEach(roleId => {
        const role = allRoles.find(r => r.id === roleId);
        if (role) {
            listContainer.appendChild(createProtectedItem(role.name, role.id));
        }
    });
    populateSelect(select, allRoles.filter(r => !ignoredRoleIds.includes(r.id)), null, { defaultText: 'Bir rol seçin...' });
}

// --- Eklentiye Özel Liste Oluşturma Fonksiyonları ---

export function renderProtectedChannelsList(allChannels, protectedIds = []) {
    const listContainer = document.getElementById('protected-channels-list');
    const selectDropdown = document.getElementById('channel-to-protect-select');
    if (!listContainer || !selectDropdown) return;
    listContainer.innerHTML = '';
    if (!Array.isArray(protectedIds)) protectedIds = [];
    populateSelect(selectDropdown, allChannels, null, { defaultText: 'Korumak için kanal seçin...' });
    Array.from(selectDropdown.options).forEach(opt => { opt.disabled = protectedIds.includes(opt.value); });
    protectedIds.forEach(id => {
        const channel = allChannels.find(c => c.id === id);
        if (channel) {
            const item = document.createElement('div');
            item.className = 'protected-item';
            item.innerHTML = `<span>#${channel.name}</span><button type="button" class="remove-item-btn" data-id="${id}" data-type="protected-channel">&times;</button>`;
            listContainer.appendChild(item);
        }
    });
}

export function renderAntiSpamAllowedRoles(allRoles, allowedRoleIds = []) {
    const listContainer = document.getElementById('antispam-allowed-roles-list');
    const selectDropdown = document.getElementById('antispam-role-select');
    if (!listContainer || !selectDropdown) return;

    listContainer.innerHTML = '';
    if (!Array.isArray(allowedRoleIds)) allowedRoleIds = [];

    const availableRoles = allRoles.filter(r => r.name !== '@everyone' && !r.managed);
    populateSelect(selectDropdown, availableRoles, null, { defaultText: 'İzin vermek için rol seçin...' });

    Array.from(selectDropdown.options).forEach(opt => {
        opt.disabled = allowedRoleIds.includes(opt.value);
    });

    allowedRoleIds.forEach(id => {
        const role = allRoles.find(r => r.id === id);
        if (role) {
            const item = document.createElement('div');
            item.className = 'protected-item';
            item.innerHTML = `
                <span><span class="role-color-dot" style="background-color: ${role.color};"></span>@${role.name}</span>
                <button type="button" class="remove-item-btn" data-id="${id}" data-type="antispam-role">&times;</button>`;
            listContainer.appendChild(item);
        }
    });
}

/**
 * YENİ: Duyuru Sistemi için izinli rolleri render eder.
 * @param {Array} allRoles Sunucudaki tüm roller.
 * @param {Array} allowedRoleIds İzin verilen rol ID'leri.
 */
export function renderAnnouncementsAllowedRoles(allRoles, allowedRoleIds = []) {
    const listContainer = document.getElementById('announcements-allowed-roles-list');
    const selectDropdown = document.getElementById('announcements-role-select');
    if (!listContainer || !selectDropdown) return;

    listContainer.innerHTML = '';
    if (!Array.isArray(allowedRoleIds)) allowedRoleIds = [];

    const availableRoles = allRoles.filter(r => r.name !== '@everyone' && !r.managed);
    populateSelect(selectDropdown, availableRoles, null, { defaultText: 'İzin vermek için rol seçin...' });

    Array.from(selectDropdown.options).forEach(opt => {
        opt.disabled = allowedRoleIds.includes(opt.value);
    });

    allowedRoleIds.forEach(id => {
        const role = allRoles.find(r => r.id === id);
        if (role) {
            const item = document.createElement('div');
            item.className = 'protected-item';
            item.innerHTML = `<span><span class="role-color-dot" style="background-color: ${role.color};"></span>@${role.name}</span><button type="button" class="remove-item-btn" data-id="${id}" data-type="announcements-role">&times;</button>`;
            listContainer.appendChild(item);
        }
    });
}

/**
 * YENİ: Kayıtlı roller listesini render eder.
 * @param {Array} allRoles Sunucudaki tüm roller.
 * @param {Array} roleIds Seçili rol ID'leri.
 */
export function renderRegisteredRolesList(allRoles, roleIds = []) {
    const listContainer = document.getElementById('registered-roles-list');
    const selectDropdown = document.getElementById('registered-role-select');
    if (!listContainer || !selectDropdown) return;

    listContainer.innerHTML = '';
    if (!Array.isArray(roleIds)) roleIds = [];

    const availableRoles = allRoles.filter(r => r.name !== '@everyone' && !r.managed);
    populateSelect(selectDropdown, availableRoles, null, { defaultText: 'Rol seçin...' });

    Array.from(selectDropdown.options).forEach(opt => {
        opt.disabled = roleIds.includes(opt.value);
    });

    roleIds.forEach(id => {
        const role = allRoles.find(r => r.id === id);
        if (role) {
            const item = document.createElement('div');
            item.className = 'protected-item';
            item.innerHTML = `<span><span class="role-color-dot" style="background-color: ${role.color};"></span>@${role.name}</span><button type="button" class="remove-item-btn" data-id="${id}" data-type="registered-role">&times;</button>`;
            listContainer.appendChild(item);
        }
    });
}

export function renderInviteRewardsList(allRoles, rewardRoles = []) {
    const listContainer = document.getElementById('invite-rewards-list');
    const selectDropdown = document.getElementById('new-reward-role-select');
    if (!listContainer || !selectDropdown) return;

    listContainer.innerHTML = '';
    populateSelect(selectDropdown, allRoles, null, { defaultText: 'Ödül rolü seçin...' });

    const usedRoleIds = rewardRoles.map(r => r.roleId);

    Array.from(selectDropdown.options).forEach(opt => {
        opt.disabled = usedRoleIds.includes(opt.value);
    });

    rewardRoles.sort((a, b) => a.inviteCount - b.inviteCount);

    rewardRoles.forEach(reward => {
        const role = allRoles.find(r => r.id === reward.roleId);
        if (role) {
            const item = document.createElement('div');
            item.className = 'protected-item';
            item.innerHTML = `
                <span><strong>${reward.inviteCount}</strong> davet → @${role.name}</span>
                <button type="button" class="remove-item-btn" data-id="${reward.roleId}" data-type="invite-reward">&times;</button>
            `;
            listContainer.appendChild(item);
        }
    });
}

export function renderTicketTopicsList(topics = []) {
    const listContainer = document.getElementById('ticket-topics-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    if (!Array.isArray(topics) || topics.length === 0) {
        listContainer.innerHTML = '<p class="setting-description" style="text-align: center; margin: 10px 0;">Henüz bilet konusu eklenmemiş.</p>';
        return;
    }

    topics.forEach(topic => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.dataset.topic = JSON.stringify(topic); // Store full topic data

        item.innerHTML = `
            <div class="list-item-content">
                <span class="list-item-label">${topic.emoji || ''} ${topic.label}</span>
                <span class="list-item-description">${topic.description || 'Açıklama yok'}</span>
            </div>
            <div class="list-item-actions">
                <button type="button" class="edit-ticket-topic-btn" title="Düzenle"><i class="fa-solid fa-pencil"></i></button>
                <button type="button" class="delete-ticket-topic-btn" title="Sil"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        listContainer.appendChild(item);
    });
}

/**
 * YENİ: Ekonomi marketindeki ürünleri render eder.
 * @param {Array} allRoles Sunucudaki tüm roller.
 * @param {Array} marketItems Marketteki ürünler.
 */
export function renderMarketItemsList(allRoles, marketItems = []) {
    const listContainer = document.getElementById('market-items-list');
    const roleSelect = document.getElementById('new-market-item-role-select');
    if (!listContainer || !roleSelect) return;

    listContainer.innerHTML = '';
    populateSelect(roleSelect, allRoles.filter(r => r.name !== '@everyone' && !r.managed), null, { defaultText: 'Satılacak rolü seçin...' });

    if (!Array.isArray(marketItems) || marketItems.length === 0) {
        listContainer.innerHTML = '<p class="setting-description" style="text-align: center; margin: 10px 0;">Markette satılan ürün yok.</p>';
        return;
    }

    marketItems.forEach(item => {
        const role = allRoles.find(r => r.id === item.roleId);
        if (role) {
            const itemEl = document.createElement('div');
            itemEl.className = 'list-item';
            itemEl.innerHTML = `
                <div class="list-item-content">
                    <span class="list-item-label" style="color: ${role.color};">@${role.name}</span>
                    <span class="list-item-description">Fiyat: ${item.price}</span>
                </div>
                <div class="list-item-actions"><button type="button" class="delete-market-item-btn" data-id="${item.roleId}" title="Sil"><i class="fa-solid fa-trash"></i></button></div>`;
            listContainer.appendChild(itemEl);
        }
    });
}

/**
 * YENİ: Otomatik ceza kurallarını panelde listeler.
 * @param {Array} punishments 
 */
export function renderAutoPunishmentsList(punishments = []) {
    const listContainer = document.getElementById('auto-punishments-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    if (!Array.isArray(punishments) || punishments.length === 0) {
        listContainer.innerHTML = '<p class="setting-description" style="text-align: center; margin: 10px 0;">Otomatik ceza kuralı yok.</p>';
        return;
    }

    // Kuralları uyarı sayısına göre sırala
    punishments.sort((a, b) => a.warnCount - b.warnCount);

    punishments.forEach(p => {
        const itemEl = document.createElement('div');
        itemEl.className = 'list-item';
        let actionText = p.action.charAt(0).toUpperCase() + p.action.slice(1);
        if (p.action === 'timeout' && p.duration) {
            actionText += ` (${p.duration / 60000} dk)`;
        }

        itemEl.innerHTML = `
            <div class="list-item-content">
                <span class="list-item-label">${p.warnCount} Uyarı</span>
                <span class="list-item-description">→ ${actionText}</span>
            </div>
            <div class="list-item-actions"><button type="button" class="delete-punishment-btn" data-count="${p.warnCount}" title="Sil"><i class="fa-solid fa-trash"></i></button></div>`;
        listContainer.appendChild(itemEl);
    });
}

export function openTicketTopicModal(guildData, topic = null) {
    const modal = document.getElementById('ticket-topic-modal');
    const form = document.getElementById('ticket-topic-form');
    const title = document.getElementById('ticket-topic-modal-title');
    if (!modal || !form || !title) return;

    form.reset();
    title.textContent = topic ? 'Bilet Konusunu Düzenle' : 'Bilet Konusu Ekle';

    const categorySelect = document.getElementById('ticket-topic-category');
    const roleSelect = document.getElementById('ticket-topic-support-role');

    // Populate dropdowns
    const populateSelectWithDefault = (select, items, selectedId, defaultText) => {
        select.innerHTML = `<option value="">${defaultText}</option>`;
        if (items && Array.isArray(items)) {
            items.forEach(item => {
                const option = new Option(item.name, item.id);
                option.selected = item.id === selectedId;
                select.add(option);
            });
        }
    };

    populateSelectWithDefault(categorySelect, guildData.channels.filter(c => c.type === 4), topic?.categoryId, 'Varsayılan Kategoriyi Kullan');
    populateSelectWithDefault(roleSelect, guildData.roles.filter(r => r.name !== '@everyone'), topic?.supportRoleId, 'Varsayılan Destek Rolünü Kullan');

    if (topic) {
        document.getElementById('ticket-topic-id').value = topic.id;
        document.getElementById('ticket-topic-label').value = topic.label;
        document.getElementById('ticket-topic-description').value = topic.description || '';
        document.getElementById('ticket-topic-emoji').value = topic.emoji || '';
    } else {
        // Yeni bir konu için benzersiz bir ID oluştur
        document.getElementById('ticket-topic-id').value = `topic_${Date.now()}`;
    }

    modal.style.display = 'flex';
}

export function updateSidebarVisibility() {
    // Bu fonksiyonun içeriği app.js'e taşındı, burada boş kalabilir veya kaldırılabilir.
    // Ancak dışa aktarılmış olması, eski kullanımların hata vermemesini sağlar.
}