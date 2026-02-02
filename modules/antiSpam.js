const { PermissionsBitField, EmbedBuilder } = require('discord.js');

const name = 'antiSpam';

function getSettings(settings) {
    return {
        enabled: false,
        blockInvites: true,
        blockLinks: false,
        allowedRoles: [],
        logChannelId: null,
        ...(settings ?? {}),
    };
}

async function onMessage(client, message, serverSettings) {
    if (!message.guild || message.author.bot || !message.content) return;

    const settings = serverSettings[message.guild.id]?.[name];
    if (!settings || !settings.enabled) return;

    // Check for exemptions
    if (message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
        return;
    }
    if (settings.allowedRoles && settings.allowedRoles.some(roleId => message.member.roles.cache.has(roleId))) {
        return;
    }

    const inviteRegex = /(https?:\/\/)?(www\.)?(discord\.(gg|io|me|li)|discordapp\.com\/invite)\/[^\s/]+?(?=\b)/gi;
    const linkRegex = /(https?:\/\/[^\s]+)/g;

    let blocked = false;
    let reason = '';

    // Önce genel linkleri kontrol et
    if (settings.blockLinks && linkRegex.test(message.content)) {
        blocked = true;
        reason = 'Harici link paylaşıldı.';
    }
    // Sonra Discord davetlerini kontrol et (eğer zaten link olarak engellenmediyse)
    if (settings.blockInvites && inviteRegex.test(message.content)) {
        blocked = true;
        reason = 'Discord davet linki paylaşıldı.';
    }

    if (blocked) {
        try {
            await message.delete();
            const warningMsg = await message.channel.send(`${message.author}, bu sunucuda link paylaşmak yasaktır.`);
            setTimeout(() => warningMsg.delete().catch(() => { }), 5000);

            if (settings.logChannelId) {
                const logChannel = await message.guild.channels.fetch(settings.logChannelId).catch(() => null);
                if (logChannel && logChannel.isTextBased()) {
                    const embed = new EmbedBuilder()
                        .setColor(0xf04747) // Red
                        .setTitle('Link Engellendi')
                        .setDescription(`**Kullanıcı:** ${message.author.tag} (${message.author.id})\n**Kanal:** ${message.channel}\n**Sebep:** ${reason}`)
                        .addFields({ name: 'Engellenen Mesaj', value: `\`\`\`${message.content.substring(0, 1000)}\`\`\`` })
                        .setTimestamp();
                    logChannel.send({ embeds: [embed] });
                }
            }
        } catch (error) {
            // 10008: Unknown Message (Mesaj zaten silinmişse loglama yapma)
            if (error.code !== 10008) {
                console.error(`[AntiSpam] Mesaj silinirken hata oluştu (Guild: ${message.guild.id}):`, error);
            }
        }
    }
}

function init(client, settings) {
    // Olay dinleyicileri artık bot.js'deki merkezi onMessageCreate tarafından yönetiliyor.
    // Bu yüzden buradaki client.on() çağrılarına gerek kalmadı.
    console.log('✅ Anti-Spam/Link module initialized.');
}

module.exports = { name, getSettings, init, onMessage };