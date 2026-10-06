import { search } from "../../scrape/ytsearch.js";
import { Button } from "../../utils/MessageBuilderV4.7.js";

export default {
  name: "YouTube Search",
  command: ["yts", "ytsearch", "play"],
  category: "tools",
  owner_only: false,
  private_only: false,
  group_only: false,
  description: "Mencari video di YouTube",
  async run(conn, m, { jid, args, usedPrefix, command }) {
    const query = args.join(" ");
    if (!query) {
      return await m.reply(`Masukkan kata kunci!\nContoh: ${usedPrefix}${command} tutorial nodejs`);
    }

    await m.react("⏳");
    try {
      const res = await search(query);
      const videos = res.results.slice(0, 5);

      if (!videos.length) {
        await m.react("❌");
        return await m.reply("Video tidak ditemukan.");
      }

      let text = `🔍 *HASIL PENCARIAN YOUTUBE*\n\nKata Kunci: *${query}*\n\n`;
      const builder = new Button(conn);

      videos.forEach((v, i) => {
        text += `*${i + 1}. ${v.title}*\n`;
        text += `👤 Channel: ${v.channel.name}\n`;
        text += `⏱️ Durasi: ${v.duration || "Unknown"}\n`;
        text += `👁️ Views: ${v.views || "Unknown"}\n`;
        text += `🔗 Link: ${v.url}\n\n`;

        builder.addReply(`🎵 Audio ${i + 1}`, `${usedPrefix}ytdl ${v.url} audio`);
        builder.addReply(`🎬 Video ${i + 1}`, `${usedPrefix}ytdl ${v.url} video`);
      });

      builder.setBody(text.trim());
      builder.setImage(videos[0].thumbnail);

      await builder.send(jid, { quoted: m });
      await m.react("✅");
    } catch (err) {
      await m.react("❌");
      await m.reply(`Gagal mencari video:\n> ${err.message}`);
    }
  }
};