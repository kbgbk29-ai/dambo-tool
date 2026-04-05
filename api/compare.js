const https = require("https");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API 키가 없습니다." });

  try {
    const rawBody = await new Promise((resolve, reject) => {
      let data = "";
      req.on("data", chunk => data += chunk);
      req.on("end", () => resolve(data));
      req.on("error", reject);
    });

    const body = JSON.parse(rawBody);
    const userMessage = body.messages[0].content;

    const payload = JSON.stringify({
      contents: [{ parts: [{ text: userMessage }] }],
      generationConfig: { maxOutputTokens: 1000, temperature: 0.7 }
    });

    const data = await new Promise((resolve, reject) => {
      const path = `/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`;
      const options = {
        hostname: "generativelanguage.googleapis.com",
        path: path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      };

      const request = https.request(options, (response) => {
        let raw = "";
        response.on("data", chunk => raw += chunk);
        response.on("end", () => {
          try {
            const geminiData = JSON.parse(raw);
            console.log("Gemini raw:", JSON.stringify(geminiData).slice(0, 300));
            const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "오류: " + JSON.stringify(geminiData).slice(0, 200);
            resolve({ content: [{ type: "text", text: text }] });
          } catch (e) {
            reject(new Error("파싱 실패: " + raw));
          }
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
