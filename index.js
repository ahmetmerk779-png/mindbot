const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const mineflayer = require('mineflayer');

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

io.on('connection', (socket) => {
    socket.on('start_bot_session', (config) => {
        if (bot) return log("Bot zaten aktif!", "error");

        log(`AesirMC Proxy ve Tüm Sistemler Başlatılıyor (${config.host})...`, "info");

        bot = mineflayer.createBot({
            host: config.host,
            port: parseInt(config.port) || 25565,
            username: config.username || 'ProAjan',
            version: config.version || '1.21.11'
        });

        captchaAuth = new CaptchaAndAuthHandler(bot, { password: config.password, subServer: config.subServer });
        captchaAuth.init();

        const proxy = new ProxyHandler(bot, { password: config.password, targetSubServer: config.subServer });
        proxy.init();

        bot.once('spawn', () => {
            log("✅ Sunucuya Girildi! Tüm Modüller Aktif.", "info");

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
        bot.on('end', () => log("Bağlantı kesildi.", "error"));
    });

    socket.on('stop_bot_session', () => {
        if (bot) { bot.quit(); bot = null; }
        log("Bot durduruldu.", "info");
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Pro Sunucu Aktif: ${PORT}`));
