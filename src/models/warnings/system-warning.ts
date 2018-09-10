import { observable } from 'mobx';

export type WarningLevel = 'medium' | 'severe';

/**
 * Warning life cycle states.
 */
export enum WarningStates {
    QUEUED = 0,
    /* WILL_SHOW = 1, */ SHOWING = 2,
    WILL_DISMISS = 3,
    DISMISSED = 4
}

/**
 * Base/local class for warnings. Server warnings class inherits from it.
 * You don't need to instantiate it directly, Icebear warnings module has a factory for that.
 */
export default class SystemWarning {
    /**
     * @param content - localization string key
     * @param title - localization string key
     * @param data - variables to pass to peerio-translator when resolving content
     * @param level - severity level, options (medium, severe)
     */
    constructor(
        content: string,
        title?: string,
        data?: unknown,
        level: WarningLevel = 'medium',
        callback?: () => void
    ) {
        this.content = content;
        this.title = title;
        this.data = data;
        this.level = level;
        this.callback = callback;
    }
    /**
     * Observable current life cycle state.
     */
    @observable state = WarningStates.QUEUED;

    content: string;
    level: WarningLevel;
    title?: string;
    data?: unknown;
    callback?: () => void;
    timer: number | null = null;

    /**
     * Advances life cycle state to SHOWING
     */
    show() {
        if (this.state !== WarningStates.QUEUED) return;
        // this.state = WarningStates.WILL_SHOW;
        // setTimeout(() => {
        this.state = WarningStates.SHOWING;
        // }, 1000);
    }

    /**
     * Advances life cycle state to final status.
     * Does it gradually to allow UI animations to execute.
     */
    dismiss() {
        if (this.state > WarningStates.SHOWING) return;
        this.state = WarningStates.WILL_DISMISS;
        setTimeout(() => {
            this.dispose();
            this.state = WarningStates.DISMISSED;
            if (this.callback) this.callback();
        }, 700);
    }

    /**
     * Starts a timer that will dismiss the warning automatically.
     */
    autoDismiss() {
        if (this.state > WarningStates.SHOWING) return;
        if (this.timer) return;
        this.timer = setTimeout(() => {
            this.dismiss();
            this.timer = null;
        }, 7000) as any; // TODO: remove node typings
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
     */
    protected dispose() {}
}
