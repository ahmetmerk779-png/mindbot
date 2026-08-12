const { pathfinder } = require('mineflayer-pathfinder');

class AdvancedPathfinder {
    constructor(bot) {
        this.bot = bot;
        this.followInterval = null;
        this.targetEntity = null;
    }

    init() {
        if (!this.bot) return;
        try { this.bot.loadPlugin(pathfinder); } catch (e) {}
    }

    // DOĞRUDAN FİZİK MOTORU İLE TAKİP (Yarım blok/Slab engellerine takılmaz)
    followEntity(entity, range = 2) {
        this.stop();
        this.targetEntity = entity;

        this.followInterval = setInterval(() => {
            if (!this.bot || !this.targetEntity || !this.targetEntity.position) {
                this.stop();
                return;
            }

            const botPos = this.bot.entity.position;
            const targetPos = this.targetEntity.position;
            const dist = botPos.distanceTo(targetPos);

            // 2 bloktan uzaktaysa doğrudan oyuncuya doğru koş
            if (dist > range) {
                // Oyuncunun göğüs hizasına bak
                this.bot.lookAt(targetPos.offset(0, 1.4, 0), true);

                this.bot.setControlState('forward', true);
                this.bot.setControlState('sprint', dist > 4);

                // Önünde yarım blok/slab veya engel varsa zıpla
                if (this.bot.entity.isCollidedHorizontally) {
                    this.bot.setControlState('jump', true);
                } else {
                    this.bot.setControlState('jump', false);
                }
            } else {
                // Dibine gelince dur
                this.bot.clearControlStates();
            }
        }, 100);
    }

    stop() {
        if (this.followInterval) {
            clearInterval(this.followInterval);
            this.followInterval = null;
        }
        this.targetEntity = null;
        if (this.bot) {
            this.bot.clearControlStates();
        }
    }
}

module.exports = AdvancedPathfinder;
