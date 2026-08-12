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

// Panel soketini ayırdık, 3D ekranla çakışmaz
const io = new Server(server, { path: '/panel-socket' });

// Paneli /panel rotasına aldık
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

function getMasterEntity(botInstance, masterUsername) {
    if (!botInstance || !botInstance.players || !masterUsername) return null;
    const keys = Object.keys(botInstance.players);
    const matchKey = keys.find(k => k.toLowerCase() === masterUsername.toLowerCase());
    if (matchKey && botInstance.players[matchKey] && botInstance.players[matchKey].entity) {
        return botInstance.players[matchKey].entity;
    }
    return null;
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

        // TPA Otomatik Kabul
        bot.on('message', (jsonMsg) => {
            const txt = jsonMsg.toString().toLowerCase();
            if (txt.includes('tp') || txt.includes('ışınlanma')) {
                setTimeout(() => bot.chat('/tpaccept'), 1000);
            }
        });

        captchaAuth = new CaptchaAndAuthHandler(bot, { password: config.password, subServer: config.subServer });
        captchaAuth.init();

        const proxy = new ProxyHandler(bot, { password: config.password, targetSubServer: config.subServer });
        proxy.init();

        bot.once('spawn', () => {
            log("✅ Sunucuya Girildi!", "info");

            // 3D Ekranı kök dizine (/) bağlıyoruz
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

            const masterUser = config.masterUser || 'OyundakiAdin';
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
            let playerEntity = getMasterEntity(bot, masterUser);
            
            // Isim uyuşmazsa etraftaki en yakın oyuncuyu bulup takip eder
            if (!playerEntity) {
                playerEntity = bot.nearestEntity(e => e.type === 'player' && e.username !== bot.username);
            }

            if (playerEntity) {
                nav.followEntity(playerEntity, 2);
                currentActionText = `${playerEntity.username} takip ediliyor.`;
                if (whisperCtrl) whisperCtrl.reply(`Seni gördüm ${playerEntity.username}, geliyorum!`);
            } else {
                if (whisperCtrl) whisperCtrl.reply("Görüş alanımda oyuncu yok! Yaklaş veya /tpa at.");
            }
        },
        STOP: () => {
            nav.stop();
            currentActionText = "Durdu.";
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
