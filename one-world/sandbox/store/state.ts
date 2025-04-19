import { genId } from '../../keyboard/ui/genId';
import { Node, Nodes } from '../../shared/cnodes';

import { _applyUpdate, applyNormalUpdate, applySelUp } from '../../keyboard/applyUpdate';
import { Mods, SelStart } from '../../keyboard/handleShiftNav';
import { KeyAction, keyActionToUpdate } from '../../keyboard/keyActionToUpdate';
import { Config } from '../../keyboard/test-utils';
import { keyUpdate, Visual } from '../../keyboard/ui/keyUpdate';
import { CopiedValues, pasteUpdate } from '../../keyboard/update/multi-change';
import { NodeSelection, Path, selStart, Top } from '../../keyboard/utils';
import { canJoinItems, Delta, HistoryItem, redo, revDelta, undo } from '../history';
import { Toplevel } from '../types';
import { selectStart } from '../../keyboard/handleNav';
import { validate } from '../../keyboard/validate';
import { argify, atomify } from '../../keyboard/selections';

export type AppState = {
    config: Config;
    imports: string[];
    roots: string[];
    tops: Record<string, Toplevel>;
    selections: NodeSelection[];
    history: HistoryItem<HistoryChange>[];
};

export type HistoryChange = {
    type: 'change';
    ts: number;
    id: string;
    onlyy?: string; // the id or text:index that is the "only" thing that was modified
    // session: string;
    tops: Delta<Record<string, TopUpdate | null>>;
    selections: Delta<NodeSelection[]>;
};

type TopUpdate = Omit<Toplevel, 'nodes'> & { nodes: Record<string, Node | null> };

export const joinHistory = (prev: HistoryChange, next: HistoryChange): HistoryChange => {
    return {
        ...prev,
        selections: { prev: prev.selections.prev, next: next.selections.next },
        tops: { prev: prev.tops.prev, next: next.tops.next },
    };
};

const diffTop = (prev: Toplevel, next: Toplevel): [TopUpdate, TopUpdate, boolean, string | undefined] => {
    const redo: TopUpdate = { ...next, nodes: {} };
    const undo: TopUpdate = { ...prev, nodes: {} };
    let only = false as false | string | null;

    let changed = next.root !== prev.root || next.children !== prev.children;
    Object.entries(next.nodes).forEach(([key, value]) => {
        if (prev.nodes[key] !== value) {
            redo.nodes[key] = value;
            undo.nodes[key] = prev.nodes[key] ?? null;
            changed = true;
            if (only === false) only = key;
            else if (only != key) only = null;
        }
    });
    Object.entries(prev.nodes).forEach(([key, value]) => {
        if (next.nodes[key] !== value) {
            redo.nodes[key] = next.nodes[key] ?? null;
            undo.nodes[key] = value;
            changed = true;
        }
    });
    return [redo, undo, changed, only ? only : undefined]; //, only === false ? undefined : only.sort().join(':')];
};

const diffTops = (
    prev: AppState['tops'],
    next: AppState['tops'],
): [HistoryChange['tops']['next'], HistoryChange['tops']['prev'], boolean, string | undefined] => {
    const redo: Record<string, TopUpdate | null> = {};
    const undo: Record<string, TopUpdate | null> = {};
    let changed = false;
    let only = false as false | string | null;

    Object.entries(next).forEach(([key, value]) => {
        if (prev[key] !== value) {
            if (!prev[key]) {
                redo[key] = value;
                undo[key] = null;
                changed = true;
            } else {
                const [r, u, c, o] = diffTop(prev[key], value);
                redo[key] = r;
                undo[key] = u;
                if (c) {
                    changed = true;
                    if (only === false) only = o ? `${key}:${o}` : null;
                    else only = null;
                }
            }
            // console.log('diff', key, prev[key], value);
        }
    });

    Object.entries(prev).forEach(([key, value]) => {
        if (!next[key]) {
            redo[key] = null;
            undo[key] = value;
            changed = true;
        }
    });

    return [redo, undo, changed, only ? only : undefined];
};

