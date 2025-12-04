import { api } from '../api.js';
import { state } from '../state.js';
import { showToast } from '../ui.js';

// YENİ: İlerleme çubuğunu ve zamanı güncelleyen interval'ı tutmak için
let progressInterval = null;


function renderPlayer(data) {
    const container = document.getElementById('music-player-container');
    if (!container) return;

    if (!data || !data.isPlaying || !data.currentTrack) {
        container.innerHTML = `
            <div class="access-denied-notice">
                <i class="fa-solid fa-headphones"></i>
                <h3>Sessizlik...</h3>
                <p>Şu anda bu sunucuda çalan bir müzik yok veya bot bir ses kanalında değil.</p>
            </div>`;
        return;
    }

    const track = data.currentTrack;
    // YENİ: İlerleme çubuğu ve zamanlayıcı için başlangıç değerleri
    const initialProgressMs = track.progress.current;
    const durationMs = track.progress.end || 1; // 0'a bölünmeyi engelle
    const progressPercent = (initialProgressMs / durationMs) * 100;

    container.innerHTML = `
        <div class="music-player-card">
            <img src="${track.thumbnail}" alt="Albüm Kapağı" class="music-thumbnail">
            <div class="music-details">
                <h3 class="music-title">${track.title}</h3>
                <p class="music-author">${track.author}</p>
                <div class="music-progress-bar-container">
                    <div id="music-progress-bar" class="music-progress-bar" style="width: ${progressPercent}%"></div>
                </div>
                <div class="music-time">
                    <span id="music-current-time">${formatTime(initialProgressMs)}</span> / <span>${track.duration}</span>
                </div>
                <p class="music-requested-by">İsteyen: ${track.requestedBy}</p>
            </div>
            <div class="music-controls">
               <div class="music-action-buttons">
                    <button class="music-control-btn" data-action="togglePause" title="${data.isPaused ? 'Devam Et' : 'Duraklat'}">
                        <i class="fa-solid ${data.isPaused ? 'fa-play' : 'fa-pause'}"></i>
                    </button>
                    <button class="music-control-btn" data-action="skip" title="Geç">
                        <i class="fa-solid fa-forward-step"></i>
                    </button>
                    <button class="music-control-btn danger" data-action="stop" title="Durdur">
                        <i class="fa-solid fa-stop"></i>
                    </button>
                </div>
                <div class="music-volume-control">
                    <i id="volume-icon" class="fa-solid fa-volume-high"></i>
                    <input type="range" id="music-volume-slider" min="0" max="150" value="${data.volume}" class="volume-slider" title="Ses Seviyesi">
                </div>
            </div>
        </div>
    `;

    // YENİ: İlerleme çubuğunu canlandırmaya başla
    startProgressUpdater(initialProgressMs, durationMs, data.isPaused);
}

// YENİ: Arama sonuçlarını render eder
function renderSearchResults(tracks) {
    const container = document.getElementById('music-search-results-container');
    if (!container) return;

    container.style.display = 'block';
    container.innerHTML = tracks.map(track => `
        <div class="leaderboard-entry" style="padding: 15px 20px; cursor: pointer;" data-track-url="${track.url}">
            <img src="${track.thumbnail}" alt="thumbnail" style="width: 60px; height: 60px; border-radius: 8px; margin-right: 15px;">
            <div class="leaderboard-user" style="flex-grow: 1;">
                <div class="leaderboard-user-info">
                    <span class="leaderboard-user-tag">${track.title}</span>
                    <span class="list-item-description">${track.author}</span>
                </div>
            </div>
            <div class="leaderboard-stats" style="min-width: auto;">
                <span class="leaderboard-level"><span>Süre</span>${track.duration}</span>
            </div>
        </div>
    `).join('');
}

function clearSearchResults() {
    const container = document.getElementById('music-search-results-container');
    if (container) container.style.display = 'none';
    if (container) container.innerHTML = '';
}

function renderQueue(tracks) {
    const container = document.getElementById('music-queue-list');
    if (!container) return;

    if (!tracks || tracks.length === 0) {
        container.innerHTML = '<p class="setting-description" style="text-align: center;">Sırada şarkı yok.</p>';
        return;
    }

    container.innerHTML = tracks.map((track, index) => `
        <div class="leaderboard-entry" style="padding: 15px 20px;">
            <span class="leaderboard-rank">${index + 1}</span>
            <div class="leaderboard-user" style="flex-grow: 1;">
                <div class="leaderboard-user-info">
                    <span class="leaderboard-user-tag">${track.title}</span>
                    <span class="list-item-description">${track.author}</span>
                </div>
            </div>
            <div class="leaderboard-stats" style="min-width: auto; gap: 20px;">
                <span class="leaderboard-xp"><span>İsteyen</span>${track.requestedBy}</span>
                <span class="leaderboard-level"><span>Süre</span>${track.duration}</span>
            </div>
        </div>
    `).join('');
}

// YENİ: Milisaniyeyi "dakika:saniye" formatına çeviren yardımcı fonksiyon
function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// YENİ: İlerleme çubuğunu ve zamanı saniyede bir güncelleyen fonksiyon
function startProgressUpdater(startTimeMs, totalDurationMs, isPaused) {
    // Önceki interval'ı temizle
    if (progressInterval) clearInterval(progressInterval);

    const progressBar = document.getElementById('music-progress-bar');
    const currentTimeEl = document.getElementById('music-current-time');
    if (!progressBar || !currentTimeEl) return;

    let currentTime = startTimeMs;

    progressInterval = setInterval(() => {
        if (document.hidden || state.currentPageId !== 'music-player-page') {
            clearInterval(progressInterval);
            return;
        }

        const isCurrentlyPaused = document.querySelector('.music-control-btn[data-action="togglePause"] i')?.classList.contains('fa-play');
        if (!isCurrentlyPaused) {
            currentTime += 1000;
        }

        if (currentTime > totalDurationMs) currentTime = totalDurationMs;

        progressBar.style.width = `${(currentTime / totalDurationMs) * 100}%`;
        currentTimeEl.textContent = formatTime(currentTime);
    }, 1000);
}

