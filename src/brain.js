const Groq = require('groq-sdk');
const memory = require('./memory');

async function decideNextAction(worldState, currentGoal, apiKey) {
    const cleanKey = apiKey ? apiKey.trim() : null;
    if (!cleanKey || !cleanKey.startsWith('gsk_')) {
        return { thought: "Groq Key eksik!", action: "WAIT", params: {} };
    }

    const groq = new Groq({ apiKey: cleanKey, timeout: 12000 });
    const memContext = memory.getMemoryContext();

    const prompt = `
Sen Minecraft'ın en akıllı ve insansı otonom yapay zeka botusun (MindCraft).
[DURUMUM]:
- Konum: ${worldState.location} | Can: ${worldState.health}/20 | Açlık: ${worldState.food}/20
- Envanter: ${worldState.inventory} | Yakındakiler: ${worldState.nearby}

[HAFIZA & KENDİ KENDİNE ÖĞRENME]:
- Geçmiş Eylemler: ${memContext.history}
- Başarısızlıklar/Dersler: ${memContext.failures}

[ANA HEDEF]: ${currentGoal}

[YAPABİLECEĞİN EYLEMLER]:
- "MOVE" -> params: { x, y, z }
- "FOLLOW" -> params: { target_name }
- "ATTACK" -> params: { target_name }
- "FARM" -> params: {}
- "FISH" -> params: {}
- "CRAFT" -> params: { item_name, count }
- "TALK" -> params: { message } (Oyuncularla insansı derin sohbetler et)
- "WAIT" -> params: {}

SADECE geçerli bir JSON ver:
{
  "reasoning": "Adım adım mantık yürütmen (Chain of Thought)",
  "chat_response": "Gerekiyorsa chate yazacağın akıllıca/esprili yanıt (boş bırakılabilir)",
  "thought": "Kısa panel açıklaması",
  "action": "MOVE" | "FOLLOW" | "ATTACK" | "FARM" | "FISH" | "CRAFT" | "TALK" | "WAIT",
  "params": {}
}`;

    try {
        const response = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.3-70b-versatile',
            response_format: { type: 'json_object' }
        });

        return JSON.parse(response.choices[0].message.content);
    } catch (err) {
        return { thought: `Groq Hatası: ${err.message}`, action: "WAIT", params: {} };
    }
}

module.exports = { decideNextAction };
