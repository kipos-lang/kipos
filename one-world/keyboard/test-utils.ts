import {
    RecNodeT,
    Nodes,
    fromRec,
    childLocs,
    childNodes,
    Id,
    ListKind,
    RecText,
    TextSpan,
    TableKind,
    Style,
    IdRef,
    RecNode,
    NodeID,
} from '../shared/cnodes';
// import { Ctx, ParseResult } from '../syntaxes/dsl';
import { TESTING_CTREE } from './applyUpdate';
import { fixTextSel } from './ctdt-test-utils';
import { charClass } from './insertId';
import { initial } from './update/crdt/ctree.test';
import { CollectionCursor, Cursor, IdCursor, ListWhere, NodeSelection, Path, selStart, TextCursor, Top } from './utils';

export type TestState = {
    top: Top;
    sel: NodeSelection;
    nextLoc: () => string;
};

// export type TestParser<T> = {
//     config: Config;
//     parse(node: RecNode, cursor?: NodeID): any;
//     spans(ast: any): Src[];
// };

export const nloc = () => {
    let id = 1;
    return () => id++ + '';
};

export const initTop = (): Top => {
    // let lid = 1;
    return {
        // nextLoc: () => lid++ + '',
        nodes: { [0]: { type: 'id', text: '', loc: '0' } },
        root: '0',
        // tmpText: {},
    };
};

export const init = (): TestState => ({
    top: initTop(),
    sel: {
        start: selStart({ root: { ids: [], top: '' }, children: ['0'] }, { type: 'id', end: 0 }),
    },
    nextLoc: nloc(),
});

export const asTopAndPath = (node: RecNodeT<boolean | number>): { top: Top; sel: NodeID[]; nextLoc(): string; sels: Record<number, NodeID[]> } => {
    const nodes: Nodes = {};
    let nextLoc = 0;
    let sel: NodeID[] = [];
    const sels: Record<number, NodeID[]> = {};
    const root = fromRec(node, nodes, (l, _, path) => {
        const loc = nextLoc++ + '';
        if (l === true || l === 1) {
            sel = path.concat([loc]);
        } else if (typeof l === 'number') {
            sels[l] = path.concat([loc]);
        }
        return loc;
    });
    return { nextLoc: () => nextLoc++ + '', top: { nodes, root }, sel, sels };
};

export type Sels = null | [number, Cursor] | [number, Cursor][];

export const asTopAndLocs = (node: RecNodeT<number>): { top: Top; nextLoc(): string; locs: Record<number, NodeID[]> } => {
    const nodes: Nodes = {};
    let nextLoc = 0;
    let locs: Record<number, NodeID[]> = {};
    const rootLoc = fromRec(node, nodes, (l, _, path) => {
        const loc = nextLoc++ + '';
        if (l != null) {
            if (locs[l]) throw new Error(`duplicate num ${l}`);
            locs[l] = path.concat([loc]);
        }
        return loc;
    });
    return { nextLoc: () => nextLoc++ + '', top: { nodes, root: rootLoc }, locs };
};

export const asTopAndPaths = (node: RecNodeT<Sels>, root: Path['root']): { top: Top; nextLoc(): string; sels: Record<number, NodeSelection> } => {
    const nodes: Nodes = {};
    let nextLoc = 0;
    let sels: Record<number, NodeSelection> = {};
    const rootLoc = fromRec(node, nodes, (l, _, path) => {
        const loc = nextLoc++ + '';
        if (l != null) {
            if (Array.isArray(l[0])) {
                (l as [number, Cursor][]).forEach(([num, cursor]) => {
                    sels[num] = { start: selStart({ children: path.concat([loc]), root }, cursor) };
                });
            } else {
                const [num, cursor] = l as [number, Cursor];
                sels[num] = { start: selStart({ children: path.concat([loc]), root }, cursor) };
            }
        }
        return loc;
    });
    return { nextLoc: () => nextLoc++ + '', top: { nodes, root: rootLoc }, sels };
};

// export { initial as asTop };
export const asTop = (node: RecNodeT<number | boolean>, cursor: Cursor, endCursor?: Cursor): TestState => {
    if (TESTING_CTREE) {
        return initial(node, cursor, endCursor);
    }
    return _asTop(node, cursor, endCursor);
};

/**
 * Either RecNodeT<boolean> or RecNodeT<number>
 * if <number>, 1 = the start, 2 = end
 * if <boolean>, true = the start
 */
export const _asTop = (node: RecNodeT<number | boolean>, cursor: Cursor, endCursor?: Cursor): TestState => {
    const { top, sel, sels, nextLoc } = asTopAndPath(node);
    const start = selStart({ children: sel, root: { ids: [], top: '' } }, cursor);
    fixTextSel(start);
    return {
        top,
        sel: {
            start,
            end: endCursor ? selStart({ children: sels[2] ?? sel, root: { ids: [], top: '' } }, endCursor) : undefined,
        },
        nextLoc,
    };
};

export const asMultiTop = (node: RecNodeT<number>, cursor: Cursor): TestState => {
    const { top, locs, nextLoc } = asTopAndLocs(node);
    if (!locs[0] || !locs[1]) throw new Error(`need locs 0 and 1`);
    return {
        top,
        sel: { start: selStart({ children: locs[0], root: { ids: [], top: '' } }, cursor) },
        nextLoc,
    };
};

export const atPath = (root: NodeID, top: Top, path: number[]) => {
    const res: NodeID[] = [root];
    const orig = path;
    path = path.slice();
    while (path.length) {
        const node = top.nodes[root];
        if (node.type === 'text') {
            const span = node.spans[path.shift()!];
            if (!path.length) {
                res.push(span.loc);
            } else {
                if (span.type !== 'embed') throw new Error(`cant go into non embed`);
                root = span.item;
                res.push(root);
                path.shift()!; // it's just going to be `0`
            }
            continue;
        }
        const locs = childLocs(top.nodes[root]);
        const nxt = path.shift()!;
        root = locs[nxt];
        if (root == null) {
            throw new Error(`invalid atPath invocation: ${orig.join(',')}`);
        }
        res.push(root);
    }
    return res;
};

