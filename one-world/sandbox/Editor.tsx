import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { js } from '../keyboard/test-utils';
import { Showsel } from './App';
import { Top } from './Top';
import { useStore } from './store/store';
import { zedlight } from './zedcolors';
import { SelStart } from '../keyboard/handleShiftNav';
import { moveA } from '../keyboard/keyActionToUpdate';
import { argify, atomify } from '../keyboard/selections';
import { HiddenInput } from '../keyboard/ui/HiddenInput';
import { css } from 'goober';
import { lastChild, Path } from '../keyboard/utils';
import { Visual } from '../keyboard/ui/keyUpdate';
import { posDown, posUp } from '../keyboard/ui/selectionPos';
import { genId } from '../keyboard/ui/genId';
import { Toplevel } from './types';
import { DebugSidebar } from './DebugSidebar';

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
    refs: Record<string, HTMLElement>;
    ref(loc: string): (node: HTMLElement) => void;
    start(sel: SelStart, meta?: boolean): void;
    move(sel: SelStart, ctrl?: boolean, alt?: boolean): void;
};

export const noopDrag: DragCtxT = { dragging: false, ref: () => () => {}, start() {}, move() {}, refs: {} };

export const DragCtx = React.createContext(null as null | DragCtxT);
export const useDrag = () => {
    const ctx = useContext(DragCtx);
    if (!ctx) throw new Error(`not in drag context`);
    return ctx;
};

export const useEditor = () => {
    const store = useStore();
    return store.useEditor();
};

// type HoverCtxT = { onHover(key?: string): boolean; setHover(key?: string | null): void };
// const HoverCtx = React.createContext<HoverCtxT>({ onHover: () => false, setHover() {} });

// export const useHover = (key?: string) => {
//     const hover = useContext(HoverCtx);
//     const isHovered = hover.onHover(key);
//     return { isHovered, setHover: useCallback((yes: boolean) => hover.setHover(yes ? key : null), [key]) };
// };

// export const useProvideHover = () => {
//     const hover = useMakeHover();
//     return useCallback(
//         ({ children }: { children: React.ReactNode }): React.ReactNode => <HoverCtx.Provider value={hover}>{children}</HoverCtx.Provider>,
//         [hover],
//     );
// };

// const useMakeHover = () => {
//     return useMemo((): HoverCtxT => {
//         let hover: null | { path: Path; notified: string | null } = null;
//         const listeners: Record<string, (v: boolean) => void> = {};

//         const bestFor = (path: Path) => {
//             for (let i = path.children.length - 1; i >= 0; i--) {
//                 const k = path.children[i];
//                 if (listeners[k]) return k;
//             }
//             return null;
//         };

//         const tell = (k: string | null | undefined, v: boolean) => {
//             if (k && listeners[k]) {
//                 listeners[k](v);
//             }
//         };

//         return {
//             onHover(key) {
//                 const [isHovered, setHover] = useState(false);
//                 useEffect(() => {
//                     if (!key) return; // don't register
//                     listeners[key] = setHover;

//                     // TODO: determine if this is the best one now
//                     if (hover?.notified !== k && hover?.path.children.includes(k) && bestFor(hover.path) === k) {
//                         tell(hover.notified, false);
//                         hover.notified = k;
//                         tell(hover.notified, true);
//                     }

//                     return () => {
//                         if (listeners[k] === setHover) {
//                             delete listeners[k];
//                         }
//                     };
//                 }, [path, hasHover]);
//                 return isHovered;
//             },
//             setHover(path) {
//                 const old = hover?.notified;
//                 hover = path ? { path, notified: bestFor(path) } : null;
//                 if (old !== hover?.notified) {
//                     tell(old, false);
//                     tell(hover?.notified, true);
//                 }
//             },
//         };
//     }, []);
// };

export const useProvideDrag = (refs: Record<string, HTMLElement>) => {
    const drag = useMakeDrag(refs);
    return useCallback(
        ({ children }: { children: React.ReactNode }): React.ReactNode => <DragCtx.Provider value={drag}>{children}</DragCtx.Provider>,
        [drag],
    );
};

export const useMakeDrag = (refs: Record<string, HTMLElement>): DragCtxT => {
    const editor = useEditor();
    return useMemo(() => {
        const up = (evt: MouseEvent) => {
            document.removeEventListener('mouseup', up);
            drag.dragging = false;
        };

        const drag: DragCtxT = {
            dragging: false,
            refs,
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
    }, [editor, refs]);
};

// const useMake

const alphabet = 'abcdefghjklmnopqrstuvwxyz';

export const Editor = () => {
    const store = useStore();
    const editor = store.useEditor();

    const refs = useMemo((): Record<string, HTMLElement> => ({}), []);

    const Drag = useProvideDrag(refs);
    // const Hover = useProvideHover();
    const module = editor.useModule();

    const deps = editor.useDependencyGraph();
    const names = useMemo(() => {
        const nums: Record<string, { at: number; count: number }> = {};
        let at = 1;
        return module.roots.map((id) => {
            const hid = deps.components.pointers[id];
            if (deps.components.entries[hid]?.length === 1) {
                return at++ + '';
            }
            if (!nums[hid]) {
                nums[hid] = { at: at++, count: 0 };
            } else {
                nums[hid].count++;
            }
            return `${nums[hid].at}${alphabet[nums[hid].count] ?? `+${nums[hid].count}`}`;
        });
    }, [deps, module.roots]);

    return (
        <>
            <div style={{ flex: 1, padding: 32, overflow: 'auto' }}>
                <KeyHandler refs={refs} />
                <Drag>
                    {module.roots.map(
                        (id, i): React.ReactNode => (
                            <Top id={id} key={id} name={names[i]} />
                        ),
                    )}
                </Drag>
                <button
                    className={css({ marginBlock: '12px' })}
                    onClick={() => {
                        editor.update({ type: 'new-tl', after: module.roots[module.roots.length - 1] });
                    }}
                >
                    Add Toplevel
                </button>
                <Showsel />
            </div>
            <DebugSidebar />
        </>
    );
};

const KeyHandler = ({ refs }: { refs: Record<string, HTMLElement> }) => {
    const editor = useEditor();
    const sel = editor.useSelection();
    const tid = sel[0].start.path.root.top;
    // const pr = editor.useTopParseResults(tid)
    const top = editor.useTop(tid);

    const visual: Visual = {
        up(sel) {
            return posUp(sel, top.top, refs, genId);
        },
        down(sel) {
            return posDown(sel, top.top, refs, genId);
        },
        spans: [], //cspans.current,
    };

    const onKeyDown = useCallback(
        (evt: React.KeyboardEvent<Element>) => {
            if (evt.key === 'z' && evt.metaKey) {
                evt.preventDefault();
                editor.update({ type: evt.shiftKey ? 'redo' : 'undo' });
                return;
            }
            if (evt.key === 'Tab') {
                evt.preventDefault();
            }
            editor.update({
                type: 'key',
                key: evt.key,
                mods: { meta: evt.metaKey, ctrl: evt.ctrlKey, alt: evt.altKey, shift: evt.shiftKey },
                visual,
            });
        },
        [editor, sel],
    );

    return (
        <HiddenInput
            onKeyDown={onKeyDown}
            getDataToCopy={() => {
                throw new Error('no copy yet');
            }}
            onDelete={() => {
                console.error('on delete');
            }}
            onInput={(text) => {
                // Not sure why I would need this
                // over the onKeyDown
            }}
            onPaste={(data) => {
                console.error(`paste I guess`, data);
            }}
            sel={sel}
        />
    );
};
