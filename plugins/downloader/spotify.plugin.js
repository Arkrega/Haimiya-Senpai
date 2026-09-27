import { doDownload, spotsaverSearch } from "../../scrape/spotify.js";
import fs from "fs";

export default {
  name: "Spotify Downloader",
  command: ["spotify", "spotifysearch"],
  owner_only: false,
  private_only: false,
  group_only: false,
  description: "Download & Search lagu dari Spotify",
  category: "downloader",
  async run(conn, m, { jid, args, usedPrefix, command }) {
    const query = args.join(" ");
    
    if (!query) {
      return await m.reply(`Masukkan URL atau judul lagu!\nContoh:\n${usedPrefix}spotify melukis senja\n${usedPrefix}spotifysearch melukis senja`);
    }

    await m.react("⏳");

    try {
      if (command === "spotifysearch") {
        const res = await spotsaverSearch(query);
        if (!res || !res.items || res.items.length === 0) {
          await m.react("❌");
          return await m.reply("Lagu tidak ditemukan.");
        }

        let text = `*Hasil Pencarian Spotify: ${query}*\n\n`;
        res.items.slice(0, 5).forEach((v, i) => {
          text += `*${i + 1}. ${v.title}*\n`;
          text += `👤 Artis: ${v.artist}\n`;
          text += `💿 Album: ${v.album}\n`;
          text += `🔗 Link: ${v.spotifyUrl}\n\n`;
        });

        await m.reply(text.trim());
        await m.react("✅");

      } else {
        const res = await doDownload(query);
        
        if (!res || !res.saved || !fs.existsSync(res.saved.path)) {
          await m.react("❌");
          return await m.reply("Gagal mengunduh lagu dari Spotify.");
        }

        await conn.sendMessage(jid, {
          audio: { url: res.saved.path },
          mimetype: "audio/mpeg",
          contextInfo: {
            externalAdReply: {
              title: res.matched.title,
              body: res.matched.artist || "Unknown Artist",
              thumbnailUrl: res.matched.thumbnail || "https://upload.wikimedia.org/wikipedia/commons/2/26/Spotify_logo_with_text.svg",
              mediaType: 1,
              sourceUrl: query.startsWith("http") ? query : "https://spotify.com/"
            }
          }
        }, { quoted: m });

        fs.unlinkSync(res.saved.path);
        await m.react("✅");
      }
    } catch (err) {
      console.error(err);
      await m.react("❌");
      await m.reply(`Terjadi kesalahan sistem:\n${err.message}`);
    }
  }
};