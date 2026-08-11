async function autoCraft(bot, itemName, count = 1) {
    try {
        const mcData = require('minecraft-data')(bot.version);
        const item = mcData.itemsByName[itemName];

        if (!item) {
            return { success: false, message: `Bilinmeyen eşya: ${itemName}` };
        }

        // 1. Envanter (2x2) tariflerini kontrol et
        let recipes = bot.recipesFor(item.id, null, 1, null);

        if (recipes.length > 0) {
            await bot.craft(recipes[0], count, null);
            return { success: true, message: `${itemName} x${count} envanterde üretildi.` };
        }

        // 2. Etraftaki Crafting Table'ı ara
        const craftingTable = bot.findBlock({
            matching: mcData.blocksByName.crafting_table ? mcData.blocksByName.crafting_table.id : 58,
            maxDistance: 4
        });

        if (craftingTable) {
            recipes = bot.recipesFor(item.id, null, 1, craftingTable);
            if (recipes.length > 0) {
                await bot.craft(recipes[0], count, craftingTable);
                return { success: true, message: `${itemName} x${count} Çalışma Masasında üretildi.` };
            }
        }

        return { success: false, message: `${itemName} için gerekli tarif veya malzeme bulunamadı.` };
    } catch (err) {
        return { success: false, message: `Crafting Hatası: ${err.message}` };
    }
}

module.exports = { autoCraft };
