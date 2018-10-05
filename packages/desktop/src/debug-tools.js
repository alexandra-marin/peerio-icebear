/* eslint-disable */
window.ice = require('peerio-icebear');
// shortcut to use with promises
window.clog = console.log.bind(console);
window.cerr = console.error.bind(console);

window.d = {};
//-- Sends messages to active chat
let spamInterval;
let spamCounter = 0;

d.spam = (interval = 1000, words = 10) => {
    if (spamInterval) return;
    spamInterval = setInterval(() => {
        if (!ice.chatStore.activeChat) return;
        ice.chatStore.activeChat.sendMessage(
            `${spamCounter++} ${ice.PhraseDictionary.current.getPassphrase(
                words
            )}`
        );
    }, interval);
};
d.stopSpam = () => {
    if (!spamInterval) return;
    clearInterval(spamInterval);
    spamInterval = null;
};
//--------------------------------------

//-- Loads pages of current chat in the ui until finds a message containing specific text, case-insensitive
d.findMessage = async text => {
    const chat = ice.chatStore.activeChat;
    if (!chat) return;
    text = text.toUpperCase();
    while (chat.canGoUp) {
        chat.loadPreviousPage();
        await ice.prombservable.asPromise(chat, 'loadingTopPage', false);
        for (const m of chat.messages) {
            if (m.text && m.text.toUpperCase().includes(text)) {
                console.log(m.text, m);
                return;
            }
        }
    }
};
//---------------------------------------

d.testSocketThrottle = async requestCount => {
    if (!requestCount) return;
    const start = Date.now();
    const promises = [];
    let c = requestCount;
    while (c--) {
        promises.push(ice.socket.send('/auth/server/settings'));
    }
    await Promise.all(promises);
    console.log(
        `Throttle test sent ${requestCount} requests in ${Date.now() - start}ms`
    );
};

/* eslint-enable */
