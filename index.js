require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
  PermissionFlagsBits
} = require('discord.js');

const {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState
} = require('@discordjs/voice');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// =======================
// ⚙️ CONFIG
// =======================
const TRIGGER_CHANNEL_ID = "1489151653658759238";
const CATEGORY_ID = "1488141665578520616";
const PANEL_CHANNEL_ID = "1489141959040696351";
const AUTO_VC_ID = "1488854856633680083";

const PANEL_TITLE = "BETLEHEM INTERFACE";
const PANEL_IMAGE = "https://media.discordapp.net/attachments/1487590787284734143/1489196472720167022/image_3.png?ex=69cf89cb&is=69ce384b&hm=3bdad0fab2f2ac7f9a9266a57f34b0fb0d8d6af8d092a520b70ccfe51d3038bc&=&format=webp&quality=lossless";
const LOGO_URL = "https://media.discordapp.net/attachments/1487590787284734143/1492050545219862598/bthl.png";
const FOOTER_TEXT = "Luna • Copyright ©2018 - BTHL";

const EMOJI = {
  name:   { name: "rn",  id: "1489177109711818823" },
  limit:  { name: "lim", id: "1489177299969380404" },
  lock:   { name: "lc",  id: "1489177237277249536" },
  unlock: { name: "op",  id: "1489177192490598430" },
  region: { name: "gl",  id: "1489177019311984660" },
  claim:  { name: "cr",  id: "1489177359318778020" }
};
const e = k => `<:${EMOJI[k].name}:${EMOJI[k].id}>`;

const PANEL_BUTTONS = ['name', 'limit', 'lock', 'unlock', 'region', 'claim'];

// 📺 TIKTOK LIVE ANNOUNCE
const TIKTOK_USERNAME = "ccheryll.a";
const TIKTOK_CHANNEL_ID = process.env.TIKTOK_CHANNEL_ID || "ISI_ID_CHANNEL_DISINI"; // channel tempat announce
const TIKTOK_PING = "";              // contoh: "@everyone" atau "<@&ID_ROLE>" — kosongkan kalau tidak mau ping
const TIKTOK_CHECK_INTERVAL = 60000; // cek tiap 60 detik

// =======================
// 💾 DATA OWNER ROOM
// =======================
const owners = new Map(); // channelId -> userId

// =======================
// 🎨 EMBED
// =======================
function baseEmbed(guild) {
  return new EmbedBuilder()
    .setAuthor({ name: "BETLEHEM HANGOUT", iconURL: LOGO_URL })
    .setFooter({ text: FOOTER_TEXT, iconURL: guild?.iconURL() || undefined })
    .setTimestamp();
}

function successEmbed(title, desc, guild) {
  return baseEmbed(guild)
    .setColor('#00b8b8')
    .setTitle(`✨ ${title}`)
    .setDescription(desc);
}

function errorEmbed(desc, guild) {
  return baseEmbed(guild)
    .setColor('#ED4245')
    .setTitle('⚠️ Gagal')
    .setDescription(desc);
}

const ephem = embed => ({ embeds: [embed], flags: MessageFlags.Ephemeral });

// =======================
// 🔥 AUTO JOIN + AUTO REJOIN VC
// =======================
async function connectToVC() {
  try {
    const vc = await client.channels.fetch(AUTO_VC_ID).catch(() => null);
    if (!vc || vc.type !== ChannelType.GuildVoice) {
      return console.log("❌ VC tidak ditemukan");
    }

    const connection = joinVoiceChannel({
      channelId: vc.id,
      guildId: vc.guild.id,
      adapterCreator: vc.guild.voiceAdapterCreator,
      selfDeaf: false
    });

    console.log("🎤 Auto join VC aktif");

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5000)
        ]);
      } catch {
        console.log("🔄 Bot keluar VC, rejoin...");
        try { connection.destroy(); } catch {}
        setTimeout(connectToVC, 3000);
      }
    });
  } catch (err) {
    console.log("❌ Gagal auto join:", err);
    setTimeout(connectToVC, 5000);
  }
}

