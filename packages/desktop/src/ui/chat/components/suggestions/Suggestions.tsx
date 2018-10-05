/*

This class is slightly strange -- you'll notice it's not a React component, but
it wraps one. We need to share some mutable state between the suggestions we're
rendering via React and the ProseMirror view, and after a few failed attempts to
make this sensible (as just a plugin that creates its own DOM elements for the
suggestions list, or as a React component that takes the ProseMirror view and
mutates its plugins on mount/unmount) this seems like the least clunky solution.

Consumers should use the 'plugin' and 'Component' fields instances of this class
exposes and mount them as a ProseMirror plugin and in the React rendering
hierarchy, respectively, and call 'cleanup' when unmounting.

*/

import React from 'react';
import {
    observable,
    autorun,
    action,
    computed,
    runInAction,
    IReactionDisposer
} from 'mobx';
import { observer } from 'mobx-react';
import { Plugin, TextSelection } from 'prosemirror-state';

/**
 * The maximum amount of leading text (before the cursor) we'll check when
 * matching against the suggestions regexes.
 */
const MATCH_BEFORE = 100; // TODO: consider making tunable in Suggestions constuctor

interface MatchData {
    match: RegExpMatchArray;
    from: number;
    to: number;
}

interface SuggestionsConfig<T> {
    /**
     * Regular expressions against which the input will be tested to see if we
     * have a token for matching against our suggestion source. The capture
     * group is allowed to match an empty string.
     */
    matchers: RegExp[];

    /**
     * Given an object with a match from one of our matchers, return the actual
     * object we can use in the suggestions component.
     */
    source: (matchData: MatchData) => T[];

    /**
     * Given the object returned from our suggestions source, return a JSX
     * element or string formatted for display in our suggestions list.
     */
    formatter: (match: T) => string | JSX.Element;

    /**
     * key of our returned object that we should use when mapping the suggestion
     * results in the React component.
     */
    keySource: string;

    onAcceptSuggestion: (matchData: MatchData, acceptedSuggestion: T) => void;
}

export default class Suggestions<T> {
    @observable selectedIndex = 0;

    @observable.shallow matchData: MatchData | null = null;

    /* FIXME/TS: this class should be generic:
       'any'/'any[]' should be 'T'/'T[]', keySource should be 'keyof T'.
    */

    readonly matchers: RegExp[];
    readonly source: (matchData: MatchData) => T[];
    readonly formatter: (match: T) => string | JSX.Element;
    readonly keySource: string;
    readonly onAcceptSuggestion: (
        matchData: MatchData,
        acceptedSuggestion: T
    ) => void;

    readonly plugin: Plugin;

    readonly disposer: IReactionDisposer;

    constructor(config: SuggestionsConfig<T>) {
        const {
            matchers,
            source,
            formatter,
            keySource,
            onAcceptSuggestion
        } = config;
        this.matchers = matchers;
        this.source = source;
        this.formatter = formatter;
        this.keySource = keySource;
        this.onAcceptSuggestion = onAcceptSuggestion;

        this.plugin = makePlugin(this);

        this.disposer = autorun(() => {
            // Our selected index should always be in range.
            if (this.suggestions && this.suggestions.length > 0) {
                this.selectedIndex = Math.min(
                    this.selectedIndex,
                    this.suggestions.length - 1
                );
            }

            const el = document.querySelector(
                `.suggests>.suggest-item:nth-of-type(${this.selectedIndex + 1})`
            );
            if (el) {
                // Chrome-only method, so not available in typings
                (el as any).scrollIntoViewIfNeeded(true);
            }
        });
    }

    cleanup = () => {
        if (this.disposer) this.disposer();
    };

    @computed
    get visible() {
        return this.suggestions !== null;
    }

    // Three states:
    // null             => don't show
    // []               => "no suggestions."
    // [...suggestions] => render suggestions
    @computed
    get suggestions() {
        if (this.matchData == null) return null;
        return this.source(this.matchData);
    }

