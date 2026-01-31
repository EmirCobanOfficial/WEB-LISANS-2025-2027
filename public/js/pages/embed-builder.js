// c:\Users\emirc\OneDrive\Desktop\web-panelli-lisans\web-panelli-discord-bot\public\js\pages\embed-builder.js

import { api } from '../api.js';
import { state } from '../state.js';
import { showToast } from '../ui.js';

export function initEmbedBuilderPage() {
    const container = document.getElementById('embed-builder-page');
    if (!container) return;

    // Kanal listesini ve şablonları her açılışta yenile
    refreshChannelList();
    loadTemplatesToSelect();

    // Eğer sayfa zaten başlatıldıysa olay dinleyicilerini tekrar ekleme
    if (container.dataset.initialized === 'true') {
        return;
    }
    container.dataset.initialized = 'true';

    // ... Olay dinleyicileri aşağıda devam ediyor ...
    setupEventListeners(container);
    
    // Sayfa yüklendiğinde ilk önizlemeyi oluştur
    updatePreview();

    // Eğer düzenleme modundaysak (Zamanlanmış Görev) verileri yükle
    checkEditScheduledTaskMode();
}

function refreshChannelList() {
    const channelSelect = document.getElementById('channel-select');
    if (channelSelect && state.guildData && state.guildData.channels) {
        channelSelect.innerHTML = '<option value="">Kanal Seçin...</option>';
        // Sadece metin (0) ve duyuru (5) kanallarını filtrele
        const textChannels = state.guildData.channels
            .filter(c => c.type === 0 || c.type === 5)
            .sort((a, b) => a.name.localeCompare(b.name));
            
        textChannels.forEach(channel => {
            const option = document.createElement('option');
            option.value = channel.id;
            option.textContent = `#${channel.name}`;
            channelSelect.appendChild(option);
        });
    }
}

function setupEventListeners(container) {
    // Canlı Önizleme için Olay Dinleyicileri
    const inputs = container.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
        input.addEventListener('input', updatePreview);
    });

    // Dosya inputları için önizleme dinleyicileri
    document.getElementById('embed-thumbnail-file')?.addEventListener('change', (e) => handleFilePreview(e, '.embed-thumbnail'));
    document.getElementById('embed-image-file')?.addEventListener('change', (e) => handleFilePreview(e, '.embed-image'));

    // Renk seçici özel dinleyici
    const colorInput = document.getElementById('embed-color');
    if (colorInput) {
        colorInput.addEventListener('input', (e) => {
            document.querySelector('.discord-embed').style.borderLeftColor = e.target.value;
        });
    }

    // Renk paleti dinleyicileri
    document.querySelectorAll('.color-swatch').forEach(swatch => {
        swatch.addEventListener('click', (e) => {
            const color = e.target.dataset.color;
            const colorInput = document.getElementById('embed-color');
            if (colorInput) {
                colorInput.value = color;
                colorInput.dispatchEvent(new Event('input')); // Önizlemeyi güncelle
            }
        });
    });

    // Alan Ekleme Butonu
    document.getElementById('add-field-btn')?.addEventListener('click', addField);

    // Buton Ekleme Butonu
    document.getElementById('add-button-btn')?.addEventListener('click', addButton);

    // Şablonları Yönet Butonu
    document.getElementById('manage-templates-btn')?.addEventListener('click', openManageTemplatesModal);

    // Şablon Yükle Butonu
    document.getElementById('load-template-btn')?.addEventListener('click', loadSelectedTemplate);

    // Şablon Kaydet Butonu
    document.getElementById('save-template-btn')?.addEventListener('click', saveCurrentAsTemplate);

    // Şablon Sil Butonu (Select kutusundan seçili olanı siler)
    document.getElementById('delete-template-btn')?.addEventListener('click', deleteSelectedTemplate);

    // Temizle Butonu
    document.getElementById('clear-preview-btn')?.addEventListener('click', clearEmbedBuilder);

    // Kopyala Butonu
    document.getElementById('copy-to-channel-btn')?.addEventListener('click', copyEmbedToChannel);

    // JSON İşlemleri
    document.getElementById('import-json-btn')?.addEventListener('click', importJson);
    document.getElementById('export-json-btn')?.addEventListener('click', exportJson);

    // Webhook/Kanal Geçişi
    document.getElementById('send-method-select')?.addEventListener('change', (e) => {
        const isWebhook = e.target.value === 'webhook';
        document.getElementById('channel-select-group').style.display = isWebhook ? 'none' : 'block';
        document.getElementById('webhook-url-group').style.display = isWebhook ? 'block' : 'none';
    });

    // Tekrar Sıklığı Değişimi (Gün seçimi için)
    document.getElementById('schedule-recurrence')?.addEventListener('change', (e) => {
        const isSpecificDays = e.target.value === 'specific_days';
        document.getElementById('recurrence-days-group').style.display = isSpecificDays ? 'block' : 'none';
    });

    // YENİ: Düzenleme Modu Kontrolleri
    const editToggle = document.getElementById('edit-mode-toggle');
    const editInputs = document.getElementById('edit-mode-inputs');
    const fetchBtn = document.getElementById('fetch-message-btn');

    if (editToggle) {
        editToggle.addEventListener('change', (e) => {
            editInputs.style.display = e.target.checked ? 'flex' : 'none';
            document.getElementById('send-embed-btn').innerHTML = e.target.checked ? '<i class="fa-solid fa-pen"></i> Güncelle' : '<i class="fa-solid fa-paper-plane"></i> Gönder';
        });
    }

    if (fetchBtn) {
        fetchBtn.addEventListener('click', fetchMessageToEdit);
    }

    // Etiketleme Seçimi
    const mentionTypeSelect = document.getElementById('mention-type-select');
    const mentionRoleSelect = document.getElementById('mention-role-select');
    const mentionUserInput = document.getElementById('mention-user-input');

    if (mentionTypeSelect) {
        mentionTypeSelect.addEventListener('change', (e) => {
            const type = e.target.value;
            mentionRoleSelect.style.display = type === 'role' ? 'block' : 'none';
            mentionUserInput.style.display = type === 'user' ? 'block' : 'none';
        });

        // Rolleri doldur (Eğer varsa)
        if (state.guildData && state.guildData.roles) {
            mentionRoleSelect.innerHTML = '<option value="">Rol Seçin...</option>';
            state.guildData.roles.forEach(role => {
                if (role.name !== '@everyone') {
                    mentionRoleSelect.add(new Option(role.name, role.id));
                }
            });
        }
    }

    // Gönder Butonu
    document.getElementById('send-embed-btn')?.addEventListener('click', sendEmbed);
    
    // Sayfa yüklendiğinde ilk önizlemeyi oluştur
    updatePreview();

    // Eğer düzenleme modundaysak (Zamanlanmış Görev) verileri yükle
    checkEditScheduledTaskMode();

    // Şablon modalı kapatma
    document.getElementById('manage-templates-close')?.addEventListener('click', () => {
        document.getElementById('manage-templates-modal').style.display = 'none';
    });
}

