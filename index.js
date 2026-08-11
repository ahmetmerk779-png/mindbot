const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const mineflayer = require('mineflayer');

const { setupPathfinder, initMovements, goToLocation } = require('./src/skills/movement');
const { autoCraft } = require('./src/skills/crafting');
const { getWorldState } = require('./src/perception');
const { decideNextAction } = require('./src/brain');

process.on('unhandledRejection', (reason) => console.error('Hata Yakalandı:', reason));
process.on('uncaughtException', (err) => console.error('İstisna Yakalandı:', err));

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let bot = null;
let aiLoopInterval = null;
let currentActionText = "Form doldurulup başlatılmayı bekliyor...";

function sendLog(text, type = 'info') {
    const time = new Date().toLocaleTimeString();
    io.emit('log_message', { text, type, time });
}

io.on('connection', (socket) => {

    const statusTicker = setInterval(() => {
        if (bot && bot.entity) {
            socket.emit('bot_status', {
                connected: true,
                health: bot.health,
                food: bot.food,
                location: `X: ${Math.floor(bot.entity.position.x)}, Y: ${Math.floor(bot.entity.position.y)}, Z: ${Math.floor(bot.entity.position.z)}`,
                action: currentActionText
            });
        } else {
            socket.emit('bot_status', {
                connected: false,
                health: 0,
                food: 0,
                location: 'X: 0, Y: 0, Z: 0',
                action: currentActionText
            });
        }
    }, 1000);

    socket.on('start_bot_session', (config) => {
        if (bot) {
            sendLog("Zaten çalışan bir bot var! Önce kapatın.", "error");
            return;
        }

        sendLog(`Bot başlatılıyor... (${config.host}:${config.port})`, "info");
        currentActionText = "Sunucuya bağlanılıyor...";

        try {
            bot = mineflayer.createBot({
                host: config.host,
                port: parseInt(config.port) || 25565,
                username: config.username || 'MindCraft_Bot',
                version: config.version || '1.21.11',
                viewDistance: 'tiny',
                physicsEnabled: true
            });

            setupPathfinder(bot);

            bot.once('spawn', async () => {
                initMovements(bot);

                sendLog("✅ Bot oyuna girdi!", "info");
                currentActionText = "Yapay zeka döngüsü başlatılıyor...";

                let currentGoal = "Etrafta dolaş, oyuncularla konuş ve eşya üret.";
                let lastAction = "Oyuna katıldı.";

                // OTONOM DÖNGÜ (EYLEM YÖNETİCİSİ)
                aiLoopInterval = setInterval(async () => {
                    if (!bot || !bot.entity) return;

                    try {
                        const state = getWorldState(bot);
                        if (!state) return;

                        // AI Karar Alıyor
                        const decision = await decideNextAction(state, currentGoal, lastAction, config.groqKey);
                        currentActionText = decision.thought;
                        lastAction = decision.thought;
                        sendLog(`AI Kararı: ${decision.thought}`, 'info');

                        // 1. HAREKET EYLEMİ
                        if (decision.action === 'MOVE' && decision.params.x) {
                            const { x, y, z } = decision.params;
                            sendLog(`Yürünüyor -> X:${x} Y:${y} Z:${z}`, 'info');
                            await goToLocation(bot, x, y, z);
                        } 
                        // 2. KONUŞMA EYLEMİ
                        else if (decision.action === 'TALK' && decision.params.message) {
                            bot.chat(decision.params.message);
                        }
                        // 3. CRAFTING EYLEMİ
                        else if (decision.action === 'CRAFT' && decision.params.item_name) {
                            const res = await autoCraft(bot, decision.params.item_name, decision.params.count || 1);
                            sendLog(`Craft Sonucu: ${res.message}`, res.success ? 'info' : 'error');
                        }

                    } catch (err) {
                        sendLog(`Döngü Hatası: ${err.message}`, 'error');
                    }
                }, 8000);
            });

            bot.on('chat', (username, message) => {
                if (username === bot.username) return;
                sendLog(`<${username}> ${message}`, 'chat');
            });

            bot.on('error', err => sendLog(`Bot Hatası: ${err.message}`, 'error'));
            bot.on('kicked', reason => {
                sendLog(`Bot Sunucudan Atıldı: ${reason}`, 'error');
                stopBotSession();
            });
            bot.on('end', () => {
                sendLog("Bot bağlantısı kesildi.", "error");
                stopBotSession();
            });

        } catch (err) {
            sendLog(`Başlatma Hatası: ${err.message}`, 'error');
        }
    });

    socket.on('stop_bot_session', () => stopBotSession());

    socket.on('send_command', (msg) => {
        if (bot) {
            bot.chat(msg);
            sendLog(`[Panelden Gönderildi]: ${msg}`, 'chat');
        }
    });

    socket.on('disconnect', () => clearInterval(statusTicker));
});

function stopBotSession() {
    if (aiLoopInterval) clearInterval(aiLoopInterval);
    if (bot) {
        bot.quit();
        bot = null;
    }
    currentActionText = "Bot durduruldu.";
    sendLog("Bot oturumu tamamen kapatıldı.", "info");
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Web Paneli Aktif: ${PORT}`));
