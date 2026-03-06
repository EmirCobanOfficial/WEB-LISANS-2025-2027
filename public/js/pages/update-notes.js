import { api } from '../api.js';
import { showToast, showConfirmModal } from '../ui.js';

export async function initUpdateNotesPage() {
    const container = document.getElementById('update-notes-content');
    if (!container) return;

    container.innerHTML = '<p>Yükleniyor...</p>';

    try {
        const data = await api.getVersion();

        if (!data.updates || data.updates.length === 0) {
            container.innerHTML = '<p>Güncelleme notları bulunamadı.</p>';
            return;
        }

        let notesHtml = '';
        const latestUpdate = data.updates[0];

        // En son güncellemeyi başlıkta göster
        notesHtml += `
            <div class="stat-card wide" style="text-align: left; display: block; cursor: default; position: relative; margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 10px; margin-bottom: 15px;">
                    <h3 style="font-size: 1.5em; color: var(--brand-color); margin: 0;">
                        <i class="fa-solid fa-code-branch"></i> Sürüm ${latestUpdate.version} (En Son)
                    </h3>
                    <button id="restart-bot-btn" class="header-action-btn danger">
                        <i class="fa-solid fa-power-off"></i> Botu Yeniden Başlat
                    </button>
                </div>
                <div style="font-size: 1.1em; color: var(--text-primary); line-height: 1.6;">
                    ${latestUpdate.notes}
                </div>
            </div>
        `;

        // Önceki sürümleri listele
        if (data.updates.length > 1) {
            notesHtml += '<h3 style="margin-top: 30px; margin-bottom: 15px; color: var(--text-primary);">Önceki Sürümler</h3>';
            data.updates.slice(1).forEach(update => {
                notesHtml += `
                    <div class="stat-card wide" style="text-align: left; display: block; cursor: default; position: relative; margin-bottom: 20px; background: var(--bg-tertiary); border-color: var(--border-color);">
                        <h4 style="font-size: 1.3em; color: var(--text-primary); margin: 0 0 15px 0; padding-bottom: 10px; border-bottom: 1px solid var(--border-color);">
                            <i class="fa-solid fa-code-branch"></i> Sürüm ${update.version}
                        </h4>
                        <div style="font-size: 1em; color: var(--text-secondary); line-height: 1.6;">
                            ${update.notes}
                        </div>
                    </div>
                `;
            });
        }

        container.innerHTML = notesHtml;

        // YENİ: Favicon yükleme formunu ekle
        const faviconCard = `
            <div class="stat-card wide" style="text-align: left; display: block; cursor: default; position: relative; margin-top: 30px;">
                <h3 style="font-size: 1.5em; color: var(--brand-color); margin: 0 0 15px 0; padding-bottom: 10px; border-bottom: 1px solid var(--border-color);">
                    <i class="fa-solid fa-image"></i> Web Panel İkonu (Favicon)
                </h3>
                <div class="image-upload-container">
                    <p class="setting-description">
                        Tarayıcı sekmesinde görünecek olan ikonu buradan değiştirebilirsiniz. En iyi sonuç için <strong>.ico</strong> veya <strong>.png</strong> formatında, kare bir resim yükleyin.
                    </p>
                    <input type="file" id="favicon-upload" class="image-upload-input" accept="image/x-icon,image/png,image/jpeg">
                    <div style="display: flex; align-items: center; gap: 15px; margin-top: 10px;">
                        <img id="favicon-preview" src="/favicon.ico?t=${Date.now()}" alt="Favicon Preview" style="width: 48px; height: 48px; border-radius: 8px; border: 1px solid var(--border-color);">
                        <button id="set-favicon-btn" class="action-btn" style="background-color: var(--green); border-color: var(--green);">
                            <i class="fa-solid fa-upload"></i> İkonu Yükle ve Ayarla
                        </button>
                    </div>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', faviconCard);

        // Yeni eklenen elemanlar için olay dinleyicileri
        const faviconInput = document.getElementById('favicon-upload');
        const faviconPreview = document.getElementById('favicon-preview');
        const setFaviconBtn = document.getElementById('set-favicon-btn');

        faviconInput.addEventListener('change', () => {
            const file = faviconInput.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => { faviconPreview.src = e.target.result; };
                reader.readAsDataURL(file);
            }
        });

        setFaviconBtn.addEventListener('click', async () => {
            const file = faviconInput.files[0];
            if (!file) return showToast('Lütfen önce bir ikon dosyası seçin.', 'warning');

            const formData = new FormData();
            formData.append('favicon', file);

            setFaviconBtn.disabled = true;
            setFaviconBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Yükleniyor...';

            try {
                const result = await api.setFavicon(formData);
                showToast(result.message, 'success');
                // Tarayıcı sekmesindeki ikonu anında güncelle
                document.querySelector("link[rel*='icon']").href = `/favicon.ico?t=${Date.now()}`;
            } catch (error) {
                showToast(`İkon ayarlanamadı: ${error.message}`, 'error');
            } finally {
                setFaviconBtn.disabled = false;
                setFaviconBtn.innerHTML = '<i class="fa-solid fa-upload"></i> İkonu Yükle ve Ayarla';
            }
        });

        // Yeniden başlatma butonu dinleyicisi
        const restartBtn = document.getElementById('restart-bot-btn');
        restartBtn.addEventListener('click', async () => {
            const confirmed = await showConfirmModal('Botu Yeniden Başlat', 'Botu yeniden başlatmak istediğinize emin misiniz? Bu işlem sırasında panel kısa bir süre erişilemez olabilir.');
            if (confirmed) {
                // Butonu devre dışı bırak ve yükleniyor göster
                restartBtn.disabled = true;
                restartBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Başlatılıyor...';

                try {
                    const result = await api.restartBot();
                    showToast(result.message, 'success');
                    // Başarılı olursa buton kapalı kalsın, çünkü bot kapanıyor.
                } catch (error) {
                    showToast(`Hata: ${error.message}`, 'error');
                    // Hata durumunda butonu eski haline getir
                    restartBtn.disabled = false;
                    restartBtn.innerHTML = '<i class="fa-solid fa-power-off"></i> Botu Yeniden Başlat';
                }
            }
        });
    } catch (error) {
        container.innerHTML = `<p style="color: var(--red);">Notlar yüklenemedi: ${error.message}</p>`;
    }
}