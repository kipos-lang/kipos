import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { js } from '../keyboard/test-utils';
import { Top, Showsel } from './App';
import { useStore } from './store/store';
import { zedlight } from './zedcolors';
import { SelStart } from '../keyboard/handleShiftNav';
import { moveA } from '../keyboard/keyActionToUpdate';
import { argify, atomify } from '../keyboard/selections';
import { HiddenInput } from '../keyboard/ui/HiddenInput';
import { css } from 'goober';
import { Event, Rule, TraceText } from '../syntaxes/dsl3';
import { shape } from '../shared/shape';

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
    }, [editor]);
};

export const Editor = () => {
    const store = useStore();
    const editor = store.useEditor();
    const drag = useMakeDrag();
    const module = editor.useModule();

    return (
        <>
            <div style={{ flex: 1, padding: 32 }}>
                Editor here
                <KeyHandler />
                <DragCtx.Provider value={drag}>
                    {module.roots.map((id) => (
                        <Top id={id} key={id} />
                    ))}
                </DragCtx.Provider>
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

const ParseTrace = ({ trace }: { trace: Event[] }) => {
    const [at, setAt] = useState(0);

    const stack = useMemo(() => {
        const stack: Event[][] = [[]];
        for (let i = 0; i < at; i++) {
            const evt = trace[i];
            switch (evt.type) {
                case 'stack-push':
                    stack.push([evt]);
                    break;
                case 'stack-pop':
                    stack.pop();
                    break;
                default:
                    stack[stack.length - 1].push(evt);
            }
        }
        return stack;
    }, [at, trace]);

    return (
        <div>
            <div>Parse Trace</div>
            <input value={at} type="range" min={0} max={trace.length} onChange={(evt) => setAt(+evt.target.value)} />
            <div>
                {stack.map((stack, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column' }}>
                        {stack.map((evt, i) => {
                            switch (evt.type) {
                                case 'match':
                                    return (
                                        <span key={i}>
                                            Match <ShowTrace text={evt.message} />
                                        </span>
                                    );
                                case 'stack-push':
                                    return (
                                        <span key={i}>
                                            Stack <ShowTrace text={evt.text} /> loc {evt.loc?.slice(-5)}
                                        </span>
                                    );
                                case 'stack-pop':
                                    return null;
                                case 'mismatch':
                                    return (
                                        <span key={i}>
                                            Mismatch <ShowTrace text={evt.message} /> loc {evt.loc?.slice(-5)}{' '}
                                        </span>
                                    );
                                case 'extra':
                                    return <span key={i}>Extra {evt.loc.slice(-5)} </span>;
                            }
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
};

const ShowTrace = ({ text }: { text: TraceText }) => {
    if (typeof text === 'string') {
        return <span>{text}</span>;
    }
    if (Array.isArray(text)) {
        return (
            <>
                {text.map((t, i) => (
                    <ShowTrace text={t} key={i} />
                ))}
            </>
        );
    }
    if (text.type === 'node') {
        return <span>Node: {shape(text.node)}</span>;
    }
    return <span style={{ color: 'red' }}>{ruleSummary(text.rule)}</span>;
};

const ruleSummary = (rule: Rule<any>): string => {
    switch (rule.type) {
        case 'ref':
            return `ref(${rule.name})`;
        case 'text':
        case 'tx':
        case 'star':
        case 'seq':
        case 'or':
        case 'opt':
        case 'group':
            return `${rule.type}(...)`;
        case 'meta':
            return `${rule.type}(...,${rule.meta})`;
        case 'table':
        case 'list':
            return `${rule.type}(...,${JSON.stringify(rule.kind)})`;
        case 'any':
        case 'number':
        case 'kwd':
        case 'id':
            return rule.type;
    }
};

const DebugSidebar = () => {
    const editor = useEditor();
    const results = editor.useParseResults();
    const sel = editor.useSelection();
    const top = sel[0].start.path.root.top;
    return (
        <div style={{}}>
            <div>Debug sidebar</div>
            <div>{results[top]?.trace?.length ? <ParseTrace trace={results[top].trace} /> : null}</div>
        </div>
    );
};

const KeyHandler = () => {
    const editor = useEditor();
    const sel = editor.useSelection();

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
                // visual,
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
