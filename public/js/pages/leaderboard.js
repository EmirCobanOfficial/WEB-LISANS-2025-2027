import { api } from '../api.js';
import { state } from '../state.js';

export async function initLeaderboardPage() {
    const container = document.getElementById('leaderboard-container');
    if (!container) return;

    container.innerHTML = '<p>Sıralama yükleniyor...</p>';

    try {
        const leaderboard = await api.getGuildLeaderboard(state.selectedGuildId);
        state.updateGuildData({ leaderboard });
        container.innerHTML = '';

        if (leaderboard.length === 0) {
            container.innerHTML = '<p>Bu sunucu için sıralama verisi bulunamadı. Üyelerin XP kazanması için mesaj göndermesi gerekir.</p>';
            return;
        }

        leaderboard.forEach((user, index) => {
            const entryDiv = document.createElement('div');
            entryDiv.className = 'leaderboard-entry';

            if (user.userId === USER_ID) { // USER_ID global olarak index.ejs'den geliyor
                entryDiv.classList.add('is-current-user');
            }

            const xpForCurrent = user.xpForCurrentLevel;
            const xpForNext = user.xpForNextLevel;
            const userXPInLevel = user.xp - xpForCurrent;
            const xpNeededForNext = xpForNext - xpForCurrent;
            const progressPercent = xpNeededForNext > 0 ? (userXPInLevel / xpNeededForNext) * 100 : 0;

            entryDiv.innerHTML = `
                <div class="leaderboard-rank">${index + 1}</div>
                <div class="leaderboard-user">
                    <img src="${user.avatar}" alt="${user.tag}'s avatar">
                    <div class="leaderboard-user-info">
                        <span class="leaderboard-user-tag">${user.tag}</span>
                        <div class="leaderboard-xp-bar-container">
                            <div class="leaderboard-xp-bar" style="width: ${progressPercent}%;"></div>
                        </div>
                    </div>
                </div>
                <div class="leaderboard-stats">
                    <div class="leaderboard-level"><span>Seviye</span>${user.level}</div>
                    <div class="leaderboard-xp"><span>XP</span>${user.xp.toLocaleString('tr-TR')}</div>
                </div>
            `;
            container.appendChild(entryDiv);
        });
    } catch (error) {
        container.innerHTML = `<p style="color: var(--red);">${error.message}</p>`;
    }
}