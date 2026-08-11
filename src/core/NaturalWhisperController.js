const Groq = require('groq-sdk');

class NaturalWhisperController {
    constructor(bot, masterUsername, groqApiKey) {
        this.bot = bot;
        this.masterUsername = masterUsername.toLowerCase();
        this.groq = groqApiKey ? new Groq({ apiKey: groqApiKey.trim() }) : null;
    }

    init(actionHandlers) {
        const whisperRegexes = [
            /^\[(\w+)\s*->\s*Siz\]\s*(.+)$/i,
            /^\[(\w+)\s*->\s*me\]\s*(.+)$/i,
            /^\[(\w+)\s*->\s*Ben\]\s*(.+)$/i,
            /^(\w+)\s*size fısıldadı:\s*(.+)$/i,
            /^(\w+)\s*whispers:\s*(.+)$/i
        ];

        this.bot.on('message', async (jsonMsg) => {
            const rawText = jsonMsg.toString().trim();

            for (const regex of whisperRegexes) {
                const match = rawText.match(regex);
                if (match) {
                    const sender = match[1].trim();
                    const message = match[2].trim();

                    if (sender.toLowerCase() === this.masterUsername) {
                        console.log(`💬 [MESAJ]: <${sender}> -> ${message}`);
                        await this.processNaturalLanguage(message, actionHandlers);
                    } else {
                        console.warn(`⛔ [YETKİSİZ ENGEL]: <${sender}> -> ${message}`);
                    }
                    break;
                }
            }
        });
    }

    reply(text) {
        this.bot.chat(`/msg ${this.masterUsername} ${text}`);
    }

    async processNaturalLanguage(userMessage, actionHandlers) {
        if (!this.groq) {
            this.reply("Groq API Key tanımlanmadığı için ne dediğini anlayamıyorum!");
            return;
        }

        const prompt = `
Sen Minecraft'ta sahibine hizmet eden sadık bir botsun. Sahibin özel mesajdan (${userMessage}) yazdı.
GÖREVİN: Sahibinin Türkçe cümlesinin amacını anla ve SADECE JSON döndür.

NİYETLER (intent):
- "FOLLOW": Yanına gelmesini/takip etmesini istiyor.
- "STOP": Durmasını istiyor.
- "NPC_CLICK": NPC'ye tıklamasını istiyor (params: { name, click_type: "right" | "left" }).
- "GUI_CLICK": Menüde slota tıklamasını istiyor (params: { slot, mouse_button: 0 | 1 }).
- "CONTAINER": Sandığa/Shulker'a eşya koymasını veya almasını istiyor (params: { action: "deposit" | "withdraw", item_name: "all" }).
- "NETHER_PORTAL": Nether portalı yapmasını/yakmasını veya girmesini istiyor (params: { action: "build" | "enter" }).
- "STATUS": Durum soruyor.
- "ESCAPE": Kaçmasını/spawn'a gitmesini istiyor.
- "CHAT": Sohbet ediyor.

JSON ÇIKTI:
{
  "intent": "FOLLOW" | "STOP" | "NPC_CLICK" | "GUI_CLICK" | "CONTAINER" | "NETHER_PORTAL" | "STATUS" | "ESCAPE" | "CHAT",
  "params": {},
  "reply": "Sahibine /msg ile atılacak insansı Türkçe cevap"
}`;

        try {
            const response = await this.groq.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: 'llama-3.3-70b-versatile',
                response_format: { type: "json_object" }
            });

            const parsed = JSON.parse(response.data.choices[0].message.content);

            if (parsed.reply) this.reply(parsed.reply);
            if (actionHandlers[parsed.intent]) actionHandlers[parsed.intent](parsed.params);

        } catch (err) {
            this.reply("Anlayamadım usta, ne yapmamı istiyorsun?");
        }
    }
}

module.exports = NaturalWhisperController;
