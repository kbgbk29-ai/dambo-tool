const https = require("https");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key missing" });

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
      model: "qwen/qwen3-32b",
      max_tokens: 3000,
      messages: [{ role: "user", content: userMessage }]
    });

    const data = await new Promise((resolve, reject) => {
      const options = {
        hostname: "api.groq.com",
        path: "/openai/v1/chat/completions",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "Content-Length": Buffer.byteLength(payload),
        },
      };

      const request = https.request(options, (response) => {
        let raw = "";
        response.on("data", chunk => raw += chunk);
        response.on("end", () => {
          try {
            const groqData = JSON.parse(raw);
            let text = groqData?.choices?.[0]?.message?.content || "Error: " + JSON.stringify(groqData).slice(0, 200); text = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim(); text = text.replace(/^---+$/gm, "").trim();
            resolve({ content: [{ type: "text", text: text }] });
          } catch (e) {
            reject(new Error("Parse error: " + raw));
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
