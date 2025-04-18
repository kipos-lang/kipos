import equal from 'fast-deep-equal';
import { splitGraphemes } from '../splitGraphemes';
import { childLocs, Loc, Node, NodeID, Style, Text } from '../shared/cnodes';
import { idText } from './cursorSplit';
import { goLateral, handleNav, selectEnd, selectStart } from './handleNav';
import { handleSpecialText, keyFormat } from './handleSpecialText';
import { KeyAction, moveA } from './keyActionToUpdate';
import { getCurrent, ltCursor } from './selections';
import { TestState } from './test-utils';
import { lastChild, NodeSelection, parentLoc, parentPath, Path, pathKey, pathWithChildren, selStart, Top } from './utils';
import { Src } from '../syntaxes/dsl3';

// export type Src = { type: 'src'; left: Loc; right?: Loc };

export const nextLargerSpan = (sel: NodeSelection, spans: Src[], top: Top) => {
    const multi = { parent: parentPath(sel.start.path), children: [lastChild(sel.start.path)] };

    if (!multi) {
        return;
    }

    const parent = top.nodes[lastChild(multi?.parent)];
    const sibs = childLocs(parent);

    const first = sibs.indexOf(multi.children[0]);
    const last = sibs.indexOf(multi.children[multi.children.length - 1]);

    if (first === -1 || last === -1) {
        return;
    }

    // number is "how much bigger"
    let best = null as null | [number, Loc, Loc];

    spans.forEach((span) => {
        if (!span.right || span.left.length !== 1 || span.right.length !== 1) return;
        const left = sibs.indexOf(span.left);
        const right = sibs.indexOf(span.right);
        if (left === -1 || right === -1) return;
        const min = left < right ? left : right;
        const max = left < right ? right : left;
        if (min > first || max < last) return;
        const delta = first - min + (max - last);
        if (delta === 0) return;
        if (best === null || best[0] > delta) best = [delta, span.left, span.right];
    });
    // console.log('nest best', best);

    return best ? { left: best[1], right: best[2], parent: multi.parent } : null;
};

export const shiftExpand = (state: TestState, spans?: Src[]): NodeSelection | void => {
    // console.log('hi');
    // if (!state.sel.multi) {
    //     return { start: state.sel.start, multi: { end: state.sel.start } };
    // }
    // const next = spans ? nextLargerSpan(state.sel, spans, state.top) : null;
    // if (next) {
    //     const left = pathWithChildren(next.parent, next.left[0].idx);
    //     const right = pathWithChildren(next.parent, next.right[0].idx);
    //     // TODO.... thissssss meansssss hm. that I'll need to be more fancy in how I store 'selection bounds'
    //     return { start: state.sel.start, multi: { end: selEnd(left), aux: selEnd(right) } };
    // }
    // const path = state.sel.multi?.end.path ?? state.sel.start.path;
    // // TODO: use the parsed's stufffffff here too
    // const parent = parentPath(path);
    // return { start: state.sel.start, multi: { end: selEnd(parent) } };
};

export const handleShiftNav = (state: TestState, key: 'ArrowLeft' | 'ArrowRight'): KeyAction[] | void => {
    const at = state.sel.end ?? state.sel.start;
    const next = handleNav(key, { ...state, sel: { start: at } });
    if (next) {
        return [{ type: 'sel-expand', sel: next }];
    }
    // if (state.sel.multi) {
    //     const next = nextLateral(state.sel.multi?.end, state.top, key === 'ArrowLeft');
    //     if (!next) return;
    //     return { nodes: {}, selection: { start: state.sel.start, multi: { end: next } } };
    // }
    // const current = getCurrent(state.sel, state.top);
    // switch (current.type) {
    //     case 'id':
    //         return handleShiftId(current, state.top, key === 'ArrowLeft');
    //     case 'text':
    //         return handleShiftText(current, state.top, key === 'ArrowLeft');
    // }
};

const isSmooshSpace = (node: Node) => {
    return node.type === 'list' && (node.kind === 'smooshed' || node.kind === 'spaced');
};

export const selEnd = (path: Path): SelSide => ({ path, key: pathKey(path) });

export const nextLateral = (side: { path: Path }, top: Top, shift: boolean): SelSide | void => {
    const parent = top.nodes[parentLoc(side.path)];
    if (!parent) return;
    if (parent.type === 'text') {
        return selStart(parentPath(side.path), { type: 'list', where: shift ? 'before' : 'after' });
    }
    const cnodes = childLocs(parent);
    const at = cnodes.indexOf(lastChild(side.path));
    if (at === (shift ? 0 : cnodes.length - 1)) {
        return selEnd(parentPath(side.path));
        // if (isSmooshSpace(parent)) {
        //     return nextLateral({ path: parentPath(side.path) }, top, shift);
        // }
        // return selStart(parentPath(side.path), { type: 'list', where: shift ? 'before' : 'after' });
    }
    const nxt = cnodes[at + (shift ? -1 : 1)];
    const npath = pathWithChildren(parentPath(side.path), nxt);
    return selEnd(npath);
    // return shift ? selectStart(npath, top) : selectEnd(npath, top);
};