function updatePreview() {
    // Değerleri al
    const content = document.getElementById('message-content').value;
    const authorName = document.getElementById('embed-author-name').value;
    const authorIcon = document.getElementById('embed-author-icon').value;
    const title = document.getElementById('embed-title').value;
    const description = document.getElementById('embed-description').value;
    const color = document.getElementById('embed-color').value;
    const image = document.getElementById('embed-image').value;
    const thumbnail = document.getElementById('embed-thumbnail').value;
    const footerText = document.getElementById('embed-footer-text').value;
    const footerIcon = document.getElementById('embed-footer-icon').value;
    const timestamp = document.getElementById('embed-timestamp').checked;

    // DOM Güncelleme
    const messageBody = document.querySelector('.discord-message-body');
    if (messageBody) {
        messageBody.textContent = content;
        messageBody.style.display = content ? 'block' : 'none';
    }
    
    const embedEl = document.querySelector('.discord-embed');
    if (embedEl) embedEl.style.borderLeftColor = color;

    // Yazar (Author)
    const authorEl = document.querySelector('.embed-author');
    authorEl.style.display = authorName ? 'flex' : 'none';
    authorEl.querySelector('span').textContent = authorName;
    const authorImg = authorEl.querySelector('img');
    if (authorIcon) {
        authorImg.src = authorIcon;
        authorImg.style.display = 'block';
    } else {
        authorImg.style.display = 'none';
    }

    // Başlık ve Açıklama
    const titleEl = document.querySelector('.embed-title');
    titleEl.textContent = title;
    titleEl.style.display = title ? 'block' : 'none';

    const descEl = document.querySelector('.embed-description');
    descEl.textContent = description;
    descEl.style.display = description ? 'block' : 'none';

    // Resimler
    // Not: Dosya seçildiyse handleFilePreview zaten src'yi ayarlamıştır, burası URL inputunu kontrol eder.
    const mainImg = document.querySelector('.embed-image');
    const mainImgFile = document.getElementById('embed-image-file')?.files[0];
    if (image && !mainImgFile) {
        mainImg.src = image;
        mainImg.style.display = 'block';
    } else if (!mainImgFile) {
        mainImg.style.display = 'none';
    }

    const thumbImg = document.querySelector('.embed-thumbnail');
    const thumbImgFile = document.getElementById('embed-thumbnail-file')?.files[0];
    if (thumbnail && !thumbImgFile) {
        thumbImg.src = thumbnail;
        thumbImg.style.display = 'block';
    } else if (!thumbImgFile) {
        thumbImg.style.display = 'none';
    }

    // Alanlar (Fields)
    const fieldsContainer = document.querySelector('.embed-fields');
    if (fieldsContainer) {
        fieldsContainer.innerHTML = '';
    const fieldInputs = document.querySelectorAll('.field-item');
    
    if (fieldInputs.length > 0) {
        fieldsContainer.style.display = 'grid';
        let hasInline = false;

        fieldInputs.forEach(field => {
            const name = field.querySelector('.field-name-input').value;
            const value = field.querySelector('.field-value-input').value;
            const inline = field.querySelector('.field-inline-input').checked;
            if (inline) hasInline = true;

            if (name || value) {
                const fieldEl = document.createElement('div');
                fieldEl.className = `embed-field ${inline ? 'inline' : ''}`;
                fieldEl.innerHTML = `
                    <div class="embed-field-name">${name || '\u200b'}</div>
                    <div class="embed-field-value">${value || '\u200b'}</div>
                `;
                fieldsContainer.appendChild(fieldEl);
            }
        });

        if (hasInline) fieldsContainer.classList.add('has-inline');
        else fieldsContainer.classList.remove('has-inline');

    } else {
        fieldsContainer.style.display = 'none';
    }
    }

    // Alt Bilgi (Footer)
    const footerEl = document.querySelector('.embed-footer');
    const footerTextEl = footerEl.querySelector('span');
    const footerImg = footerEl.querySelector('img');
    
    let footerContent = footerText;
    if (timestamp) {
        const date = new Date().toLocaleDateString('tr-TR');
        footerContent = footerContent ? `${footerContent} • ${date}` : `Bugün saat ${new Date().toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})}`;
    }
    
    footerTextEl.textContent = footerContent;
    footerEl.style.display = footerContent ? 'flex' : 'none';
    
    if (footerIcon) {
        footerImg.src = footerIcon;
        footerImg.style.display = 'block';
    } else {
        footerImg.style.display = 'none';
    }

    // Butonlar (Components)
    const buttonsContainer = document.querySelector('.discord-buttons');
    if (buttonsContainer) {
        buttonsContainer.innerHTML = '';
    const buttonInputs = document.querySelectorAll('.button-item');
    
    if (buttonInputs.length > 0) {
        buttonsContainer.style.display = 'flex';
        buttonsContainer.style.flexWrap = 'wrap';
        buttonsContainer.style.gap = '10px';

        buttonInputs.forEach(btn => {
            const label = btn.querySelector('.button-label-input').value;
            const style = btn.querySelector('.button-style-input').value;
            const url = btn.querySelector('.button-url-input').value;
            
            if (label) {
                const btnEl = document.createElement('a');
                btnEl.className = `discord-button button-style-${style.toLowerCase()}`;
                btnEl.textContent = label;
                if (style === 'Link' && url) btnEl.href = url;
                buttonsContainer.appendChild(btnEl);
            }
        });
    } else {
        buttonsContainer.style.display = 'none';
    }
    }

    // Eğer embed boşsa gizle (sadece düz mesaj varsa)
    if (embedEl) {
        if (!authorName && !title && !description && !image && !thumbnail && document.querySelectorAll('.field-item').length === 0 && !footerContent) {
            embedEl.style.display = 'none';
        } else {
            embedEl.style.display = 'grid';
        }
    }
}

