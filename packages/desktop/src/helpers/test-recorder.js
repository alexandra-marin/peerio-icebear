/* eslint-disable */
/**
 * Tooling for UI tests -- record some DOM activity and spit it out.
 *
 * Output will have redundant stuff, e.g. both a click and an set value for an input.
 * State-related classes will be stripped, e.g. those conveying error and focus status.
 */
const csspath = require('cssman');

let actions = [];

function recordUI() {
    console.log(
        '👀 ⏺ Started recording for tests. Stop with stopRecording() to print results.'
    );

    window.onclick = ev => {
        actions.push({ event: 'click', selector: csspath(ev.target) });
        console.log(csspath(ev.target));
    };

    // const observer = new MutationObserver(check);
    // observer.observe(doc.documentElement, {
    //     childList: true,
    //     subtree: true
    // });

    // needs to reload from virtual dom...
    const inputs = document.getElementsByTagName('input');
    for (let i = 0; i < inputs.length; i++) {
        inputs.item(i).onblur = ev => {
            actions.push({
                event: 'fill',
                selector: csspath(ev.target),
                val: ev.target.value
            });
        };
    }
}

function stopRecording() {
    let s = '';
    actions.forEach(a => {
        const selector = a.selector.replace(
            /(\.rt-input-errored)|(\.focused)|(div#root > div > div\.flex-row\.app-root > div > )/g,
            ''
        );
        if (a.event === 'click') {
            s += `.click('${selector}')\n`;
        }
        if (a.event === 'fill') {
            s += `.setValue('${selector}', '${a.val}')\n`;
        }
    });
    console.log('👀 ⏹ Recording stopped.');
    console.log('👀 Pseudocode for spectron tests:');
    console.log(' ');
    console.log(s);
    console.log(' ');
    console.log(
        '👀 --- Note that selectors have been stripped of classes like .focused and may not be accurate as a result.'
    );
    actions = [];
}

module.exports = { recordUI, stopRecording };
