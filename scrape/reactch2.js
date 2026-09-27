/*
name: react channel
base url: https://satriareact.satriadeveloperz.workers.dev
author: xvlovers
github: xvlovers
fungsi: react channel wa via satria react server 3.
credit: xvlovers
chanel WhatsApp untuk info : https://whatsapp.com/channel/0029VbCKJpb6LwHpbtC1mb3E
*/

import axios from "axios";

const BASE_URL = "https://satriareact.satriadeveloperz.workers.dev";
const DEFAULT_SERVER = 3;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function handshake(server) {
  const response = await axios.post(`${BASE_URL}/api/handshake`, {
    server: server
  }, {
    timeout: 30000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "*/*",
      "Content-Type": "application/json",
      "Origin": BASE_URL,
      "Referer": BASE_URL + "/"
    },
    validateStatus: () => true
  });

  return response.data;
}

async function reactChannel(url, reactions, token, authToken, server) {
  const response = await axios.post(`${BASE_URL}/api/react`, {
    url: url,
    reactions: reactions,
    token: token,
    authToken: authToken || null,
    server: server
  }, {
    timeout: 60000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "*/*",
      "Content-Type": "application/json",
      "Origin": BASE_URL,
      "Referer": BASE_URL + "/"
    },
    validateStatus: () => true
  });

  return {
    status: response.status,
    data: response.data
  };
}

export async function doReactChannel(link, emojis = "🔥", jumlah = 1, delayMs = 800, server = DEFAULT_SERVER) {
  const hs = await handshake(server);

  if (!hs.success || !hs.token) {
    throw new Error(hs.error || "Handshake gagal");
  }

  const emojiList = emojis.split(",").map(e => e.trim()).filter(Boolean);
  let successCount = 0;
  let failedCount = 0;
  let token = hs.token;
  let authToken = hs.authToken || null;

  for (let i = 0; i < jumlah; i++) {
    const shuffled = [...emojiList].sort(() => Math.random() - 0.5);

    try {
      const result = await reactChannel(link.trim(), shuffled, token, authToken, server);

      if (result.status === 200 && result.data?.success) {
        successCount++;
      } else if (result.status === 403) {
        // Token kadaluarsa atau ditolak, minta handshake baru
        const newHs = await handshake(server);
        if (newHs.success && newHs.token) {
          token = newHs.token;
          authToken = newHs.authToken || null;
          i--; // Ulangi iterasi ini
          continue;
        }
        failedCount++;
      } else {
        failedCount++;
      }
    } catch (e) {
      failedCount++;
    }

    if (i < jumlah - 1 && delayMs > 0) {
      await delay(delayMs);
    }
  }

  return {
    status: successCount > 0,
    message: successCount > 0 ? "React berhasil dikirim" : "Semua react gagal",
    data: {
      link,
      emojis: emojiList,
      jumlah,
      delay: delayMs,
      server,
      success: successCount,
      failed: failedCount
    }
  };
}