import CucumbotBase from './cucumbot-base';

export default class CucumbotServer extends CucumbotBase {
    constructor(world) {
        super(world);
        process.on('message', this.processMessage);
    }

    async createAccount() {
        await this.world.createAccount();
        this.sendReady();
    }
}