// YENİ: Dosya önizleme fonksiyonu
function handleFilePreview(event, selector) {
    const file = event.target.files[0];
    const imgEl = document.querySelector(selector);
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            imgEl.src = e.target.result;
            imgEl.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
}

function addField() {
    const container = document.getElementById('fields-container');
    const fieldId = Date.now();
    
    const fieldHTML = `
        <div class="builder-section field-item" id="field-${fieldId}" style="border-left: 3px solid var(--brand-color);">
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px; align-items: center;">
                <h4 style="margin:0; font-size: 0.9em;">Yeni Alan</h4>
                <button class="remove-item-btn danger" style="background:none; border:none; color:var(--red); cursor:pointer;" onclick="this.closest('.field-item').remove(); document.getElementById('embed-builder-page').dispatchEvent(new Event('input', {bubbles:true}));">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
            <div class="form-group">
                <input type="text" class="setting-input field-name-input" placeholder="Alan Başlığı">
            </div>
            <div class="form-group">
                <textarea class="setting-input field-value-input" rows="2" placeholder="Alan İçeriği"></textarea>
            </div>
            <div class="form-group-checkbox">
                <input type="checkbox" class="field-inline-input">
                <label>Yan Yana (Inline)</label>
            </div>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', fieldHTML);
    
    // Yeni eklenen elemanlara olay dinleyicisi ekle
    const newField = container.lastElementChild;
    newField.querySelectorAll('input, textarea').forEach(el => {
        el.addEventListener('input', updatePreview);
    });
    updatePreview();
}

function addButton() {
    const container = document.getElementById('buttons-container');
    if (container.children.length >= 5) return showToast('En fazla 5 buton ekleyebilirsiniz.', 'warning');

    const btnId = Date.now();
    const btnHTML = `
        <div class="builder-section button-item" id="btn-${btnId}" style="border-left: 3px solid var(--green);">
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px; align-items: center;">
                <h4 style="margin:0; font-size: 0.9em;">Buton</h4>
                <button class="remove-item-btn danger" style="background:none; border:none; color:var(--red); cursor:pointer;" onclick="this.closest('.button-item').remove(); document.getElementById('embed-builder-page').dispatchEvent(new Event('input', {bubbles:true}));">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
            <div class="form-group">
                <input type="text" class="setting-input button-label-input" placeholder="Buton Yazısı">
            </div>
            <div class="form-group">
                <select class="setting-select button-style-input">
                    <option value="Link">Link (URL)</option>
                    <option value="Primary">Mavi (Blurple)</option>
                    <option value="Secondary">Gri (Grey)</option>
                    <option value="Success">Yeşil (Green)</option>
                    <option value="Danger">Kırmızı (Red)</option>
                </select>
            </div>
            <div class="form-group">
                <input type="text" class="setting-input button-url-input" placeholder="URL (Sadece Link stili için)">
            </div>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', btnHTML);

    const newBtn = container.lastElementChild;
    newBtn.querySelectorAll('input, select').forEach(el => {
        el.addEventListener('input', updatePreview);
    });
    updatePreview();
}

