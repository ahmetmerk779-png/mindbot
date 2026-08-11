const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');

class AdvancedPathfinder {
    constructor(bot) {
        this.bot = bot;
        this.movements = null;
        this.stuckCheckInterval = null;
        this.lastPos = null;
        this.stuckCount = 0;
    }

    init() {
        this.bot.loadPlugin(pathfinder);
        const mcData = require('minecraft-data')(this.bot.version);
        
        this.movements = new Movements(this.bot, mcData);
        this.movements.canDig = true;
        this.movements.allowParkour = true;
        this.movements.allowSprinting = true;
        this.movements.allow1by1towers = true;
        this.movements.canOpenDoors = true;
        this.movements.maxDropDown = 4;

        // Köprüleme blokları
        const buildBlocks = ['cobblestone', 'dirt', 'stone', 'oak_planks'];
        this.movements.scafoldingBlocks = buildBlocks.map(name => mcData.blocksByName[name]?.id).filter(Boolean);

        // Tehlikeli bloklar
        this.movements.liquidsCost = 8;
        ['lava', 'fire', 'sweet_berry_bush', 'magma_block'].forEach(name => {
            const b = mcData.blocksByName[name];
            if (b) this.movements.cantBreak.add(b.id);
        });

        this.bot.pathfinder.setMovements(this.movements);
        this.startAntiStuckEngine();
    }

    startAntiStuckEngine() {
        if (this.stuckCheckInterval) clearInterval(this.stuckCheckInterval);

        this.stuckCheckInterval = setInterval(async () => {
            if (!this.bot || !this.bot.entity || !this.bot.pathfinder.isMoving()) {
                this.stuckCount = 0;
                return;
            }

            const currentPos = this.bot.entity.position;
            if (this.lastPos && currentPos.distanceTo(this.lastPos) < 0.5) {
                this.stuckCount++;
                if (this.stuckCount >= 2) {
                    console.warn("⚠️ [STUCK]: Bot takıldı! Otomatik kurtarma tetiklendi.");
                    await this.recoverFromStuck();
                    this.stuckCount = 0;
                }
            } else {
                this.stuckCount = 0;
            }
            this.lastPos = currentPos.clone();
        }, 1200);
    }

    async recoverFromStuck() {
        this.bot.pathfinder.setGoal(null);
        const pos = this.bot.entity.position;
        const headBlock = this.bot.blockAt(pos.offset(0, 2, 0));

        if (headBlock && headBlock.name !== 'air') {
            try { await this.bot.dig(headBlock); } catch (e) {}
        }

        this.bot.setControlState('jump', true);
        this.bot.setControlState('forward', true);
        setTimeout(() => this.bot.clearControlStates(), 800);
    }

    followEntity(entity, range = 2) {
        if (!entity) return;
        this.bot.pathfinder.setGoal(new goals.GoalFollow(entity, range), true);
    }

    gotoBlock(x, y, z) {
        this.bot.pathfinder.setGoal(new goals.GoalBlock(x, y, z));
    }

    stop() {
        this.bot.pathfinder.setGoal(null);
        this.bot.clearControlStates();
    }
}

module.exports = AdvancedPathfinder;
