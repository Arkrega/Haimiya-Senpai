export default {
  name: "Get Profile Picture",
  command: ["getpp", "getppuser", "getprofile"],
  owner_only: true,
  private_only: false,
  group_only: false,
  description: "Ambil foto profil pengguna WhatsApp",
  category: "owner",
  async run(conn, m, { jid, args, quotedSender, mentionedJid }) {
    let targetJid = quotedSender || (mentionedJid && mentionedJid[0]) || (args[0] ? args[0].replace(/[^0-9]/g, "") + "@s.whatsapp.net" : null);

    if (!targetJid || !targetJid.endsWith("@s.whatsapp.net")) {
      return await m.reply("⚠️ Tag user, reply pesannya, atau masukkan nomor!\nContoh: .getpp @user");
    }

    try {
      const ppUrl = await conn.profilePictureUrl(targetJid, "image").catch(() => null);
      if (!ppUrl) {
        return await m.reply(`⚠️ *@${targetJid.split("@")[0]}* tidak memiliki foto profil atau foto profilnya di-private.`, { mentions: [targetJid] });
      }

      await conn.sendMessage(jid, {
        image: { url: ppUrl },
        caption: `*GET USER PROFILE PICTURE*\n\n📌 *User:* @${targetJid.split("@")[0]}`,
        mentions: [targetJid]
      }, { quoted: m });

      await m.react("✅");
    } catch (e) {
      await m.react("❌");
      await m.reply("Gagal mengambil foto profil pengguna.");
    }
  }
};