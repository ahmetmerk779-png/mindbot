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
Sen Minecraft'ta oynayan otonom bir akıllı botsun. SADECE bir JSON objesi döndür, markdown veya başka bir açıklama yazma.

[DURUMUM]:
- Konum: ${worldState.location} | Can: ${worldState.health}/20 | Açlık: ${worldState.food}/20
- Envanter: ${worldState.inventory} | Yakındakiler: ${worldState.nearby}
- Geçmiş Hatalar: ${memContext.failures}
- Hedef: ${currentGoal}

Örnek Yanıt Formatı:
{
  "reasoning": "Mantık yürütmen",
  "chat_response": "Chate yazılacak mesaj (boş olabilir)",
  "thought": "Kısa eylem açıklaması",
  "action": "MOVE",
  "params": { "x": 0, "y": 64, "z": 0 }
}

Kullanabileceğin aksiyonlar: MOVE, FOLLOW, ATTACK, FARM, FISH, CRAFT, TALK, WAIT.
Şimdi bu formata uygun kararını ver:`;

    try {
        const response = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.3-70b-versatile'
        });

        const rawText = response.choices[0].message.content;
        
        // GÜVENLİ PARSE: Metin içindeki süslü parantez aralığını yakala (Markdown çöpünü temizler)
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error("Model geçerli bir JSON blok yapısı döndürmedi.");
        }

        const parsed = JSON.parse(jsonMatch[0]);
        return parsed;

    } catch (err) {
        // Hata verse bile bot asla çökmez, güvenli bekleme moduna geçer
        return { 
            reasoning: "Parse hatası güvenle atlatıldı.",
            chat_response: "",
            thought: "Karar optimize ediliyor...", 
            action: "WAIT", 
            params: {} 
        };
    }
}

module.exports = { decideNextAction };
