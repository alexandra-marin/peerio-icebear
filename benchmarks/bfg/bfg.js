/* eslint-disable strict */
const Bullet = require('./bullet');

async function makeBoom(log, bulletsCount = 2) {
    const bullets = [];
    const host = new Bullet(log, true);
    bullets.push(host);
    for (let i = 0; i < bulletsCount; i++) {
        bullets.push(new Bullet(log));
    }

    const promises = bullets.map(b => b.fire());
    log.info('Waiting for all bullets to fire...');
    await Promise.all(promises);
    log.info('All bullets are flying!');

    log.info('Starting chat.');
    host.startChat(bullets.map(b => b.username));
    host.startTelemetryReports();
}

module.exports = makeBoom;