    @action.bound
    dismiss() {
        this.matchData = null;
    }

    @action.bound
    acceptSuggestion() {
        if (this.matchData && this.suggestions.length > 0) {
            this.onAcceptSuggestion(
                this.matchData,
                this.suggestions[this.selectedIndex]
            );
        }
        this.dismiss();
    }

    Component = observer(() => {
        if (!this.visible) return null;

        return (
            <div className="suggests-wrapper">
                <div className="suggests">
                    {this.suggestions.length === 0 ? (
                        <div className="suggest-item">No suggestions.</div>
                    ) : (
                        this.suggestions.map((s, i) => {
                            return (
                                <div
                                    className={`suggest-item ${
                                        i === this.selectedIndex
                                            ? 'selected'
                                            : ''
                                    }`}
                                    key={s[this.keySource]}
                                    onMouseDown={this.acceptSuggestion}
                                    onMouseOver={action(() => {
                                        this.selectedIndex = i;
                                    })}
                                >
                                    {this.formatter(s)}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        );
    });
}

function makePlugin(self: Suggestions<any>) {
    return new Plugin({
        props: {
            handleKeyDown(_view, ev) {
                switch (ev.key) {
                    case 'ArrowDown':
                        if (self.visible && self.suggestions.length > 0) {
                            runInAction(() => {
                                self.selectedIndex += 1;
                                if (
                                    self.selectedIndex >=
                                    self.suggestions.length
                                ) {
                                    self.selectedIndex = 0;
                                }
                            });
                            return true;
                        }
                        return false;
                    case 'ArrowUp':
                        if (self.visible && self.suggestions.length > 0) {
                            runInAction(() => {
                                self.selectedIndex -= 1;
                                if (self.selectedIndex < 0) {
                                    self.selectedIndex =
                                        self.suggestions.length - 1;
                                }
                            });
                            return true;
                        }
                        return false;
                    case 'Escape':
                        if (self.visible) {
                            self.dismiss();
                            return true;
                        }
                        return false;
                    case 'Enter':
                    case 'Tab':
                        if (self.visible && self.suggestions.length > 0) {
                            self.acceptSuggestion();
                            return true;
                        }
                        return false;
                    default:
                        return false;
                }
            }
        },
        view() {
            return {
                // It's important that we either update or remove the match data
                // whenever the doc changes: our match data contains document
                // positions, which will become invalid/stale if they stick
                // around when the doc is changed.
                update(view, lastState) {
                    const { state } = view;

                    if (lastState && lastState.doc.eq(state.doc)) {
                        // For any state update where the selection changed but the
                        // doc didn't, we want to dismiss the autocomplete. This
                        // should handle cases like moving the cursor left/right,
                        // clicking around, etc. without having to enumerate them
                        // manually in keydown/click handlers.
                        if (!lastState.selection.eq(state.selection)) {
                            self.dismiss();
                        }

                        // Regardless of whether the selection changed, if the
                        // doc hasn't changed nothing else here applies.
                        return;
                    }

                    const cursor = (state.selection as TextSelection).$cursor;
                    if (cursor) {
                        // Adapted from logic in https://github.com/ProseMirror/prosemirror-inputrules
                        const textBefore = cursor.parent.textBetween(
                            Math.max(0, cursor.parentOffset - MATCH_BEFORE),
                            cursor.parentOffset,
                            null,
                            '\ufffc' // unicode object replacement character
                        );

                        for (let i = 0; i < self.matchers.length; i++) {
                            const match = self.matchers[i].exec(textBefore);

                            if (match) {
                                self.matchData = {
                                    match,
                                    from: cursor.pos - match[0].length,
                                    to: cursor.pos
                                };
                                return;
                            }
                        }
                    }

                    // If the doc changed but our selection isn't a cursor OR we
                    // didn't match anything, dismiss the matches.
                    self.dismiss();
                }
            };
        }
    });
}