const calculateHistoryItem = (prev: AppState, next: AppState): HistoryChange | void => {
    const [redo, undo, changed, onlyy] = diffTops(prev.tops, next.tops);
    if (!changed) return;
    return {
        type: 'change',
        id: genId(),
        ts: Date.now(),
        onlyy,
        tops: { next: redo, prev: undo },
        selections: { next: next.selections, prev: prev.selections },
    };
};

export type Action =
    | { type: 'add-sel'; sel: NodeSelection }
    | { type: 'drag-sel'; sel: SelStart; ctrl: boolean; alt: boolean }
    | { type: 'update'; update: KeyAction[] | null | undefined }
    | { type: 'key'; key: string; mods: Mods; visual?: Visual }
    | { type: 'selections'; selections: NodeSelection[] }
    | { type: 'new-import' }
    | { type: 'new-tl'; after: string; parent?: string }
    | { type: 'rm-tl'; id: string }
    | { type: 'paste'; replace?: Path; data: { type: 'json'; data: CopiedValues[] } | { type: 'plain'; text: string } }
    | { type: 'undo' }
    | { type: 'redo' };

export const recordHistory = (prev: AppState, next: AppState, noJoin = false): AppState => {
    if (prev === next) return next;
    const item = calculateHistoryItem(prev, next);
    if (!item) return next;
    const history = next.history.slice();
    const pitem = next.history[next.history.length - 1];
    if (!noJoin && canJoinItems(pitem, item)) {
        history[history.length - 1] = joinHistory(pitem, item);
        return { ...next, history };
    }
    history.push(item);
    return { ...next, history };
};

const applyHistoryChange = (state: AppState, item: HistoryChange) => {
    state = { ...state, tops: { ...state.tops } };
    state.selections = item.selections.next;
    Object.entries(item.tops.next).forEach(([key, value]) => {
        if (!value) {
            delete state.tops[key];
        } else {
            state.tops[key] = { ...value, nodes: withNodes(state.tops[key].nodes, value.nodes) };
        }
    });
    return state;
};

const withNodes = (nodes: Nodes, up: Record<number, Node | null>): Nodes => {
    nodes = { ...nodes };
    Object.entries(up).forEach(([key, value]) => {
        if (value === null) {
            delete nodes[key];
        } else {
            nodes[key] = value;
        }
    });
    return nodes;
};

type MyState = {
    history: HistoryItem<HistoryChange>[];
    applyHistoryChange(change: HistoryChange): MyState;
    joinHistory(prev: HistoryChange, next: HistoryChange): HistoryChange;
    // applyAction(action: Action): this;
    calculateHistoryItem(next: MyState): HistoryChange | void;
    invertChange(change: HistoryChange): HistoryChange;
    withHistory(items: HistoryItem<HistoryChange>[]): MyState;
    state: AppState;
};

const invertChange = (change: HistoryChange): HistoryChange => ({
    ...change,
    selections: revDelta(change.selections),
    tops: revDelta(change.tops),
});

const wrap = (state: AppState): MyState => {
    return {
        state,
        get history() {
            return state.history;
        },
        withHistory(history) {
            return wrap({ ...state, history });
        },
        applyHistoryChange(change) {
            return wrap(applyHistoryChange(state, change));
        },
        calculateHistoryItem(next) {
            return calculateHistoryItem(state, next.state);
        },
        invertChange: invertChange,
        joinHistory: joinHistory,
    };
};

