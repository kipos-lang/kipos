import React, { useContext, useEffect, useMemo } from 'react';
import { js } from '../keyboard/test-utils';
import { Top, Showsel } from './App';
import { useStore } from './store';
import { zedlight } from './zedcolors';
import { SelStart } from '../keyboard/handleShiftNav';
import { moveA } from '../keyboard/keyActionToUpdate';
import { argify, atomify } from '../keyboard/selections';

// type ECtx = {
//     // drag
//     // errors: Record<string, string>;
//     // refs: Record<string, HTMLElement>; // -1 gets you 'cursor' b/c why not
//     // config: DisplayConfig;
//     // styles: Record<string, Style>;
//     // placeholders: Record<string, string>;
//     // selectionStatuses: SelectionStatuses;
//     // dispatch: (up: KeyAction[]) => void;
//     // msel: null | string[];
//     // mhover: null | string[];
//     drag: DragCtxT;
// };
type DragCtxT = {
    dragging: boolean;
    ref(loc: string): (node: HTMLElement) => void;
    start(sel: SelStart, meta?: boolean): void;
    move(sel: SelStart, ctrl?: boolean, alt?: boolean): void;
};

const DragCtx = React.createContext(null as null | DragCtxT);
export const useDrag = () => {
    const ctx = useContext(DragCtx);
    if (!ctx) throw new Error(`not in drag context`);
    return ctx;
};

const useEditor = () => {
    const store = useStore();
    return store.useEditor();
};

export const useMakeDrag = (): DragCtxT => {
    const editor = useEditor();
    return useMemo(() => {
        const up = (evt: MouseEvent) => {
            document.removeEventListener('mouseup', up);
            drag.dragging = false;
        };

        const refs: Record<string, HTMLElement> = {};
        const drag: DragCtxT = {
            dragging: false,
            ref(loc) {
                return (node) => (refs[loc] = node);
            },
            start(sel: SelStart, meta = false) {
                if (meta) {
                    editor.update({ type: 'add-sel', sel: { start: sel } });
                    // cstate.current.selections.map((s): undefined | Update => undefined).concat([{ nodes: [], selection: { start: sel } }]),
                    // [undefined, { nodes: [], selection: { start: sel } }]
                } else {
                    drag.dragging = true;
                    editor.update({ type: 'selections', selections: [{ start: sel }] });
                    document.addEventListener('mouseup', up);
                }
            },
            move(sel: SelStart, ctrl = false, alt = false) {
                // let start = cstate.current.selections[0].start;
                // if (ctrl) {
                //     [start, sel] = argify(start, sel, cstate.current.top);
                // } else if (alt) {
                //     [start, sel] = atomify(start, sel, cstate.current.top);
                // }
                // editor.update({ type: 'update', update: [{ type: 'move', sel: start, end: sel }] });
            },
        };
        return drag;
    }, []);
};

export const Editor = () => {
    const store = useStore();
    const editor = store.useEditor();
    const drag = useMakeDrag();

    useEffect(() => {
        const fn = (evt: KeyboardEvent) => {
            if (evt.key === 'z' && evt.metaKey) {
                editor.update({ type: evt.shiftKey ? 'redo' : 'undo' });
                return;
            }
            editor.update({
                type: 'key',
                key: evt.key,
                mods: { meta: evt.metaKey, ctrl: evt.ctrlKey, alt: evt.altKey, shift: evt.shiftKey },
                // visual,
                config: js, // parser.config,
            });
        };

        window.addEventListener('keydown', fn);
        return () => window.removeEventListener('keydown', fn);
    }, [editor]);

    return (
        <div style={{ flex: 1, padding: 32, background: zedlight.background }}>
            Editor here
            <DragCtx.Provider value={drag}>
                {editor.module.roots.map((id) => (
                    <Top id={id} key={id} />
                ))}
            </DragCtx.Provider>
            <button
                onClick={() => {
                    editor.update({ type: 'new-tl', after: editor.module.roots[editor.module.roots.length - 1] });
                }}
            >
                Add Toplevel
            </button>
            <Showsel />
        </div>
    );
};
