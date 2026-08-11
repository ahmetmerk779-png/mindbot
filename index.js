const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const mineflayer = require('mineflayer');
const { mineflayer: prismarineViewer } = require('prismarine-viewer');

const ProxyHandler = require('./src/core/ProxyHandler');
const CaptchaAndAuthHandler = require('./src/core/CaptchaAndAuthHandler');
const AdvancedGUIAndNPCHandler = require('./src/core/AdvancedGUIAndNPCHandler');
const NetherPortalHandler = require('./src/core/NetherPortalHandler');
const NaturalWhisperController = require('./src/core/NaturalWhisperController');
const AdvancedPathfinder = require('./src/core/AdvancedPathfinder');
const RealCombat = require('./src/engines/RealCombat');
const ToolAndEmergencyEngine = require('./src/engines/ToolAndEmergencyEngine');

process.on('unhandledRejection', r => console.error(r));
process.on('uncaughtException', e => console.error(e));

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static(path.join(__dirname, 'public')));

let bot = null;
let nav, combat, guiNpc, portalHandler, captchaAuth, whisperCtrl, toolEngine;
let currentActionText = "Giriş Bekleniyor...";

function log(text, type = 'info') {
    io.emit('log_message', { text, type, time: new Date().toLocaleTimeString() });
}

// 🌐 1 SANİYELİK CANLI DURUM YAYINI (Web Paneli İçin)
setInterval(() => {
    if (bot && bot.entity) {
        const pos = bot.entity.position;
        io.emit('bot_status', {
            connected: true,
            health: bot.health || 20,
            food: bot.food || 20,
            location: `X:${Math.floor(pos.x)} Y:${Math.floor(pos.y)} Z:${Math.floor(pos.z)}`,
            action: currentActionText
        });
    } else {
        io.emit('bot_status', {
            connected: false,
            health: 0,
            food: 0,
            location: 'X:0 Y:0 Z:0',
            action: 'Kapalı / Bağlı Değil'
        });
    }
}, 1000);

io.on('connection', (socket) => {

    // WEB TERMINALINDEN OYUNA MESAJ/KOMUT GÖNDERME
    socket.on('send_chat', (msg) => {
        if (bot) {
            bot.chat(msg);
            log(`💬 [WEB TERMINAL -> OYUN]: ${msg}`, "info");
        } else {
            log("❌ Bot oyunda değil, komut gönderilemedi!", "error");
        }
    });

    socket.on('start_bot_session', (config) => {
        if (bot) return log("Bot zaten aktif!", "error");

        log(`AesirMC Proxy ve Tüm Sistemler Başlatılıyor (${config.host})...`, "info");

        bot = mineflayer.createBot({
            host: config.host,
            port: parseInt(config.port) || 25565,
            username: config.username || 'ProAjan',
            version: config.version || '1.21.11'
        });

        // Sohbet Mesajlarını Terminale Yazdır
        bot.on('message', (jsonMsg) => {
            log(jsonMsg.toString());
        });

        captchaAuth = new CaptchaAndAuthHandler(bot, { password: config.password, subServer: config.subServer });
        captchaAuth.init();

        const proxy = new ProxyHandler(bot, { password: config.password, targetSubServer: config.subServer });
        proxy.init();

        bot.once('spawn', () => {
            log("✅ Sunucuya Girildi! Tüm Modüller Aktif.", "info");

            // 🎥 3D CANLI YAYIN MOTORU (WebGL)
            try {
                prismarineViewer(bot, {
                    server: server,
                    firstPerson: false, // 3. Şahıs Serbest Kamera
                    viewDistance: 3      // RAM tasarruflu görüş alanı
                });
                log("🎥 [3D CANLI YAYIN]: 3D İzleme Ekranı Aktifleştirildi!", "info");
            } catch (err) {
                log(`3D Yayın Başlatılamadı: ${err.message}`, "error");
            }

            nav = new AdvancedPathfinder(bot);
            nav.init();
            combat = new RealCombat(bot);
            guiNpc = new AdvancedGUIAndNPCHandler(bot);
            portalHandler = new NetherPortalHandler(bot);
            toolEngine = new ToolAndEmergencyEngine(bot);

            captchaAuth.reconnectToLastServer();

            const masterUser = config.masterUser || 'OyundakiAdin';
            whisperCtrl = new NaturalWhisperController(bot, masterUser, config.groqKey);

            // Periyodik Zırh, Yemek ve Acil Kaçış Kontrolü
            setInterval(async () => {
                if (!bot || !bot.entity) return;
                await toolEngine.autoEquipArmor();
                await toolEngine.autoEat();
                toolEngine.checkEmergencyEscape();
            }, 2000);

            // DOĞAL DİL ÖZEL MESAJ EYLEMLERİ
            whisperCtrl.init({
                FOLLOW: () => {
                    const player = bot.players[masterUser.toLowerCase()]?.entity;
                    if (player) { nav.followEntity(player, 2); currentActionText = `${masterUser} takip ediliyor.`; }
                },
                STOP: () => {
                    nav.stop();
                    if (combat) combat.stopCombat();
                    currentActionText = "Durdu (Pasif Bekleme).";
                },
                NPC_CLICK: async (p) => {
                    const res = await guiNpc.interactWithNPC(p.name || 'NPC', p.click_type || 'right');
                    whisperCtrl.reply(res.message);
                },
                GUI_CLICK: async (p) => {
                    const res = await guiNpc.clickCustomGUISlot(p.slot || 0, p.mouse_button || 0);
                    whisperCtrl.reply(res.message);
                },
                CONTAINER: async (p) => {
                    const res = await guiNpc.handleContainer(p.action || 'deposit', p.item_name || 'all');
                    whisperCtrl.reply(res.message);
                },
                NETHER_PORTAL: async (p) => {
                    const res = p.action === 'build' ? await portalHandler.buildAndIgnitePortal() : await portalHandler.enterExistingPortal();
                    whisperCtrl.reply(res.message);
                },
                ESCAPE: () => {
                    bot.chat('/spawn');
                    whisperCtrl.reply("Güvenli bölgeye kaçış komutu verildi!");
                },
                STATUS: () => {},
                CHAT: () => {}
            });

            currentActionText = `IDLE: ${masterUser} kişisinden /msg bekleniyor...`;
        });

        bot.on('error', err => log(`Hata: ${err.message}`, 'error'));
        bot.on('end', () => {
            log("Bağlantı kesildi.", "error");
            bot = null;
        });
    });

    socket.on('stop_bot_session', () => {
        if (bot) { bot.quit(); bot = null; }
        log("Bot durduruldu.", "info");
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Pro Sunucu Aktif: ${PORT}`));
