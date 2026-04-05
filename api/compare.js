const https = require("https");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API 키가 없습니다." });

  try {
    // req.body를 직접 스트림에서 읽기
    const rawBody = await new Promise((resolve, reject) => {
      let data = "";
      req.on("data", chunk => data += chunk);
      req.on("end", () => resolve(data));
      req.on("error", reject);
    });

    const body = JSON.parse(rawBody);

    const payload = JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      messages: body.messages,
    });

    const data = await new Promise((resolve, reject) => {
      const options = {
        hostname: "api.anthropic.com",
        path: "/v1/messages",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Length": Buffer.byteLength(payload),
        },
      };

      const request = https.request(options, (response) => {
        let raw = "";
        response.on("data", chunk => raw += chunk);
        response.on("end", () => {
          try { resolve(JSON.parse(raw)); }
          catch (e) { reject(new Error("파싱 실패: " + raw)); }
        });
      });

      request.on("error", reject);
      request.write(payload);
      request.end();
    });

    return res.status(200).json(data);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