// =======================
// 📦 PANEL (TIDAK NYAMPAH)
// =======================
function getPanel(guild) {
  const btn = (id, style = ButtonStyle.Secondary) =>
    new ButtonBuilder().setCustomId(id).setEmoji(EMOJI[id]).setStyle(style);

  const row = new ActionRowBuilder().addComponents(
    btn('name'), btn('limit'), btn('lock'), btn('unlock'), btn('region')
  );
  const row2 = new ActionRowBuilder().addComponents(
    btn('claim', ButtonStyle.Primary)
  );

  const embed = baseEmbed(guild)
    .setColor('#00b8b8')
    .setTitle(PANEL_TITLE)
    .setDescription("Gunakan tombol dibawah untuk mengatur voice anda.")
    .setImage(PANEL_IMAGE);

  return { embeds: [embed], components: [row, row2] };
}

async function sendOrUpdatePanel() {
  const ch = await client.channels.fetch(PANEL_CHANNEL_ID).catch(() => null);
  if (!ch) return console.log("❌ Channel panel tidak ditemukan");

  const recent = await ch.messages.fetch({ limit: 100 }).catch(() => null);
  const panels = recent
    ? [...recent.filter(m =>
        m.author.id === client.user.id &&
        m.embeds[0]?.title === PANEL_TITLE
      ).values()] // urut terbaru dulu
    : [];

  const panelMsg = panels[0] || null;

  for (const m of panels.slice(1)) {
    await m.delete().catch(() => {});
    console.log(`🧹 Hapus panel duplikat ${m.id}`);
  }

  const payload = getPanel(ch.guild);

  if (panelMsg) {
    try {
      await panelMsg.edit(payload);
      console.log("♻️ Panel di-update");
      return;
    } catch {
      console.log("⚠️ Gagal edit panel, kirim ulang");
      await panelMsg.delete().catch(() => {});
    }
  }

  await ch.send(payload);
  console.log("✅ Panel dikirim");
}

// =======================
// 🧹 ROOM HELPER
// =======================
function isTempRoom(channel) {
  return (
    channel &&
    channel.type === ChannelType.GuildVoice &&
    channel.parentId === CATEGORY_ID &&
    channel.id !== TRIGGER_CHANNEL_ID &&
    channel.id !== AUTO_VC_ID
  );
}

async function cleanupEmptyRooms() {
  const category = await client.channels.fetch(CATEGORY_ID).catch(() => null);
  if (!category) return;

  for (const ch of category.children.cache.values()) {
    if (isTempRoom(ch) && ch.members.size === 0) {
      await ch.delete().catch(() => {});
      console.log(`🧹 Hapus room kosong: ${ch.name}`);
    }
  }
}

// =======================
// 🚀 READY
// =======================
client.once('clientReady', async () => {
  console.log(`Login sebagai ${client.user.tag}`);

  setTimeout(connectToVC, 3000);

  try {
    await sendOrUpdatePanel();
  } catch (err) {
    console.log("❌ Error setup panel:", err);
  }

  // room sisa sebelum restart yang sudah kosong
  await cleanupEmptyRooms().catch(() => {});

  // Slash command /tiktoktest (khusus yang punya izin Manage Server)
  for (const guild of client.guilds.cache.values()) {
    await guild.commands.create({
      name: "tiktoktest",
      description: "Kirim test preview announce live TikTok ke channel announce",
      default_member_permissions: PermissionFlagsBits.ManageGuild.toString(),
      dm_permission: false
    }).catch(err => console.log(`⚠️ Gagal daftar /tiktoktest di ${guild.name}:`, err.message));
  }

  // TikTok live announce
  checkTiktokLive();
  setInterval(checkTiktokLive, TIKTOK_CHECK_INTERVAL);
});

// =======================
// 📺 TIKTOK LIVE ANNOUNCE
// =======================
const TIKTOK_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const TIKTOK_LIVE_URL = `https://www.tiktok.com/@${TIKTOK_USERNAME}/live`;

let tiktokAnnounce = null; // { roomId, message, viewers }
let tiktokChecking = false;

