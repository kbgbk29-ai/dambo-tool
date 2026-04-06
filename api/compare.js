const https = require("https");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.GROQ_API_KEY;
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
      model: "llama-3.3-70b-versatile",
      max_tokens: 1000,
      반드시 한국어로만 답하세요. 필요하다면 약관에 있는 영어단어는 추가로 사용 가능. 한자, 아랍어 등 다른 언어는 절대 사용하지 마세요. messages: [{ role: "user", content: userMessage }]
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
            console.log("Groq 응답:", JSON.stringify(groqData).slice(0, 200));
            const text = groqData?.choices?.[0]?.message?.content || "오류: " + JSON.stringify(groqData).slice(0, 200);
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