export const expandLateral = (side: SelStart, top: Top, shift: boolean): KeyAction[] | void => {
    // const sel = nextLateral(side, top, shift);
    // return sel ? { start: side, multi: { end: sel } } : undefined;
};

export type SelSide = { path: Path; key: string };
export type SelStart = NodeSelection['start'];

export const goTabLateral = (side: SelStart, top: Top, shift: boolean): NodeSelection['start'] | void => {
    const { path, cursor } = side;
    const node = top.nodes[lastChild(path)];
    if (cursor.type === 'list') {
        // Maybe go inside?
        if ((shift && cursor.where === 'after') || (!shift && cursor.where === 'before')) {
            if (node.type === 'list') {
                if (node.children.length === 0) {
                    return selStart(path, { type: 'list', where: 'inside' });
                }
                if (shift) {
                    return selectEnd(pathWithChildren(path, node.children[node.children.length - 1]), top);
                } else {
                    return selectStart(pathWithChildren(path, node.children[0]), top);
                }
            } else if (node.type === 'table') {
                if (node.rows.length === 0) {
                    return selStart(path, { type: 'list', where: 'inside' });
                }
                if (shift) {
                    const last = node.rows[node.rows.length - 1];
                    return selectEnd(pathWithChildren(path, last[last.length - 1]), top);
                } else {
                    return selectStart(pathWithChildren(path, node.rows[0][0]), top);
                }
            }
        }
    }

    if (cursor.type === 'list') {
        if (cursor.where === (shift ? 'before' : 'after')) {
            // check for smoosh
            const parent = top.nodes[parentLoc(path)];
            if (parent?.type === 'list' && parent.kind === 'smooshed') {
                const at = parent.children.indexOf(lastChild(path));
                if (at !== (shift ? 0 : parent.children.length - 1)) {
                    // go double
                    const next = goLateral(path, top, shift, true);
                    // return next;
                    return next ? goTabLateral(next, top, shift) : next;
                }
            }
        }
    }

    if (cursor.type === 'control' && node.type === 'list') {
        const at = typeof cursor.index === 'string' ? node.children.indexOf(cursor.index) : cursor.index;
        if (!shift || at > 0) {
            if (shift) {
                return selectEnd(pathWithChildren(path, node.children[at - 1]), top);
            } else {
                return selectStart(pathWithChildren(path, node.children[at]), top);
            }
        }
    }

    if (cursor.type === 'id' && node.type === 'id') {
        const text = idText(cursor, node);
        if (cursor.end === (shift ? 0 : text.length)) {
            const parent = top.nodes[parentLoc(path)];
            if (parent?.type === 'list' && parent.kind === 'smooshed') {
                const at = parent.children.indexOf(lastChild(path));
                if (at !== (shift ? 0 : parent.children.length - 1)) {
                    // go double
                    const next = goLateral(path, top, shift, true);
                    return next ? goTabLateral(next, top, shift) : next;
                }
            }
        }
    }

    return goLateral(path, top, shift, true);
};

const wordNext = (
    node: Text<NodeID>,
    left: boolean,
    index: number,
    cursor: number,
    grems?: string[],
): { index: number | string; cursor: number } | null => {
    const span = node.spans[index];

    if (left) {
        if (cursor === 0) {
            if (index === 0) return null;
            const prev = node.spans[index - 1];
            if (prev.type === 'text') {
                const pt = splitGraphemes(prev.text);
                return wordNext(node, left, index - 1, pt.length, pt);
            } else {
                return { index: prev.loc, cursor: 0 };
            }
        }

        if (span.type === 'text') {
            let text = grems ?? splitGraphemes(span.text);
            let i = cursor - 2;
            for (; i >= 0 && text[i] !== ' ' && text[i] !== '\n'; i--);
            i++;
            return { index: span.loc, cursor: i };
        }
    }

    let text = span.type === 'text' ? (grems ?? splitGraphemes(span.text)) : ['_'];
    if (cursor >= text.length) {
        if (index >= node.spans.length - 1) return null;
        const next = node.spans[index + 1];
        if (next.type === 'text') {
            const grems = splitGraphemes(next.text);
            return wordNext(node, left, index + 1, 0, grems);
        } else {
            return { index: next.loc, cursor: 1 };
        }
    }

    let i = cursor + 2;
    for (; i < text.length && text[i] !== ' ' && text[i] !== '\n'; i++);
    if (i > text.length) i = text.length;
    return { index: span.loc, cursor: i };
};

export const toggleFormat = (style: Style, up: Partial<Style>) => {
    if (Object.keys(up).every((k) => equal(style[k as 'color'], up[k as 'color']))) {
        Object.keys(up).forEach((k) => {
            delete style[k as 'color'];
        });
    } else {
        Object.assign(style, up);
    }
};

