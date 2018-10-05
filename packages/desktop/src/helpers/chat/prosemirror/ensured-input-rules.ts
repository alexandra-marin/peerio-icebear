import { Plugin, EditorState, Transaction } from 'prosemirror-state';
import { InputRule } from 'prosemirror-inputrules';

const MAX_MATCH = 500;

/**
 * Augment InputRule with internal members; see
 * https://github.com/DefinitelyTyped/DefinitelyTyped/pull/27770
 */
interface InputRuleInternal extends InputRule {
    match: RegExp;
    handler: (
        state: EditorState<any>,
        match: string[],
        start: number,
        end: number
    ) => Transaction<any>;
}

/**
 * Like ProseMirror's provided inputRules plugin, but doesn't support the use of the
 * "undoInputRule" command. Either the rule is applied, or the input is undone.
 */
export function ensuredInputRules({ rules }: { rules: InputRule[] }) {
    return new Plugin({
        props: {
            handleTextInput(view, from, to, text) {
                const { state } = view;
                const $from = state.doc.resolve(from);
                const textBefore =
                    $from.parent.textBetween(
                        Math.max(0, $from.parentOffset - MAX_MATCH),
                        $from.parentOffset,
                        undefined,
                        '\ufffc'
                    ) + text;

                for (const r of rules) {
                    const rule = r as InputRuleInternal;
                    const match = rule.match.exec(textBefore);
                    if (match) {
                        const tr = rule.handler(
                            state,
                            match,
                            from - (match[0].length - text.length),
                            to
                        );
                        if (tr) {
                            view.dispatch(tr);
                            return true;
                        }
                    }
                }
                return false;
            }
        }
    });
}
