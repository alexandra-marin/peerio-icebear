import { Plugin } from 'prosemirror-state';
import { Node } from 'prosemirror-model';

/**
 * A ProseMirror plugin that applies a CSS class to the editor view when the document is empty, as well as a
 * `data-placeholder` attribute containing the placeholder text.
 *
 * If you need to update the placeholder text, you can call `EditorState.reconfigure` with a new placeholder plugin.
 *
 * @param text The placeholder text.
 * @param emptyState If the document state is equal to this state, the editor will be considered empty.
 * @param emptyClassName The CSS class to apply to the editor view when the document is empty.
 */
export function placeholder(
    text: string,
    emptyState: Node,
    emptyClassName: string = 'ProseMirror-empty'
) {
    const placeholderPlugin = new Plugin({
        view(editorView) {
            (editorView.dom as HTMLElement).dataset.placeholder = text;
            if (editorView.state.doc.eq(emptyState)) {
                editorView.dom.classList.add(emptyClassName);
            }

            return {
                update(view) {
                    if (view.state.doc.eq(emptyState))
                        view.dom.classList.add(emptyClassName);
                    else view.dom.classList.remove(emptyClassName);
                },
                destroy() {
                    if (editorView && editorView.dom) {
                        editorView.dom.classList.remove(emptyClassName);
                        delete (editorView.dom as HTMLElement).dataset
                            .placeholder;
                    }
                }
            };
        }
    });

    return placeholderPlugin;
}
