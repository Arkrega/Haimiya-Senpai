import https from "https";

const getInitialAuth = () => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "id.pinterest.com",
      path: "/",
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"
      }
    };
    https.get(options, res => {
      const cookies = res.headers["set-cookie"];
      if (cookies) {
        const csrfCookie = cookies.find(c => c.startsWith("csrftoken="));
        const pinterestSessCookie = cookies.find(c => c.startsWith("_pinterest_sess="));
        if (csrfCookie && pinterestSessCookie) {
          const csrftoken = csrfCookie.split(";")[0].split("=")[1];
          const sess = pinterestSessCookie.split(";")[0];
          resolve({ csrftoken, cookieHeader: `csrftoken=${csrftoken}; ${sess}` });
          return;
        }
      }
      reject(new Error("Gagal mendapatkan CSRF token atau session cookie."));
    }).on("error", e => reject(e));
  });
};

const searchPinterestAPI = async (query, limit) => {
  const { csrftoken, cookieHeader } = await getInitialAuth();
  let results = [];
  let bookmark = null;
  let keepFetching = true;
  const fetchTarget = Math.max(limit * 3, 50);

  while (keepFetching && results.length < fetchTarget) {
    const postData = {
      options: {
        query: query,
        scope: "pins",
        bookmarks: bookmark ? [bookmark] : []
      },
      context: {}
    };
    const sourceUrl = `/search/pins/?q=${encodeURIComponent(query)}`;
    const dataString = `source_url=${encodeURIComponent(sourceUrl)}&data=${encodeURIComponent(JSON.stringify(postData))}`;
    const options = {
      hostname: "id.pinterest.com",
      path: "/resource/BaseSearchResource/get/",
      method: "POST",
      headers: {
        Accept: "application/json, text/javascript, */*, q=0.01",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
        "X-Requested-With": "XMLHttpRequest",
        "X-CSRFToken": csrftoken,
        "X-Pinterest-Source-Url": sourceUrl,
        Cookie: cookieHeader
      }
    };
    const responseBody = await new Promise((resolve, reject) => {
      const req = https.request(options, res => {
        let body = "";
        res.on("data", chunk => body += chunk);
        res.on("end", () => resolve(body));
      });
      req.on("error", e => reject(e));
      req.write(dataString);
      req.end();
    });
    const jsonResponse = JSON.parse(responseBody);
    const pins = jsonResponse.resource_response?.data?.results || [];
    pins.forEach(pin => {
      if (pin.images?.["736x"]) results.push(pin.images["736x"].url);
      else if (pin.images?.["orig"]) results.push(pin.images["orig"].url);
    });
    bookmark = jsonResponse.resource_response?.bookmark;
    if (!bookmark || !pins.length) keepFetching = false;
  }
  
  results = results.sort(() => Math.random() - 0.5);
  return results.slice(0, limit);
};

export default {
  name: "pinterest",
  command: ["pin", "pinterest"],
  category: "search",
  description: "Search and download Pinterest images",
  owner_only: false,
  private_only: false,
  group_only: false,

  async run(conn, m, { jid, args, usedPrefix, command }) {
    try {
      const cmd = command || m.command || "pin";
      const prefix = usedPrefix || ".";
      const text = args ? args.join(" ").trim() : "";
      
      if (!text) {
        throw new Error(`*Example Use :* ${prefix}${cmd} anime, 3\n\n*Note :* Bisa pakai koma, pipe, atau spasi (Contoh: ${prefix}${cmd} anime 5)`);
      }

      let query = text;
      let limit = 5;

      if (/[,|]/.test(text)) {
        const parts = text.split(/[,|]/);
        query = parts[0].trim();
        limit = parseInt(parts[1]?.trim(), 10) || 5;
      } else {
        const match = text.match(/^(.*?)(?:\s+(\d+))$/);
        if (match?.[1]?.trim()) {
          query = match[1].trim();
          limit = parseInt(match[2], 10) || 5;
        }
      }

      limit = Math.min(Math.max(1, limit), 20);
      await m.react("⏳");

      const res = await searchPinterestAPI(query, limit);
      if (!res.length) {
        throw new Error("Tidak ada hasil yang ditemukan.");
      }

      if (res.length === 1) {
        await conn.sendMessage(jid || m.chat, { image: { url: res[0] } }, { quoted: m });
      } else {
        if (typeof conn.sendAlbumMessage === "function") {
          await conn.sendAlbumMessage(jid || m.chat, res.map(url => ({ image: { url } })), { quoted: m });
        } else {
          for (const imgUrl of res) {
            await conn.sendMessage(jid || m.chat, { image: { url: imgUrl } }, { quoted: m });
          }
        }
      }
      await m.react("✅");
    } catch (e) {
      await m.react("❌");
      if (e.message) {
        await m.reply(e.message);
      }
    }
  }
};
