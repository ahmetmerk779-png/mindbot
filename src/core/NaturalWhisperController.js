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
                        console.log(`💬 [GELEN MSG] <${sender}>: ${message}`);
                        await this.handleUniversalCommand(message, actionHandlers);
                    }
                    break;
                }
            }
        });
    }

    reply(text) {
        if (this.bot) {
            this.bot.chat(`/msg ${this.masterUsername} ${text}`);
        }
    }

    // HER YERDEN GELEN KOMUTLARI ANINDA İŞLEYEN MOTOR
    async handleUniversalCommand(rawMessage, actionHandlers) {
        const text = rawMessage.toLowerCase().trim();

        // 1. ANLIK HIZLI KELİME YAKALAYICI (Gecikmesiz Mantık)
        if (text.includes('takip') || text.includes('gel') || text.includes('koş') || text.includes('yanıma')) {
            if (actionHandlers.FOLLOW) actionHandlers.FOLLOW();
            return;
        }
        if (text.includes('dur') || text.includes('bekle') || text.includes('sakin') || text.includes('kımıldama')) {
            if (actionHandlers.STOP) actionHandlers.STOP();
            return;
        }
        if (text.includes('saldır') || text.includes('kes') || text.includes('öldür') || text.includes('vur')) {
            if (actionHandlers.ATTACK) actionHandlers.ATTACK({ target: 'mob' });
            return;
        }
        if (text.includes('spawn') || text.includes('kaç')) {
            if (actionHandlers.ESCAPE) actionHandlers.ESCAPE();
            return;
        }
        if (text.includes('portal') || text.includes('nether')) {
            if (actionHandlers.NETHER_PORTAL) actionHandlers.NETHER_PORTAL({ action: text.includes('yap') ? 'build' : 'enter' });
            return;
        }
        if (text.includes('sandık') || text.includes('shulker') || text.includes('depola')) {
            if (actionHandlers.CONTAINER) actionHandlers.CONTAINER({ action: 'deposit', item_name: 'all' });
            return;
        }
        if (text.includes('npc') || text.includes('tıkla')) {
            if (actionHandlers.NPC_CLICK) actionHandlers.NPC_CLICK({ name: 'NPC', click_type: 'right' });
            return;
        }

        // 2. GROQ AI FALLBACK (Karmaşık Cümleler İçin)
        if (this.groq) {
            try {
                const response = await this.groq.chat.completions.create({
                    messages: [{
                        role: 'user',
                        content: `Cümle: "${rawMessage}". Niyeti bul ve JSON döndür: {"intent": "FOLLOW"|"STOP"|"ATTACK"|"ESCAPE"|"NPC_CLICK"|"CONTAINER"|"NETHER_PORTAL"}`
                    }],
                    model: 'llama-3.3-70b-versatile',
                    response_format: { type: "json_object" }
                });

                const parsed = JSON.parse(response.data.choices[0].message.content);
                if (parsed.intent && actionHandlers[parsed.intent]) {
                    actionHandlers[parsed.intent]({});
                }
            } catch (e) {}
        }
    }
}

module.exports = NaturalWhisperController;
