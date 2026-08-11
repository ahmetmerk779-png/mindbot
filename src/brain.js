const Groq = require('groq-sdk');

async function decideNextAction(worldState, currentGoal, lastAction, apiKey) {
    const cleanKey = apiKey ? apiKey.trim() : null;

    if (!cleanKey || !cleanKey.startsWith('gsk_')) {
        return { thought: "Geçersiz veya eksik Groq API Key!", action: "WAIT", params: {} };
    }

    // Zaman aşımı (timeout) eklenerek kilitlenme engellendi
    const groq = new Groq({ 
        apiKey: cleanKey,
        timeout: 10000 
    });

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
  "action": "MOVE" | "TALK" | "CRAFT" | "WAIT",
  "params": {
     "x": ${worldState.rawPos.x}, "y": ${worldState.rawPos.y}, "z": ${worldState.rawPos.z},
     "message": "mesaj",
     "item_name": "oak_planks",
     "count": 1
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
        return { thought: `Groq Hatası (${err.message}) - Yeniden deneniyor...`, action: "WAIT", params: {} };
    }
}

module.exports = { decideNextAction };
