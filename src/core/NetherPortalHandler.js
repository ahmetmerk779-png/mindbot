const Vec3 = require('vec3');

class NetherPortalHandler {
    constructor(bot) {
        this.bot = bot;
    }

    async enterExistingPortal() {
        const portalBlock = this.bot.findBlock({ matching: b => b.name === 'nether_portal', maxDistance: 15 });
        if (!portalBlock) return { success: false, message: 'Yakında aktif portal yok.' };

        this.bot.pathfinder.setGoal(new (require('mineflayer-pathfinder').goals.GoalBlock)(
            portalBlock.position.x, portalBlock.position.y, portalBlock.position.z
        ));
        return { success: true, message: 'Nether Portalına yürünüyor...' };
    }

    async buildAndIgnitePortal() {
        const obsidian = this.bot.inventory.items().find(i => i.name === 'obsidian');
        const flintAndSteel = this.bot.inventory.items().find(i => i.name === 'flint_and_steel');

        if (!obsidian || obsidian.count < 10) return { success: false, message: 'En az 10 Obsidyen gerekli!' };
        if (!flintAndSteel) return { success: false, message: 'Envanterde Çakmak Taşı yok!' };

        const basePos = this.bot.entity.position.offset(1, 0, 0).floored();
        const portalTemplate = [
            { x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 },
            { x: 0, y: 1, z: 0 }, { x: 0, y: 2, z: 0 }, { x: 0, y: 3, z: 0 },
            { x: 3, y: 1, z: 0 }, { x: 3, y: 2, z: 0 }, { x: 3, y: 3, z: 0 },
            { x: 1, y: 4, z: 0 }, { x: 2, y: 4, z: 0 }
        ];

        try {
            await this.bot.equip(obsidian, 'hand');
            for (const offset of portalTemplate) {
                const targetPos = basePos.offset(offset.x, offset.y, offset.z);
                const refBlock = this.bot.blockAt(targetPos.offset(0, -1, 0));
                if (refBlock && this.bot.blockAt(targetPos).name === 'air') {
                    await this.bot.placeBlock(refBlock, new Vec3(0, 1, 0));
                    await new Promise(r => setTimeout(r, 250));
                }
            }

            await this.bot.equip(flintAndSteel, 'hand');
            const insideBlock = this.bot.blockAt(basePos.offset(1, 1, 0));
            await this.bot.placeBlock(insideBlock, new Vec3(0, 1, 0));

            return { success: true, message: 'Nether Portalı inşa edildi ve yakıldı!' };
        } catch (err) {
            return { success: false, message: `Portal Hatası: ${err.message}` };
        }
    }
}

module.exports = NetherPortalHandler;
