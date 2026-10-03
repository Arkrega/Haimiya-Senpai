/**
 * Haimiya-Senpai — Remove Background
 * Pixelcut/Pixa matte endpoint. No Remove.bg API key required.
 */

export async function removebg(imageBuffer, filename = "image.jpg") {
  if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
    throw new TypeError("Image buffer tidak valid.");
  }

  const form = new FormData();
  form.append(
    "image",
    new Blob([imageBuffer], { type: "image/jpeg" }),
    filename
  );
  form.append("format", "png");
  form.append("model", "v1");

  const response = await fetch("https://api2.pixelcut.app/image/matte/v1", {
    method: "POST",
    headers: {
      "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
      Accept: "application/json, text/plain, */*",
      "sec-ch-ua": '"Chromium";v="139", "Not;A=Brand";v="99"',
      "x-locale": "en",
      "x-client-version": "web:pixa.com:4a5b0af2",
      "sec-ch-ua-mobile": "?1",
      "sec-ch-ua-platform": '"Android"',
      origin: "https://www.pixa.com",
      "sec-fetch-site": "cross-site",
      "sec-fetch-mode": "cors",
      "sec-fetch-dest": "empty",
      referer: "https://www.pixa.com/",
      "accept-language": "id-ID,id;q=0.9,en-AU;q=0.8,en;q=0.7,en-US;q=0.6"
    },
    body: form
  });

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = await response.text();
      if (body) detail += ` — ${body.slice(0, 300)}`;
    } catch {}
    throw new Error(`Remove background gagal: ${detail}`);
  }

  const result = Buffer.from(await response.arrayBuffer());
  if (!result.length) throw new Error("API mengembalikan gambar kosong.");

  return result;
}