function getEmbedDataFromForm() {
    const data = {
        content: document.getElementById('message-content').value,
        embed: {
            title: document.getElementById('embed-title').value,
            description: document.getElementById('embed-description').value,
            color: document.getElementById('embed-color').value,
            author: {
                name: document.getElementById('embed-author-name').value,
                icon_url: document.getElementById('embed-author-icon').value
            },
            thumbnail: { url: document.getElementById('embed-thumbnail').value },
            image: { url: document.getElementById('embed-image').value },
            footer: {
                text: document.getElementById('embed-footer-text').value,
                icon_url: document.getElementById('embed-footer-icon').value
            },
            timestamp: document.getElementById('embed-timestamp').checked,
            fields: []
        },
        buttons: []
    };

    document.querySelectorAll('.field-item').forEach(field => {
        const name = field.querySelector('.field-name-input').value;
        const value = field.querySelector('.field-value-input').value;
        if (name || value) {
            data.embed.fields.push({
                name: name,
                value: value,
                inline: field.querySelector('.field-inline-input').checked
            });
        }
    });

    document.querySelectorAll('.button-item').forEach(btn => {
        const label = btn.querySelector('.button-label-input').value;
        if (label) {
            data.buttons.push({
                label: label,
                style: btn.querySelector('.button-style-input').value,
                url: btn.querySelector('.button-url-input').value
            });
        }
    });

    return data;
}

function exportJson() {
    const data = getEmbedDataFromForm();
    const jsonString = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(jsonString).then(() => {
        showToast('JSON panoya kopyalandı!', 'success');
    }).catch(err => {
        console.error('Kopyalama hatası:', err);
        prompt("JSON Kodu (Kopyalamak için Ctrl+C):", jsonString);
    });
}

