/**
 * Lex text into the CST
 */

import { Collection, List, ListKind, NodeID, Nodes, NodeT, RecCollection, RecList, RecNodeT, Table, Text } from './nodes';

export const lisp = {
    punct: [';', '.', '@', '=#+'],
    space: '',
    sep: ' \n',
    tableCol: ' :',
    tableRow: '\n',
    tableNew: ':',
} satisfies Config;

export const js = {
    // punct: [],
    // so js's default is just 'everything for itself'
    // tight: [...'~`!@#$%^&*_+-=\\./?:'],
    // punct: '~`!@#$%^&*_+-=\\./?:',
    punct: ['.', '/', '~`!@#$%^&*+-=\\/?:><'],
    space: ' ',
    sep: ',;\n',
    tableCol: ',:',
    tableRow: ';\n',
    tableNew: ':',
    xml: true,
} satisfies Config;

export type Config = {
    punct: string[];
    space: string;
    sep: string;
    xml?: boolean;
    tableCol: string;
    tableRow: string;
    tableNew: string;
};

// type NodeID = { start: number; end: number; id: string };

export type Kind = number | 'space' | 'sep' | 'string'; // | 'bar';

export const textKind = (grem: string, config: Config): Kind => {
    if (grem === '"') return 'string';
    if (config.sep.includes(grem)) return 'sep';
    if (config.space.includes(grem)) return 'space';
    return charClass(grem, config);
};

export const charClass = (grem: string, config: Config): number => {
    for (let i = 0; i < config.punct.length; i++) {
        if (config.punct[i].includes(grem)) {
            return i + 1;
        }
    }
    return 0; // 0 is the class for text
};

const ticker = () => {
    let i = 0;
    return () => (i++).toString().padStart(3, '0');
};

