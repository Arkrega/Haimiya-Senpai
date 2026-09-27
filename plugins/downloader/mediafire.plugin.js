import axios from "axios";
import * as cheerio from "cheerio";

async function scrapeMediafire(url) {
  try {
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
      },
    });

    const $ = cheerio.load(response.data);
    const downloadLink = $("#downloadButton").attr("href");

    if (!downloadLink) {
      return {
        status: false,
        message: "Download link not found",
      };
    }

    let filename = $(".dl-btn-label").attr("title");
    if (!filename) {
      filename = $(".promo-download-info .filename").text().trim();
    }
    if (!filename && downloadLink) {
      const urlObj = new URL(downloadLink);
      filename = urlObj.pathname.split("/").pop();
      filename = decodeURIComponent(filename);
    }

    let size = "";
    const sizeText = $("a#downloadButton").text();
    const sizeMatch = sizeText.match(/\((.*?)\)/);
    if (sizeMatch && sizeMatch[1]) {
      size = sizeMatch[1];
    } else {
      size = $(".dl-info .details").text().trim();
    }

    return {
      status: true,
      data: {
        source_url: url,
        download_url: downloadLink,
        filename: filename || "Unknown",
        size: size || "Unknown",
      },
    };
  } catch (error) {
    throw new Error(`Gagal mengambil data: ${error.message}`);
  }
}

export default {
  name: "Mediafire Downloader",
  command: ["mediafire", "mf"],
  owner_only: false,
  private_only: false,
  group_only: false,
  description: "Scraper untuk mengambil link download dan informasi file dari Mediafire",
  category: "downloader",
  async run(conn, m, { jid, args, usedPrefix, command }) {
    const url = args[0];

    if (!url || !url.includes("mediafire.com")) {
      return await m.reply(
        `⚠️ *Format salah!*\n\n📌 Contoh penggunaan:\n${usedPrefix}${command} https://www.mediafire.com/file/xxx/file`
      );
    }

    await m.react("⏳");

    try {
      const res = await scrapeMediafire(url);

      if (!res.status) {
        await m.react("❌");
        return await m.reply(`❌ Gagal: ${res.message}`);
      }

      const { filename, size, download_url } = res.data;

      const caption =
        `📄 *MEDIAFIRE DOWNLOADER*\n\n` +
        `📛 *Nama File:* ${filename}\n` +
        `📦 *Ukuran:* ${size}\n\n` +
        `⏳ *Sedang mengirim file, mohon tunggu...*`;

      await m.reply(caption);

      await conn.sendMessage(
        jid,
        {
          document: { url: download_url },
          fileName: filename,
          mimetype: "application/octet-stream",
          caption: `✅ Berhasil mengunduh: ${filename}`,
        },
        { quoted: m }
      );

      await m.react("✅");
    } catch (err) {
      console.error(err);
      await m.react("❌");
      await m.reply(`❌ Terjadi kesalahan: ${err.message}`);
    }
  },
};