function importJson() {
    const jsonString = prompt("Lütfen JSON kodunu buraya yapıştırın:");
    if (!jsonString) return;

    try {
        const data = JSON.parse(jsonString);
        
        document.getElementById('message-content').value = data.content || '';
        if (data.embed) {
            document.getElementById('embed-title').value = data.embed.title || '';
            document.getElementById('embed-description').value = data.embed.description || '';
            document.getElementById('embed-color').value = data.embed.color || '#5865F2';
            document.getElementById('embed-author-name').value = data.embed.author?.name || '';
            document.getElementById('embed-author-icon').value = data.embed.author?.icon_url || '';
            document.getElementById('embed-thumbnail').value = data.embed.thumbnail?.url || '';
            document.getElementById('embed-image').value = data.embed.image?.url || '';
            document.getElementById('embed-footer-text').value = data.embed.footer?.text || '';
            document.getElementById('embed-footer-icon').value = data.embed.footer?.icon_url || '';
            document.getElementById('embed-timestamp').checked = !!data.embed.timestamp;

            document.getElementById('fields-container').innerHTML = '';
            if (data.embed.fields) {
                data.embed.fields.forEach(field => {
                    addField();
                    const lastField = document.getElementById('fields-container').lastElementChild;
                    lastField.querySelector('.field-name-input').value = field.name || '';
                    lastField.querySelector('.field-value-input').value = field.value || '';
                    lastField.querySelector('.field-inline-input').checked = !!field.inline;
                });
            }
        }

        document.getElementById('buttons-container').innerHTML = '';
        if (data.buttons) {
            data.buttons.forEach(btn => {
                addButton();
                const lastBtn = document.getElementById('buttons-container').lastElementChild;
                lastBtn.querySelector('.button-label-input').value = btn.label || '';
                lastBtn.querySelector('.button-style-input').value = btn.style || 'Link';
                lastBtn.querySelector('.button-url-input').value = btn.url || '';
            });
        }

        updatePreview();
        showToast('JSON başarıyla içe aktarıldı.', 'success');
    } catch (e) {
        showToast('Geçersiz JSON formatı!', 'error');
    }
}

