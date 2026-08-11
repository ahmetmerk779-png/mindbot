const Groq = require('groq-sdk');

async function decideNextAction(worldState, currentGoal, lastAction, apiKey) {
    if (!apiKey) {
        return { thought: "Groq API Key girilmedi!", action: "WAIT", params: {} };
    }

    const groq = new Groq({ apiKey: apiKey });

    const prompt = `
Sen Minecraft'ta oynayan otonom bir botsun.
Mevcut Durumun:
- Konum: ${worldState.location}
- Can: ${worldState.health}/20, Açlık: ${worldState.food}/20
- Envanter: ${worldState.inventory}
- Yakındakiler: ${worldState.nearby}

Ana Hedefin: ${currentGoal}
Son Eylemin: ${lastAction}

SADECE geçerli bir JSON yanıtı ver:
{
  "thought": "Düşüncen ve yapacağın hamlenin kısa açıklaması",
  "action": "MOVE" | "TALK" | "WAIT",
  "params": {
     "x": ${worldState.rawPos.x}, "y": ${worldState.rawPos.y}, "z": ${worldState.rawPos.z},
     "message": "mesaj"
  }
}`;

    try {
        const response = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.3-70b-versatile',
            response_format: { type: 'json_object' }
        });

        return JSON.parse(response.choices[0].message.content);
    } catch (err) {
        console.error("Groq API Hatası:", err.message);
        return { thought: "Groq API Hatası: " + err.message, action: "WAIT", params: {} };
    }
}

module.exports = { decideNextAction };
