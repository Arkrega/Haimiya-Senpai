import axios from "axios";
import * as cheerio from "cheerio";
import { Button } from "../../utils/MessageBuilderV4.7.js";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

async function searchSongs(query) {
  const url = `https://genius.com/api/search/multi?q=${encodeURIComponent(query)}`;
  try {
    const response = await axios.get(url, { headers: HEADERS, timeout: 10000 });
    if (response.status === 200) {
      const sections = response.data?.response?.sections || [];
      const songs = [];
      const seenIds = new Set();

      for (const section of sections) {
        const hits = section.hits || [];
        for (const hit of hits) {
          const result = hit.result || {};
          const hitType = hit.type;
          const _type = result._type;

          if (hitType === "song" || _type === "song") {
            const songId = result.id;
            if (songId && !seenIds.has(songId)) {
              seenIds.add(songId);
              songs.push({
                title: result.title,
                artist: result.artist_names,
                path: result.path,
                image: result.header_image_url,
                release_date: result.release_date_for_display,
              });
            }
          }
        }
      }
      return songs;
    }
  } catch (error) {
    console.error(error);
  }
  return [];
}

async function getLyrics(songPath) {
  const url = songPath.startsWith("/") ? `https://genius.com${songPath}` : songPath;
  try {
    const response = await axios.get(url, { headers: HEADERS, timeout: 10000 });
    if (response.status === 200) {
      const $ = cheerio.load(response.data);
      const containers = $('div[data-lyrics-container="true"]');
      let lyricsList = [];

      containers.each((i, elem) => {
        const container = $(elem);
        container.find('[data-exclude-from-selection="true"]').remove();
        container.find("br").replaceWith("\n");
        lyricsList.push(container.text());
      });

      return lyricsList.join("\n").trim();
    }
  } catch (error) {
    console.error(error);
  }
  return null;
}

export default {
  name: "Lyrics Search",
  command: ["lirik", "lyrics", "lirikget"],
  owner_only: false,
  private_only: false,
  group_only: false,
  description: "Pencarian dan scraper lirik lagu dari Genius",
  category: "tools",
  async run(conn, m, { jid, args, usedPrefix, command }) {
    if (command === "lirik" || command === "lyrics") {
      const query = args.join(" ");
      if (!query) {
        return await m.reply(`Masukkan judul lagu atau nama penyanyi!\nContoh: ${usedPrefix}${command} sempurna`);
      }

      await m.react("⏳");

      try {
        const songs = await searchSongs(query);
        if (songs.length === 0) {
          await m.react("❌");
          return await m.reply("Lagu tidak ditemukan.");
        }

        const builder = new Button(conn)
          .setTitle("🎵 Hasil Pencarian Lirik")
          .setBody(`Ditemukan beberapa hasil untuk pencarian "${query}". Silakan pilih lagu yang tepat di bawah ini:`)
          .setFooter("Genius Lyrics Scraper")
          .addSelection("Pilih Lagu");

        builder.makeSection("Daftar Lagu", "");

        const displayCount = Math.min(songs.length, 8);
        for (let i = 0; i < displayCount; i++) {
          const s = songs[i];
          builder.makeRow("", s.title, `${s.artist} (${s.release_date || "N/A"})`, `${usedPrefix}lirikget ${s.path}`);
        }

        await builder.send(jid, { quoted: m });
        await m.react("✅");
      } catch (error) {
        console.error(error);
        await m.react("❌");
        await m.reply("Terjadi kesalahan saat mencari lagu.");
      }
    }

    if (command === "lirikget") {
      const pathUrl = args.join(" ");
      if (!pathUrl || !pathUrl.startsWith("/")) {
        return await m.reply("Format salah! Gunakan tombol pilihan dari menu pencarian lirik.");
      }

      await m.react("⏳");

      try {
        const lyrics = await getLyrics(pathUrl);

        if (!lyrics) {
          await m.react("❌");
          return await m.reply("Gagal mengambil lirik untuk lagu ini.");
        }

        const caption = `🎵 *LIRIK LAGU*\n\n📝 *Lirik:*\n${lyrics}`;

        await conn.sendMessage(
          jid,
          { text: caption },
          { quoted: m }
        );

        await m.react("✅");
      } catch (error) {
        console.error(error);
        await m.react("❌");
        await m.reply("Terjadi kesalahan saat mengunduh lirik.");
      }
    }
  },
};