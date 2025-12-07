async function fetchJSON(url, options = {}) {
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            let data;
            try {
                data = await response.json(); // Hata mesajını JSON olarak almayı dene
            } catch (jsonError) {
                data = { error: `HTTP error! status: ${response.status}` }; // JSON ayrıştırma başarısız olursa genel bir hata oluştur
            }
            throw new Error(data.error || `HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        throw error; // Hatanın daha üst katmanlarda yakalanabilmesi için tekrar fırlat
    }
}

export const api = {
    // GET istekleri
    getUserGuilds: () => fetchJSON('/api/user/guilds'),
    getBotGuilds: () => fetchJSON('/api/bot/guilds'),
    getGuildSettings: (guildId) => fetchJSON(`/api/settings?guildId=${guildId}`),
    getGuildChannels: (guildId) => fetchJSON(`/api/guild/${guildId}/channels`),
    getGuildRoles: (guildId) => fetchJSON(`/api/guild/${guildId}/roles`),
    getGuildMembers: (guildId) => fetchJSON(`/api/guild/${guildId}/members`),
    getGuildSummary: (guildId) => fetchJSON(`/api/guild/${guildId}/summary`),
    getGuildStats: (guildId) => fetchJSON(`/api/guild/${guildId}/stats`),
    getGuildInvites: (guildId) => fetchJSON(`/api/guild/${guildId}/invites`),
    getGuildAuditLogs: (guildId) => fetchJSON(`/api/guild/${guildId}/audit-logs`),
    getGuildModLogs: (guildId) => fetchJSON(`/api/guild/${guildId}/mod-logs`),
    getGuildLeaderboard: (guildId) => fetchJSON(`/api/guild/${guildId}/leaderboard`),
    getGuildBackups: (guildId) => fetchJSON(`/api/guild/${guildId}/backups`),
    getCustomCommands: (guildId) => fetchJSON(`/api/guild/${guildId}/custom-commands`), // YENİ
    getGuildWarnings: (guildId) => fetchJSON(`/api/guild/${guildId}/warnings`), // YENİ
    getGuildBans: (guildId) => fetchJSON(`/api/guild/${guildId}/bans`), // YENİ
    getPermissions: () => fetchJSON('/api/permissions'),
    getAuditLogEvents: () => fetchJSON('/api/audit-log-events'),
    getAuthorizedUsers: () => fetchJSON('/api/authorized-users'), // YENİ: Giriş yapanları getiren rota
    getPanelLogs: () => fetchJSON('/api/panel-logs'), // YENİ: Panel loglarını getiren rota
    getUserProfile: (userId) => fetchJSON(`/api/user/${userId}`), // YENİ: Kullanıcı profili
    checkPermissions: (guildId) => fetchJSON(`/api/guild/${guildId}/permissions-check`), // YENİ: İzin kontrolü

    // YENİ: Müzik API
    getMusicQueue: (guildId) => fetchJSON(`/api/guild/${guildId}/music/queue`),
    controlMusic: (guildId, action, volume) => fetchJSON(`/api/guild/${guildId}/music/control`, { // YENİ: volume parametresi eklendi
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, volume }), // YENİ: volume'u isteğe ekle
    }),
    searchMusic: (guildId, query) => fetchJSON(`/api/guild/${guildId}/music/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
    }),
    playTrack: (guildId, trackUrl) => fetchJSON(`/api/guild/${guildId}/music/play`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackUrl }),
    }),

    getFivemStatus: (guildId) => fetchJSON(`/api/guild/${guildId}/fivem/status`),
     saveSettings: (guildId, moduleName, newSettings) => fetchJSON('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guildId, module: moduleName, newSettings }),
    }),
    deleteRole: (guildId, roleId) => fetchJSON(`/api/guild/${guildId}/roles/${roleId}`, { method: 'DELETE' }),
    createRole: (guildId, roleData) => fetchJSON(`/api/guild/${guildId}/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roleData)
    }),
    updateRole: (guildId, roleId, roleData) => fetchJSON(`/api/guild/${guildId}/roles/${roleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roleData)
    }),
    updateMemberRoles: (guildId, memberId, roles) => fetchJSON(`/api/guild/${guildId}/members/${memberId}/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles })
    }),
    deleteInvite: (guildId, inviteCode) => fetchJSON(`/api/guild/${guildId}/invites/${inviteCode}`, { method: 'DELETE' }),
    resetAllSettings: (guildId) => fetchJSON(`/api/guild/${guildId}/settings`, { method: 'DELETE' }),
    importSettings: (guildId, settings) => fetchJSON(`/api/guild/${guildId}/settings/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
    }),
    createBackup: (guildId) => fetchJSON(`/api/guild/${guildId}/backup`, { method: 'POST' }),
    deleteBackup: (guildId, backupId) => fetchJSON(`/api/guild/${guildId}/backups/${backupId}`, { method: 'DELETE' }),
    restoreBackup: (guildId, backupData) => fetchJSON(`/api/guild/${guildId}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backupData)
    }),
    // YENİ EKLENEN FONKSİYON
    savePluginOrder: (guildId, gridId, order) => fetchJSON(`/api/guild/${guildId}/plugin-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gridId, order })
    }),
    // YENİ: Özel Komutlar API Fonksiyonları
    addCustomCommand: (guildId, commandData) => fetchJSON(`/api/guild/${guildId}/custom-commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commandData)
    }),
    updateCustomCommand: (guildId, commandId, commandData) => fetchJSON(`/api/guild/${guildId}/custom-commands/${commandId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commandData)
    }),
    deleteCustomCommand: (guildId, commandId) => fetchJSON(`/api/guild/${guildId}/custom-commands/${commandId}`, {
        method: 'DELETE',
    }),
    deleteWarning: (guildId, userId, warnId) => fetchJSON(`/api/guild/${guildId}/warnings/${userId}/${warnId}`, { // YENİ
        method: 'DELETE',
    }),
    unbanUser: (guildId, userId) => fetchJSON(`/api/guild/${guildId}/bans/${userId}`, { // YENİ
        method: 'DELETE',
    }),

    // --- Kullanıcı Engelleme API Fonksiyonları ---
    getBlockedUsers: () => fetchJSON('/api/blocked-users'),
    blockUser: (userId) => fetchJSON('/api/block-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
    }),
    unblockUser: (userId) => fetchJSON(`/api/blocked-users/${userId}`, {
        method: 'DELETE'
    }),

    // --- Güvenilir Kullanıcı API Fonksiyonları (YENİ) ---
    getTrustedUsers: () => fetchJSON('/api/trusted-users'),
    addTrustedUser: (userId) => fetchJSON('/api/trusted-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
    }),
    removeTrustedUser: (userId) => fetchJSON(`/api/trusted-users/${userId}`, {
        method: 'DELETE'
    }),
    clearPanelLogs: () => fetchJSON('/api/panel-logs', { // YENİ
        method: 'DELETE'
    }),
    // YENİ: Bot Banner API
    setBotBanner: (formData) => fetch('/api/bot/banner', {
        method: 'POST',
        body: formData,
    }).then(res => res.json().then(data => { if (!res.ok) throw new Error(data.error); return data; })),
};