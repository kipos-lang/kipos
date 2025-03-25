import { genId } from '../keyboard/ui/genId';
import { NodeSelection, Top } from '../keyboard/utils';
import { Node, Nodes } from '../shared/cnodes';

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
    top: Delta<Omit<Top, 'nodes'> & { nodes: Record<number, Node | null> }>;
    selections: Delta<NodeSelection[]>;
};

const revDelta = <T>(d: Delta<T>): Delta<T> => ({ next: d.prev, prev: d.next });

const invertChange = (change: HistoryChange): HistoryChange => ({ ...change, selections: revDelta(change.selections), top: revDelta(change.top) });

interface State<Action = any> {
    history: HistoryItem[];
    applyHistoryChange(change: HistoryChange): this;
    applyAction(action: Action): this;
    calculateHistoryItem(next: this): HistoryChange | void;
}

const revert = <T extends State>(state: T, item: HistoryItem, undo: boolean): T => {
    if (item.type === 'change') {
        state = state.applyHistoryChange(invertChange(item));
        const next: HistoryItem = { type: 'revert', reverts: item.id, id: genId(), ts: Date.now(), undo: undo };
        state.history = state.history.concat([next]);
        return state;
    }
    const found = state.history.find((h) => h.id === item.reverts);
    if (!found) return state;
    if (found.type === 'change') {
        state = state.applyHistoryChange(found);
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
            delete nodes[+key];
        } else {
            nodes[+key] = value;
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

export const redo = <T extends State>(state: T): T => {
    const item = findRedo(state.history);
    return item != null ? revert(state, item, false) : state;
};

export const undo = <T extends State>(state: T): T => {
    if (!state.history.length) return state;
    const item = findUndo(state.history);
    return item != null ? revert(state, item, item.type === 'change') : state;
};

type SimpleChangeIds = string;

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

export const recordHistory = <T extends State>(prev: T, next: T, noJoin = false): T => {
    if (prev === next) return next;
    const item = prev.calculateHistoryItem(next);
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

// export type Action<T extends { type: string }> = { type: 'undo' } | { type: 'redo' } | T;

// export const applyAppUpdate = <T extends State<SAction>, SAction extends { type: string }>(state: T, action: Action<SAction>, noJoin = false): T => {
//     switch (action.type) {
//         case 'undo':
//             return undo(state);
//         case 'redo':
//             return redo(state);
//         default:
//             return state.applyAction(action as SAction);
//     }
// };

// export const reducer = (state: AppState, action: Action) => {
//     const result = applyAppUpdate(state, action);
//     return result;
// };

// export const initialAppState: AppState = { top: init.top, selections: [init.sel], history: [] };
