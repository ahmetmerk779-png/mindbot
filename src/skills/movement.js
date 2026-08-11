const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { GoalBlock } = goals;

function setupPathfinder(bot) {
    // Sadece eklentiyi bota bağla
    bot.loadPlugin(pathfinder);
}

function initMovements(bot) {
    // Sürüm ve harita verilerini bot spawn olduktan sonra yükle
    try {
        const mcData = require('minecraft-data')(bot.version);
        if (!mcData) return;

        const defaultMove = new Movements(bot, mcData);
        defaultMove.canDig = false; // RAM ve performans için kazmayı kapat
        defaultMove.allowParkour = true;

        if (bot.pathfinder) {
            bot.pathfinder.setMovements(defaultMove);
        }
    } catch (err) {
        console.error("Movements yükleme hatası:", err.message);
    }
}

function goToLocation(bot, x, y, z) {
    return new Promise((resolve) => {
        if (!bot.pathfinder) {
            return resolve({ success: false, message: 'Pathfinder henüz hazır değil.' });
        }

        const goal = new GoalBlock(x, y, z);
        bot.pathfinder.setGoal(goal);

        const onGoal = () => {
            cleanup();
            resolve({ success: true, message: `Hedefe varıldı: ${x}, ${y}, ${z}` });
        };

        const onStop = () => {
            cleanup();
            resolve({ success: false, message: 'Yol tıkandı veya durduruldu.' });
        };

        function cleanup() {
            bot.removeListener('goal_reached', onGoal);
            bot.removeListener('path_stop', onStop);
        }

        bot.once('goal_reached', onGoal);
        bot.once('path_stop', onStop);
    });
}

module.exports = { setupPathfinder, initMovements, goToLocation };
