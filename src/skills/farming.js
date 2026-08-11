async function autoFarm(bot) {
    const mcData = require('minecraft-data')(bot.version);
    
    // Olgunlaşmış buğdayları (wheat) veya havuçları bul
    const cropBlock = bot.findBlock({
        matching: (b) => (b.name === 'wheat' || b.name === 'carrots' || b.name === 'potatoes') && b.metadata === 7,
        maxDistance: 6
    });

    if (!cropBlock) {
        return { success: false, message: 'Yakında toplanacak olgun mahsul bulunamadı.' };
    }

    try {
        await bot.dig(cropBlock); // Hasat et
        
        // Yeniden ekmek için eldeki tohumu seç
        const seed = bot.inventory.items().find(i => i.name.includes('seeds') || i.name.includes('carrot') || i.name.includes('potato'));
        if (seed) {
            await bot.equip(seed, 'hand');
            const farmland = bot.blockAt(cropBlock.position.offset(0, -1, 0));
            await bot.placeBlock(farmland, { x: 0, y: 1, z: 0 });
        }
        return { success: true, message: 'Mahsul toplanıp yerine yenisi ekildi!' };
    } catch (err) {
        return { success: false, message: `Çiftçilik Hatası: ${err.message}` };
    }
}

module.exports = { autoFarm };
