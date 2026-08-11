const fs = require('fs');
const path = require('path');

class CaptchaAndAuthHandler {
    constructor(bot, config = {}) {
        this.bot = bot;
        this.targetSubServer = config.subServer || '';
        this.lastServerFile = path.join(__dirname, '../../last_server.json');
        this.lastSubServer = this.loadLastSubServer() || this.targetSubServer;
    }

    init() {
        // Chat Captcha ve Son Sunucu Kaydı
        this.bot.on('message', (jsonMsg) => {
            const text = jsonMsg.toString().trim();

            // Matematiksel Captcha
            const mathMatch = text.match(/(\d+)\s*([\+\-\*])\s*(\d+)/);
            if (mathMatch && (text.includes('doğrulama') || text.includes('sonucu') || text.includes('captcha'))) {
                const n1 = parseInt(mathMatch[1]);
                const op = mathMatch[2];
                const n2 = parseInt(mathMatch[3]);
                let res = 0;
                if (op === '+') res = n1 + n2;
                if (op === '-') res = n1 - n2;
                if (op === '*') res = n1 * n2;

                console.log(`🧩 [CAPTCHA CHAT]: Matematik Cevaplandı -> ${res}`);
                setTimeout(() => this.bot.chat(res.toString()), 1000);
                return;
            }

            // Metin Kod Captcha
            const codeMatch = text.match(/kodu\s*(?:yazın|girin)?\s*:?\s*([A-Za-z0-9]{4,8})/i);
            if (codeMatch && (text.includes('doğrulama') || text.includes('captcha') || text.includes('kod'))) {
                console.log(`🧩 [CAPTCHA CHAT]: Kod Cevaplandı -> ${codeMatch[1]}`);
                setTimeout(() => this.bot.chat(codeMatch[1]), 1000);
                return;
            }

            // Son Sunucu Tespiti
            if (text.includes('aktarılıyorsunuz') || text.includes('Bağlanılıyor')) {
                const serverMatch = text.match(/(\w+)\s*sunucusuna/i);
                if (serverMatch) {
                    this.saveLastSubServer(serverMatch[1].toLowerCase());
                }
            }
        });

        // GUI Captcha (Yeşil cam/elmas seçme)
        this.bot.on('windowOpen', async (window) => {
            const title = (window.title || '').toLowerCase();
            if (title.includes('doğrulama') || title.includes('captcha') || title.includes('tıkla') || title.includes('verify')) {
                console.log(`🧩 [CAPTCHA GUI]: Pencere Algılandı -> ${window.title}`);
                const targetSlot = window.slots.findIndex(item => {
                    if (!item) return false;
                    const name = item.name.toLowerCase();
                    return name.includes('green') || name.includes('emerald') || name.includes('lime') || name.includes('diamond');
                });

                if (targetSlot !== -1) {
                    console.log(`🧩 [CAPTCHA GUI]: Slot ${targetSlot} Tıklanıyor...`);
                    setTimeout(async () => {
                        try { await this.bot.clickWindow(targetSlot, 0, 0); } catch (e) {}
                    }, 1200);
                }
            }
        });
    }

    saveLastSubServer(serverName) {
        this.lastSubServer = serverName;
        try {
            fs.writeFileSync(this.lastServerFile, JSON.stringify({ lastServer: serverName }));
            console.log(`💾 [HAFIZA]: Son sunucu kaydedildi -> ${serverName}`);
        } catch (e) {}
    }

    loadLastSubServer() {
        try {
            if (fs.existsSync(this.lastServerFile)) {
                return JSON.parse(fs.readFileSync(this.lastServerFile)).lastServer;
            }
        } catch (e) {}
        return null;
    }

    reconnectToLastServer() {
        const target = this.lastSubServer || this.targetSubServer;
        if (target) {
            console.log(`🔄 [RECONNECT]: Son sunucuya aktarılıyor -> /server ${target}`);
            setTimeout(() => this.bot.chat(`/server ${target}`), 2500);
        }
    }
}

module.exports = CaptchaAndAuthHandler;
