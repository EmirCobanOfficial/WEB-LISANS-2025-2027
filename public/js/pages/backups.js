import { api } from '../api.js';
import { state } from '../state.js';
import { showToast, showConfirmModal } from '../ui.js';

async function handleCreateBackup(button) {
    const confirmed = await showConfirmModal(
        'Yeni Yedek Oluştur',
        'Sunucunun mevcut rollerini, kanallarını ve ayarlarını yedeklemek istediğinizden emin misiniz? Bu işlem biraz zaman alabilir.'
    );
    if (!confirmed) return;

    button.disabled = true;
    button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Yedekleniyor...';

    try {
        await api.createBackup(state.selectedGuildId);
        showToast('Sunucu yedeği başarıyla oluşturuldu.', 'success');
        initBackupsPage(); // Listeyi yenile
    } catch (error) {
        showToast(`Hata: ${error.message}`, 'error');
    } finally {
        button.disabled = false;
        button.innerHTML = '<i class="fa-solid fa-plus"></i> Yeni Yedek Oluştur';
    }
}

async function handleDeleteBackup(backupId) {
    const confirmed = await showConfirmModal(
        'Yedeği Sil',
        `Bu yedeği kalıcı olarak silmek istediğinizden emin misiniz? (ID: ${backupId})\nBu işlem geri alınamaz.`
    );
    if (!confirmed) return;

    try {
        await api.deleteBackup(state.selectedGuildId, backupId);
        showToast('Yedek başarıyla silindi.', 'success');
        initBackupsPage();
    } catch (error) {
        showToast(`Hata: ${error.message}`, 'error');
    }
}

async function handleRestoreBackup(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const backupData = JSON.parse(event.target.result);
            const confirmed = await showConfirmModal(
                'Yedekten Geri Yükle',
                `'${backupData.name}' sunucusunun yedeğini BU SUNUCUYA yüklemek üzeresiniz.\n\nUYARI: Bu işlem, mevcut sunucudaki TÜM kanalları ve rolleri silecek ve yedek dosyasındaki yapılandırmayla değiştirecektir. Bu işlem geri alınamaz. Devam etmek istediğinizden emin misiniz?`
            );
            if (!confirmed) return;

            showToast('Geri yükleme işlemi başlatıldı. Bu işlem birkaç dakika sürebilir...', 'warning', 10000);
            await api.restoreBackup(state.selectedGuildId, backupData);
            showToast('Sunucu başarıyla geri yüklendi. Sayfa yenileniyor...', 'success');
            setTimeout(() => window.location.reload(), 2000);
        } catch (error) {
            showToast(`Geri yükleme hatası: ${error.message}`, 'error');
        }
    };
    reader.readAsText(file);
}

/**
 * YENİ: Dosya boyutunu okunabilir bir formata çevirir (Bytes, KB, MB, GB).
 * @param {number} bytes - Byte cinsinden dosya boyutu.
 * @param {number} decimals - Ondalık basamak sayısı.
 * @returns {string}
 */
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export async function initBackupsPage() {
    const container = document.getElementById('backups-list-container');
    if (!container) return;

    container.innerHTML = '<p>Yedekler yükleniyor...</p>';

    try {
        const backups = await api.getGuildBackups(state.selectedGuildId);
        container.innerHTML = '';

        if (backups.length === 0) {
            container.innerHTML = '<p>Bu sunucu için oluşturulmuş yedek bulunamadı.</p>';
            return;
        }

        backups.forEach(backup => {
            const card = document.createElement('div');
            card.className = 'backup-card';
            const backupDate = new Date(backup.date).toLocaleString('tr-TR');
            const backupSize = formatBytes(backup.size || 0); // YENİ: Boyutu formatla

            card.innerHTML = `
                <div class="backup-info">
                    <i class="fa-solid fa-database"></i>
                    <div class="backup-details">
                        <span class="backup-date">${backupDate}</span>
                        <span class="backup-id">Boyut: ${backupSize}</span> <!-- YENİ: Boyut bilgisi eklendi -->
                        <span class="backup-id">ID: ${backup.id}</span>
                    </div>
                </div>
                <div class="backup-actions">
                    <a href="/api/guild/${state.selectedGuildId}/backups/${backup.id}/download" class="role-action-btn edit"><i class="fa-solid fa-download"></i> İndir</a>
                    <button class="role-action-btn delete delete-backup-btn" data-backup-id="${backup.id}"><i class="fa-solid fa-trash"></i> Sil</button>
                </div>
            `;
            container.appendChild(card);
        });
    } catch (error) {
        container.innerHTML = `<p style="color: var(--red);">${error.message}</p>`;
    }
}

document.getElementById('create-backup-btn')?.addEventListener('click', e => handleCreateBackup(e.target));
document.getElementById('restore-from-backup-btn')?.addEventListener('click', () => document.getElementById('restore-backup-input').click());
document.getElementById('restore-backup-input')?.addEventListener('change', e => handleRestoreBackup(e.target.files[0]));
document.getElementById('backups-list-container')?.addEventListener('click', e => {
    const deleteBtn = e.target.closest('.delete-backup-btn');
    if (deleteBtn) handleDeleteBackup(deleteBtn.dataset.backupId);
});