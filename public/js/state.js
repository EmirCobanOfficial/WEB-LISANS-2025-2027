export const state = {
    selectedGuildId: null,
    guildData: {
        channels: [],
        roles: [],
        settings: {},
        stats: {},
        permissions: {},
        members: [],
        auditLogs: [],
        auditLogEvents: {},
        summary: {},
        modLogs: [],
        leaderboard: []
    },

    setSelectedGuild(guildId, guildName, guildIcon) {
        this.selectedGuildId = guildId;
        localStorage.setItem('selectedGuildId', guildId);
        localStorage.setItem('selectedGuildName', guildName);
        localStorage.setItem('selectedGuildIcon', guildIcon);
    },

    updateGuildData(newData) {
        this.guildData = { ...this.guildData, ...newData };
    },

    // YENİ: Belirli bir veri türünün yüklenip yüklenmediğini kontrol eder.
    isDataLoaded(key) {
        return this.guildData[key] && (!Array.isArray(this.guildData[key]) || this.guildData[key].length > 0);
    }
};