const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kayit')
        .setDescription('Bir üyeyi sunucuya kaydeder.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
        .addSubcommand(subcommand =>
            subcommand
                .setName('yap')
                .setDescription('Bir üyeyi sunucuya kaydeder.')
                .addUserOption(option =>
                    option.setName('kullanici')
                        .setDescription('Kaydedilecek üye.')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('isim')
                        .setDescription('Üyenin yeni ismi.')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('yas')
                        .setDescription('Üyenin yaşı.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('Yetkililerin kayıt istatistiklerini gösterir.')
                .addUserOption(option =>
                    option.setName('kullanici')
                        .setDescription('Belirli bir yetkilinin istatistiklerini gör.')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats-sifirla')
                .setDescription('Kayıt istatistiklerini sıfırlar (Sadece Yönetici).')
                .addUserOption(option =>
                    option.setName('kullanici')
                        .setDescription('Sadece belirtilen yetkilinin istatistiklerini sıfırla.')
                        .setRequired(false))),

    async execute(interaction, serverSettings, db) {
        const settings = serverSettings[interaction.guild.id]?.register;
        const subcommand = interaction.options.getSubcommand();

        // Yetki kontrolü
        if (!settings || !settings.enabled) {
            return interaction.reply({ content: '❌ Kayıt sistemi bu sunucuda aktif değil.', flags: MessageFlags.Ephemeral });
        }

        if (subcommand === 'stats') {
            await this.executeStats(interaction, settings, db.registerStats);
        } else if (subcommand === 'yap') {
            await this.executeRegister(interaction, settings, db);
        } else if (subcommand === 'stats-sifirla') {
            await this.executeResetStats(interaction, settings, db);
        }
    },

    async executeStats(interaction, settings, registerStats) {
        if (!settings || !settings.enabled) {
            return interaction.reply({ content: '❌ Kayıt sistemi bu sunucuda aktif değil.', flags: MessageFlags.Ephemeral });
        }

        const guildStats = registerStats[interaction.guild.id];
        const targetUser = interaction.options.getUser('kullanici');

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTimestamp();

        if (targetUser) {
            // Belirli bir yetkilinin istatistiği
            const count = guildStats?.[targetUser.id] || 0;
            embed
                .setAuthor({ name: `${targetUser.tag} Kayıt İstatistikleri`, iconURL: targetUser.displayAvatarURL() })
                .setDescription(`**${targetUser}** toplam **${count}** kayıt yapmış.`);
        } else {
            // Genel liderlik tablosu
            embed.setTitle(`🏆 ${interaction.guild.name} - Kayıt Liderlik Tablosu`);

            if (!guildStats || Object.keys(guildStats).length === 0) {
                embed.setDescription('Bu sunucuda henüz hiç kayıt yapılmamış.');
            } else {
                const sortedStats = Object.entries(guildStats)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 15); // İlk 15 kişiyi göster

                let description = '';
                for (let i = 0; i < sortedStats.length; i++) {
                    const [userId, count] = sortedStats[i];
                    const user = await interaction.client.users.fetch(userId).catch(() => ({ tag: 'Bilinmeyen Kullanıcı' }));
                    description += `**${i + 1}.** ${user.tag} - \`${count}\` kayıt\n`;
                }
                embed.setDescription(description);
            }
        }

        await interaction.reply({ embeds: [embed] });
    },

    async executeResetStats(interaction, settings, db) {
        // YENİ: Yönetici izni kontrolü
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ Bu komutu sadece yöneticiler kullanabilir.', flags: MessageFlags.Ephemeral });
        }

        const targetUser = interaction.options.getUser('kullanici');
        const guildId = interaction.guild.id;

        const confirmationEmbed = new EmbedBuilder()
            .setColor(0xFFA500) // Turuncu
            .setTitle('⚠️ Onay Gerekli');

        if (targetUser) {
            confirmationEmbed.setDescription(`**${targetUser.tag}** kullanıcısının kayıt istatistiklerini kalıcı olarak sıfırlamak istediğinizden emin misiniz?`);
        } else {
            confirmationEmbed.setDescription(`Bu sunucudaki **TÜM** kayıt istatistiklerini kalıcı olarak sıfırlamak istediğinizden emin misiniz? Bu işlem geri alınamaz.`);
        }

        const confirmButton = new ButtonBuilder()
            .setCustomId('confirm_reset')
            .setLabel('Evet, Sıfırla')
            .setStyle(ButtonStyle.Danger);

        const cancelButton = new ButtonBuilder()
            .setCustomId('cancel_reset')
            .setLabel('Hayır, İptal Et')
            .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

        const reply = await interaction.reply({
            embeds: [confirmationEmbed],
            components: [row],
            flags: MessageFlags.Ephemeral
        });

        const collector = reply.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 15000 // 15 saniye
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: 'Bu butonu sadece komutu kullanan kişi kullanabilir.', flags: MessageFlags.Ephemeral });
            }

            if (i.customId === 'confirm_reset') {
                if (targetUser) {
                    if (db.registerStats[guildId]?.[targetUser.id]) {
                        delete db.registerStats[guildId][targetUser.id];
                    }
                } else {
                    if (db.registerStats[guildId]) {
                        delete db.registerStats[guildId];
                    }
                }
                await db.saveRegisterStatsToFile();
                await i.update({ content: '✅ İstatistikler başarıyla sıfırlandı.', embeds: [], components: [] });
            } else if (i.customId === 'cancel_reset') {
                await i.update({ content: 'İşlem iptal edildi.', embeds: [], components: [] });
            }
            collector.stop();
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                interaction.editReply({ content: 'Onay süresi dolduğu için işlem iptal edildi.', embeds: [], components: [] });
            }
        });
    },


    async executeRegister(interaction, settings, db) {
        // Bu fonksiyonun içeriği, önceki execute fonksiyonunuzun içeriği olacak.
        // Sadece istatistik artırma kodunu ekleyeceğiz.

        // 1. Modül aktif mi?
        if (!settings || !settings.enabled) {
            return interaction.reply({ content: '❌ Kayıt sistemi bu sunucuda aktif değil.', flags: MessageFlags.Ephemeral });
        }

        // 2. Komutu kullanan yetkili mi?
        if (!settings.staffRoleId || !interaction.member.roles.cache.has(settings.staffRoleId)) {
            return interaction.reply({ content: '❌ Bu komutu kullanmak için gerekli yetkiye sahip değilsiniz.', flags: MessageFlags.Ephemeral });
        }

        const memberToRegister = interaction.options.getMember('kullanici');
        const newName = interaction.options.getString('isim');
        const newAge = interaction.options.getInteger('yas');

        if (!memberToRegister) {
            return interaction.reply({ content: '❌ Kaydedilecek üye bulunamadı.', flags: MessageFlags.Ephemeral });
        }

        // Botun rolü, kayıt edilecek üyenin rolünden yüksek olmalı
        if (memberToRegister.roles.highest.position >= interaction.guild.members.me.roles.highest.position) {
            return interaction.reply({ content: '❌ Bu üyenin rolü benim rolümden daha yüksek olduğu için işlem yapamam.', flags: MessageFlags.Ephemeral });
        }

        try {
            // 3. İsim ve Rolleri Güncelle
            const nickname = settings.nicknameTemplate
                .replace('{isim}', newName)
                .replace('{yas}', newAge);

            // YENİ: İstatistikleri artır
            if (settings.statsEnabled) {
                const guildId = interaction.guild.id;
                const staffId = interaction.user.id;
                if (!db.registerStats[guildId]) db.registerStats[guildId] = {};
                db.registerStats[guildId][staffId] = (db.registerStats[guildId][staffId] || 0) + 1;
                await db.saveRegisterStatsToFile();
            }

            await memberToRegister.setNickname(nickname);

            // YENİ: Çoklu rol desteği
            const rolesToAdd = [];
            if (settings.registeredRoleIds && Array.isArray(settings.registeredRoleIds)) {
                rolesToAdd.push(...settings.registeredRoleIds);
            }
            // Geriye dönük uyumluluk (Eski ayar varsa onu da ekle)
            if (settings.registeredRoleId && !rolesToAdd.includes(settings.registeredRoleId)) {
                rolesToAdd.push(settings.registeredRoleId);
            }

            if (rolesToAdd.length > 0) {
                await memberToRegister.roles.add(rolesToAdd);
            }
            if (settings.unregisteredRoleId) {
                await memberToRegister.roles.remove(settings.unregisteredRoleId);
            }

            // 4. Başarı Mesajı
            const successEmbed = new EmbedBuilder()
                .setColor(0x43B581) // Yeşil
                .setAuthor({ name: 'Kayıt Başarılı', iconURL: memberToRegister.user.displayAvatarURL() })
                .setDescription(`${memberToRegister} başarıyla kaydedildi!`)
                .addFields(
                    { name: 'Yeni İsim', value: nickname, inline: true },
                    { name: 'Yetkili', value: interaction.user.toString(), inline: true }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [successEmbed] });

            // 5. YENİ: Kullanıcıya özel mesaj gönder
            if (settings.welcomeMessage) {
                const welcomeDM = settings.welcomeMessage
                    .replace('{user}', memberToRegister.toString())
                    .replace('{server}', interaction.guild.name);

                await memberToRegister.send(welcomeDM).catch(err => {
                    console.log(`[Kayıt] Kullanıcıya DM gönderilemedi (${memberToRegister.user.tag}): ${err.message}`);
                });
            }

            // 5. Log Kanalına Mesaj Gönder
            if (settings.logChannelId) {
                const logChannel = await interaction.guild.channels.fetch(settings.logChannelId).catch(() => null);
                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setColor(0x5865F2)
                        .setTitle('Üye Kaydedildi')
                        .setDescription(`**Yetkili:** ${interaction.user.tag}\n**Kayıt Edilen:** ${memberToRegister.user.tag}\n**Yeni İsim:** ${nickname}`)
                        .setTimestamp();
                    await logChannel.send({ embeds: [logEmbed] });
                }
            }

        } catch (error) {
            console.error('Kayıt hatası:', error);
            await interaction.reply({ content: '❌ Kayıt işlemi sırasında bir hata oluştu. Rol izinlerimi kontrol edin.', flags: MessageFlags.Ephemeral });
        }
    }
};