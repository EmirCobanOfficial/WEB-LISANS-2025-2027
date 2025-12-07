import { api } from '../api.js';
import { state } from '../state.js';
import { showToast, populateSelect } from '../ui.js';

function displayMembers(members) {
    const membersBody = document.getElementById('members-list-body');
    if (!membersBody) return;

    membersBody.innerHTML = '';

    const message = members.length === 0 ? 'Eşleşen üye bulunamadı.' : (state.guildData.members.length === 0 ? 'Bu sunucuda üye bulunamadı.' : '');
    if (message) {
        membersBody.innerHTML = `<tr><td colspan="3" style="text-align: center;">${message}</td></tr>`;
        return;
    }

    members.forEach(member => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div class="member-info-cell">
                    <img src="${member.avatar}" alt="${member.tag}'s avatar">
                    <span class="member-tag">${member.tag}</span>
                </div>
            </td>
            <td>${member.id}</td>
            <td style="text-align: center;">
                <button class="action-btn edit edit-member-roles-btn" data-member-id="${member.id}">
                    Rolleri Düzenle
                </button>
            </td>
        `;
        membersBody.appendChild(tr);
    });
}

function openMemberRolesModal(member) {
    const modal = document.getElementById('member-roles-modal');
    const title = document.getElementById('member-roles-modal-title');
    const grid = document.getElementById('member-roles-grid');
    if (!modal || !title || !grid) return;

    document.getElementById('member-edit-id').value = member.id;
    title.textContent = `${member.tag} Rollerini Düzenle`;
    grid.innerHTML = '';

    const manageableRoles = state.guildData.roles;

    manageableRoles.forEach(role => {
        const isChecked = member.roles.includes(role.id);
        const item = document.createElement('div');
        item.className = 'permission-item';
        const checkboxId = `member-role-${role.id}`;
        item.innerHTML = `
            <input type="checkbox" id="${checkboxId}" value="${role.id}" ${isChecked ? 'checked' : ''}>
            <label for="${checkboxId}">
                <span class="role-color-dot" style="background-color: ${role.color};"></span>
                ${role.name}
            </label>
        `;
        grid.appendChild(item);
    });

    modal.style.display = 'flex';
}

async function handleMemberRolesSave(event) {
    event.preventDefault();
    const form = event.target;
    const memberId = form.querySelector('#member-edit-id').value;
    const selectedRoleIds = Array.from(form.querySelectorAll('#member-roles-grid input:checked')).map(cb => cb.value);

    try {
        await api.updateMemberRoles(state.selectedGuildId, memberId, selectedRoleIds);
        showToast('Üye rolleri başarıyla güncellendi.', 'success');
        document.getElementById('member-roles-modal').style.display = 'none';
    } catch (error) {
        showToast(`Hata: ${error.message}`, 'error');
    }
}

function applyMemberFilters() {
    const searchInput = document.getElementById('member-search-input');
    const roleFilter = document.getElementById('member-role-filter');
    if (!searchInput || !roleFilter || !state.guildData.members) return;

    const searchTerm = searchInput.value.toLowerCase().trim();
    const selectedRoleId = roleFilter.value;

    let filteredMembers = state.guildData.members;

    if (searchTerm) {
        filteredMembers = filteredMembers.filter(member =>
            member.tag.toLowerCase().includes(searchTerm) || member.id.includes(searchTerm)
        );
    }

    if (selectedRoleId && selectedRoleId !== 'all') {
        filteredMembers = filteredMembers.filter(member => member.roles.includes(selectedRoleId));
    }

    displayMembers(filteredMembers);
}

function setupMemberEventListeners() {
    const searchInput = document.getElementById('member-search-input');
    const roleFilter = document.getElementById('member-role-filter');

    if (searchInput) searchInput.addEventListener('input', applyMemberFilters);
    if (roleFilter) roleFilter.addEventListener('change', applyMemberFilters);

    document.getElementById('members-list-body')?.addEventListener('click', e => {
        const editBtn = e.target.closest('.edit-member-roles-btn');
        if (editBtn) {
            const memberId = editBtn.dataset.memberId;
            const member = state.guildData.members.find(m => m.id === memberId);
            if (member) openMemberRolesModal(member);
        }
    });

    document.getElementById('member-roles-form')?.addEventListener('submit', handleMemberRolesSave);

    const memberRolesModal = document.getElementById('member-roles-modal');
    if (memberRolesModal) {
        memberRolesModal.addEventListener('click', (e) => {
            if (e.target === memberRolesModal || e.target.id === 'member-roles-modal-cancel') {
                memberRolesModal.style.display = 'none';
            }
        });
    }
}

export async function initMembersPage() {
    const membersBody = document.getElementById('members-list-body');
    const searchInput = document.getElementById('member-search-input');
    const roleFilter = document.getElementById('member-role-filter');
    if (!membersBody || !searchInput || !roleFilter) return;

    searchInput.value = '';
    membersBody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Üyeler yükleniyor...</td></tr>';

    // Rol filtresini doldur
    const rolesForFilter = [{ id: 'all', name: 'Tüm Roller' }, ...state.guildData.roles];
    populateSelect(roleFilter, rolesForFilter, 'all');

    try {
        const members = await api.getGuildMembers(state.selectedGuildId);
        state.updateGuildData({ members });
        displayMembers(members);
   } catch (error) {
        showToast(`Üyeler alınamadı: ${error}`, 'error');
        membersBody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--red);">${error.message}</td></tr>`;
    }

    // Olay dinleyicilerini sadece bir kez kur
    if (!searchInput.dataset.listenerAttached) {
        setupMemberEventListeners();
        searchInput.dataset.listenerAttached = 'true';
    }
}