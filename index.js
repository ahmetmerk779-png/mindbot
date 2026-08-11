const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const mineflayer = require('mineflayer');

// TÜM BECERİ MODÜLLERİ
const { setupPathfinder, initMovements, goToLocation } = require('./src/skills/movement');
const { setupCombat, followTarget, attackTarget, stopCombat } = require('./src/skills/combat');
const { autoFarm } = require('./src/skills/farming');
const { startFishing } = require('./src/skills/fishing');
const { autoCraft } = require('./src/skills/crafting');
const { getWorldState } = require('./src/perception');
const { decideNextAction } = require('./src/brain');
const memory = require('./src/memory');

process.on('unhandledRejection', (r) => console.error('Hata:', r));
process.on('uncaughtException', (e) => console.error('İstisna:', e));

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let bot = null;
let aiLoopInterval = null;
let currentActionText = "Başlatılmayı bekliyor...";

function sendLog(text, type = 'info') {
    io.emit('log_message', { text, type, time: new Date().toLocaleTimeString() });
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
            socket.emit('bot_status', { connected: false, health: 0, food: 0, location: 'X:0 Y:0 Z:0', action: currentActionText });
        }
    }, 1000);

    socket.on('start_bot_session', (config) => {
        if (bot) return sendLog("Zaten çalışan bir bot var!", "error");

        sendLog(`Bot Başlatılıyor (${config.host})...`, "info");
        currentActionText = "Sunucuya bağlanılıyor...";

        try {
            bot = mineflayer.createBot({
                host: config.host,
                port: parseInt(config.port) || 25565,
                username: config.username || 'MindCraft_AI',
                version: config.version || '1.21.11',
                viewDistance: 'tiny',
                physicsEnabled: true
            });

            setupPathfinder(bot);
            setupCombat(bot); // PvP Modülünü Yükle

            bot.once('spawn', async () => {
                initMovements(bot);
                sendLog("✅ Bot Oyuna Girdi!", "info");

                let currentGoal = "Etrafı keşfet, çiftçilik veya balıkçılık yap, biri saldırırsa savaş!";

                // OTONOM YAPAY ZEKA DÖNGÜSÜ
                aiLoopInterval = setInterval(async () => {
                    if (!bot || !bot.entity) return;

                    try {
                        const state = getWorldState(bot);
                        if (!state) return;

                        // Yapay Zeka Karar Alıyor (CoT + Hafıza)
                        const decision = await decideNextAction(state, currentGoal, config.groqKey);
                        currentActionText = decision.thought;
                        sendLog(`🧠 Düşünce: ${decision.reasoning}`, 'info');

                        // Eğer bot chate bir şey yazmak istediyse
                        if (decision.chat_response) {
                            bot.chat(decision.chat_response);
                        }

                        let result = { success: true, message: 'Beklendi.' };

                        // BECERİ YÖNETİCİSİ (EXECUTION)
                        switch (decision.action) {
                            case 'MOVE':
                                if (decision.params.x) result = await goToLocation(bot, decision.params.x, decision.params.y, decision.params.z);
                                break;
                            case 'FOLLOW':
                                if (decision.params.target_name) result = followTarget(bot, decision.params.target_name);
                                break;
                            case 'ATTACK':
                                if (decision.params.target_name) result = await attackTarget(bot, decision.params.target_name);
                                break;
                            case 'FARM':
                                result = await autoFarm(bot);
                                break;
                            case 'FISH':
                                result = await startFishing(bot);
                                break;
                            case 'CRAFT':
                                if (decision.params.item_name) result = await autoCraft(bot, decision.params.item_name, decision.params.count);
                                break;
                            case 'TALK':
                                if (decision.params.message) bot.chat(decision.params.message);
                                break;
                        }

                        // HAFIZAYA VE KENDİ KENDİNE ÖĞRENMEYE KAYDET
                        if (result.success) {
                            memory.addHistory(decision.action, result.message);
                        } else {
                            memory.addFailure(decision.action, result.message);
                            sendLog(`⚠️ Öğrenme Notu (Başarısızlık): ${result.message}`, 'error');
                        }

                    } catch (err) {
                        sendLog(`Döngü Hatası: ${err.message}`, 'error');
                    }
                }, 8000);
            });

            // Saldırıya Uğradığında Otomatik Savunma (Öğrenilmiş Beceri)
            bot.on('entityHurt', (entity) => {
                if (entity === bot.entity) {
                    sendLog("⚠️ Bot Hasar Aldı! Savaş modu tetiklendi.", "error");
                    const attacker = bot.nearestEntity(e => e.type === 'mob' || e.type === 'player');
                    if (attacker) attackTarget(bot, attacker.name || 'Saldırgan');
                }
            });

            bot.on('chat', (username, message) => {
                if (username === bot.username) return;
                sendLog(`<${username}> ${message}`, 'chat');
            });

            bot.on('error', err => sendLog(`Hata: ${err.message}`, 'error'));
            bot.on('kicked', r => { sendLog(`Atıldı: ${r}`, 'error'); stopBotSession(); });
            bot.on('end', () => stopBotSession());

        } catch (err) { sendLog(`Başlatma Hatası: ${err.message}`, 'error'); }
    });

    socket.on('stop_bot_session', () => stopBotSession());
    socket.on('send_command', (msg) => {
        if (bot) { bot.chat(msg); sendLog(`[Panel]: ${msg}`, 'chat'); }
    });
    socket.on('disconnect', () => clearInterval(statusTicker));
});

function stopBotSession() {
    if (aiLoopInterval) clearInterval(aiLoopInterval);
    if (bot) { stopCombat(bot); bot.quit(); bot = null; }
    currentActionText = "Durduruldu.";
    sendLog("Oturum kapatıldı.", "info");
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 MindCraft AI Motoru Aktif: ${PORT}`));
