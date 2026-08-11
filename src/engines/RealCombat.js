const { goals } = require('mineflayer-pathfinder');

class RealCombat {
    constructor(bot) {
        this.bot = bot;
        this.activeTarget = null;
        this.isFighting = false;
        this.combatInterval = null;
    }

    getNearestHostile(maxDistance = 12) {
        return this.bot.nearestEntity(entity => {
            if (!entity || entity.type !== 'mob') return false;
            const name = (entity.name || '').toLowerCase();
            const hostiles = ['zombie', 'skeleton', 'spider', 'creeper', 'drowned', 'husk'];
            return hostiles.some(h => name.includes(h)) && this.bot.entity.position.distanceTo(entity.position) <= maxDistance;
        });
    }

    startCombatLoop(target) {
        if (this.isFighting && this.activeTarget === target) return;

        this.isFighting = true;
        this.activeTarget = target;

        const weapon = this.bot.inventory.items().find(i => i.name.includes('sword') || i.name.includes('axe'));
        if (weapon) this.bot.equip(weapon, 'hand').catch(() => {});

        this.bot.pathfinder.setGoal(new goals.GoalFollow(target, 1.8), true);

        this.combatInterval = setInterval(async () => {
            if (!target || !target.isValid || this.bot.health <= 0) {
                this.stopCombat();
                return;
            }

            const dist = this.bot.entity.position.distanceTo(target.position);
            await this.bot.lookAt(target.position.offset(0, target.height * 0.85, 0), true).catch(() => {});

            if (dist <= 3.8) {
                if (this.bot.entity.onGround) {
                    this.bot.setControlState('jump', true);
                    this.bot.setControlState('jump', false);
                }
                if (this.bot.entity.velocity.y < 0 || dist <= 2.2) {
                    this.bot.attack(target);
                }
            }
        }, 200);
    }

    stopCombat() {
        if (!this.isFighting) return;
        this.isFighting = false;
        this.activeTarget = null;
        if (this.combatInterval) clearInterval(this.combatInterval);
        this.bot.pathfinder.setGoal(null);
    }
}

module.exports = RealCombat;
