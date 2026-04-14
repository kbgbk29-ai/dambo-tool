const https = require("https");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
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
      max_tokens: 500,
      stream: true,
      messages: [{ role: "user", content: userMessage }]
    });

    // SSE 헤더 설정
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    await new Promise((resolve, reject) => {
      const options = {
        hostname: "api.anthropic.com",
        path: "/v1/messages",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Length": Buffer.byteLength(payload, "utf8"),
        },
      };

      const request = https.request(options, (response) => {
        let buffer = "";
        response.on("data", chunk => {
          buffer += chunk.toString("utf8");
          const lines = buffer.split("\n");
          buffer = lines.pop(); // 미완성 줄은 보관

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === "content_block_delta" && parsed.delta?.text) {
                res.write(`data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`);
              }
            } catch (_) {}
          }
        });
        response.on("end", () => {
          res.write("data: [DONE]\n\n");
          res.end();
          resolve();
        });
        response.on("error", reject);
      });

      request.on("error", reject);
      request.write(payload, "utf8");
      request.end();
    });

  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }
};