export const selPathN = <T>(exp: RecNodeT<T>, needle: T) => {
    let found = null as number[] | null;
    const visit = (node: RecNodeT<T>, path: number[]) => {
        if (node.loc === needle) {
            if (found != null) throw new Error(`multiple nodes marked as selected`);
            found = path;
        }
        childNodes(node).forEach((child, i) => visit(child, path.concat([i])));
    };
    visit(exp, []);
    return found;
};

export const selPaths = (exp: RecNodeT<number | boolean | null>): { main: number[]; paths: Record<number, number[]> } => {
    const paths: Record<number, number[]> = {};
    let main: number[] | null = null;
    const visit = (node: RecNodeT<number | boolean | null>, path: number[]) => {
        if (node.loc === true || node.loc === 1) {
            if (main != null) throw new Error(`multiple nodes marked as selected`);
            main = path;
        } else if (typeof node.loc === 'number') {
            paths[node.loc] = path;
        }
        if (node.type === 'text') {
            for (let i = 0; i < node.spans.length; i++) {
                const span = node.spans[i];
                if (span.loc === true || span.loc === 1) {
                    if (main != null) throw new Error(`multiple nodes marked as selected`);
                    main = path.concat([i]);
                } else if (typeof span.loc === 'number') {
                    paths[span.loc] = path.concat([i]);
                }
                if (span.type === 'embed') {
                    visit(span.item, path.concat([i, 0]));
                }
            }
        } else {
            childNodes(node).forEach((child, i) => visit(child, path.concat([i])));
        }
    };
    visit(exp, []);
    if (main === null) throw new Error(`selected node not found`);
    return { main, paths };
};

export const selPath = (exp: RecNodeT<boolean | number>, which?: number) => {
    const found = selPathN(exp, which ?? true);
    if (found == null) throw new Error(`no node marked for selection`);
    return found;
};

// kinds of keys:
// - tight
// - space
// - sep
// - id (everything else)
// MARK: makers
export const id = <T>(text: string, loc: T = null as T, config: Config = js, ref?: IdRef): Id<T> => ({
    type: 'id',
    text,
    loc,
    ref,
    ccls: text.length === 0 ? undefined : text[0] === '.' && text.length > 1 ? charClass(text[1], config) : charClass(text[0], config),
});
export const list =
    (kind: ListKind<RecNodeT<unknown>>) =>
    <T>(children: RecNodeT<T>[], loc: T = null as T, forceMultiline?: boolean): RecNodeT<T> => ({
        type: 'list',
        kind: kind as ListKind<RecNodeT<T>>,
        forceMultiline,
        children,
        loc,
    });
export const smoosh = list('smooshed');
export const spaced = list('spaced');
export const round = list('round');
export const square = list('square');
export const curly = list('curly');
export const rich = list({ type: 'plain' });
export const bullet = list({ type: 'list', ordered: false });
export const checks = list({ type: 'checks', checked: {} });
// What do I do about you now
// export const angle = list('angle');
export const table = <T>(kind: TableKind, rows: RecNodeT<T>[][], loc: T = null as T, forceMultiline?: boolean): RecNodeT<T> => ({
    type: 'table',
    kind,
    rows,
    loc,
    forceMultiline,
});
export const text = <T>(spans: TextSpan<RecNodeT<T>, T>[], loc: T = null as T): RecText<T> => ({ type: 'text', loc, spans });

// ugh.
/*

In lisp, we want:
- ' ' to be the list sep
- no space sep
- '|' to be the table sep, but NOT the list sep

I guess it would be

list: ' \n'
table: '|\n

and js

list: ',;\n',
table: ';\n',

So instead of `listKind` it would be something like .. `isListSep(key, config)` and `isTableSep(key, config)`

and we only check tableSep in certain circumstances.

*/

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

// Classes of keys
/// IDkeys
const allkeys = '1234567890qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM~!@#$%^&*()_+{}|:"<>?`-=[]\\;\',./';
const idkeys = (config: Config) => [...allkeys].filter((k) => !config.punct.includes(k) && !config.space.includes(k) && !config.sep.includes(k));
const lispId = idkeys(lisp);
const jsId = idkeys(js);
export const idc = (end: number): IdCursor => ({ type: 'id', end });
export const listc = (where: ListWhere): CollectionCursor => ({ type: 'list', where });
export const controlc = (index: number): CollectionCursor => ({ type: 'control', index });
export const noText = (cursor: Cursor): Cursor => cursor;
// cursor.type === 'id' ? { ...cursor } : cursor.type === 'text' ? { ...cursor, end: { ...cursor.end, text: undefined } } : cursor;
export const textc = (index: number | string, cursor: number): TextCursor => ({
    // text?: string[]
    type: 'text',
    end: { index, cursor }, // text
});

// export const textcs = (index: number, cursor: number, sindex: number, scursor: number, text?: string[]): TextCursor => ({
//     type: 'text',
//     end: { index, cursor, text },
//     start: { index: sindex, cursor: scursor },
// });

export const tspan = (text: string, style?: Style, loc?: boolean | number): TextSpan<any, boolean | number> => ({
    type: 'text',
    text,
    style,
    loc: loc ?? 0,
});
export const tembed = (item: RecNodeT<boolean | number>, style?: Style, loc?: boolean): TextSpan<any, number | boolean> => ({
    type: 'embed',
    item,
    style,
    loc: loc ?? 0,
});
