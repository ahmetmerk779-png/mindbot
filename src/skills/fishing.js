async function startFishing(bot) {
    try {
        const rod = bot.inventory.items().find(i => i.name === 'fishing_rod');
        if (!rod) return { success: false, message: 'Envanterde olta (fishing_rod) yok!' };

        await bot.equip(rod, 'hand');
        
        // Su bloğuna bak
        const water = bot.findBlock({ matching: (b) => b.name === 'water', maxDistance: 4 });
        if (!water) return { success: false, message: 'Yakında olta atacak su bulunamadı.' };

        await bot.lookAt(water.position);
        await bot.fish();
        return { success: true, message: 'Olta suya atıldı, balık bekleniyor...' };
    } catch (err) {
        bot.activateItem(); // İptal et
        return { success: false, message: `Balıkçılık Hatası: ${err.message}` };
    }
}

module.exports = { startFishing };
