import { genId } from '../../keyboard/ui/genId';
import { Node, Nodes } from '../../shared/cnodes';

import { _applyUpdate, applyNormalUpdate, applySelUp } from '../../keyboard/applyUpdate';
import { Mods } from '../../keyboard/handleShiftNav';
import { KeyAction, keyActionToUpdate } from '../../keyboard/keyActionToUpdate';
import { Config } from '../../keyboard/test-utils';
import { keyUpdate, Visual } from '../../keyboard/ui/keyUpdate';
import { CopiedValues } from '../../keyboard/update/multi-change';
import { NodeSelection, selStart, Top } from '../../keyboard/utils';
import { canJoinItems, Delta, HistoryItem, redo, revDelta, undo } from '../history';
import { Toplevel } from '../types';
import { selectStart } from '../../keyboard/handleNav';
import { validate } from '../../keyboard/validate';

export type AppState = {
    config: Config;
    roots: string[];
    tops: Record<string, Toplevel>;
    selections: NodeSelection[];
    history: HistoryItem<HistoryChange>[];
};

export type HistoryChange = {
    type: 'change';
    ts: number;
    id: string;
    // onlyy?: string; // the id or text:index that is the "only" thing that was modified
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

const diffTop = (prev: Toplevel, next: Toplevel): [TopUpdate, TopUpdate, boolean] => {
    const redo: TopUpdate = { ...next, nodes: {} };
    const undo: TopUpdate = { ...prev, nodes: {} };

    let changed = next.root !== prev.root || next.children !== prev.children;
    Object.entries(next.nodes).forEach(([key, value]) => {
        if (prev.nodes[key] !== value) {
            redo.nodes[key] = value;
            undo.nodes[key] = prev.nodes[key] ?? null;
            changed = true;
        }
    });
    Object.entries(prev.nodes).forEach(([key, value]) => {
        if (next.nodes[key] !== value) {
            redo.nodes[key] = next.nodes[key] ?? null;
            undo.nodes[key] = value;
            changed = true;
        }
    });
    return [redo, undo, changed]; //, only === false ? undefined : only.sort().join(':')];
};

const diffTops = (prev: AppState['tops'], next: AppState['tops']): [HistoryChange['tops']['next'], HistoryChange['tops']['prev'], boolean] => {
    const redo: Record<string, TopUpdate | null> = {};
    const undo: Record<string, TopUpdate | null> = {};
    let changed = false;

    Object.entries(next).forEach(([key, value]) => {
        if (prev[key] !== value) {
            if (!prev[key]) {
                redo[key] = value;
                undo[key] = null;
                changed = true;
            } else {
                const [r, u, c] = diffTop(prev[key], value);
                redo[key] = r;
                undo[key] = u;
                if (c) {
                    changed = true;
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
            // console.log('removed', key);
        }
    });

    return [redo, undo, changed];
};

const calculateHistoryItem = (prev: AppState, next: AppState): HistoryChange | void => {
    const [redo, undo, changed] = diffTops(prev.tops, next.tops);
    if (!changed) return;
    return {
        type: 'change',
        id: genId(),
        ts: Date.now(),
        tops: { next: redo, prev: undo },
        selections: { next: next.selections, prev: prev.selections },
    };
};

export type Action =
    | { type: 'add-sel'; sel: NodeSelection }
    | { type: 'update'; update: KeyAction[] | null | undefined }
    | { type: 'key'; key: string; mods: Mods; visual?: Visual }
    | { type: 'selections'; selections: NodeSelection[] }
    | { type: 'new-tl'; after: string; parent?: string }
    | { type: 'rm-tl'; id: string }
    | { type: 'paste'; data: { type: 'json'; data: CopiedValues[] } | { type: 'plain'; text: string } }
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
            const roots = state.roots.slice();
            const at = roots.indexOf(action.id);
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
                return state;
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
