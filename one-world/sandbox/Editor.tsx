import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
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
import { Event, Rule, TraceText } from '../syntaxes/dsl3';
import { shape } from '../shared/shape';
import { ShowXML } from '../keyboard/ui/XML';
import { toXML } from '../syntaxes/xml';
import { currentTheme } from './themes';
import { processStack, stackForEvt } from '../../type-inference-debugger/demo/App';
import { ShowStacks } from '../../type-inference-debugger/demo/ShowText';
import { lastChild, Path } from '../keyboard/utils';
import { ShowScope } from '../../type-inference-debugger/demo/ShowScope';
import { Visual } from '../keyboard/ui/keyUpdate';
import { posDown, posUp } from '../keyboard/ui/selectionPos';
import { genId } from '../keyboard/ui/genId';

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

export const noopDrag: DragCtxT = { dragging: false, ref: () => () => {}, start() {}, move() {} };

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
                Editor here
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
            <input value={at} type="range" min={0} max={trace.length} onChange={(evt) => setAt(+evt.target.value)} /> {at}
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
        case 'declaration':
        case 'reference':
        case 'tx':
        case 'star':
        case 'seq':
        case 'or':
        case 'opt':
        case 'group':
        case 'scope':
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

const ShowTypeInference = () => {
    const editor = useEditor();
    const sel = editor.useSelection();
    const top = sel[0].start.path.root.top;
    const results = editor.useTopParseResults(top);

    const events = results?.validation?.events ?? [];

    const [at, setAt] = useState(0);
    const breaks = useMemo(() => stackForEvt(events.length - 1, events), [events]);

    const { byLoc, scope, smap, stack, highlightVars } = useMemo(() => {
        return processStack(events, results?.ctx.meta ?? {}, at, false);
    }, [at, false, events, results?.ctx.meta]);

    if (!results?.validation) return <span>No inference results</span>;
    if (!results?.validation.events?.length) return <span>No inference trace</span>;

    return (
        <div style={{ width: 400, overflow: 'auto' }}>
            <input
                type="range"
                min={0}
                value={at}
                max={breaks}
                onChange={(evt) => {
                    setAt(+evt.target.value);
                }}
            />
            <ShowStacks
                showTips={false}
                subst={smap}
                stack={stack}
                hv={highlightVars}
                onClick={(name) => {
                    // onClick({ type: 'var', name })
                }}
            />
            <ShowScope highlightVars={highlightVars} scope={scope} smap={smap} />
            <Collapsible title="Type Annotations">{JSON.stringify(results.validation.annotations)}</Collapsible>
        </div>
    );
};

const ShowErrorAnnotations = () => {
    const editor = useEditor();
    const sel = editor.useSelection();
    const top = sel[0].start.path.root.top;
    const results = editor.useTopParseResults(top);

    if (!results.validation) return <span>No validation info</span>;

    const byKey = Object.entries(results.validation.annotations[top])
        .map(([key, annotations]) => {
            return { key, errors: annotations.filter((a) => a.type === 'error') };
        })
        .filter((m) => m.errors.length);
    if (!byKey.length) {
        return <div>No errors</div>;
    }
    return byKey.map(({ key, errors }) => (
        <div key={key}>
            <div>{key}</div>
            <div>
                {errors.map((ann, i) => (
                    <div key={i}>{JSON.stringify(ann)}</div>
                ))}
            </div>
        </div>
    ));
};

const ShowCST = () => {
    const editor = useEditor();
    const sel = editor.useSelection();
    const top = sel[0].start.path.root.top;
    const results = editor.useTopParseResults(top);
    if (!results) return null;
    return (
        <div>
            <ShowXML root={toXML(results.input)} onClick={() => {}} sel={[]} setHover={() => {}} statuses={{}} />
        </div>
    );
};

const ShowAST = () => {
    const editor = useEditor();
    const sel = editor.useSelection();
    const top = sel[0].start.path.root.top;
    const results = editor.useTopParseResults(top);
    if (!results) return null;
    return (
        <div>
            <ShowXML root={toXML(results.result)} onClick={() => {}} sel={[]} setHover={() => {}} statuses={{}} />
        </div>
    );
};

const Collapsible = ({ title, children }: { title: string; children: React.ReactNode }) => {
    const [open, setOpen] = useState(false);
    return (
        <div>
            <div
                onClick={() => setOpen(!open)}
                className={css({
                    cursor: 'pointer',
                    '&:hover': {
                        background: currentTheme.metaNode.punct.color,
                        color: 'white',
                    },
                })}
            >
                {title}
            </div>
            {open ? children : null}
        </div>
    );
};

const DebugSidebar = () => {
    const editor = useEditor();
    const results = editor.useParseResults();
    const sel = editor.useSelection();
    const top = sel[0].start.path.root.top;

    return (
        <div style={{ overflow: 'auto', maxWidth: '40vw', padding: '8px 16px' }}>
            <div>Debug sidebar</div>
            <div style={{ fontSize: '80%' }}>{top}</div>
            <div>{results[top]?.trace?.length ? <ParseTrace trace={results[top].trace} /> : null}</div>
            <Collapsible title="CST">
                <ShowCST />
            </Collapsible>
            <Collapsible title="AST">
                <ShowAST />
            </Collapsible>
            <Collapsible title="Type Inference">
                <ShowTypeInference />
                <Collapsible title="Error Annotations">
                    <ShowErrorAnnotations />
                </Collapsible>
            </Collapsible>
        </div>
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
