const { plugin: pvp } = require('mineflayer-pvp');
const { goals } = require('mineflayer-pathfinder');

function setupCombat(bot) {
    bot.loadPlugin(pvp);
}

// Oyuncuyu veya Varlığı Takip Etme
function followTarget(bot, targetName) {
    const target = bot.players[targetName]?.entity || bot.nearestEntity(e => e.name === targetName);
    if (!target) return { success: false, message: `${targetName} bulunamadı.` };

    bot.pathfinder.setGoal(new goals.GoalFollow(target, 2), true);
    return { success: true, message: `${targetName} takip ediliyor.` };
}

// PvP / Dövüş Modu
async function attackTarget(bot, targetName) {
    const target = bot.players[targetName]?.entity || bot.nearestEntity(e => e.name?.includes(targetName));
    if (!target) return { success: false, message: `Saldırılacak hedef (${targetName}) bulunamadı.` };

    // Envanterdeki en güçlü kılıcı veya baltai kuşan
    const weapon = bot.inventory.items().find(i => i.name.includes('sword') || i.name.includes('axe'));
    if (weapon) await bot.equip(weapon, 'hand');

    bot.pvp.attack(target);
    return { success: true, message: `${targetName} hedefine saldırı başlatıldı!` };
}

function stopCombat(bot) {
    bot.pvp.stop();
    bot.pathfinder.stop();
}

module.exports = { setupCombat, followTarget, attackTarget, stopCombat };
