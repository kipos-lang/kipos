import equal from 'fast-deep-equal';
import { Node, Nodes } from '../../shared/cnodes';
import { shape } from '../../shared/shape';
import { applyUpdate, applySelUp, applyNormalUpdate, _applyUpdate } from '../applyUpdate';
import { keyActionToUpdate } from '../keyActionToUpdate';
import { root } from '../root';
import { init, nloc } from '../test-utils';
import { Top, NodeSelection } from '../utils';
import { AppState, Action } from './App';
import { keyUpdate } from './keyUpdate';
import { genId } from './genId';

type Delta<T> = { next: T; prev: T };
export type HistoryItem =
    | HistoryChange
    | {
          type: 'revert';
          id: string;
          undo: boolean;
          ts: number;
          reverts: string;
      };

export type HistoryChange = {
    type: 'change';
    ts: number;
    id: string;
    onlyy?: SimpleChangeIds; // the id or text:index that is the "only" thing that was modified
    // session: string;
    top: Delta<Omit<Top, 'nodes'> & { nodes: Record<string, Node | null> }>;
    selections: Delta<NodeSelection[]>;
};

const revDelta = <T>(d: Delta<T>): Delta<T> => ({ next: d.prev, prev: d.next });

const invertChange = (change: HistoryChange): HistoryChange => ({ ...change, selections: revDelta(change.selections), top: revDelta(change.top) });

const applyChange = (state: AppState, item: HistoryChange) => {
    state = { ...state };
    state.selections = item.selections.next;
    state.top = { ...item.top.next, nodes: withNodes(state.top.nodes, item.top.next.nodes) };
    return state;
};

