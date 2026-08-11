class ProxyHandler {
    constructor(bot, config = {}) {
        this.bot = bot;
        this.password = config.password || '';
        this.targetSubServer = config.targetSubServer || '';
        this.isLoggedIn = false;
    }

    init() {
        this.bot.on('message', (jsonMsg) => {
            const text = jsonMsg.toString();

            // Otomatik Kayıt / Giriş
            if ((text.includes('/login') || text.includes('/giris') || text.includes('Lütfen şifrenizi')) && !this.isLoggedIn) {
                if (this.password) {
                    console.log("🔑 [PROXY]: Giriş komutu gönderiliyor...");
                    this.bot.chat(`/login ${this.password}`);
                    this.isLoggedIn = true;
                }
            } else if ((text.includes('/register') || text.includes('/kayit')) && !this.isLoggedIn) {
                if (this.password) {
                    console.log("📝 [PROXY]: Kayıt komutu gönderiliyor...");
                    this.bot.chat(`/register ${this.password} ${this.password}`);
                    this.isLoggedIn = true;
                }
            }

            // Alt sunucuya geçiş
            if ((text.includes('Başarıyla giriş') || text.includes('Hoşgeldin')) && this.targetSubServer) {
                setTimeout(() => {
                    console.log(`🚀 [PROXY]: Hedef sunucuya geçiliyor -> /server ${this.targetSubServer}`);
                    this.bot.chat(`/server ${this.targetSubServer}`);
                }, 1500);
            }
        });

        // Sub-Server geçişinde paket sıfırlama
        this.bot.on('respawn', () => {
            console.log("🔄 [PROXY]: Dünya/Sunucu değişti, rota temizlendi.");
            if (this.bot.pathfinder) {
                this.bot.pathfinder.setGoal(null);
            }
        });
    }
}

module.exports = ProxyHandler;
