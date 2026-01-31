import { api } from '../api.js';
import { state } from '../state.js';
import { showToast, showConfirmModal } from '../ui.js';

async function handleDeleteTask(taskId) {
    const confirmed = await showConfirmModal(
        'Görevi İptal Et',
        'Bu zamanlanmış mesajı iptal etmek istediğinizden emin misiniz?'
    );
    if (!confirmed) return;

    try {
        await api.deleteScheduledTask(state.selectedGuildId, taskId);
        showToast('Zamanlanmış mesaj iptal edildi.', 'success');
        initScheduledTasksPage(); // Listeyi yenile
    } catch (error) {
        showToast(`Hata: ${error.message}`, 'error');
    }
}

// YENİ: Görevi Şimdi Gönder
async function handleExecuteTask(taskId) {
    const confirmed = await showConfirmModal('Şimdi Gönder', 'Bu mesajı hemen göndermek istediğinize emin misiniz?');
    if (!confirmed) return;

    try {
        await api.executeScheduledTask(state.selectedGuildId, taskId);
        showToast('Mesaj başarıyla gönderildi.', 'success');
        initScheduledTasksPage(); // Listeyi yenile (tek seferlikse silinmiş olabilir)
    } catch (error) {
        showToast(`Hata: ${error.message}`, 'error');
    }
}

// YENİ: Görev Düzenleme Fonksiyonu
function handleEditTask(taskId) {
    // Task ID'yi kaydet ve Embed Builder sayfasına yönlendir
    localStorage.setItem('editScheduledTaskId', taskId);
    // Sayfa geçişini tetikle (Sidebar'daki linke tıklamış gibi)
    document.querySelector('a[data-page="embed-builder-page"]')?.click();
}

// YENİ: Önizleme Modalı Fonksiyonu
function showTaskPreview(task) {
    const modal = document.getElementById('task-preview-modal');
    const contentDiv = document.getElementById('task-preview-content');
    if (!modal || !contentDiv) return;

    const msg = task.messageData;
    const embed = msg.embeds && msg.embeds.length > 0 ? msg.embeds[0] : null;

    // HTML Oluşturma (Embed Builder'daki yapıya benzer)
    let html = `
        <div class="discord-message">
            <div class="discord-avatar">
                <img src="https://cdn.discordapp.com/embed/avatars/0.png" style="width: 100%; height: 100%; border-radius: 50%;">
            </div>
            <div class="discord-content">
                <div class="discord-header">
                    <span class="discord-username">Bot İsmi</span>
                    <span class="discord-tag" style="background: #5865F2; color: white; font-size: 0.625rem; padding: 0 4px; border-radius: 3px; margin-left: 4px; vertical-align: middle; line-height: 1.3;">BOT</span>
                    <span class="discord-timestamp">Bugün saat 14:30</span>
                </div>
                <div class="discord-message-body" style="${msg.content ? 'display:block' : 'display:none'}">${msg.content || ''}</div>
    `;

    if (embed) {
        html += `
            <div class="discord-embed" style="border-left-color: #${embed.color ? embed.color.toString(16).padStart(6, '0') : '5865F2'};">
                ${embed.author ? `<div class="embed-author"><img class="embed-author-icon" src="${embed.author.iconURL || ''}" style="${!embed.author.iconURL ? 'display:none' : ''}"><span>${embed.author.name}</span></div>` : ''}
                ${embed.title ? `<div class="embed-title">${embed.title}</div>` : ''}
                ${embed.description ? `<div class="embed-description">${embed.description}</div>` : ''}
                
                <div class="embed-fields ${embed.fields && embed.fields.some(f => f.inline) ? 'has-inline' : ''}" style="${!embed.fields || embed.fields.length === 0 ? 'display:none' : ''}">
                    ${embed.fields ? embed.fields.map(f => `
                        <div class="embed-field ${f.inline ? 'inline' : ''}">
                            <div class="embed-field-name">${f.name}</div>
                            <div class="embed-field-value">${f.value}</div>
                        </div>
                    `).join('') : ''}
                </div>

                ${embed.thumbnail ? `<img class="embed-thumbnail" src="${embed.thumbnail.url}">` : ''}
                ${embed.image ? `<img class="embed-image" src="${embed.image.url}">` : ''}
                ${embed.footer ? `<div class="embed-footer"><img class="embed-footer-icon" src="${embed.footer.iconURL || ''}" style="${!embed.footer.iconURL ? 'display:none' : ''}"><span>${embed.footer.text}</span></div>` : ''}
            </div>
        `;
    }

    html += `
            </div>
        </div>
    `;

    contentDiv.innerHTML = html;
    modal.style.display = 'flex';
}

