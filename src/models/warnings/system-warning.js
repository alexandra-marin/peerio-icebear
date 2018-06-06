const { observable } = require('mobx');

/**
 * Base/local class for warnings. Server warnings class inherits from it.
 * You don't need to instantiate it directly, Icebear warnings module has a factory for that.
 * @class
 * @param {string} content - localization string key
 * @param {string} [title] - localization string key
 * @param {Object} [data] - variables to pass to peerio-translator when resolving content
 * @param {string} [level='medium'] - severity level, options (medium, severe)
 */
class SystemWarning {
    /**
     * Warning life cycle states.
     */
    static STATES = { QUEUED: 0, /* WILL_SHOW: 1, */ SHOWING: 2, WILL_DISMISS: 3, DISMISSED: 4 };

    /**
     * Observable current life cycle state.
     * @type {number}
     */
    @observable state = SystemWarning.STATES.QUEUED

    constructor(content, title, data, level = 'medium', callback) {
        this.content = content;
        this.title = title;
        this.data = data;
        this.level = level;
        this.callback = callback;
    }

    /**
     * Advances life cycle state to SHOWING
     */
    show() {
        if (this.state !== SystemWarning.STATES.QUEUED) return;
        // this.state = SystemWarning.STATES.WILL_SHOW;
        // setTimeout(() => {
        this.state = SystemWarning.STATES.SHOWING;
        // }, 1000);
    }
    /**
     * Advances life cycle state to final status.
     * Does it gradually to allow UI animations to execute.
     */
    dismiss() {
        if (this.state > SystemWarning.STATES.SHOWING) return;
        this.state = SystemWarning.STATES.WILL_DISMISS;
        setTimeout(() => {
            this.dispose();
            this.state = SystemWarning.STATES.DISMISSED;
            if (this.callback) this.callback();
        }, 700);
    }

    /**
     * Starts a timer that will dismiss the warning automatically.
     */
    autoDismiss() {
        if (this.state > SystemWarning.STATES.SHOWING) return;
        if (this.timer) return;
        this.timer = setTimeout(() => {
            this.dismiss();
            this.timer = null;
        }, 7000);
    }
    /**
     * Removes auto-dismiss timer
     */
    cancelAutoDismiss() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    /**
     *  Does nothing in this class, but you can override it in child class if needed.
     *  Will get called after warning dismiss.
     *  @protected
     */
    dispose() { }
}

module.exports = SystemWarning;
