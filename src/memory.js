class BotMemory {
    constructor() {
        this.shortTermMemory = []; // Son chat ve eylemler
        this.failedActions = [];    // Denenip başarısız olan şeyler
        this.learnedSkills = [];     // Keşfedilen stratejiler
    }

    addHistory(action, result) {
        this.shortTermMemory.push({ action, result, timestamp: new Date().toLocaleTimeString() });
        if (this.shortTermMemory.length > 8) this.shortTermMemory.shift();
    }

    addFailure(action, reason) {
        this.failedActions.push({ action, reason });
        if (this.failedActions.length > 5) this.failedActions.shift();
    }

    addSkill(skillName, description) {
        if (!this.learnedSkills.includes(skillName)) {
            this.learnedSkills.push({ name: skillName, desc: description });
        }
    }

    getMemoryContext() {
        const historyText = this.shortTermMemory.map(m => `[${m.action} -> ${m.result}]`).join(', ');
        const failText = this.failedActions.map(f => `[${f.action} Başarısız: ${f.reason}]`).join(', ');
        return {
            history: historyText || 'Henüz eylem yok.',
            failures: failText || 'Henüz başarısızlık yok.'
        };
    }
}

module.exports = new BotMemory();