async function fetchAndRenderMusicData() {
    const playerContainer = document.getElementById('music-player-container');
    const queueContainer = document.getElementById('music-queue-list');
    if (!playerContainer || !queueContainer) return;

    playerContainer.innerHTML = '<p>Müzik verileri yükleniyor...</p>';
    queueContainer.innerHTML = '';
    clearSearchResults(); // YENİ: Sayfa yenilendiğinde arama sonuçlarını temizle

    // YENİ: Sayfa değiştirildiğinde interval'ı durdurmak için
    if (progressInterval) clearInterval(progressInterval);

    try {
        const data = await api.getMusicQueue(state.selectedGuildId);
        renderPlayer(data);
        renderQueue(data.tracks);
    } catch (error) {
        playerContainer.innerHTML = `
            <div class="access-denied-notice">
                <i class="fa-solid fa-circle-exclamation"></i>
                <h3>Hata</h3>
                <p>Müzik verileri alınırken bir hata oluştu: ${error.message}</p>
            </div>`;
    }
}

export function initMusicPlayerPage() {
    fetchAndRenderMusicData();

    // Olay dinleyicilerini ayarla
    document.getElementById('music-refresh-btn')?.addEventListener('click', fetchAndRenderMusicData);

    // YENİ: Arama butonu için olay dinleyicisi
    const searchBtn = document.getElementById('music-search-btn');
    const searchInput = document.getElementById('music-search-query');
    if (searchBtn && searchInput) {
        const handleSearch = async () => {
            const query = searchInput.value.trim();
            if (!query) return;
            searchBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Aranıyor...';
            searchBtn.disabled = true;
            try {
                const results = await api.searchMusic(state.selectedGuildId, query);
                renderSearchResults(results);
            } catch (error) {
                showToast(`Arama hatası: ${error.message}`, 'error');
                clearSearchResults();
            } finally {
                searchBtn.innerHTML = '<i class="fa-solid fa-search"></i> Ara';
                searchBtn.disabled = false;
            }
        };
        searchBtn.addEventListener('click', handleSearch);
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleSearch();
        });
    }

    const playerContainer = document.getElementById('music-player-container');
    const searchResultsContainer = document.getElementById('music-search-results-container');
    if (!playerContainer || !searchResultsContainer) return;

    // YENİ: Olay dinleyicilerinin tekrar tekrar eklenmesini önle
    const pageElement = document.getElementById('music-player-page');
    if (pageElement.dataset.listenerAttached) return;
    pageElement.dataset.listenerAttached = 'true';

    playerContainer.addEventListener('click', async (e) => {
        const button = e.target.closest('.music-control-btn');
        if (button && button.dataset.action) {
            const action = button.dataset.action;
            // YENİ: Butona basıldığında geçici olarak devre dışı bırak ve görsel geri bildirim ver
            button.disabled = true;
            button.style.opacity = '0.5';
            button.style.cursor = 'wait';

            try {
                await api.controlMusic(state.selectedGuildId, action);
                showToast(`Eylem '${action}' başarıyla gerçekleştirildi.`, 'success');
                // Eylem sonrası arayüzü yenilemek için kısa bir gecikme
                setTimeout(fetchAndRenderMusicData, 250);
            } catch (error) {
                console.error(`Müzik kontrol hatası (${action}):`, error);
                showToast(`Eylem gerçekleştirilemedi: ${error.message}`, 'error');
                // YENİ: Hata durumunda butonu tekrar aktif et
                button.disabled = false;
                button.style.opacity = '1';
                button.style.cursor = 'pointer';
            }
        }
    });

    // YENİ: Ses seviyesi çubuğu için olay dinleyicisi
    playerContainer.addEventListener('input', async (e) => {
        if (e.target.id === 'music-volume-slider') {
            const volume = e.target.value;
            const volumeIcon = document.getElementById('volume-icon');
            if (volumeIcon) {
                if (volume == 0) volumeIcon.className = 'fa-solid fa-volume-xmark';
                else if (volume < 70) volumeIcon.className = 'fa-solid fa-volume-low';
                else volumeIcon.className = 'fa-solid fa-volume-high';
            }
            try {
                // API'ye ses seviyesini ayarla isteği gönder
                await api.controlMusic(state.selectedGuildId, 'setVolume', volume);
            } catch (error) {
                console.error(`Ses ayarı hatası:`, error);
                showToast('Ses seviyesi ayarlanamadı.', 'error');
            }
        }
    });

    // YENİ: Arama sonuçlarından birine tıklama
    searchResultsContainer.addEventListener('click', async (e) => {
        const trackElement = e.target.closest('.leaderboard-entry');
        if (!trackElement || !trackElement.dataset.trackUrl) return;

        const url = trackElement.dataset.trackUrl;
        showToast('Şarkı sıraya ekleniyor...', 'info');
        try {
            const result = await api.playTrack(state.selectedGuildId, url);
            showToast(result.message, 'success');
            searchInput.value = '';
            clearSearchResults();
            setTimeout(fetchAndRenderMusicData, 1000); // Sırayı ve çaları güncelle
        } catch (error) {
            showToast(`Şarkı eklenemedi: ${error.message}`, 'error');
        }
    });
}
