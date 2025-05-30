import { childLocs, isRich, NodeID } from '../shared/cnodes';
import { isTag, richNode } from './handleNav';
import { TestState } from './test-utils';
import { getSpan, lastChild, NodeSelection, parentLoc, Path, Top } from './utils';
import { getCurrent } from './selections';

const validatePath = (top: Top, path: Path) => {
    if (path.children.length === 0) {
        throw new Error(`empty path`);
    }
    let parent = top.root;
    for (let i = 0; i < path.children.length; i++) {
        const id = path.children[i];
        if (i === 0) {
            if (id !== parent) throw new Error(`first id is not root (${parent}) ${id}`);
            continue;
        }
        const children = childLocs(top.nodes[parent]);
        if (!children.includes(id)) {
            console.log(top.nodes[parent]);
            throw new Error(`child ${id} is not a child of ${parent} (${children.join(',')})`);
        }
        parent = id;
    }
    return true;
};

export const validateLocs = (top: Top) => {
    Object.keys(top.nodes).forEach((loc) => {
        if (!top.nodes[loc]) {
            return;
        }
        if (top.nodes[loc].loc !== loc) {
            throw new Error(`Node.loc doesn't match key ${+loc}`);
        }
    });
};

export const validateNodes = (top: Top, id: NodeID) => {
    const node = top.nodes[id];

    if (!node) {
        throw new Error(`missing node ${id} in top`);
    }

    // if (node.type === 'text') {
    //     const seen: Record<string, true> = {};
    //     node.spans.forEach((span) => {
    //         if (!span.loc || top.nodes[span.loc] || seen[span.loc]) {
    //             throw new Error(`bad span loc ${span.loc}`);
    //         }
    //         seen[span.loc] = true;
    //     });
    // }

    if (node.type === 'id' && (node.text === '') !== (node.ccls == null)) {
        console.log(node);
        throw new Error(`ccls must be set if text is not empty "${node.text}" vs ${node.ccls}, and vice versa`);
    }

    // Every row in a table must have at least one item.
    if (node.type === 'table') {
        node.rows.forEach((row) => {
            if (row.length === 0) {
                throw new Error(`table row has 0 items; must have at least 1`);
            }
        });
    }

    if (node.type === 'list' && node.kind === 'spaced') {
        if (node.children.length < 2) {
            throw new Error(`spaced list shouldn't have fewer than 2 items`);
        }
        node.children.forEach((cid) => {
            const child = top.nodes[cid];
            if (child.type === 'list' && child.kind === 'spaced') {
                throw new Error(`spaced child cant be spaced: ${child.kind}`);
            }
        });
    }

    if (node.type === 'list' && isTag(node.kind)) {
        const tag = top.nodes[node.kind.node];
        if (tag.type === 'list' && tag.kind === 'spaced') {
            throw new Error(`xml tag cant be spaced`);
        }
    }

    if (node.type === 'list' && node.kind === 'smooshed') {
        if (node.children.length < 2) {
            throw new Error(`smooshed list shouldn't have fewer than 2 items`);
        }
        let kinds: ('id' | number | 'other')[] = [];
        node.children.forEach((cid) => {
            const child = top.nodes[cid];
            if (!child) throw new Error(`invalid child ${cid}`);
            if (child.type === 'id') {
                if (child.text === '') {
                    throw new Error(`blank id ${cid} in smooshed ${node.loc} should not be`);
                }
                if (child.ccls != null) {
                    kinds.push(child.ccls);
                } else {
                    kinds.push('id');
                }
            } else {
                kinds.push('other');
            }

            if (child.type === 'list') {
                if (child.kind === 'smooshed' || child.kind === 'spaced') {
                    throw new Error(`smooshed child cant be spaced or smooshed: ${child.kind}`);
                }
            }
        });

        kinds.forEach((kind, i) => {
            if (i > 0 && kind !== 'other' && kind === kinds[i - 1]) {
                console.log(kinds);
                console.log(node.children.map((n) => top.nodes[n]));
                throw new Error(`Cannot have ${kind} adjacent to itself in smooshed`);
            }
        });
    }
    childLocs(node).forEach((cid) => validateNodes(top, cid));
};

const validateCursor = (state: Pick<TestState, 'top' | 'sel'>) => {
    const current = getCurrent(state.sel, state.top);
    if (current.type === 'text') {
        const parent = state.top.nodes[parentLoc(current.path)];
        if (richNode(parent) && current.cursor.type === 'list' && current.cursor.where !== 'inside') {
            throw new Error(`Rich text texts can't be selected before or after`);
        }
        if (current.cursor.type === 'text') {
            const span = getSpan(current.node, current.cursor.end.index);
            if (!span) {
                console.log(current.node, current.cursor.end.index);
                throw new Error(`invalid text cursor ${current.cursor.end.index}`);
            }
            const at = current.node.spans.indexOf(span);
            if (at < 0 || at >= current.node.spans.length) {
                throw new Error(`cursor text index out of range`);
            }
        }
    }
};

export const validate = (state: Pick<TestState, 'top' | 'sel'>) => {
    try {
        validatePath(state.top, state.sel.start.path);
    } catch (err) {
        console.log('path', state.sel.start.path);
        throw err;
    }
    validateCursor(state);
    validateLocs(state.top);
    validateNodes(state.top, state.top.root);
};
