import { api } from '../api.js';
import { state } from '../state.js';
import { showToast, showConfirmModal } from '../ui.js';

// YENİ: İlerleme çubuğunu ve zamanı güncelleyen interval'ı tutmak için
let progressInterval = null;
let isDraggingQueue = false; // YENİ: Sürükleme durumu
let queueSortable = null; // YENİ: Sortable instance


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

    // YENİ: Tekrar modu durumu
    const loopModes = ['Kapalı', 'Şarkı', 'Liste'];
    const loopClass = data.repeatMode > 0 ? 'active' : '';
    const loopIcon = data.repeatMode === 1 ? 'fa-repeat' : (data.repeatMode === 2 ? 'fa-rotate' : 'fa-repeat');

    container.innerHTML = `
        <div class="music-player-card">
            <img src="${track.thumbnail}" alt="Albüm Kapağı" class="music-thumbnail">
            <div class="music-details">
                <h3 class="music-title">${track.title}</h3>
                <p class="music-author">${track.author}</p>
                <div class="music-progress-bar-container" data-duration="${durationMs}">
                    <div id="music-progress-bar" class="music-progress-bar" style="width: ${progressPercent}%"></div>
                </div>
                <div class="music-time">
                    <span id="music-current-time">${formatTime(initialProgressMs)}</span> / <span>${track.duration}</span>
                </div>
                <p class="music-requested-by">İsteyen: ${track.requestedBy}</p>
            </div>
            <div class="music-controls">
               <div class="music-action-buttons">
                    <button class="music-control-btn" data-action="shuffle" title="Karıştır">
                        <i class="fa-solid fa-shuffle"></i>
                    </button>
                    <button class="music-control-btn" data-action="togglePause" title="${data.isPaused ? 'Devam Et' : 'Duraklat'}">
                        <i class="fa-solid ${data.isPaused ? 'fa-play' : 'fa-pause'}"></i>
                    </button>
                    <button class="music-control-btn" data-action="skip" title="Geç">
                        <i class="fa-solid fa-forward-step"></i>
                    </button>
                    <button class="music-control-btn ${loopClass}" data-action="loop" title="Tekrarla: ${loopModes[data.repeatMode] || 'Kapalı'}">
                        <i class="fa-solid ${loopIcon}"></i>
                    </button>
                    <button class="music-control-btn" id="show-lyrics-btn" title="Şarkı Sözleri">
                        <i class="fa-solid fa-file-lines"></i>
                    </button>
                    <button class="music-control-btn danger" data-action="stop" title="Durdur">
                        <i class="fa-solid fa-stop"></i>
                    </button>
                </div>
                <div class="music-volume-control">
                    <i id="volume-icon" class="fa-solid fa-volume-high"></i>
                    <input type="range" id="music-volume-slider" min="0" max="150" value="${data.volume}" class="volume-slider" title="Ses Seviyesi">
                    <span id="music-volume-text" style="min-width: 40px; text-align: right; font-size: 0.9em; color: var(--text-secondary);">%${data.volume}</span>
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

    // Sürükleme yapılıyorsa güncellemeyi atla (kullanıcı deneyimini bozmamak için)
    if (isDraggingQueue) return;

    if (!tracks || tracks.length === 0) {
        container.innerHTML = '<p class="setting-description" style="text-align: center;">Sırada şarkı yok.</p>';
        return;
    }

    container.innerHTML = tracks.map((track, index) => `
        <div class="leaderboard-entry" style="padding: 15px 20px; cursor: grab;" data-index="${index}">
            <span class="leaderboard-rank"><i class="fa-solid fa-grip-lines" style="color: var(--text-secondary); margin-right: 10px;"></i>${index + 1}</span>
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

