import axios from "axios";

export default {
  name: "Translate",
  command: ["tr", "translate", "terjemah"],
  owner_only: false,
  private_only: false,
  group_only: false,
  description: "Terjemahkan teks ke bahasa lain",
  category: "tools",
  async run(conn, m, { args, quotedText, usedPrefix, command }) {
    let targetLang = "id";
    let textToTranslate = "";

    if (quotedText) {
      targetLang = args[0] ? args[0].toLowerCase() : "id";
      textToTranslate = quotedText;
    } else if (args.length >= 2) {
      targetLang = args[0].toLowerCase();
      textToTranslate = args.slice(1).join(" ").trim();
    } else if (args.length === 1 && args[0]) {
      targetLang = "id";
      textToTranslate = args[0].trim();
    }

    if (!textToTranslate) {
      return await m.reply(`⚠️ Masukkan kode bahasa dan teks atau reply pesan!\nContoh: ${usedPrefix}${command} en Halo selamat pagi\n\nKode bahasa umum: id (Indonesia), en (Inggris), ja (Jepang), ar (Arab), ko (Korea), es (Spanyol)`);
    }

    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(textToTranslate)}`;
      const { data } = await axios.get(url);

      if (!data || !data[0]) {
        return await m.reply("❌ Gagal menerjemahkan teks.");
      }

      const translatedText = data[0].map(item => item[0]).join(" ");
      const detectedLang = data[2] || "auto";

      let resultText = `🌐 *TRANSLATOR BAHASA*\n\n`;
      resultText += `🔤 *Dari:* _${detectedLang.toUpperCase()}_\n`;
      resultText += `🎯 *Ke:* _${targetLang.toUpperCase()}_\n\n`;
      resultText += `📝 *Hasil:* ${translatedText}`;

      await m.reply(resultText.trim());
      await m.react("🌐");
    } catch (e) {
      await m.react("❌");
      await m.reply("Gagal menerjemahkan teks: Kode bahasa tidak valid atau kendala jaringan.");
    }
  }
};