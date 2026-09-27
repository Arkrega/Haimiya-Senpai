export default {
  name: "Demote",
  command: ["demote"],
  owner_only: false,
  private_only: false,
  group_only: true,
  category: "group",
  async run(conn, m, { jid, args, isAdmin, isBotAdmin, isOwner, quotedSender, mentionedJid }) {
    if (!isAdmin && !isOwner) {
      return await m.reply("Fitur ini hanya untuk admin grup");
    }
    if (!isBotAdmin) {
      return await m.reply("Bot harus menjadi admin terlebih dahulu.");
    }

    let targetJid = quotedSender || (mentionedJid && mentionedJid[0]) || (args[0] ? args[0].replace(/[^0-9]/g, "") + "@s.whatsapp.net" : null);

    if (!targetJid || !targetJid.endsWith("@s.whatsapp.net")) {
      return await m.reply("Tag admin atau balas pesannya yang ingin dicabut jabatannya!\nContoh: .demote @user");
    }

    try {
      await conn.groupParticipantsUpdate(jid, [targetJid], "demote");
      await conn.sendMessage(jid, { text: `🔻 Jabatan Admin *@${targetJid.split("@")[0]}* telah dicabut kembali menjadi anggota biasa.`, mentions: [targetJid] }, { quoted: m });
      await m.react("🔻");
    } catch (e) {
      await m.react("❌");
      await m.reply("Gagal mencabut jabatan Admin anggota.");
    }
  }
};
