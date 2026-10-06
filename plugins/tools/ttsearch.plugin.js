import { searchVideos } from "../../scrape/tiktoksearch.js";
import { Button } from "../../utils/MessageBuilderV4.7.js";

export default {
  name: "TikTok Search",
  command: ["tts", "ttsearch", "vtsearch", "tiktoksearch"],
  category: "search",
  owner_only: false,
  private_only: false,
  group_only: false,
  description: "Mencari video di TikTok",
  async run(conn, m, { jid, args, usedPrefix, command }) {
    const query = args.join(" ");
    if (!query) {
      return await m.reply(`Masukkan kata kunci!\nContoh: ${usedPrefix}${command} kucing lucu`);
    }

    await m.react("⏳");
    try {
      const res = await searchVideos(query, { limit: 5 });
      
      if (!res.videos || res.videos.length === 0) {
        await m.react("❌");
        return await m.reply("Video TikTok tidak ditemukan.");
      }

      let text = `🔍 *HASIL PENCARIAN TIKTOK*\n\nKata Kunci: *${query}*\n\n`;
      const builder = new Button(conn);

      res.videos.forEach((v, i) => {
        text += `*${i + 1}. ${v.title || "Tanpa Judul"}*\n`;
        text += `👤 Author: ${v.author?.nickname || "Unknown"} (@${v.author?.username || "unknown"})\n`;
        text += `⏱️ Durasi: ${v.duration || 0} detik\n`;
        text += `👁️ Views: ${v.stats?.playCount || 0}\n`;
        text += `❤️ Likes: ${v.stats?.diggCount || 0}\n\n`;

        const videoUrl = `https://www.tiktok.com/@${v.author?.username}/video/${v.id}`;
        builder.addReply(`🎬 Download ${i + 1}`, `${usedPrefix}tt ${videoUrl}`);
      });

      builder.setBody(text.trim());
      builder.setImage(res.videos[0].cover);

      await builder.send(jid, { quoted: m });
      await m.react("✅");
    } catch (err) {
      console.error("[TT SEARCH ERROR]", err);
      await m.react("❌");
      await m.reply(`Gagal mencari video TikTok:\n> ${err.message}`);
    }
  }
};