export const wordNav = (state: TestState, left: boolean, shift: boolean | undefined): KeyAction[] | void => {
    const current = getCurrent(state.sel, state.top);
    if (current.type === 'text' && current.cursor.type === 'text') {
        const { index, cursor } = current.cursor.end;
        const at = typeof index === 'number' ? index : current.node.spans.findIndex((s) => s.loc === index);
        const next = wordNext(current.node, left, at, cursor, undefined); // state.top.tmpText[`${current.node.loc}:${index}`]);
        if (next != null) {
            const start = selStart(current.path, {
                type: 'text',
                end: { cursor: next.cursor, index: next.index },
            });
            return [{ type: shift ? 'sel-expand' : 'move', sel: start }];
        }
    }
    const next = goTabLateral(state.sel.start, state.top, left);
    return moveA(next);
};

export const handleTab = (state: TestState, shift: boolean): SelStart | void => {
    // if (state.sel.end)
    const next = goTabLateral(state.sel.start, state.top, shift);
    return next;
};

export type Mods = { meta?: boolean; ctrl?: boolean; alt?: boolean; shift?: boolean };

export const handleSpecial = (state: TestState, key: string, mods: Mods): void | KeyAction[] => {
    const current = getCurrent(state.sel, state.top);
    if (key === '\n' && mods.meta) {
        let path = current.cursor.type === 'list' && current.cursor.where === 'inside' ? state.sel.start.path : parentPath(state.sel.start.path);
        while (path.children.length) {
            const node = state.top.nodes[lastChild(path)];
            if (node.type === 'table' || (node.type === 'list' && node.kind !== 'smooshed' && node.kind !== 'spaced')) {
                return [{ type: 'toggle-multiline', loc: node.loc }];
            }
            path = parentPath(path);
        }
    }
    if (state.sel.end?.cursor.type === 'text' && state.sel.start.cursor.type === 'text') {
        const sc = state.sel.start.cursor;
        const ec = state.sel.end.cursor;
        if (state.sel.end.key === state.sel.start.key) {
            const mod = keyFormat(key, mods);
            if (!mod) return;

            const [left, right] = ltCursor(sc, ec) ? [sc, ec] : [ec, sc];

            const node = state.top.nodes[lastChild(state.sel.start.path)];
            if (node.type === 'text') {
                return [{ type: 'text-format', path: current.path, left: left.end, right: right.end, format: mod }];
            }
        }
        // console.log('NOT IT', state.sel.end.key, state.sel.start.key);

        // TODO: iterate through all middles, and if everything is a text, go to town.
    }
    switch (current.type) {
        case 'text':
            if (current.cursor.type === 'text') {
                return handleSpecialText(current, state.top, key, mods);
            }
    }
};

export const allPaths = (top: Top) => {
    const paths: Record<NodeID, Path> = {};
    const add = (id: NodeID, parent: Path) => {
        const path = pathWithChildren(parent, id);
        paths[id] = path;

        const node = top.nodes[id];
        const children = childLocs(node);
        children.forEach((child) => add(child, path));
    };
    add(top.root, { children: [], root: { ids: [], top: '' } });
    return paths;
};

const lastCommonAncestor = (one: number[], two: number[]) => {
    let i = 0;
    for (; i < one.length - 1 && i < two.length - 1 && one[i] === two[i]; i++);
    return { common: one.slice(0, i), one: one[i], two: two[i] };
};

export const multiSelChildren = (sel: NodeSelection, top: Top) => {
    // if (!sel.multi) return null;
    // const base = sel.multi.aux ?? sel.start;
    // if (base.path.root.top !== sel.multi.end.path.root.top) return null; // TODO multi-top life
    // if (base.key === sel.multi.end.key) {
    //     return { parent: parentPath(base.path), children: [lastChild(base.path)] };
    // }
    // // so, we ... find the least common ancestor
    // let lca = lastCommonAncestor(base.path.children, sel.multi.end.path.children);
    // // console.log('cla', lca);
    // if (!lca.common.length) return null;
    // const parent: Path = { root: base.path.root, children: lca.common };
    // if (lca.one == null || lca.two == null) {
    //     // return { parent, children: lca.one == null ? [lca.two] : [lca.one] };
    //     throw new Error(`lca didnt work`);
    // }
    // const pnode = top.nodes[lastChild(parent)];
    // const locs = childLocs(pnode);
    // // if (pnode.type !== 'list') return null; // not strings or stuff just yet sry
    // const one = locs.indexOf(lca.one);
    // const two = locs.indexOf(lca.two);
    // const left = one < two ? one : two;
    // const right = one < two ? two : one;
    // return { parent, children: locs.slice(left, right + 1) };
};

export const multiSelKeys = (parent: Path, children: NodeID[]) => {
    return children.map((child) => pathKey(pathWithChildren(parent, child)));
};