// TikTok tidak punya API resmi; ini endpoint yang dipakai web TikTok sendiri.
// status 2 = sedang live, 4 = offline.
async function getTiktokLive() {
  try {
    const res = await fetch(
      `https://www.tiktok.com/api-live/user/room/?aid=1988&sourceType=54&uniqueId=${encodeURIComponent(TIKTOK_USERNAME)}`,
      { headers: { "User-Agent": TIKTOK_UA }, signal: AbortSignal.timeout(15000) }
    );
    const json = await res.json();
    const user = json?.data?.user;
    const room = json?.data?.liveRoom;
    if (!user) return null;

    return {
      live: user.status === 2 || room?.status === 2,
      roomId: user.roomId,
      nickname: user.nickname || TIKTOK_USERNAME,
      avatar: user.avatarThumb || user.avatarMedium,
      avatarLarge: user.avatarLarger || user.avatarMedium || user.avatarThumb,
      title: room?.title || "",
      cover: room?.coverUrl || room?.squareCoverImg || "",
      viewers: room?.liveRoomStats?.userCount ?? 0
    };
  } catch (err) {
    console.log("⚠️ Gagal cek TikTok:", err.message);
    return null;
  }
}

function tiktokPayload(info, ended = false) {
  const embed = new EmbedBuilder()
    .setColor(ended ? 0x4f545c : 0xfe2c55)
    .setAuthor({
      name: info.nickname,
      iconURL: info.avatar || undefined,
      url: `https://www.tiktok.com/@${TIKTOK_USERNAME}`
    })
    .setTitle(info.title || `${info.nickname} sedang live!`)
    // room id ditaruh di URL supaya setelah restart bot tahu live ini sudah diumumkan
    .setURL(`${TIKTOK_LIVE_URL}?room=${info.roomId}`);

  if (ended) {
    embed.setDescription("Live sudah selesai.");
  } else {
    embed.addFields({ name: "Viewers", value: String(info.viewers) });
    if (info.cover) embed.setImage(info.cover);
  }

  const button = new ButtonBuilder()
    .setStyle(ButtonStyle.Link)
    .setLabel("Watch Stream")
    .setURL(TIKTOK_LIVE_URL);

  const content = ended
    ? `**${info.nickname}** was live.`
    : `${TIKTOK_PING ? TIKTOK_PING + " " : ""}**${info.nickname}** is live!`;

  return {
    content,
    embeds: [embed],
    components: ended ? [] : [new ActionRowBuilder().addComponents(button)]
  };
}

// =======================
// 🧪 TEST PREVIEW (/tiktoktest)
// =======================
client.on('interactionCreate', async (i) => {
  if (!i.isChatInputCommand() || i.commandName !== 'tiktoktest') return;

  try {
    await i.deferReply({ flags: MessageFlags.Ephemeral });

    const ch = await client.channels.fetch(TIKTOK_CHANNEL_ID).catch(() => null);
    if (!ch) {
      return i.editReply({ embeds: [errorEmbed(
        '> Channel announce TikTok tidak ditemukan.\n> Cek `TIKTOK_CHANNEL_ID` di config.', i.guild
      )] });
    }

    // Pakai data asli profil TikTok; kalau sedang offline, judul/cover diisi contoh
    const info = await getTiktokLive();
    const nickname = info?.nickname || TIKTOK_USERNAME;
    const preview = {
      nickname,
      avatar: info?.avatar,
      roomId: "test", // bukan room asli → tidak dianggap live sungguhan
      title: info?.live && info.title ? info.title : `Contoh judul live ${nickname} 🔴`,
      cover: info?.live && info.cover ? info.cover : (info?.avatarLarge || ""),
      viewers: info?.live ? info.viewers : 1
    };

    const payload = tiktokPayload(preview);
    payload.content = `🧪 **[TEST]** **${nickname}** is live!`; // tanpa ping
    await ch.send(payload);

    return i.editReply({ embeds: [successEmbed(
      'Test Terkirim',
      `> Preview announce TikTok dikirim ke ${ch}.` +
      (info ? '' : '\n> ⚠️ Data TikTok gagal diambil, preview pakai data contoh.'),
      i.guild
    )] });
  } catch (err) {
    console.log("❌ Error /tiktoktest:", err.message);
    i.editReply({ embeds: [errorEmbed('> Gagal kirim test. Cek izin bot di channel announce.', i.guild)] }).catch(() => {});
  }
});