const revert = (state: AppState, item: HistoryItem, undo: boolean) => {
    if (item.type === 'change') {
        state = applyChange(state, invertChange(item));
        const next: HistoryItem = { type: 'revert', reverts: item.id, id: genId(), ts: Date.now(), undo: undo };
        state.history = state.history.concat([next]);
        return state;
    }
    const found = state.history.find((h) => h.id === item.reverts);
    if (!found) return state;
    if (found.type === 'change') {
        state = applyChange(state, found);
        const next: HistoryItem = { type: 'revert', reverts: item.id, id: genId(), ts: Date.now(), undo: undo };
        state.history = state.history.concat([next]);
        return state;
    }
    const back = state.history.find((h) => h.id === found.reverts);
    if (!back) return state;
    return revert(state, back, !undo);
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

/*
take the top item
if it is a normal change, revert it!
if it is an undo of a normal change, jump to the corresponding thing, and go back one more.
*/
export const findUndo = (history: HistoryItem[]): HistoryItem | void => {
    if (!history.length) return;
    let at = history.length - 1;
    while (at >= 0) {
        const item = history[at];
        if (item.type === 'change' || !item.undo) return item;
        const found = history.findIndex((h) => h.id === item.reverts);
        if (found === -1) return;
        at = found - 1;
    }
};

/*
take the top item
if it is a normal change, bail
if it is an 'undo' revert, you're good
if it is a 'redo' revert, back up to it's corresponding undo - 1
*/
export const findRedo = (history: HistoryItem[]): HistoryItem | void => {
    if (!history.length) return;
    let at = history.length - 1;
    while (at >= 0) {
        const last = history[at];
        if (!last) return;
        if (last.type === 'change') return;
        if (last.undo) return last;
        const found = history.findIndex((h) => h.id === last.reverts);
        if (found === -1) return;
        at = found - 1;
    }
};

const redo = (state: AppState): AppState => {
    const item = findRedo(state.history);
    return item != null ? revert(state, item, false) : state;
};

const undo = (state: AppState) => {
    if (!state.history.length) return state;
    const item = findUndo(state.history);
    return item != null ? revert(state, item, item.type === 'change') : state;
};

type SimpleChangeIds = string;

const diffTop = (prev: Top, next: Top): [HistoryChange['top']['next'], boolean, SimpleChangeIds | undefined] => {
    const diff: HistoryChange['top']['next'] = {
        ...next,
        nodes: {},
    };
    let only = [] as false | string[];
    let changed = next.root !== prev.root; // || !equal(next.tmpText, prev.tmpText);
    Object.entries(next.nodes).forEach(([key, value]) => {
        if (prev.nodes[key] !== value) {
            if (only) {
                const pnode = prev.nodes[key];

                if (
                    (pnode?.type === 'id' && value.type === 'id') ||
                    (pnode?.type === 'text' &&
                        value.type === 'text' &&
                        pnode.spans.length === value.spans.length &&
                        pnode.spans.every((span, i) => span.type === value.spans[i].type))
                ) {
                    only.push(key);
                } else {
                    only = false;
                }
            }
            diff.nodes[key] = value;
            changed = true;
        }
    });
    Object.keys(prev.nodes).forEach((key) => {
        if (!next.nodes[key]) {
            diff.nodes[key] = null;
            changed = true;
        }
    });
    return [diff, changed, only === false ? undefined : only.sort().join(':')];
};

const calculateHistoryItem = (prev: AppState, next: AppState): HistoryChange | void => {
    const [nt, cn, onlyy] = diffTop(prev.top, next.top);
    const [pt, cp] = diffTop(next.top, prev.top);
    if (!cn && !cp) return;
    return {
        type: 'change',
        id: genId(),
        ts: Date.now(),
        onlyy,
        top: { next: nt, prev: pt },
        selections: { next: next.selections, prev: prev.selections },
    };
};

const joinHistory = (prev: HistoryChange, next: HistoryChange): HistoryChange => {
    return {
        ...prev,
        selections: { prev: prev.selections.prev, next: next.selections.next },
        top: { prev: prev.top.prev, next: next.top.next },
    };
};

const canJoinItems = (prev: HistoryItem | null, item: HistoryItem): prev is HistoryChange => {
    return prev?.type === 'change' && item.type === 'change' && prev.onlyy != null && prev.onlyy === item.onlyy && item.ts - prev.ts < 10000;
};

const recordHistory = (prev: AppState, next: AppState, noJoin = false): AppState => {
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

export const applyAppUpdate = (state: AppState, action: Action, noJoin = false): AppState => {
    switch (action.type) {
        case 'undo':
            return undo(state);
        case 'redo':
            return redo(state);
        case 'add-sel':
            return recordHistory(state, { ...state, selections: state.selections.concat([action.sel]) }, noJoin);
        case 'update':
            const result = _applyUpdate({ top: state.top, sel: state.selections[0], nextLoc: state.nextLoc }, action.update);
            return recordHistory(state, { ...state, top: result.top, selections: [result.sel] }, noJoin);

        case 'paste':
            console.log('pasting', action.data);
            if (action.data.type === 'json') {
                const selections = state.selections.slice();
                let top = state.top;

                selections.forEach((sel, i) => {
                    if (sel.end) {
                        const result = _applyUpdate({ top, sel: state.selections[i], nextLoc: state.nextLoc }, [
                            { type: 'multi-delete', start: sel.start, end: sel.end },
                        ]);
                        top = result.top;
                        selections[i] = result.sel;
                    }
                });

                for (let i = 0; i < state.selections.length; i++) {
                    const v = action.data.data.length === 1 ? action.data.data[0] : action.data.data[i];
                    if (!v) break;
                    const sel = state.selections[i];

                    const result = _applyUpdate({ top, sel: state.selections[i], nextLoc: state.nextLoc }, [
                        {
                            type: 'paste',
                            path: sel.start.path,
                            cursor: sel.start.cursor,
                            values: v,
                        },
                    ]);
                    selections[i] = result.sel;
                    top = result.top;
                }
                return recordHistory(state, { ...state, top, selections }, noJoin);
            }
            return state;

        case 'key':
            const selections = state.selections.slice();
            let top = state.top;
            for (let i = 0; i < selections.length; i++) {
                const sel = selections[i];
                const update = keyUpdate({ top, sel, nextLoc: state.nextLoc }, action.key, action.mods, action.visual, action.config);
                if (Array.isArray(update)) {
                    for (let keyAction of update) {
                        const sub = keyActionToUpdate({ top, sel, nextLoc: state.nextLoc }, keyAction);
                        const result = applyNormalUpdate({ top, sel, nextLoc: state.nextLoc }, sub);
                        top = result.top;
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
                const result = _applyUpdate({ top, sel, nextLoc: state.nextLoc }, update);
                top = result.top;
                selections[i] = result.sel;
            }
            return recordHistory(state, { ...state, top, selections }, noJoin);
    }
};

export const reducer = (state: AppState, action: Action) => {
    const result = applyAppUpdate(state, action);
    return result;
};

const is = init();
export const initialAppState = (): AppState => ({ top: is.top, selections: [is.sel], history: [], nextLoc: nloc() });
