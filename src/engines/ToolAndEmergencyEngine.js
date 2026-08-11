class ToolAndEmergencyEngine {
    constructor(bot) {
        this.bot = bot;
    }

    async autoEquipArmor() {
        const slots = {
            helmet: ['netherite_helmet', 'diamond_helmet', 'iron_helmet'],
            chestplate: ['netherite_chestplate', 'diamond_chestplate', 'iron_chestplate'],
            leggings: ['netherite_leggings', 'diamond_leggings', 'iron_leggings'],
            boots: ['netherite_boots', 'diamond_boots', 'iron_boots']
        };

        const items = this.bot.inventory.items();
        for (const [dest, list] of Object.entries(slots)) {
            for (const name of list) {
                const item = items.find(i => i.name === name);
                if (item) {
                    try { await this.bot.equip(item, dest); break; } catch (e) {}
                }
            }
        }
    }

    async autoEat() {
        if (this.bot.food >= 18) return;
        const foods = ['golden_apple', 'cooked_beef', 'cooked_porkchop', 'bread'];
        const items = this.bot.inventory.items();

        for (const name of foods) {
            const food = items.find(i => i.name === name);
            if (food) {
                await this.bot.equip(food, 'hand');
                await this.bot.consume();
                break;
            }
        }
    }

    // Acil Durum Kaçışı (Can < 6 ise /spawn atar)
    checkEmergencyEscape() {
        if (this.bot.health > 0 && this.bot.health <= 6) {
            console.warn("⚠️ [EMERGENCY]: Can kritik seviyede! /spawn çekiliyor...");
            this.bot.chat('/spawn');
            return true;
        }
        return false;
    }
}

module.exports = ToolAndEmergencyEngine;