async function checkTiktokLive() {
  if (tiktokChecking) return;
  tiktokChecking = true;

  try {
    const info = await getTiktokLive();
    if (!info) return;

    const ch = await client.channels.fetch(TIKTOK_CHANNEL_ID).catch(() => null);
    if (!ch) return console.log("❌ Channel announce TikTok tidak ditemukan");

    // ===== SEDANG LIVE =====
    if (info.live) {
      if (tiktokAnnounce?.roomId === info.roomId) {
        // live yang sama → update jumlah viewers saja
        if (tiktokAnnounce.viewers !== info.viewers) {
          tiktokAnnounce.viewers = info.viewers;
          await tiktokAnnounce.message.edit(tiktokPayload(info)).catch(() => {});
        }
        return;
      }

      // habis restart: cek apakah live ini sudah pernah diumumkan
      const recent = await ch.messages.fetch({ limit: 50 }).catch(() => null);
      const existing = recent?.find(m =>
        m.author.id === client.user.id &&
        m.embeds[0]?.url?.includes(`room=${info.roomId}`)
      );

      const message = existing
        ? await existing.edit(tiktokPayload(info)).catch(() => existing)
        : await ch.send(tiktokPayload(info));

      tiktokAnnounce = { roomId: info.roomId, message, viewers: info.viewers };
      if (!existing) console.log(`📺 ${info.nickname} live di TikTok, announce dikirim`);
      return;
    }

    // ===== SELESAI LIVE =====
    if (tiktokAnnounce) {
      await tiktokAnnounce.message
        .edit(tiktokPayload({ ...info, roomId: tiktokAnnounce.roomId }, true))
        .catch(() => {});
      console.log(`📴 ${info.nickname} selesai live`);
      tiktokAnnounce = null;
    }
  } catch (err) {
    console.log("❌ Error TikTok announce:", err.message);
  } finally {
    tiktokChecking = false;
  }
}

// =======================
// 🔊 TEMP VOICE
// =======================
client.on('voiceStateUpdate', async (oldState, newState) => {

  // Masuk trigger → buat room
  if (
    newState.channelId === TRIGGER_CHANNEL_ID &&
    oldState.channelId !== TRIGGER_CHANNEL_ID
  ) {
    try {
      const member = newState.member;
      const vc = await newState.guild.channels.create({
        name: member.displayName,
        type: ChannelType.GuildVoice,
        parent: CATEGORY_ID
      });

      owners.set(vc.id, member.id);
      await newState.setChannel(vc);
    } catch (err) {
      console.log("❌ Gagal buat room:", err.message);
    }
  }

  // Keluar dari room → hapus kalau kosong
  const oldChannel = oldState.channel;
  if (isTempRoom(oldChannel) && oldState.channelId !== newState.channelId) {
    setTimeout(() => {
      if (oldChannel.members.size === 0) {
        owners.delete(oldChannel.id);
        oldChannel.delete().catch(() => {});
      }
    }, 3000);
  }
});

