/*
**reaction whatsapp**
**author skrep: xvlovers**
**git:https://github.com/xvlovers/kumpulan-scrape-dan-plugin-esm-cjs-/blob/main/reactionWa.js **
**base URL: https://reaction-whatsapp.edgeone.dev**
**credit: reaction whatsapp**
*/

import axios from "axios";

const BASE_URL = "https://reaction-whatsapp.edgeone.dev";
const API_KEY = "9J88DPLJ";

export async function doReactEdgeone(link, emoji) {
  try {
    const res = await axios.post(`${BASE_URL}/react`, {
      link,
      emoji
    }, {
      timeout: 60000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
        "Origin": BASE_URL,
        "Referer": BASE_URL + "/"
      },
      validateStatus: () => true
    });

    return {
      status: res.status === 200,
      httpStatus: res.status,
      data: res.data
    };
  } catch (error) {
    return {
      status: false,
      message: error.message
    };
  }
}