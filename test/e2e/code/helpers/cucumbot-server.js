const CucumbotBase = require('./cucumbot-base');

class CucumbotServer extends CucumbotBase {
    constructor(world) {
        super(world);
        process.on('message', this.processMessage);
    }

    async createAccount() {
        await this.world.createAccount();
        this.sendReady();
    }
}


module.exports = CucumbotServer;