// =======================
// 🎛️ BUTTON
// =======================
client.on('interactionCreate', async (i) => {
  if (!i.isButton()) return;
  if (!PANEL_BUTTONS.includes(i.customId)) return;

  try {
    const vc = i.member.voice.channel;

    if (!vc || !isTempRoom(vc)) {
      return i.reply(ephem(errorEmbed(
        `> Kamu harus berada di voice pribadi dulu.\n> Masuk ke <#${TRIGGER_CHANNEL_ID}> untuk membuat voice.`,
        i.guild
      )));
    }

    const ownerId = owners.get(vc.id);

    // CLAIM: boleh kalau owner tidak ada / sudah keluar dari voice
    if (i.customId === 'claim') {
      if (ownerId === i.user.id) {
        return i.reply(ephem(errorEmbed('> Kamu sudah menjadi owner voice ini.', i.guild)));
      }
      if (ownerId && vc.members.has(ownerId)) {
        return i.reply(ephem(errorEmbed(`> Owner <@${ownerId}> masih ada di voice ini.`, i.guild)));
      }

      owners.set(vc.id, i.user.id);
      return i.reply(ephem(successEmbed(
        'Claim Berhasil',
        `> Sekarang kamu adalah **owner** dari <#${vc.id}> 👑`,
        i.guild
      )));
    }

    // Tombol lain: khusus owner
    if (ownerId !== i.user.id) {
      return i.reply(ephem(errorEmbed(
        ownerId
          ? `> Voice ini milik <@${ownerId}>.`
          : `> Voice ini belum punya owner. Tekan ${e('claim')} **Claim** dulu.`,
        i.guild
      )));
    }

    if (i.customId === 'name') {
      const modal = new ModalBuilder()
        .setCustomId('rename')
        .setTitle('Rename Voice');

      const input = new TextInputBuilder()
        .setCustomId('nameInput')
        .setLabel('Nama Baru')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(100)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return i.showModal(modal);
    }

    if (i.customId === 'limit') {
      const modal = new ModalBuilder()
        .setCustomId('limit')
        .setTitle('Set Limit');

      const input = new TextInputBuilder()
        .setCustomId('limitInput')
        .setLabel('Jumlah User (0 = tanpa batas, maks 99)')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(2)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return i.showModal(modal);
    }

    if (i.customId === 'lock') {
      await vc.permissionOverwrites.edit(i.guild.roles.everyone, { Connect: false });
      return i.reply(ephem(successEmbed('Voice Dikunci', `> ${e('lock')} <#${vc.id}> berhasil **dikunci** 🔒`, i.guild)));
    }

    if (i.customId === 'unlock') {
      await vc.permissionOverwrites.edit(i.guild.roles.everyone, { Connect: true });
      return i.reply(ephem(successEmbed('Voice Dibuka', `> ${e('unlock')} <#${vc.id}> berhasil **dibuka** 🔓`, i.guild)));
    }

    if (i.customId === 'region') {
      const next = vc.rtcRegion === 'singapore' ? null : 'singapore';
      await vc.setRTCRegion(next);
      return i.reply(ephem(successEmbed(
        'Region Diubah',
        `> ${e('region')} Region sekarang: **${next ? 'Singapore' : 'Automatic'}** 🌏`,
        i.guild
      )));
    }
  } catch (err) {
    console.log("❌ Error button:", err.message);
    if (!i.replied && !i.deferred) {
      i.reply(ephem(errorEmbed('> Terjadi kendala, silahkan hubungi **ADMIN** ya.', i.guild))).catch(() => {});
    }
  }
});

// =======================
// 📝 MODAL
// =======================
client.on('interactionCreate', async (i) => {
  if (!i.isModalSubmit()) return;
  if (!['rename', 'limit'].includes(i.customId)) return;

  try {
    const vc = i.member.voice.channel;

    if (!vc || owners.get(vc.id) !== i.user.id) {
      return i.reply(ephem(errorEmbed('> Kamu harus berada di voice milikmu sendiri.', i.guild)));
    }

    if (i.customId === 'rename') {
      const name = i.fields.getTextInputValue('nameInput').trim();
      if (!name) {
        return i.reply(ephem(errorEmbed('> Nama tidak boleh kosong.', i.guild)));
      }

      await vc.setName(name);
      return i.reply(ephem(successEmbed('Nama Diubah', `> ${e('name')} Nama voice sekarang **${name}**`, i.guild)));
    }

    if (i.customId === 'limit') {
      const limit = parseInt(i.fields.getTextInputValue('limitInput'), 10);
      if (isNaN(limit) || limit < 0 || limit > 99) {
        return i.reply(ephem(errorEmbed('> Masukkan angka **0 – 99** ya.', i.guild)));
      }

      await vc.setUserLimit(limit);
      return i.reply(ephem(successEmbed(
        'Limit Diubah',
        `> ${e('limit')} User limit sekarang **${limit === 0 ? 'Tanpa batas' : `${limit} users`}**`,
        i.guild
      )));
    }
  } catch (err) {
    console.log("❌ Error modal:", err.message);
    if (!i.replied && !i.deferred) {
      i.reply(ephem(errorEmbed('> Terjadi kendala, silahkan hubungi **ADMIN** ya.', i.guild))).catch(() => {});
    }
  }
});

// =======================
// 🛡️ ANTI CRASH
// =======================
process.on('unhandledRejection', err => console.log('Unhandled Rejection:', err));
process.on('uncaughtException', err => console.log('Uncaught Exception:', err));

client.login(process.env.TOKEN);