export const lex = (config: Config, input: string) => {
    const nodes: Record<string, NodeT<NodeID>> = {};
    const path: string[] = [];
    const ts = ticker();
    const smap: Record<string, { start: number; end: number }> = {};

    const root = ts();
    path.push(root);
    nodes[root] = { type: 'list', children: [], kind: 'round', loc: root };

    const getParent = () => nodes[path[path.length - 1]] as Collection<NodeID> | Text<NodeID>;

    const add = (node: NodeT<NodeID>) => {
        nodes[node.loc] = node;
        if (!smap[node.loc]) smap[node.loc] = { start: i, end: i };
        const parent = getParent();
        if (parent.type === 'text') {
            const last = parent.spans[parent.spans.length - 1];
            if (last?.type !== 'embed') throw new Error(`need embed to put in`);
            if (last.item === '') {
                last.item = node.loc;
                return;
            }
            const prev = last.item;
            const smoosh: List<NodeID> = { type: 'list', kind: 'smooshed', children: [prev, node.loc], loc: ts() };
            smap[smoosh.loc] = { start: smap[prev]?.start ?? -1, end: smap[node.loc].end };
            last.item = smoosh.loc;
            nodes[smoosh.loc] = smoosh;
            path.push(smoosh.loc);
            return;
        }
        if (parent.type === 'table') {
            if (parent.rows.length === 0) {
                parent.rows.push([node.loc]);
                return;
            }
            const last = parent.rows[parent.rows.length - 1];
            if (last.length === 0) {
                last.push(node.loc);
                return;
            }
            const prev = last[last.length - 1];
            if (prev === '') {
                last[last.length - 1] = node.loc;
                return;
            }
            const smoosh: List<NodeID> = { type: 'list', kind: 'smooshed', children: [prev, node.loc], loc: ts() };
            smap[smoosh.loc] = { start: smap[prev].start, end: smap[node.loc].end };
            last[last.length - 1] = smoosh.loc;
            nodes[smoosh.loc] = smoosh;
            path.push(smoosh.loc);
            return;
        }
        if (parent.children.length === 0 || parent.kind === 'smooshed') {
            parent.children.push(node.loc);
            return;
        }
        const at = parent.children.length - 1;
        if (parent.children[at] === '') {
            parent.children[at] = node.loc;
            return;
        }
        const prev = parent.children[at];
        const smoosh: List<NodeID> = { type: 'list', kind: 'smooshed', children: [prev, node.loc], loc: ts() };
        smap[smoosh.loc] = { start: smap[prev].start, end: smap[node.loc].end };
        parent.children[at] = smoosh.loc;
        nodes[smoosh.loc] = smoosh;
        path.push(smoosh.loc);
    };

    const addSpace = () => {
        let parent = getParent();

        if (parent.type === 'list' && parent.kind === 'smooshed') {
            path.pop();
            smap[parent.loc].end = i;
            parent = getParent();
        }

        if (parent.type === 'text') {
            const last = parent.spans[parent.spans.length - 1];
            if (last?.type !== 'embed') throw new Error(`need embed to put in`);
            let prev = last.item;
            if (prev == '') {
                prev = ts();
                nodes[prev] = { type: 'id', text: '', loc: prev };
                smap[prev] = { start: i, end: i };
            }
            const loc = ts();
            nodes[loc] = { type: 'list', kind: 'spaced', children: [prev, ''], loc };
            smap[loc] = { start: smap[prev].start, end: i };
            last.item = loc;
            path.push(loc);
            return;
        }

        if (parent.type === 'table') {
            const last = parent.rows[parent.rows.length - 1];
            if (!last || !last.length) return;
            if (last[last.length - 1] === '') return;
            throw new Error('not yet');
        }

        if (parent.kind === 'spaced') {
            parent.children.push('');
        } else {
            let prev = parent.children.length ? parent.children[parent.children.length - 1] : null;
            if (prev == null) {
                prev = ts();
                nodes[prev] = { type: 'id', text: '', loc: prev };
                smap[prev] = { start: i, end: i };
            }
            if (prev === '') {
                return;
            }
            const loc: NodeID = ts();
            smap[loc] = { start: i + 1, end: i + 1 };
            parent.children[parent.children.length - 1] = loc;
            path.push(loc);
            nodes[loc] = { type: 'list', kind: 'spaced', children: prev === '' ? [prev] : [prev, ''], loc };
        }
    };

    const addSep = (newline: boolean) => {
        let parent = getParent();
        if (parent.type === 'text') {
            throw new Error(`cant sep in text embed`);
        }

        while (parent.kind === 'smooshed' || parent.kind === 'spaced') {
            path.pop();
            smap[parent.loc].end = i;
            parent = getParent();
            if (parent.type === 'text') {
                throw new Error(`cant sep in text embed`);
            }
        }

        if (parent.type === 'table') {
            if (parent.rows[parent.rows.length - 1]?.length === 0) return;
            parent.rows.push([]);
            return;
        }

        if (newline) {
            parent.forceMultiline = true;
        }

        parent.children.push('');
    };

    let i = 0;
    for (; i < input.length; i++) {
        const char = input[i];
        let parent = getParent();

        if (parent.type === 'text' && parent.spans[parent.spans.length - 1]?.type !== 'embed') {
            if (char === '"') {
                path.pop();
                smap[parent.loc].end = i + 1;
                continue;
            }
            if (char === '$' && input[i + 1] === '{') {
                const loc = ts();
                parent.spans.push({ type: 'embed', item: '', loc });
                i++; // skip one }
                continue;
            }
            const last = parent.spans[parent.spans.length - 1];
            if (last?.type !== 'text') {
                const loc = ts();
                parent.spans.push({ type: 'text', loc, text: char });
                continue;
            }
            last.text += char;
            continue;
        }

        const wrap = wrapKind(char);
        if (wrap) {
            const loc: NodeID = ts();
            smap[loc] = { start: i, end: i };
            if (input[i + 1] === config.tableNew) {
                i++;
                add({ type: 'table', kind: wrap, rows: [], loc });
            } else {
                add({ type: 'list', kind: wrap, children: [], loc });
            }
            path.push(loc);
            continue;
        }

        const findTable = () => {
            for (let i = path.length - 1; i >= 0; i--) {
                const node = nodes[path[i]];
                if (node.type === 'table') {
                    return node.loc;
                }
                if (node.type === 'list' && (node.kind === 'smooshed' || node.kind === 'spaced')) {
                    continue;
                }
                return null;
            }
        };

        if (char === config.tableNew) {
            const ptable = findTable();
            if (ptable != null) {
                const table = nodes[ptable] as Table<NodeID>;
                if (closerKind(input[i + 1]) === table.kind) {
                    const at = path.indexOf(ptable);
                    while (path.length > at) {
                        path.pop();
                        smap[parent.loc].end = i;
                        parent = getParent();
                    }
                    i++;
                    continue;
                }
            }
        }

        if (config.tableCol.includes(char)) {
            const ptable = findTable();
            if (ptable != null) {
                const node = nodes[ptable] as Table<NodeID>;
                if (!node.rows.length) throw new Error('no rows');
                node.rows[node.rows.length - 1].push('');
                continue;
            }
        }

        const close = closerKind(char);
        if (close) {
            while (parent.type === 'list' && (parent.kind === 'smooshed' || parent.kind === 'spaced')) {
                path.pop();
                smap[parent.loc].end = i;
                parent = getParent();
            }
            if (parent.type === 'text') {
                if (close !== 'curly') {
                    throw new Error(`text close must be curly`);
                }
                parent.spans.push({ type: 'text', loc: ts(), text: '' });
                continue;
            } else if (close !== parent.kind) {
                throw new Error(`unexpected close ${close} - expected ${parent.kind}`);
            }
            smap[parent.loc].end = i;
            path.pop();
            continue;
        }

        const kind = textKind(char, config);
        switch (kind) {
            case 'space':
                addSpace();
                continue;
            case 'sep':
                addSep(char === '\n');
                continue;
            case 'string': {
                const loc: NodeID = ts();
                smap[loc] = { start: i, end: i };
                add({ type: 'text', loc, spans: [] });
                path.push(loc);
                continue;
            }
            default: {
                let node;
                if (parent.type === 'text') {
                    const last = parent.spans[parent.spans.length - 1];
                    if (last.type !== 'embed') throw new Error('shoulndt get here');
                    node = nodes[last.item];
                } else if (parent.type === 'table') {
                    if (!parent.rows.length) {
                        node = null;
                    } else {
                        const row = parent.rows[parent.rows.length - 1];
                        const last = row[row.length - 1];
                        node = nodes[last];
                    }
                } else {
                    const last = parent.children[parent.children.length - 1];
                    node = nodes[last];
                }
                if (node?.type === 'id' && (node.ccls === undefined || node.ccls === kind)) {
                    node.text += char;
                } else {
                    add({ type: 'id', loc: ts(), text: char, ccls: kind });
                }
                continue;
            }
        }
    }
    Object.values(nodes).forEach((node) => {
        if (node.type === 'list') {
            node.children = node.children.filter((c) => c !== '');
        }
    });

    return { nodes, roots: nodes[root].children };
};

export const wrapKind = (key: string): 'round' | 'curly' | 'square' | void => {
    switch (key) {
        case '(':
            return 'round';
        case '{':
            return 'curly';
        case '[':
            return 'square';
        // case '<':
        //     return 'angle';
    }
};

export const closerKind = (key: string): ListKind<any> | void => {
    switch (key) {
        case ')':
            return 'round';
        case '}':
            return 'curly';
        case ']':
            return 'square';
        // case '<':
        //     return 'angle';
    }
};