// YENİ: Kayıtlı listeleri render et
async function renderSavedPlaylists() {
    const container = document.getElementById('saved-playlists-container');
    if (!container) return;

    try {
        const playlists = await api.getUserPlaylists();
        container.innerHTML = '';

        if (playlists.length === 0) {
            container.innerHTML = '<p class="setting-description" style="text-align: center;">Henüz kayıtlı listeniz yok.</p>';
            return;
        }

        playlists.forEach(playlist => {
            const div = document.createElement('div');
            div.className = 'leaderboard-entry';
            div.style.padding = '15px 20px';
            div.innerHTML = `
                <div class="leaderboard-user" style="flex-grow: 1;">
                    <div class="leaderboard-user-info">
                        <span class="leaderboard-user-tag">${playlist.name}</span>
                        <span class="list-item-description" style="font-size: 0.8em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 300px;">${playlist.url}</span>
                    </div>
                </div>
                <div class="leaderboard-stats" style="min-width: auto; gap: 10px;">
                    <button class="action-btn play-playlist-btn" data-url="${playlist.url}" title="Listeyi Oynat" style="background-color: var(--green); border-color: var(--green); color: white;">
                        <i class="fa-solid fa-play"></i>
                    </button>
                    <button class="remove-item-btn danger delete-playlist-btn" data-name="${playlist.name}" title="Sil">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `;
            container.appendChild(div);
        });

        // Olay dinleyicileri
        container.querySelectorAll('.play-playlist-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const url = btn.dataset.url;
                showToast('Liste sıraya ekleniyor...', 'info');
                try {
                    const result = await api.playTrack(state.selectedGuildId, url);
                    showToast(result.message, 'success');
                    setTimeout(fetchAndRenderMusicData, 1000);
                } catch (error) {
                    showToast(`Hata: ${error.message}`, 'error');
                }
            });
        });

        container.querySelectorAll('.delete-playlist-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const name = btn.dataset.name;
                const confirmed = await showConfirmModal('Listeyi Sil', `${name} listesini silmek istediğinize emin misiniz?`);
                if (!confirmed) return;
                try {
                    await api.deleteUserPlaylist(name);
                    showToast('Liste silindi.', 'success');
                    renderSavedPlaylists();
                } catch (error) {
                    showToast(`Hata: ${error.message}`, 'error');
                }
            });
        });

    } catch (error) {
        console.error('Playlists error:', error);
        container.innerHTML = '<p class="setting-description" style="text-align: center; color: var(--red);">Listeler yüklenemedi.</p>';
    }
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
        renderSavedPlaylists(); // YENİ: Listeleri de yükle
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
    renderSavedPlaylists(); // YENİ: Sayfa açılışında listeleri yükle

    // SOCKET.IO ENTEGRASYONU
    // Socket.io scriptinin sayfada yüklü olduğunu varsayıyoruz
    if (typeof io !== 'undefined') {
        const socket = io();
        socket.emit('joinMusicRoom', state.selectedGuildId);

        socket.on('musicUpdate', (data) => {
            renderPlayer(data);
            if (!isDraggingQueue) renderQueue(data.tracks);
        });
    } else {
        console.warn("Socket.io yüklenemedi, otomatik güncellemeler devre dışı.");
    }

    // Olay dinleyicilerini ayarla
    document.getElementById('music-refresh-btn')?.addEventListener('click', fetchAndRenderMusicData);

    // YENİ: Çalma Listesi Kaydetme
    document.getElementById('save-playlist-btn')?.addEventListener('click', async () => {
        const btn = document.getElementById('save-playlist-btn');
        const nameInput = document.getElementById('playlist-name-input');
        const urlInput = document.getElementById('playlist-url-input');
        const name = nameInput.value.trim();
        const url = urlInput.value.trim();

        if (!name || !url) return showToast('Lütfen isim ve URL girin.', 'warning');

        // Butonu devre dışı bırak (Çift tıklamayı önlemek için)
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Kaydediliyor...';

        try {
            await api.saveUserPlaylist(name, url);
            showToast('Çalma listesi kaydedildi.', 'success');
            nameInput.value = '';
            urlInput.value = '';
            renderSavedPlaylists();
        } catch (error) {
            showToast(`Hata: ${error.message}`, 'error');
        } finally {
            // Butonu tekrar aktif et
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-save"></i> Kaydet';
        }
    });

    // YENİ: Sortable.js Kurulumu (Sürükle-Bırak)
    const queueList = document.getElementById('music-queue-list');
    if (queueList && typeof Sortable !== 'undefined') {
        // Varsa eski instance'ı temizle
        if (queueSortable) queueSortable.destroy();
        
        queueSortable = new Sortable(queueList, {
            animation: 150,
            handle: '.leaderboard-entry', // Tüm satır sürüklenebilir
            ghostClass: 'sortable-ghost',
            onStart: () => {
                isDraggingQueue = true;
            },
            onEnd: async (evt) => {
                isDraggingQueue = false;
                // Sıra değişmediyse işlem yapma
                if (evt.oldIndex === evt.newIndex) return;

                // Yeni sırayı DOM'dan oku
                const items = queueList.querySelectorAll('.leaderboard-entry');
                const newOrder = Array.from(items).map(item => parseInt(item.dataset.index));

                try {
                    await api.reorderMusicQueue(state.selectedGuildId, newOrder);
                    // Başarılı olursa socket update zaten gelecek ve listeyi tazeleyecek
                } catch (error) {
                    showToast(`Sıralama hatası: ${error.message}`, 'error');
                    fetchAndRenderMusicData(); // Hata durumunda eski haline getir
                }
            }
        });
    }

    // YENİ: Şarkı Sözleri Modalı Kapatma
    document.getElementById('lyrics-modal-close')?.addEventListener('click', () => {
        document.getElementById('lyrics-modal').style.display = 'none';
    });

    // YENİ: Şarkı Sözlerini Kopyala
    document.getElementById('lyrics-copy-btn')?.addEventListener('click', () => {
        const content = document.getElementById('lyrics-content').innerText;
        navigator.clipboard.writeText(content)
            .then(() => showToast('Şarkı sözleri kopyalandı.', 'success'))
            .catch(() => showToast('Kopyalama başarısız.', 'error'));
    });

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
        // YENİ: İlerleme çubuğuna tıklama (Seek)
        const progressContainer = e.target.closest('.music-progress-bar-container');
        if (progressContainer) {
            const durationMs = parseInt(progressContainer.dataset.duration);
            if (!durationMs) return;

            const rect = progressContainer.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const width = rect.width;
            const percentage = Math.max(0, Math.min(1, x / width));
            const seekTime = Math.floor(percentage * durationMs);

            try {
                await api.controlMusic(state.selectedGuildId, 'seek', seekTime);
                // Arayüzü güncellemek için kısa bir süre bekle
                setTimeout(fetchAndRenderMusicData, 500);
            } catch (error) {
                showToast(`Sarma hatası: ${error.message}`, 'error');
            }
            return; // Diğer buton kontrollerine girmesin
        }

        // Şarkı sözleri butonu için özel kontrol (data-action kullanmıyor)
        if (e.target.closest('#show-lyrics-btn')) {
            const btn = e.target.closest('#show-lyrics-btn');
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            try {
                const data = await api.getLyrics(state.selectedGuildId);
                document.getElementById('lyrics-title').textContent = `${data.title} - ${data.artist}`;
                document.getElementById('lyrics-content').textContent = data.lyrics;
                document.getElementById('lyrics-modal').style.display = 'flex';
            } catch (error) {
                showToast(error.message, 'error');
            } finally {
                btn.innerHTML = '<i class="fa-solid fa-file-lines"></i>';
            }
            return;
        }

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

    // YENİ: Ses seviyesi çubuğu için olay dinleyicisi (Görsel Güncelleme - Anlık)
    playerContainer.addEventListener('input', (e) => {
        if (e.target.id === 'music-volume-slider') {
            const volume = e.target.value;
            const volumeIcon = document.getElementById('volume-icon');
            const volumeText = document.getElementById('music-volume-text');
            
            if (volumeText) volumeText.textContent = `%${volume}`;

            if (volumeIcon) {
                if (volume == 0) volumeIcon.className = 'fa-solid fa-volume-xmark';
                else if (volume < 70) volumeIcon.className = 'fa-solid fa-volume-low';
                else volumeIcon.className = 'fa-solid fa-volume-high';
            }
        }
    });

    // YENİ: Ses seviyesi çubuğu için olay dinleyicisi (API İsteği - Bırakıldığında)
    playerContainer.addEventListener('change', async (e) => {
        if (e.target.id === 'music-volume-slider') {
            const volume = e.target.value;
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
