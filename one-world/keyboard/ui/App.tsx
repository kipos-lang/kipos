import React, { useEffect, useMemo, useReducer, useState } from 'react';
import { useLatest } from '../../useLatest';
import { Config, TestParser } from '../test-utils';

import { NodeID, Style } from '../../shared/cnodes';
import { show } from '../../syntaxes/dsl';
import { parser as jsMinusParser } from '../../syntaxes/js--';
import { nodeToXML, toXML, XML } from '../../syntaxes/xml';
import { selectStart } from '../handleNav';
import { allPaths, Mods, SelStart, Src } from '../handleShiftNav';
import { KeyAction, moveA } from '../keyActionToUpdate';
import { root } from '../root';
import { argify, atomify, getSelectionStatuses } from '../selections';
import { CopiedValues } from '../update/multi-change';
import { lastChild, mergeHighlights, NodeSelection, SelectionStatuses, selStart, Top } from '../utils';
import { HiddenInput } from './HiddenInput';
import { HistoryItem, initialAppState, reducer } from './history';
import { Visual } from './keyUpdate';
import { RenderNode } from './RenderNode';
import { ShowXML } from './XML';
import { useKeyFns } from './useKeyFns';
import { useBackslashMenu } from './useBackslashMenu';
import { genId } from './genId';

const styleKinds: Record<string, Style> = {
    comment: { color: { r: 200, g: 200, b: 200 } },
    kwd: { color: { r: 123, g: 0, b: 177 } },
    punct: { color: { r: 150, g: 150, b: 150 } },
    bop: { color: { r: 150, g: 0, b: 0 } },
    uop: { color: { r: 150, g: 0, b: 0 } },
    number: { color: { r: 0, g: 166, b: 255 } },
    unparsed: { color: { r: 255, g: 100, b: 100 }, textDecoration: 'underline' },
};

export const showKey = (evt: React.KeyboardEvent) => {
    let key = evt.key;
    if (key === ' ') key = 'Space';
    if (evt.metaKey) key = 'Meta ' + key;
    if (evt.shiftKey) key = 'Shift ' + key;
    if (evt.altKey) key = 'Alt ' + key;
    if (evt.ctrlKey) key = 'Ctrl ' + key;
    return key;
};

export type Menu = {
    top: number;
    left: number;
    selection: number;
    items: {
        title: string;
        action(): void;
    }[];
};

// Ahhhhhhhhhhhh ok. sO actually what wee need is to, like, coalesce the updates?
// hm. yeah

export type Action =
    | { type: 'add-sel'; sel: NodeSelection }
    | { type: 'update'; update: KeyAction[] | null | undefined }
    | { type: 'key'; key: string; mods: Mods; visual?: Visual; config: Config }
    | { type: 'paste'; data: { type: 'json'; data: CopiedValues[] } | { type: 'plain'; text: string } }
    | { type: 'undo' }
    | { type: 'redo' };

const getInitialState = (id: string): AppState => {
    const data: AppState = localStorage[id] ? JSON.parse(localStorage[id]) : initialAppState;
    data.nextLoc = genId;
    // if (!data.top.tmpText) data.top.tmpText = {};
    // @ts-ignore
    if (data.sel) {
        // @ts-ignore
        data.selections = [data.sel];
        // @ts-ignore
        delete data.sel;
    }
    if (!data.history) data.history = [];
    return data;
};

const useAppState = (id: string) => {
    const [state, dispatch] = useReducer(reducer, id, getInitialState);
    useEffect(() => {
        localStorage[id] = JSON.stringify(state);
    }, [state, id]);
    return [state, dispatch] as const;
};

const putOnWindow = (obj: any) => {
    Object.assign(window, obj);
};

export interface AppState {
    top: Top;
    selections: NodeSelection[];
    nextLoc: () => string;
    parser?: TestParser<any>;
    history: HistoryItem[];
}

