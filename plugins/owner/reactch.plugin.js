import { doReactEdgeone } from "../../scrape/reactch.js";

export default {
  name: "React Channel",
  command: ["rch", "reactch"],
  owner_only: true,
  private_only: false,
  group_only: false,
  category: "owner",
  async run(conn, m, { args, usedPrefix, command }) {
    const text = args.join(" ");

    if (!text || !text.includes("|")) {
      return await m.reply(
        `*Format salah!*\n\nCara Penggunaan:\n> ${usedPrefix + command} link_channel | emoji\n\n*Contoh:*\n> ${usedPrefix + command} https://whatsapp.com/channel/xxx/123 | ✅`
      );
    }

    const [link, emojiText] = text.split("|").map(v => v?.trim());

    if (!link) {
      return await m.reply("Link channel tidak boleh kosong.");
    }
    const emoji = emojiText || "✅";

    await m.react("⏳");
    await m.reply(`Memproses pengiriman react *${emoji}* ke channel...`);

    try {
      const res = await doReactEdgeone(link, emoji);
      
      let resultText = `*REACT CHANNEL v1 (Edgeone)*\n\n`;
      resultText += `🔹 *Status:* ${res.status ? "Sukses" : "Gagal"}\n`;
      resultText += `🔹 *HTTP Status:* ${res.httpStatus || "-"}\n`;
      
      if (res.data) {
         resultText += `🔹 *Respon Server:* ${JSON.stringify(res.data)}`;
      } else if (res.message) {
         resultText += `🔹 *Pesan Error:* ${res.message}`;
      }

      await m.reply(resultText);
      await m.react(res.status ? "✅" : "❌");
    } catch (err) {
      await m.react("❌");
      await m.reply(`Terjadi kesalahan:\n${err.message}`);
    }
  }
};