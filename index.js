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

const io = new Server(server, { path: '/panel-socket' });

app.get('/panel', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});
app.use(express.static(path.join(__dirname, 'public')));

let bot = null;
let nav, combat, guiNpc, portalHandler, captchaAuth, whisperCtrl, toolEngine;
let currentActionText = "Giriş Bekleniyor...";

function log(text, type = 'info') {
    io.emit('log_message', { text, type, time: new Date().toLocaleTimeString() });
}

// HASSAS OYUNCI TESPİTİ (Hologram ve NPC'leri eler)
function getMasterEntity(botInstance, masterUsername) {
    if (!botInstance || !botInstance.entities) return null;
    
    const masterLower = (masterUsername || '').toLowerCase();

    // 1. İsmi tam eşleşen gerçek oyuncuyu bul
    for (const id in botInstance.entities) {
        const e = botInstance.entities[id];
        if (e && e.type === 'player' && e.username) {
            if (e.username.toLowerCase() === masterLower && e.username !== botInstance.username) {
                return e;
            }
        }
    }

    // 2. İsmi bulamazsa yakındaki en yakın gerçek oyuncuya kilitlen
    return botInstance.nearestEntity(e => {
        return e.type === 'player' && 
               e.username && 
               e.username !== botInstance.username &&
               !e.username.includes('NPC') &&
               !e.username.includes('CITIZEN');
    });
}

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
    }
}, 1000);

io.on('connection', (socket) => {
    socket.on('send_chat', (msg) => {
        if (bot) {
            bot.chat(msg);
            log(`💬 [TERMINAL]: ${msg}`, "info");
            if (whisperCtrl) whisperCtrl.handleUniversalCommand(msg, getActionHandlers());
        }
    });

    socket.on('start_bot_session', (config) => {
        if (bot) return log("Bot zaten aktif!", "error");

        log(`Sunucuya Bağlanılıyor (${config.host})...`, "info");

        bot = mineflayer.createBot({
            host: config.host,
            port: parseInt(config.port) || 25565,
            username: config.username || 'ProAjan',
            version: '1.21.11'
        });

        bot.on('message', (jsonMsg) => log(jsonMsg.toString()));

        captchaAuth = new CaptchaAndAuthHandler(bot, { password: config.password, subServer: config.subServer });
        captchaAuth.init();

        const proxy = new ProxyHandler(bot, { password: config.password, targetSubServer: config.subServer });
        proxy.init();

        bot.once('spawn', () => {
            log("✅ Sunucuya Girildi!", "info");

            try {
                prismarineViewer(bot, { server: server, viewDistance: 3 });
                log("🎥 3D Ekran Aktif!", "info");
            } catch (err) {
                log(`3D Hata: ${err.message}`, "error");
            }

            nav = new AdvancedPathfinder(bot);
            nav.init();
            combat = new RealCombat(bot);
            guiNpc = new AdvancedGUIAndNPCHandler(bot);
            portalHandler = new NetherPortalHandler(bot);
            toolEngine = new ToolAndEmergencyEngine(bot);

            captchaAuth.reconnectToLastServer();

            const masterUser = config.masterUser || 'Mahmutcanmerk12';
            whisperCtrl = new NaturalWhisperController(bot, masterUser, config.groqKey);
            whisperCtrl.init(getActionHandlers());

            bot.on('chat', (username, message) => {
                if (username.toLowerCase() === masterUser.toLowerCase()) {
                    whisperCtrl.handleUniversalCommand(message, getActionHandlers());
                }
            });

            currentActionText = `IDLE: Bekliyor...`;
        });

        bot.on('error', err => log(`Hata: ${err.message}`, 'error'));
        bot.on('end', () => { bot = null; });
    });

    socket.on('stop_bot_session', () => {
        if (bot) { bot.quit(); bot = null; }
    });
});

function getActionHandlers() {
    return {
        FOLLOW: () => {
            const masterUser = whisperCtrl ? whisperCtrl.masterUsername : '';
            const playerEntity = getMasterEntity(bot, masterUser);

            if (playerEntity) {
                nav.followEntity(playerEntity, 2);
                currentActionText = `${playerEntity.username || masterUser} takip ediliyor.`;
                if (whisperCtrl) whisperCtrl.reply(`Seni gördüm ${playerEntity.username || masterUser}, geliyorum!`);
            } else {
                if (whisperCtrl) whisperCtrl.reply("Etrafımda kimseyi göremiyorum! Yaklaşıp tekrar dene.");
            }
        },
        STOP: () => {
            nav.stop();
            currentActionText = "Durdu.";
            if (whisperCtrl) whisperCtrl.reply("Duruyorum usta.");
        },
        ATTACK: () => {
            const target = combat.getNearestHostile(12);
            if (target) { combat.startCombatLoop(target); }
        },
        ESCAPE: () => { bot.chat('/spawn'); }
    };
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Sunucu Aktif: ${PORT}`));