export const reduce = (state: AppState, action: Action, noJoin: boolean, nextLoc: () => string): AppState => {
    switch (action.type) {
        case 'undo': {
            return undo(wrap(state)).state;
        }
        case 'redo': {
            return redo(wrap(state)).state;
        }
        case 'add-sel':
            return recordHistory(state, { ...state, selections: state.selections.concat([action.sel]) }, noJoin);
        case 'drag-sel': {
            let { sel, ctrl, alt } = action;
            // console.log('move sel', sel);
            let start = state.selections[0].start;
            if (ctrl) {
                [start, sel] = argify(start, sel, state.tops[sel.path.root.top]);
            } else if (alt) {
                [start, sel] = atomify(start, sel, state.tops[sel.path.root.top]);
            }
            // editor.update({ type: 'update', update: [{ type: 'move', sel: start, end: sel }] });

            return { ...state, selections: [{ start, end: sel }] };
        }

        case 'selections':
            action.selections.forEach((sel) => {
                if (!sel.start.path) {
                    console.log('WHAT SEL');
                    debugger;
                }
                try {
                    validate({ sel, top: state.tops[sel.start.path.root.top] });
                } catch (err) {
                    debugger;
                    validate({ sel, top: state.tops[sel.start.path.root.top] });
                }
            });

            return { ...state, selections: action.selections };

        case 'update': {
            // const sel = action.update
            // const sel = state.selections[0];
            // const top = state.tops[sel.start.path.root.top];
            // console.log('update', action.update);
            // console.log('the top', top);
            // const result = _applyUpdate({ top, sel, nextLoc: genId }, action.update);
            // console.log('result', result);
            // return recordHistory(state, { ...state, tops: { ...state.tops, [top.id]: result.top }, selections: [result.sel] }, noJoin);
            throw new Error('updateeee');
        }

        case 'rm-tl': {
            if (state.imports.includes(action.id)) {
                const imports = state.imports.slice();
                const at = imports.indexOf(action.id);
                imports.splice(at, 1);
                let next = at < imports.length ? imports[at] : state.roots[0];
                if (next == null) return state;
                const top = state.tops[next];
                const sel = selectStart({ root: { top: top.id, ids: [] }, children: [top.root] }, top);
                if (!sel) return state;
                const tops = { ...state.tops };
                delete tops[action.id];
                return { ...state, imports, tops, selections: [{ start: sel }] };
            }
            const roots = state.roots.slice();
            const at = roots.indexOf(action.id);
            if (at === -1) return state;
            roots.splice(at, 1);
            let next = at < roots.length ? roots[at] : roots[at - 1];
            if (next == null) return state;
            const top = state.tops[next];
            const sel = selectStart({ root: { top: top.id, ids: [] }, children: [top.root] }, top);
            if (!sel) return state;
            const tops = { ...state.tops };
            delete tops[action.id];
            return { ...state, roots, tops, selections: [{ start: sel }] };
        }

        case 'new-import': {
            const tid = genId();
            const rid = genId();
            return {
                ...state,
                tops: {
                    ...state.tops,
                    [tid]: {
                        id: tid,
                        root: rid,
                        children: [],
                        nodes: { [rid]: { type: 'id', text: '', loc: rid } },
                    },
                },
                imports: state.imports.concat([tid]),
                selections: [{ start: selStart({ root: { top: tid, ids: [] }, children: [rid] }, { type: 'id', end: 0 }) }],
            };
        }

        case 'new-tl': {
            if (action.parent == null) {
                const tid = genId();
                const rid = genId();
                return {
                    ...state,
                    tops: {
                        ...state.tops,
                        [tid]: {
                            id: tid,
                            root: rid,
                            children: [],
                            nodes: { [rid]: { type: 'id', text: '', loc: rid } },
                        },
                    },
                    roots: state.roots.concat([tid]),
                    selections: [{ start: selStart({ root: { top: tid, ids: [] }, children: [rid] }, { type: 'id', end: 0 }) }],
                };
            }
            return state;
        }

        case 'paste': {
            console.log('pasting', action.data);
            if (action.data.type !== 'json') {
                console.error('not handling plain pasts yet');
                return state;
            }
            if (action.replace) {
                let top = state.tops[action.replace.root.top];
                if (action.data.data.length !== 1) throw new Error(`trying to replace-paste multiple values; not supported`);
                const update = pasteUpdate(top, action.replace, undefined, action.data.data[0], nextLoc);
                const result = applyNormalUpdate({ top, sel: state.selections[0], nextLoc }, update);
                const tops = { ...state.tops };
                tops[top.id] = result.top;
                return recordHistory(state, { ...state, tops, selections: [result.sel] }, noJoin);
            }
            const selections = state.selections.slice();

            selections.forEach((sel, i) => {
                // let top = state.top;
                if (sel.end) {
                    throw new Error('need to multideleete');
                    // const result = _applyUpdate({ top, sel: state.selections[i] }, [{ type: 'multi-delete', start: sel.start, end: sel.end }]);
                    // top = result.top;
                    // selections[i] = result.sel;
                }
            });

            const tops = { ...state.tops };

            for (let i = 0; i < state.selections.length; i++) {
                const v = action.data.data.length === 1 ? action.data.data[0] : action.data.data[i];
                if (!v) break;
                const sel = state.selections[i];
                const top = tops[sel.start.path.root.top];

                const result = _applyUpdate({ top, sel: state.selections[i], nextLoc }, [
                    {
                        type: 'paste',
                        path: sel.start.path,
                        cursor: sel.start.cursor,
                        values: v,
                    },
                ]);
                selections[i] = result.sel;
                tops[sel.start.path.root.top] = result.top;
            }

            return recordHistory(state, { ...state, tops, selections }, noJoin);
        }

        case 'key': {
            const selections = state.selections.slice();
            const tops = { ...state.tops };
            // let top = state.top;
            for (let i = 0; i < selections.length; i++) {
                const sel = selections[i];
                if (sel.end && sel.start.path.root.top !== sel.end.path.root.top) {
                    throw new Error(`multi-toplevel, not doing`);
                }
                const top = tops[sel.start.path.root.top];
                const update = keyUpdate({ top, sel, nextLoc }, action.key, action.mods, action.visual, state.config);
                if (!update) continue;
                for (let keyAction of update) {
                    const sub = keyActionToUpdate({ top, sel, nextLoc }, keyAction);
                    const result = applyNormalUpdate({ top, sel, nextLoc }, sub);
                    tops[sel.start.path.root.top] = result.top;
                    selections[i] = result.sel;
                    if (sub && Array.isArray(sub.selection)) {
                        for (let j = 0; j < selections.length; j++) {
                            if (j !== i) {
                                sub.selection.forEach((up) => {
                                    selections[j] = applySelUp(selections[i], up);
                                });
                            }
                        }
                    }
                }
                continue;
            }
            return recordHistory(state, { ...state, tops, selections }, noJoin);
        }
    }
    throw new Error(`not handled action ${(action as any).type}`);
};

