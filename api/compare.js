const https = require("https");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key missing" });

  try {
    const rawBody = await new Promise((resolve, reject) => {
      let data = "";
      req.on("data", chunk => data += chunk.toString("utf8"));
      req.on("end", () => resolve(data));
      req.on("error", reject);
    });

    const body = JSON.parse(rawBody);
    const userMessage = body.messages[0].content;

    const payload = JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      messages: [{ role: "user", content: userMessage }]
    });

    const data = await new Promise((resolve, reject) => {
      const options = {
        hostname: "api.anthropic.com",
        path: "/v1/messages",
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Length": Buffer.byteLength(payload, "utf8"),
        },
      };

      const request = https.request(options, (response) => {
        const chunks = [];
        response.on("data", chunk => chunks.push(chunk));
        response.on("end", () => {
          try {
            const raw = Buffer.concat(chunks).toString("utf8");
            const claudeData = JSON.parse(raw);
            if (claudeData.error) {
  return resolve({ content: [{ type: "text", text: "API 에러: " + JSON.stringify(claudeData.error) }] });
}
            const text = claudeData?.content?.[0]?.text || "Error: " + JSON.stringify(claudeData).slice(0, 200);
            resolve({ content: [{ type: "text", text }] });
          } catch (e) {
            reject(new Error("Parse error"));
          }
        });
      });

      request.on("error", reject);
      request.write(payload, "utf8");
      request.end();
    });

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