export const App = ({ id }: { id: string }) => {
    const [state, dispatch] = useAppState(id);

    putOnWindow({ state });

    const [hover, setHover] = useState(null as null | NodeSelection);

    const parser = jsMinusParser;
    const rootNode = root(state, (idx) => idx);
    const cursor = lastChild(state.selections[0].start.path);
    const parsed = parser.parse(rootNode, cursor);
    const errors = useMemo(() => {
        const errors: Record<NodeID, string> = {};
        parsed.bads.forEach((bad) => {
            if (bad.type !== 'missing') {
                errors[bad.node.loc] = bad.type === 'extra' ? 'Extra node in ' + show(bad.matcher) : 'Mismatch: ' + show(bad.matcher);
            }
        });
        return errors;
    }, [state, parsed.bads]);

    const xml = useMemo(() => (parsed.result ? toXML(parsed.result) : null), [parsed.result]);
    const xmlcst = useMemo(() => nodeToXML(rootNode), [rootNode]);
    const styles: Record<string, Style> = {};
    const placeholders: Record<string, string> = {};
    Object.entries(parsed.ctx.meta).forEach(([key, meta]) => {
        if (meta.kind && styleKinds[meta.kind]) {
            styles[key] = styleKinds[meta.kind];
        }
        if (meta.placeholder) {
            placeholders[key] = meta.placeholder;
        }
    });

    const paths = useMemo(() => allPaths(state.top), [state.top]);
    const hoverSrc = (src: Src | null) => {
        if (!src || !src.left.length) return setHover(null);
        const l = paths[src.left];
        if (!src.right || !src.right.length) return setHover({ start: selStart(l, { type: 'list', where: 'before' }) });
        const r = paths[src.right];
        return setHover({ start: selStart(l, { type: 'list', where: 'before' }) });
    };

    const clickSrc = (src: Src | null) => {
        if (!src) return;
        const l = paths[src.left];
        const start = selectStart(l, state.top);
        if (!start) return;
        if (!src.right) {
            return dispatch({ type: 'update', update: moveA(start) });
        }
        const r = paths[src.right];
        return dispatch({ type: 'update', update: moveA(start) });
    };

    const [menu, setMenu] = useState(null as null | Menu);
    const { keyFns, lastKey, refs } = useKeyFns(state, parsed, dispatch, parser, menu, setMenu);

    const cstate = useLatest(state);

    useBackslashMenu(state.selections[0], state.top, refs, setMenu, dispatch);

    const selectionStatuses = useSelectionStatuses(state);
    const drag = useDrag(dispatch, cstate);

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'row', minHeight: 0 }}>
            <HiddenInput {...keyFns} sel={state.selections} />
            <div
                style={{
                    whiteSpace: 'pre-wrap',
                    wordWrap: 'break-word',
                    padding: 50,
                    paddingBottom: 0,
                    minHeight: 0,
                    overflow: 'auto',
                    flexShrink: 1,
                    flex: 1,
                }}
            >
                <div style={{ height: '1em', paddingBottom: 20 }}>{lastKey ?? ''}</div>
                <RenderNode
                    loc={state.top.root}
                    parent={{ root: { ids: [], top: '' }, children: [] }}
                    top={state.top}
                    inRich={false}
                    ctx={{
                        drag,
                        errors,
                        refs,
                        styles,
                        placeholders,
                        selectionStatuses,
                        config: { sep: { curly: '; ', round: ', ', square: ', ' } },
                        dispatch(up) {
                            dispatch({ type: 'update', update: up });
                        },
                    }}
                />
            </div>
            {menu ? (
                <div
                    style={{
                        position: 'absolute',
                        zIndex: 10,
                        borderRadius: 5,
                        top: menu.top,
                        left: menu.left,
                        background: '#eee',
                    }}
                >
                    {menu.items.map(({ title, action }, i) => (
                        <div
                            key={i}
                            style={{
                                backgroundColor: i === menu.selection ? '#ddd' : undefined,
                                padding: '2px 4px',
                                cursor: 'pointer',
                            }}
                            onClick={() => action()}
                        >
                            {title}
                        </div>
                    ))}
                </div>
            ) : null}
            <div style={{ display: 'flex', flexDirection: 'column', width: 800, borderLeft: '1px solid #aaa', overflow: 'auto' }}>
                <div style={{ overflow: 'auto', padding: 25 }}>
                    <h3>CST</h3>
                    <ShowXML root={xmlcst} onClick={clickSrc} setHover={hoverSrc} sel={[]} statuses={selectionStatuses} />
                </div>
                <div style={{ flex: 1, overflow: 'auto', padding: 25 }}>
                    <h3>AST</h3>
                    {xml ? <ShowXML root={xml} onClick={clickSrc} setHover={hoverSrc} statuses={selectionStatuses} sel={[]} /> : 'NO xml'}
                    <div style={{ marginTop: 50, whiteSpace: 'pre-wrap' }}>
                        {parsed.bads.map((er, i) => (
                            <div key={i} style={{ color: 'red' }}>
                                <div>
                                    {show(er.matcher)} {er.type}
                                </div>
                                <div style={{ fontSize: '80%', padding: 12 }}>{JSON.stringify(er)}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const walxml = (xml: XML, f: (n: XML) => void) => {
    f(xml);
    if (xml.children) {
        Object.values(xml.children).forEach((value) => {
            if (!value) return;
            if (Array.isArray(value)) return value.forEach((v) => walxml(v, f));
            else return walxml(value, f);
        });
    }
};

export const collides = (one: [number, number], two: [number, number]) => {
    return (
        (one[0] < two[0] && one[1] > two[0]) ||
        (one[0] < two[1] && one[1] > two[1]) ||
        (two[0] < one[0] && two[1] > one[0]) ||
        (two[0] < one[1] && two[1] > one[1])
    );
};

// export const calculateSelectionStatuses = (selections: NodeSelection) => {
//     let statuses: SelectionStatuses = {};
//     selections.forEach((sel) => {
//         const st = getSelectionStatuses(sel, state.top);
//         Object.entries(st).forEach(([key, status]) => {
//             if (statuses[key]) {
//                 statuses[key].cursors.push(...status.cursors);
//                 statuses[key].highlight = mergeHighlights(statuses[key].highlight, status.highlight);
//             } else {
//                 statuses[key] = status;
//             }
//         });
//     });
//     return statuses;
// }

export const useSelectionStatuses = (state: AppState) => {
    return useMemo(() => {
        let statuses: SelectionStatuses = {};
        state.selections.forEach((sel) => {
            const st = getSelectionStatuses(sel, state.top);
            Object.entries(st).forEach(([key, status]) => {
                if (statuses[key]) {
                    statuses[key].cursors.push(...status.cursors);
                    statuses[key].highlight = mergeHighlights(statuses[key].highlight, status.highlight);
                } else {
                    statuses[key] = status;
                }
            });
        });
        return statuses;
    }, [state.selections, state.top]);
};

const useDrag = (dispatch: (a: Action) => void, cstate: { current: AppState }) => {
    return useMemo(() => {
        const up = (evt: MouseEvent) => {
            document.removeEventListener('mouseup', up);
            drag.dragging = false;
        };
        const drag = {
            dragging: false,
            start(sel: SelStart, meta = false) {
                if (meta) {
                    dispatch({ type: 'add-sel', sel: { start: sel } });
                } else {
                    drag.dragging = true;
                    dispatch({ type: 'update', update: moveA(sel) });
                    document.addEventListener('mouseup', up);
                }
            },
            move(sel: SelStart, ctrl = false, alt = false) {
                let start = cstate.current.selections[0].start;
                if (ctrl) {
                    [start, sel] = argify(start, sel, cstate.current.top);
                } else if (alt) {
                    [start, sel] = atomify(start, sel, cstate.current.top);
                }
                dispatch({ type: 'update', update: [{ type: 'move', sel: start, end: sel }] });
            },
        };
        return drag;
    }, []);
};