export const keyUpdates = (selections: NodeSelection[], tops: Record<string, Toplevel>, action: Action & { type: 'key' }, config: Config) => {
    selections = selections.slice();
    tops = { ...tops };
    let changed = false;
    // let top = state.top;
    for (let i = 0; i < selections.length; i++) {
        const sel = selections[i];
        if (sel.end && sel.start.path.root.top !== sel.end.path.root.top) {
            throw new Error(`multi-toplevel, not doing`);
        }
        const top = tops[sel.start.path.root.top];
        const update = keyUpdate({ top, sel, nextLoc: genId }, action.key, action.mods, action.visual, config);
        if (!update) continue;
        for (let keyAction of update) {
            const sub = keyActionToUpdate({ top, sel, nextLoc: genId }, keyAction);
            const result = applyNormalUpdate({ top, sel, nextLoc: genId }, sub);
            if (tops[sel.start.path.root.top] !== result.top) {
                changed = true;
            }
            tops[sel.start.path.root.top] = result.top;
            selections[i] = result.sel;
            if (sub && Array.isArray(sub.selection)) {
                for (let j = 0; j < selections.length; j++) {
                    if (j !== i) {
                        sub.selection.forEach((up) => {
                            selections[j] = applySelUp(selections[i], up);
                        });
                    }
                }
            }
        }
        continue;
    }
    return { selections, tops, changed };
};
