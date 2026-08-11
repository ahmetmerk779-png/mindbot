const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { GoalBlock } = goals;

function setupPathfinder(bot) {
    bot.loadPlugin(pathfinder);
    const mcData = require('minecraft-data')(bot.version);
    const defaultMove = new Movements(bot, mcData);
    
    defaultMove.canDig = false; // RAM tasarrufu için blok kazmayı kısıtla
    defaultMove.allowParkour = true;
    bot.pathfinder.setMovements(defaultMove);
}

function goToLocation(bot, x, y, z) {
    return new Promise((resolve) => {
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

module.exports = { setupPathfinder, goToLocation };