// YENİ: Mesajı Getir ve Formu Doldur
async function fetchMessageToEdit() {
    const channelId = document.getElementById('channel-select').value;
    const messageId = document.getElementById('edit-message-id').value.trim();

    if (!channelId) return showToast('Lütfen önce mesajın bulunduğu kanalı seçin.', 'warning');
    if (!messageId) return showToast('Lütfen bir Mesaj ID girin.', 'warning');

    const btn = document.getElementById('fetch-message-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
        const data = await api.getMessage(state.selectedGuildId, channelId, messageId);
        
        // Formu Doldur
        document.getElementById('message-content').value = data.content || '';
        
        if (data.embeds && data.embeds.length > 0) {
            const embed = data.embeds[0];
            document.getElementById('embed-title').value = embed.title || '';
            document.getElementById('embed-description').value = embed.description || '';
            document.getElementById('embed-color').value = embed.color ? '#' + embed.color.toString(16).padStart(6, '0') : '#5865F2';
            document.getElementById('embed-author-name').value = embed.author?.name || '';
            document.getElementById('embed-author-icon').value = embed.author?.iconURL || '';
            document.getElementById('embed-thumbnail').value = embed.thumbnail?.url || '';
            document.getElementById('embed-image').value = embed.image?.url || '';
            document.getElementById('embed-footer-text').value = embed.footer?.text || '';
            document.getElementById('embed-footer-icon').value = embed.footer?.iconURL || '';
            document.getElementById('embed-timestamp').checked = !!embed.timestamp;

            // Alanları temizle ve yeniden oluştur
            document.getElementById('fields-container').innerHTML = '';
            if (embed.fields) {
                embed.fields.forEach(field => {
                    addField();
                    const lastField = document.getElementById('fields-container').lastElementChild;
                    lastField.querySelector('.field-name-input').value = field.name || '';
                    lastField.querySelector('.field-value-input').value = field.value || '';
                    lastField.querySelector('.field-inline-input').checked = field.inline;
                });
            }
        }

        // Butonları temizle (Şimdilik butonları geri yüklemiyoruz, karmaşık olabilir)
        document.getElementById('buttons-container').innerHTML = '';

        updatePreview();
        showToast('Mesaj başarıyla getirildi.', 'success');
    } catch (error) {
        showToast(`Hata: ${error.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Getir';
    }
}

// YENİ: Şablon Yönetim Modalı
async function openManageTemplatesModal() {
    const modal = document.getElementById('manage-templates-modal');
    const container = document.getElementById('templates-list-container');
    if (!modal || !container) return;

    container.innerHTML = '<p style="text-align:center;">Yükleniyor...</p>';
    modal.style.display = 'flex';

    try {
        const templates = await api.getEmbedTemplates(state.selectedGuildId);
        container.innerHTML = '';

        if (Object.keys(templates).length === 0) {
            container.innerHTML = '<p style="text-align:center;">Kayıtlı şablon yok.</p>';
            return;
        }

        Object.keys(templates).forEach(name => {
            const item = document.createElement('div');
            item.className = 'list-item';
            item.innerHTML = `
                <span class="list-item-label">${name}</span>
                <div class="list-item-actions">
                    <button class="remove-item-btn delete-template-btn" data-name="${name}" title="Sil">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `;
            container.appendChild(item);
        });

        // Silme butonları için olay dinleyicisi
        container.querySelectorAll('.delete-template-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const name = e.currentTarget.dataset.name;
                if (confirm(`${name} şablonunu silmek istediğinize emin misiniz?`)) {
                    try {
                        await api.deleteEmbedTemplate(state.selectedGuildId, name);
                        showToast('Şablon silindi.', 'success');
                        openManageTemplatesModal(); // Listeyi yenile
                        // Ana sayfadaki select kutusunu yenilemek için loadTemplates fonksiyonunu çağırıyoruz
                        // (Bu fonksiyonun daha önce tanımlandığını varsayıyoruz, eğer yoksa eklenmelidir)
                        if (typeof loadTemplates === 'function') loadTemplates();
                    } catch (err) {
                        showToast(`Hata: ${err.message}`, 'error');
                    }
                }
            });
        });

    } catch (error) {
        container.innerHTML = `<p style="color:var(--red);">Hata: ${error.message}</p>`;
    }
}

// YENİ: Embed Oluşturucuyu Temizle
function clearEmbedBuilder() {
    if (!confirm('Tüm alanları temizlemek ve sıfırdan başlamak istediğinize emin misiniz?')) return;

    // Inputları sıfırla
    const container = document.getElementById('embed-builder-page');
    container.querySelectorAll('input, textarea, select').forEach(input => {
        if (input.type === 'checkbox') {
            input.checked = input.id === 'embed-timestamp'; // Timestamp varsayılan olarak açık olsun
            if (input.closest('.days-selector')) input.checked = false; // Gün seçimlerini temizle
        } else if (input.type === 'color') {
            input.value = '#5865F2';
        } else if (input.type === 'file') {
            input.value = '';
        } else if (input.tagName === 'SELECT') {
            input.selectedIndex = 0;
        } else {
            input.value = '';
        }
    });
    
    // Gün seçim grubunu gizle
    document.getElementById('recurrence-days-group').style.display = 'none';

    // Dinamik alanları temizle
    document.getElementById('fields-container').innerHTML = '';
    document.getElementById('buttons-container').innerHTML = '';

    // Düzenleme modundan çık
    localStorage.removeItem('editScheduledTaskId');
    const editToggle = document.getElementById('edit-mode-toggle');
    if (editToggle) editToggle.checked = false;
    document.getElementById('edit-mode-inputs').style.display = 'none';
    const sendBtn = document.getElementById('send-embed-btn');
    sendBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Gönder';
    delete sendBtn.dataset.editingTaskId;

    updatePreview();
    showToast('Form ve önizleme temizlendi.', 'info');
}

// YENİ: Şablonları Select Kutusuna Yükle
async function loadTemplatesToSelect() {
    const select = document.getElementById('embed-template-select');
    if (!select) return;
    
    try {
        const templates = await api.getEmbedTemplates(state.selectedGuildId);
        select.innerHTML = '<option value="">Şablon Seç...</option>';
        
        if (templates && typeof templates === 'object') {
            Object.keys(templates).forEach(name => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Şablonlar yüklenemedi:', error);
    }
}

// YENİ: Seçili Şablonu Yükle
async function loadSelectedTemplate() {
    const name = document.getElementById('embed-template-select').value;
    if (!name) return showToast('Lütfen bir şablon seçin.', 'warning');

    try {
        const templates = await api.getEmbedTemplates(state.selectedGuildId);
        const data = templates[name];
        
        if (data) {
            // Form alanlarını doldur
            document.getElementById('message-content').value = data.content || '';
            document.getElementById('embed-title').value = data.title || '';
            document.getElementById('embed-description').value = data.description || '';
            document.getElementById('embed-color').value = data.color || '#5865F2';
            document.getElementById('embed-author-name').value = data.authorName || '';
            document.getElementById('embed-author-icon').value = data.authorIcon || '';
            document.getElementById('embed-thumbnail').value = data.thumbnail || '';
            document.getElementById('embed-image').value = data.image || '';
            document.getElementById('embed-footer-text').value = data.footerText || '';
            document.getElementById('embed-footer-icon').value = data.footerIcon || '';
            document.getElementById('embed-timestamp').checked = data.timestamp !== false;

            // Alanları temizle ve yeniden oluştur (Eğer şablonda varsa)
            // Not: Şablon yapısına göre burası özelleştirilebilir.
            // Basitlik için şimdilik sadece temel alanları yüklüyoruz.
            
            updatePreview();
            showToast('Şablon yüklendi.', 'success');
        }
    } catch (error) {
        showToast('Şablon yüklenirken hata oluştu.', 'error');
    }
}

// YENİ: Mevcut Hali Şablon Olarak Kaydet
async function saveCurrentAsTemplate() {
    const name = prompt("Şablon için bir isim girin:");
    if (!name) return;

    const templateData = {
        content: document.getElementById('message-content').value,
        title: document.getElementById('embed-title').value,
        description: document.getElementById('embed-description').value,
        color: document.getElementById('embed-color').value,
        authorName: document.getElementById('embed-author-name').value,
        authorIcon: document.getElementById('embed-author-icon').value,
        thumbnail: document.getElementById('embed-thumbnail').value,
        image: document.getElementById('embed-image').value,
        footerText: document.getElementById('embed-footer-text').value,
        footerIcon: document.getElementById('embed-footer-icon').value,
        timestamp: document.getElementById('embed-timestamp').checked
    };

    try {
        await api.saveEmbedTemplate(state.selectedGuildId, name, templateData);
        showToast('Şablon başarıyla kaydedildi!', 'success');
        loadTemplatesToSelect(); // Listeyi yenile
    } catch (error) {
        showToast('Şablon kaydedilemedi: ' + error.message, 'error');
    }
}

// YENİ: Seçili Şablonu Sil
async function deleteSelectedTemplate() {
    const name = document.getElementById('embed-template-select').value;
    if (!name) return showToast('Silinecek şablonu seçin.', 'warning');

    if (!confirm(`${name} şablonunu silmek istediğinize emin misiniz?`)) return;

    try {
        await api.deleteEmbedTemplate(state.selectedGuildId, name);
        showToast('Şablon silindi.', 'success');
        loadTemplatesToSelect();
    } catch (error) {
        showToast('Silme işlemi başarısız.', 'error');
    }
}

// YENİ: Embed'i Başka Kanala Kopyala
async function copyEmbedToChannel() {
    const channelId = prompt("Mesajın kopyalanacağı Kanal ID'sini girin:");
    if (!channelId) return;
    
    // Basit ID doğrulama
    if (!/^\d{17,19}$/.test(channelId)) {
        return showToast('Geçersiz Kanal ID.', 'error');
    }

    const copyBtn = document.getElementById('copy-to-channel-btn');
    const originalHtml = copyBtn.innerHTML;
    copyBtn.disabled = true;
    copyBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
        const embedData = getEmbedDataFromForm();
        
        // FormData oluştur (Dosya yüklemelerini desteklemek için)
        const formData = new FormData();
        const payload = {
            channelId: channelId,
            webhookUrl: null, // Webhook değil, kanal ID'si kullanıyoruz
            ...embedData
        };
        formData.append('payload_json', JSON.stringify(payload));
        
        const imageFile = document.getElementById('embed-image-file')?.files[0];
        const thumbnailFile = document.getElementById('embed-thumbnail-file')?.files[0];
        if (imageFile) formData.append('imageFile', imageFile);
        if (thumbnailFile) formData.append('thumbnailFile', thumbnailFile);

        await api.postEmbedWithFiles(state.selectedGuildId, formData);
        showToast('Mesaj başarıyla kopyalandı!', 'success');
    } catch (error) {
        showToast(`Kopyalama hatası: ${error.message}`, 'error');
    } finally {
        copyBtn.disabled = false;
        copyBtn.innerHTML = originalHtml;
    }
}

// YENİ: Zamanlanmış Görev Düzenleme Modu Kontrolü
async function checkEditScheduledTaskMode() {
    const editTaskId = localStorage.getItem('editScheduledTaskId');
    if (!editTaskId) return;

    // Modu temizle ki sayfa yenilendiğinde tekrar çalışmasın (isteğe bağlı)
    // localStorage.removeItem('editScheduledTaskId'); 

    const sendBtn = document.getElementById('send-embed-btn');
    sendBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Görev Yükleniyor...';
    sendBtn.disabled = true;

    try {
        const task = await api.getScheduledTask(state.selectedGuildId, editTaskId);
        
        // Formu Doldur
        if (task.channelId) document.getElementById('channel-select').value = task.channelId;
        if (task.webhookUrl) {
            document.getElementById('send-method-select').value = 'webhook';
            document.getElementById('webhook-url').value = task.webhookUrl;
            document.getElementById('send-method-select').dispatchEvent(new Event('change'));
        }
        
        // Tarihi formatla (datetime-local inputu için: YYYY-MM-DDTHH:MM)
        const date = new Date(task.executeAt);
        const dateString = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
        document.getElementById('schedule-time').value = dateString;
        
        if (task.recurrence) {
            document.getElementById('schedule-recurrence').value = task.recurrence;
            document.getElementById('schedule-recurrence').dispatchEvent(new Event('change'));
            
            if (task.recurrence === 'specific_days' && task.selectedDays) {
                const checkboxes = document.querySelectorAll('#recurrence-days-group input[type="checkbox"]');
                checkboxes.forEach(cb => cb.checked = task.selectedDays.includes(parseInt(cb.value)));
            }
        }

        const msg = task.messageData;
        document.getElementById('message-content').value = msg.content || '';

        if (msg.embeds && msg.embeds.length > 0) {
            const embed = msg.embeds[0];
            document.getElementById('embed-title').value = embed.title || '';
            document.getElementById('embed-description').value = embed.description || '';
            document.getElementById('embed-color').value = embed.color ? '#' + embed.color.toString(16).padStart(6, '0') : '#5865F2';
            // ... diğer alanları doldur ...
        }

        // Butonu güncelle
        sendBtn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Görevi Güncelle';
        sendBtn.dataset.editingTaskId = editTaskId; // ID'yi butona kaydet
        sendBtn.disabled = false;

        updatePreview();
        showToast('Zamanlanmış görev düzenleme modundasınız.', 'info');

    } catch (error) {
        showToast(`Görev yüklenemedi: ${error.message}`, 'error');
        sendBtn.innerHTML = 'Hata';
    }
}

async function sendEmbed() {
    const sendMethod = document.getElementById('send-method-select').value;
    const channelId = document.getElementById('channel-select').value;
    const webhookUrl = document.getElementById('webhook-url').value;
    const scheduledTime = document.getElementById('schedule-time').value;
    const recurrence = document.getElementById('schedule-recurrence').value;
    
    let selectedDays = [];
    if (recurrence === 'specific_days') {
        const checkboxes = document.querySelectorAll('#recurrence-days-group input[type="checkbox"]:checked');
        selectedDays = Array.from(checkboxes).map(cb => parseInt(cb.value));
        if (selectedDays.length === 0) return showToast('Lütfen en az bir gün seçin.', 'warning');
    }

    const editingTaskId = document.getElementById('send-embed-btn').dataset.editingTaskId; // Düzenleme ID'si
    
    // YENİ: Düzenleme modu kontrolü
    const isEditMode = document.getElementById('edit-mode-toggle')?.checked;
    const messageId = document.getElementById('edit-message-id')?.value;
    
    // Etiketleme verileri
    const mentionType = document.getElementById('mention-type-select').value;
    const mentionTargetId = mentionType === 'role' ? document.getElementById('mention-role-select').value : 
                           (mentionType === 'user' ? document.getElementById('mention-user-input').value : null);

    if (sendMethod === 'channel' && !channelId) return showToast('Lütfen bir kanal seçin.', 'warning');
    if (sendMethod === 'webhook' && !webhookUrl) return showToast('Lütfen bir Webhook URL girin.', 'warning');

    const sendBtn = document.getElementById('send-embed-btn');
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> İşleniyor...';

    const embedData = getEmbedDataFromForm();
    if (embedData.embed.timestamp) embedData.embed.timestamp = new Date().toISOString();
    else embedData.embed.timestamp = null;

    try {
        // YENİ: Düzenleme Modu Kontrolü
        if (isEditMode && messageId) {
            await api.updateMessage(state.selectedGuildId, channelId, messageId, {
                content: embedData.content,
                embed: embedData.embed,
                buttons: embedData.buttons
            });
            showToast('Mesaj başarıyla güncellendi!', 'success');
        } else {
            // Normal Gönderim
            await api.sendEmbed(state.selectedGuildId, { 
                channelId: sendMethod === 'channel' ? channelId : null,
                webhookUrl: sendMethod === 'webhook' ? webhookUrl : null,
                scheduledTime,
                recurrence,
                selectedDays: recurrence === 'specific_days' ? selectedDays : null,
                mentionType,
                mentionTargetId,
                ...embedData 
            });
            
            if (scheduledTime) {
                showToast('Mesaj başarıyla zamanlandı!', 'success');
            } else {
                showToast('Embed mesajı başarıyla gönderildi!', 'success');
            }
        }
    } catch (error) {
        showToast(`Hata: ${error.message}`, 'error');
    } finally {
        sendBtn.disabled = false;
        sendBtn.innerHTML = isEditMode ? '<i class="fa-solid fa-pen"></i> Güncelle' : '<i class="fa-solid fa-paper-plane"></i> Gönder';
    }
}
