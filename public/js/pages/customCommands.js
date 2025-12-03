import { api } from '../api.js';
import { state } from '../state.js';
import { showToast, showConfirmModal } from '../ui.js';

let currentCommands = [];

function renderCustomCommandsTable(commands) {
    const tableBody = document.getElementById('custom-commands-list-body');
    if (!tableBody) return;

    tableBody.innerHTML = '';
    currentCommands = commands; // Güncel komut listesini sakla

    if (commands.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">Henüz özel komut bulunmuyor.</td></tr>`;
        return;
    }

    commands.forEach(command => {
        const tr = document.createElement('tr');
        tr.dataset.commandId = command.id;
        tr.innerHTML = `
            <td>${command.trigger}</td>
            <td>${command.response.substring(0, 50)}${command.response.length > 50 ? '...' : ''}</td>
            <td>${command.type}</td>
            <td>
                <span class="status-indicator ${command.enabled ? 'status-active' : 'status-inactive'}">
                    ${command.enabled ? 'Aktif' : 'Pasif'}
                </span>
            </td>
            <td style="text-align: center;">
                <button class="action-btn edit edit-custom-command-btn" data-id="${command.id}" title="Düzenle">
                    <i class="fa-solid fa-pencil"></i>
                </button>
                <button class="action-btn delete-custom-command-btn danger" data-id="${command.id}" title="Sil">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

async function fetchCustomCommands() {
    try {
        const commands = await api.getCustomCommands(state.selectedGuildId);
        renderCustomCommandsTable(commands);
    } catch (error) {
        showToast(`Özel komutlar alınamadı: ${error.message}`, 'error');
        document.getElementById('custom-commands-list-body').innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--red);">${error.message}</td></tr>`;
    }
}

function openCustomCommandModal(command = null) {
    const modal = document.getElementById('custom-command-modal');
    const form = document.getElementById('custom-command-form');
    const title = document.getElementById('custom-command-modal-title');

    if (!modal || !form || !title) return;

    form.reset();
    title.textContent = command ? 'Komutu Düzenle' : 'Yeni Komut Ekle';

    document.getElementById('custom-command-id').value = command ? command.id : `cmd_${Date.now()}`; // Yeni komut için benzersiz ID
    document.getElementById('custom-command-trigger').value = command ? command.trigger : '';
    document.getElementById('custom-command-response').value = command ? command.response : '';
    document.getElementById('custom-command-type').value = command ? command.type : 'text';
    document.getElementById('custom-command-enabled').checked = command ? command.enabled !== false : true;

    // YENİ: Rol seçimini doldur ve ayarla
    const rolesSelect = document.getElementById('custom-command-roles');
    rolesSelect.innerHTML = ''; // Önce temizle
    state.guildData.roles.forEach(role => {
        if (role.name !== '@everyone') {
            const option = new Option(role.name, role.id);
            // Eğer komut düzenleniyorsa ve bu rol izinli roller arasındaysa, seçili yap
            if (command && command.allowedRoles && command.allowedRoles.includes(role.id)) {
                option.selected = true;
            }
            rolesSelect.add(option);
        }
    });

    // YENİ: Kanal seçimini doldur ve ayarla
    const channelsSelect = document.getElementById('custom-command-channels');
    channelsSelect.innerHTML = ''; // Önce temizle
    const textChannels = state.guildData.channels.filter(c => [0, 5, 10, 11, 12].includes(c.type));
    textChannels.forEach(channel => {
        const option = new Option(`#${channel.name}`, channel.id);
        // Eğer komut düzenleniyorsa ve bu kanal izinli kanallar arasındaysa, seçili yap
        if (command && command.allowedChannels && command.allowedChannels.includes(channel.id)) {
            option.selected = true;
        }
        channelsSelect.add(option);
    });


    modal.style.display = 'flex';
}

async function handleSaveCustomCommand(event) {
    event.preventDefault();
    const form = event.target;
    const commandId = form.querySelector('#custom-command-id').value;
    const trigger = form.querySelector('#custom-command-trigger').value.trim();
    const response = form.querySelector('#custom-command-response').value.trim();
    const type = form.querySelector('#custom-command-type').value;
    const enabled = form.querySelector('#custom-command-enabled').checked;
    // YENİ: Seçili rolleri al
    const allowedRoles = Array.from(form.querySelector('#custom-command-roles').selectedOptions).map(opt => opt.value);
    // YENİ: Seçili kanalları al
    const allowedChannels = Array.from(form.querySelector('#custom-command-channels').selectedOptions).map(opt => opt.value);

    if (!trigger || !response) {
        showToast('Tetikleyici ve yanıt boş bırakılamaz.', 'warning');
        return;
    }

    const commandData = { id: commandId, trigger, response, type, enabled, allowedRoles, allowedChannels };

    try {
        const existingCommand = currentCommands.find(cmd => cmd.id === commandId);
        if (existingCommand) {
            await api.updateCustomCommand(state.selectedGuildId, commandId, commandData);
            showToast('Komut başarıyla güncellendi.', 'success');
        } else {
            await api.addCustomCommand(state.selectedGuildId, commandData);
            showToast('Komut başarıyla eklendi.', 'success');
        }
        document.getElementById('custom-command-modal').style.display = 'none';
        await fetchCustomCommands(); // Listeyi yenile
    } catch (error) {
        showToast(`Komut kaydedilirken hata: ${error.message}`, 'error');
    }
}

async function handleDeleteCustomCommand(commandId, trigger) {
    const confirmed = await showConfirmModal(
        'Komutu Sil',
        `'${trigger}' komutunu silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`
    );
    if (!confirmed) return;

    try {
        await api.deleteCustomCommand(state.selectedGuildId, commandId);
        showToast('Komut başarıyla silindi.', 'success');
        await fetchCustomCommands(); // Listeyi yenile
    } catch (error) {
        showToast(`Komut silinirken hata: ${error.message}`, 'error');
    }
}

export async function initCustomCommandsPage() {
    await fetchCustomCommands();

    // Olay dinleyicilerini sadece bir kez kurmak için kontrol
    const pageElement = document.getElementById('custom-commands-page');
    if (pageElement && !pageElement.dataset.listenerAttached) {
        document.getElementById('add-custom-command-btn')?.addEventListener('click', () => openCustomCommandModal());

        document.getElementById('custom-commands-list-body')?.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.edit-custom-command-btn');
            const deleteBtn = e.target.closest('.delete-custom-command-btn');

            if (editBtn) {
                const commandId = editBtn.dataset.id;
                const command = currentCommands.find(cmd => cmd.id === commandId);
                if (command) openCustomCommandModal(command);
            } else if (deleteBtn) {
                const commandId = deleteBtn.dataset.id;
                const command = currentCommands.find(cmd => cmd.id === commandId);
                if (command) handleDeleteCustomCommand(commandId, command.trigger);
            }
        });

        const modal = document.getElementById('custom-command-modal');
        const form = document.getElementById('custom-command-form');
        const cancelBtn = document.getElementById('custom-command-modal-cancel');

        if (form) form.addEventListener('submit', handleSaveCustomCommand);
        if (cancelBtn) cancelBtn.addEventListener('click', () => modal.style.display = 'none');
        if (modal) modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.style.display = 'none';
        });

        pageElement.dataset.listenerAttached = 'true';
    }
}