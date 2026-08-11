class AdvancedGUIAndNPCHandler {
    constructor(bot) {
        this.bot = bot;
    }

    async interactWithNPC(npcName, clickType = 'right') {
        const npc = this.bot.nearestEntity(e => {
            if (!e || !e.name) return false;
            return e.name.toLowerCase().includes(npcName.toLowerCase()) || 
                   (e.customName && e.customName.toLowerCase().includes(npcName.toLowerCase()));
        });

        if (!npc) return { success: false, message: `Yakında ${npcName} NPC'si bulunamadı.` };

        try {
            await this.bot.lookAt(npc.position.offset(0, npc.height * 0.8, 0));
            if (clickType === 'right') {
                await this.bot.activateEntity(npc);
                return { success: true, message: `${npcName} NPC'sine SAĞ tıklandı.` };
            } else {
                await this.bot.attack(npc);
                return { success: true, message: `${npcName} NPC'sine SOL tıklandı.` };
            }
        } catch (err) {
            return { success: false, message: `NPC Hatası: ${err.message}` };
        }
    }

    async clickCustomGUISlot(slotIndex, mouseButton = 0) {
        if (!this.bot.currentWindow) {
            return { success: false, message: 'Açık GUI menüsü yok.' };
        }
        try {
            await this.bot.clickWindow(slotIndex, mouseButton, 0);
            return { success: true, message: `GUI Slot ${slotIndex} tıklandı.` };
        } catch (err) {
            return { success: false, message: `GUI Hatası: ${err.message}` };
        }
    }

    async handleContainer(action = 'deposit', itemName = 'all') {
        const containerBlock = this.bot.findBlock({
            matching: b => b.name.includes('chest') || b.name.includes('shulker_box'),
            maxDistance: 4.5
        });

        if (!containerBlock) return { success: false, message: 'Yakında Sandık veya Shulker bulunamadı.' };

        try {
            const container = await this.bot.openContainer(containerBlock);
            if (action === 'deposit') {
                for (const item of this.bot.inventory.items()) {
                    if (itemName === 'all' || item.name.includes(itemName)) {
                        await container.deposit(item.type, null, item.count);
                    }
                }
                container.close();
                return { success: true, message: 'Eşyalar konteynere aktarıldı.' };
            } else {
                for (const item of container.containerItems()) {
                    if (itemName === 'all' || item.name.includes(itemName)) {
                        await container.withdraw(item.type, null, item.count);
                    }
                }
                container.close();
                return { success: true, message: 'Eşyalar konteynerden alındı.' };
            }
        } catch (err) {
            return { success: false, message: `Konteyner Hatası: ${err.message}` };
        }
    }
}

module.exports = AdvancedGUIAndNPCHandler;
