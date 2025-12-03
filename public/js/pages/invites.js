import { api } from '../api.js';
import { state } from '../state.js';
import { showToast, showConfirmModal } from '../ui.js';

async function handleDeleteInvite(inviteCode) {
    const confirmed = await showConfirmModal(
        'Daveti Sil',
        `'${inviteCode}' kodlu daveti silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`
    );
    if (!confirmed) return;

    try {
        await api.deleteInvite(state.selectedGuildId, inviteCode);
        showToast('Davet başarıyla silindi.', 'success');
        initInvitesPage(); // Listeyi yenile
    } catch (error) {
        showToast(`Hata: ${error.message}`, 'error');
    }
}

export async function initInvitesPage() {
    const invitesBody = document.getElementById('invites-list-body');
    if (!invitesBody) return;

    invitesBody.innerHTML = '<tr><td colspan="6">Yükleniyor...</td></tr>';

    try {
        const invites = await api.getGuildInvites(state.selectedGuildId);
        invitesBody.innerHTML = '';

        if (invites.length === 0) {
            invitesBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Bu sunucuda aktif davet bulunamadı.</td></tr>';
            return;
        }

        invites.sort((a, b) => b.uses - a.uses).forEach(invite => {
            const tr = document.createElement('tr');
            const expires = invite.expiresAt ? new Date(invite.expiresAt).toLocaleString('tr-TR') : 'Kalıcı';
            const uses = `${invite.uses} / ${invite.maxUses === 0 ? '∞' : invite.maxUses}`;

            tr.innerHTML = `
                <td class="invite-code-cell">
                    <code>${invite.code}</code>
                    <button class="copy-invite-btn" data-url="${invite.url}" title="Davet Linkini Kopyala">
                        <i class="fa-regular fa-copy"></i>
                    </button>
                </td>
                <td>${invite.inviter}</td>
                <td>${uses}</td>
                <td>#${invite.channel}</td>
                <td>${expires}</td>
                <td>
                    <button class="remove-item-btn danger delete-invite-btn" data-invite-code="${invite.code}" title="Daveti Sil">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            `;
            invitesBody.appendChild(tr);
        });

    } catch (error) {
        invitesBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--red);">${error.message}</td></tr>`;
    }
}

document.getElementById('invites-list-body')?.addEventListener('click', e => {
    const deleteBtn = e.target.closest('.delete-invite-btn');
    if (deleteBtn) {
        handleDeleteInvite(deleteBtn.dataset.inviteCode);
    }
    const copyBtn = e.target.closest('.copy-invite-btn');
    if (copyBtn) {
        navigator.clipboard.writeText(copyBtn.dataset.url).then(() => {
            showToast('Davet linki kopyalandı!', 'success');
        });
    }
});