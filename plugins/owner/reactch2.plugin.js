import { doReactChannel } from "../../scrape/reactch2.js";

export default {
  name: "React Channel v2",
  command: ["rch2", "reactch2"],
  owner_only: true,
  private_only: false,
  group_only: false,
  category: "owner",
  async run(conn, m, { args, usedPrefix, command }) {
    const text = args.join(" ");

    if (!text || !text.includes("|")) {
      return await m.reply(
        `*Format salah!*\n\nCara Penggunaan:\n> ${usedPrefix + command} link | emoji | jumlah | delay | server\n\n*Contoh:*\n> ${usedPrefix + command} https://whatsapp.com/channel/xxx/123 | 🔥,👍 | 5 | 800 | 3\n\n*Note:* Parameter jumlah, delay, dan server bersifat opsional (Default: 1x, 800ms, Server 3).`
      );
    }

    const [link, emojiText, countText, delayText, serverText] = text.split("|").map(v => v?.trim());

    if (!link) return await m.reply("Link channel tidak boleh kosong.");

    const emojis = emojiText || "🔥";
    const jumlah = parseInt(countText) || 1;
    const delayMs = parseInt(delayText) || 800;
    const server = parseInt(serverText) || 3;

    await m.react("⏳");
    await m.reply(`Memproses pengiriman *${jumlah}* react ke channel...\nMohon tunggu sebentar.`);

    try {
      const res = await doReactChannel(link, emojis, jumlah, delayMs, server);

      const resultText = `*REACT CHANNEL v2*\n\n` +
        `🔹 *Status:* ${res.message}\n` +
        `🔹 *Sukses:* ${res.data.success} kali\n` +
        `🔹 *Gagal:* ${res.data.failed} kali\n` +
        `🔹 *Server:* ${res.data.server}\n` +
        `🔹 *Emoji:* ${res.data.emojis.join(", ")}`;

      await m.reply(resultText);
      await m.react("✅");
    } catch (err) {
      await m.react("❌");
      await m.reply(`Terjadi kesalahan:\n${err.message}`);
    }
  }
};