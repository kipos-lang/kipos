import { Node, NodeID } from '../shared/cnodes';
import { isTag } from './handleNav';

export const replaceIn = (node: Node, old: NodeID, ...locs: NodeID[]): Node => {
    if (node.type === 'id') {
        throw new Error(`no children of id`);
    }

    if (node.type === 'text') {
        const at = node.spans.findIndex((span) => span.type === 'embed' && span.item === old);
        if (at === -1) throw new Error(`cant find ${old} child of text ${node.loc}`);
        const spans = node.spans.slice();
        if (!locs.length) {
            spans.splice(at, 1);
            return { ...node, spans };
        }
        spans[at] = { type: 'embed', item: locs[0], loc: '' };
        for (let i = 1; i < locs.length; i++) {
            spans.splice(at + i, 0, { type: 'embed', item: locs[i], loc: '' });
        }
        return { ...node, spans };
    }

    if (node.type === 'list') {
        if (isTag(node.kind) && node.kind.node === old) {
            if (locs.length !== 1) {
                // hm or I could wrap them in a spaced or something? or a smooshed?
                throw new Error(`Tag must be replaced with only a single node?`);
            }
            return { ...node, kind: { type: 'tag', node: locs[0], attributes: node.kind.attributes } };
        }
        if (isTag(node.kind) && node.kind.attributes === old) {
            if (locs.length !== 1) {
                // hm or I could wrap them in a spaced or something? or a smooshed?
                throw new Error(`Tag must be replaced with only a single node?`);
            }
            return { ...node, kind: { type: 'tag', node: node.kind.node, attributes: locs[0] } };
        }
        const at = node.children.indexOf(old);
        if (at === -1) throw new Error(`cant find ${old} child of list ${node.loc}`);
        const children = node.children.slice();
        if (!locs.length) {
            children.splice(at, 1);
            return { ...node, children };
        }
        children[at] = locs[0];
        for (let i = 1; i < locs.length; i++) {
            children.splice(at + i, 0, locs[i]);
        }
        return { ...node, children };
    }

    if (node.type === 'table') {
        const rows = node.rows.slice();
        let found = false;
        for (let i = 0; i < rows.length; i++) {
            const at = rows[i].indexOf(old);
            if (at !== -1) {
                found = true;
                rows[i] = rows[i].slice();
                if (!locs.length) {
                    rows[i].splice(at, 1);
                } else {
                    rows[i][at] = locs[0];
                    for (let i = 1; i < locs.length; i++) {
                        rows[i].splice(at + i, 0, locs[i]);
                    }
                }
                break;
            }
        }
        if (!found) throw new Error(`cant find ${old} child of table ${node.loc}`);
        return { ...node, rows };
    }

    throw new Error(`unexpected node type ${(node as any).type}`);
};