export async function initScheduledTasksPage() {
    const tableBody = document.getElementById('scheduled-tasks-list-body');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Yükleniyor...</td></tr>';

    try {
        const tasks = await api.getScheduledTasks(state.selectedGuildId);
        tableBody.innerHTML = '';

        if (tasks.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Zamanlanmış mesaj bulunmuyor.</td></tr>';
            return;
        }

        // Tarihe göre sırala (yakın tarih önce)
        tasks.sort((a, b) => new Date(a.executeAt) - new Date(b.executeAt));

        tasks.forEach(task => {
            const tr = document.createElement('tr');
            const date = new Date(task.executeAt).toLocaleString('tr-TR');
            
            let target = 'Bilinmiyor';
            if (task.webhookUrl) target = 'Webhook';
            else if (task.channelId) {
                const channel = state.guildData.channels.find(c => c.id === task.channelId);
                target = channel ? `#${channel.name}` : `Kanal ID: ${task.channelId}`;
            }

            let contentSummary = '';
            if (task.messageData.content) contentSummary += task.messageData.content;
            if (task.messageData.embeds && task.messageData.embeds.length > 0) {
                contentSummary += (contentSummary ? ' + ' : '') + `[Embed: ${task.messageData.embeds[0].title || 'Başlıksız'}]`;
            }
            if (contentSummary.length > 50) contentSummary = contentSummary.substring(0, 50) + '...';

            let recurrenceText = 'Tek Seferlik';
            if (task.recurrence === 'daily') recurrenceText = 'Her Gün';
            else if (task.recurrence === 'weekly') recurrenceText = 'Her Hafta';
            else if (task.recurrence === 'monthly') recurrenceText = 'Her Ay';
            else if (task.recurrence === 'specific_days' && task.selectedDays) {
                const daysMap = {0: 'Paz', 1: 'Pzt', 2: 'Sal', 3: 'Çar', 4: 'Per', 5: 'Cum', 6: 'Cmt'};
                const daysStr = task.selectedDays.sort().map(d => daysMap[d]).join(', ');
                recurrenceText = daysStr;
            }

            let creatorHtml = '<span style="color: var(--text-muted); font-style: italic;">Bilinmiyor</span>';
            if (task.createdBy) {
                creatorHtml = `
                    <div class="member-info-cell" style="gap: 8px;">
                        <img src="${task.createdBy.avatar}" alt="avatar" style="width: 24px; height: 24px;">
                        <span class="member-tag" style="font-size: 0.9em;">${task.createdBy.tag}</span>
                    </div>
                `;
            }

            tr.innerHTML = `
                <td>${date}</td>
                <td><span class="new-badge" style="background: var(--bg-tertiary); color: var(--text-secondary); font-weight: normal;">${recurrenceText}</span></td>
                <td>${target}</td>
                <td>${creatorHtml}</td>
                <td>${contentSummary || 'İçerik Yok'}</td>
                <td>
                    <button class="action-btn execute-task-btn" data-task-id="${task.id}" title="Şimdi Gönder" style="background-color: var(--green); border-color: var(--green); color: white;">
                        <i class="fa-solid fa-paper-plane"></i>
                    </button>
                    <button class="action-btn edit edit-task-btn" data-task-id="${task.id}" title="Düzenle">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="action-btn edit preview-task-btn" title="Önizle">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    <button class="remove-item-btn danger delete-task-btn" data-task-id="${task.id}" title="İptal Et">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            `;
            
            // Olay dinleyicilerini ekle
            tr.querySelector('.execute-task-btn').addEventListener('click', () => handleExecuteTask(task.id));
            tr.querySelector('.edit-task-btn').addEventListener('click', () => handleEditTask(task.id));
            tr.querySelector('.preview-task-btn').addEventListener('click', () => showTaskPreview(task));
            tr.querySelector('.delete-task-btn').addEventListener('click', () => handleDeleteTask(task.id));

            tableBody.appendChild(tr);
        });

    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--red);">${error.message}</td></tr>`;
    }
}

// Modal kapatma butonu
document.getElementById('task-preview-close')?.addEventListener('click', () => {
    document.getElementById('task-preview-modal').style.display = 'none';
});
