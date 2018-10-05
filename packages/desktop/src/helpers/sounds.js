/**
 * Sounds module.
 * Usage: require('./sounds').ack.play()
 */

// 1. add file to static/snd
// 2. add file name here
const files = ['ack', 'sending', 'sent', 'received', 'destroy'];

class Sound {
    constructor(id) {
        this.node = document.createElement('audio');
        this.node.src = `static/snd/${id}.ogg`;
    }

    play() {
        return this.node.play(); //eslint-disable-line
    }

    get volume() {
        return this.node.volume;
    }

    set volume(val) {
        this.node.volume = val;
    }
}

const sounds = {};

files.forEach(id => {
    sounds[id] = new Sound(id);
});

module.exports = sounds;
