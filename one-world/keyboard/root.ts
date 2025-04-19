import { fromMap, NodeID } from '../shared/cnodes';
import { lastChild, NodeSelection, Top } from './utils';

export const root = <T>(state: { top: Top; sel?: NodeSelection }, fromId: (n: NodeID) => T = (x) => x as T) => {
    let nodes = state.top.nodes;
    if (!nodes[state.top.root]) throw new Error(`invalid root provided`);

    return fromMap(state.top.root, nodes, fromId);
};
