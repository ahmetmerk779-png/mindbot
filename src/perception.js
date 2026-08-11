function getWorldState(bot) {
    if (!bot.entity) return null;
    const pos = bot.entity.position;
    
    const inventory = bot.inventory.items().map(i => `${i.name} x${i.count}`).join(', ');
    
    const nearbyEntities = Object.values(bot.entities)
        .filter(e => e !== bot.entity && bot.entity.position.distanceTo(e.position) < 12)
        .map(e => e.customName ? e.customName.toString() : e.name)
        .slice(0, 5)
        .join(', ');

    return {
        location: `X: ${Math.floor(pos.x)}, Y: ${Math.floor(pos.y)}, Z: ${Math.floor(pos.z)}`,
        rawPos: { x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z) },
        health: bot.health,
        food: bot.food,
        inventory: inventory || 'Boş',
        nearby: nearbyEntities || 'Kimse yok'
    };
}

module.exports = { getWorldState };
