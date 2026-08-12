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

process.on('unhandledRejection', r => console.error("Unhandled:", r));
process.on('uncaughtException', e => console.error("Uncaught:", e));

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

// Master Oyuncunun Varlığını Esnek Bulma
function getMasterEntity(botInstance, masterUsername) {
    if (!botInstance || !botInstance.players || !masterUsername) return null;
    const keys = Object.keys(botInstance.players);
    const matchKey = keys.find(k => k.toLowerCase() === masterUsername.toLowerCase());
    if (matchKey && botInstance.players[matchKey] && botInstance.players[matchKey].entity) {
        return botInstance.players[matchKey].entity;
    }
    return null;
}

// CANLI DURUM YAYINI
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

    socket.on('send_chat', (msg) => {
        if (bot) {
            bot.chat(msg);
            log(`💬 [WEB TERMINAL]: ${msg}`, "info");
            if (whisperCtrl) whisperCtrl.handleUniversalCommand(msg, getActionHandlers());
        } else {
            log("❌ Bot oyunda değil!", "error");
        }
    });

    socket.on('start_bot_session', (config) => {
        if (bot) return log("Bot zaten aktif!", "error");

        log(`AesirMC Proxy Başlatılıyor (${config.host})...`, "info");

        bot = mineflayer.createBot({
            host: config.host,
            port: parseInt(config.port) || 25565,
            username: config.username || 'ProAjan',
            version: config.version || '1.21.11'
        });

        bot.on('message', (jsonMsg) => log(jsonMsg.toString()));

        // TPA VE ISINLANMA ISTEKLERINI OTOMATIK KABUL ETME
        bot.on('message', (jsonMsg) => {
            const txt = jsonMsg.toString();
            const masterUser = config.masterUser || '';
            if ((txt.includes('tp') || txt.includes('ışınlanma')) && txt.toLowerCase().includes(masterUser.toLowerCase())) {
                log("📌 Master oyuncudan TPA isteği algılandı, kabul ediliyor...", "info");
                setTimeout(() => bot.chat('/tpaccept'), 1000);
            }
        });

        captchaAuth = new CaptchaAndAuthHandler(bot, { password: config.password, subServer: config.subServer });
        captchaAuth.init();

        const proxy = new ProxyHandler(bot, { password: config.password, targetSubServer: config.subServer });
        proxy.init();

        bot.once('spawn', () => {
            log("✅ Sunucuya Girildi! 3D Yayın ve Modüller Aktif.", "info");

            // 🎥 3D VIEWER'I DOĞRUDAN EXPRESS APP'E ENJEKTE ET
            try {
                prismarineViewer(bot, { port: 3000, express: app, viewDistance: 3 });
                log("🎥 [3D CANLI İZLEME]: 3D WebGL Yayın Sunucusu Aktif!", "info");
            } catch (err) {
                log(`3D Ekran Hatası: ${err.message}`, "error");
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
            whisperCtrl.init(getActionHandlers());

            bot.on('chat', (username, message) => {
                if (username.toLowerCase() === masterUser.toLowerCase()) {
                    log(`💬 [GENEL CHAT] <${username}>: ${message}`, "info");
                    whisperCtrl.handleUniversalCommand(message, getActionHandlers());
                }
            });

            // Alt sunucu değiştiğinde (respawn) Pathfinder'ı tekrar bağla
            bot.on('respawn', () => {
                log("🔄 Sub-server değişti, Navigasyon ve Fizik tekrar güncelleniyor...", "info");
                setTimeout(() => {
                    if (nav) nav.init();
                }, 2000);
            });

            setInterval(async () => {
                if (!bot || !bot.entity) return;
                await toolEngine.autoEquipArmor();
                await toolEngine.autoEat();
                toolEngine.checkEmergencyEscape();
            }, 2000);

            currentActionText = `IDLE: ${masterUser} kişisinden komut bekleniyor...`;
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

function getActionHandlers() {
    return {
        FOLLOW: () => {
            const masterUser = whisperCtrl ? whisperCtrl.masterUsername : '';
            const playerEntity = getMasterEntity(bot, masterUser);
            if (playerEntity) {
                nav.followEntity(playerEntity, 2);
                currentActionText = `${masterUser} takip ediliyor.`;
                if (whisperCtrl) whisperCtrl.reply("Yanına geliyorum usta!");
            } else {
                if (whisperCtrl) whisperCtrl.reply("Görüş alanımda değilsin usta! Bana /tpa at, kabul edeyim veya yanıma yaklaş.");
                currentActionText = "Takip Beklemede (Oyuncu Görüş Alanı Dışında).";
            }
        },
        STOP: () => {
            nav.stop();
            if (combat) combat.stopCombat();
            currentActionText = "Durdu (Pasif Bekleme).";
            if (whisperCtrl) whisperCtrl.reply("Olduğum yerde durdum usta.");
        },
        ATTACK: (p) => {
            const target = combat.getNearestHostile(12);
            if (target) {
                combat.startCombatLoop(target);
                currentActionText = `Savaşta: ${target.name}`;
                if (whisperCtrl) whisperCtrl.reply(`${target.name} hedefine saldırıyorum!`);
            } else {
                if (whisperCtrl) whisperCtrl.reply("Yakında saldırılacak yaratık bulunamadı.");
            }
        },
        NPC_CLICK: async (p) => {
            const res = await guiNpc.interactWithNPC(p.name || 'NPC', p.click_type || 'right');
            if (whisperCtrl) whisperCtrl.reply(res.message);
        },
        GUI_CLICK: async (p) => {
            const res = await guiNpc.clickCustomGUISlot(p.slot || 0, p.mouse_button || 0);
            if (whisperCtrl) whisperCtrl.reply(res.message);
        },
        CONTAINER: async (p) => {
            const res = await guiNpc.handleContainer(p.action || 'deposit', p.item_name || 'all');
            if (whisperCtrl) whisperCtrl.reply(res.message);
        },
        NETHER_PORTAL: async (p) => {
            const res = p.action === 'build' ? await portalHandler.buildAndIgnitePortal() : await portalHandler.enterExistingPortal();
            if (whisperCtrl) whisperCtrl.reply(res.message);
        },
        ESCAPE: () => {
            bot.chat('/spawn');
            if (whisperCtrl) whisperCtrl.reply("Güvenli bölgeye kaçış yapıldı!");
        }
    };
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Pro Sunucu Aktif: ${PORT}`));
