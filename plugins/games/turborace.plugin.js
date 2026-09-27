import { BALAP_HTML } from "../../scrape/turbo.js";
import { Button } from "../../utils/MessageBuilderV4.7.js";
import axios from "axios";
import FormData from "form-data";

async function uploadHtmlApp(htmlString, filename) {
    const form = new FormData();
    form.append("file", Buffer.from(htmlString, "utf-8"), {
        filename: filename,
        contentType: "text/html",
    });
    const res = await axios.post("https://cdn.ornzora.eu.cc/upload", form, {
        headers: form.getHeaders()
    });
    return res.data?.url || res.data?.link;
}

let cachedRaceUrl = null;

export default {
    name: "Turbo Race Webview",
    command: ["turborace", "balap"],
    owner_only: false,
    private_only: false,
    group_only: false,
    description: "Mainkan game balap HTML langsung di dalam WhatsApp",
    category: "games",
    async run(conn, m, { jid }) {
        await m.react("⏳");
        try {
            if (!cachedRaceUrl) {
                cachedRaceUrl = await uploadHtmlApp(BALAP_HTML, `turborace-${Date.now()}.html`);
                if (!cachedRaceUrl) throw new Error("Gagal mengunggah source game HTML");
            }

            const btn = new Button(conn)
                .setTitle("🏎️ TURBO RACE 3D")
                .setBody("Game balap interaktif berbasis HTML. Klik tombol di bawah untuk mulai bermain tanpa harus keluar dari WhatsApp!")
                .setFooter("NIXCODE - In-App Webview")
                .addUrl("🎮 Mainkan Sekarang", cachedRaceUrl, true, { icon: "PROMOTION" });
            
            await btn.send(jid, { quoted: m });
            await m.react("✅");

        } catch (e) {
            await m.react("❌");
            await m.reply(`Gagal memuat game:\n${e.message}`);
        }
    }
};