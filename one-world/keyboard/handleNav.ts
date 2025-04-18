import { splitGraphemes } from '../splitGraphemes';
import { hasControls, isRich, ListKind, Node, NodeID, Nodes, TableKind, Text, TextSpan } from '../shared/cnodes';
import { cursorSides } from './cursorSides';
// import { textCursorSides, textCursorSides2 } from './insertId';
import { TestState } from './test-utils';
import {
    Current,
    Cursor,
    findTableLoc,
    getSpan,
    lastChild,
    NodeSelection,
    parentLoc,
    parentPath,
    Path,
    pathWithChildren,
    selStart,
    TextIndex,
    Top,
} from './utils';
import { getCurrent } from './selections';
import { SelStart } from './handleShiftNav';
import { idText, spanText } from './cursorSplit';

export const isTag = <T>(kind: ListKind<T> | TableKind) => typeof kind !== 'string' && kind.type === 'tag';

export const selectStart = (path: Path, top: Top, plus1 = false, tab = false): SelStart | void => {
    const loc = lastChild(path);
    const node = top.nodes[loc];
    if (node.type === 'id') {
        if (plus1 && node.text === '') {
            return goRight(path, top);
        }

        return selStart(path, { type: 'id', end: plus1 ? 1 : 0 });
    }
    if (node.type === 'list') {
        if (tab && hasControls(node.kind) && node.children.length > 0) {
            return selStart(path, { type: 'control', index: 0 });
        }
        if (node.kind === 'spaced' || node.kind === 'smooshed') {
            if (!node.children.length) throw new Error('empty spaced/smooshed/rich');
            return selectStart(pathWithChildren(path, node.children[0]), top, plus1);
        }
        if (plus1) {
            if (isTag(node.kind)) {
                return selectStart(pathWithChildren(path, node.kind.node), top);
            }
            if (node.children.length) {
                return selectStart(pathWithChildren(path, node.children[0]), top);
            }
            return selStart(path, { type: 'list', where: 'inside' });
        }
        return selStart(path, { type: 'list', where: 'before' });
    }
    if (node.type === 'table') {
        return selStart(path, { type: 'list', where: 'before' });
    }
    // TODO... if we are inside of a rich text ... then this text is different.
    // SHOULD that just be a flag on the /text/? hm. idk it might be worth denormalizing?
    const ploc = parentLoc(path);
    if (ploc != null) {
        const parent = top.nodes[ploc];
        // Rich Text, we select the start of the first item in the text
        if (richNode(parent)) {
            if (node.spans.length === 0) {
                return selStart(path, { type: 'list', where: 'inside' });
            }
            return spanStart(node.spans[0], 0, path, top, plus1);
        }
    }
    if (plus1) {
        if (node.spans.length === 0) {
            return selStart(path, { type: 'list', where: 'inside' });
        }
        return spanStart(node.spans[0], 0, path, top, false);
    }
    return selStart(path, { type: 'list', where: 'before' });
};

export const selectEnd = (path: Path, top: { nodes: Nodes }, plus1: boolean = false): SelStart | void => {
    const loc = lastChild(path);
    const node = top.nodes[loc];
    if (!node) throw new Error(`no node ${loc} : ${JSON.stringify(path)}`);
    if (node.type === 'id') {
        const end = splitGraphemes(node.text).length;
        if (end === 0 && plus1) {
            return goLeft(path, top);
        }
        return selStart(path, { type: 'id', end: end - (plus1 ? 1 : 0) });
    }
    if (node.type === 'list') {
        if (node.kind === 'spaced' || node.kind === 'smooshed') {
            if (!node.children.length) throw new Error('empty spaced/smooshed/rich');
            return selectEnd(pathWithChildren(path, node.children[node.children.length - 1]), top, plus1);
        }
        if (plus1) {
            if (node.children.length === 0) {
                return selStart(path, { type: 'list', where: 'inside' });
            }
            return selectEnd(pathWithChildren(path, node.children[node.children.length - 1]), top);
        }
        return selStart(path, { type: 'list', where: 'after' });
    }
    if (node.type === 'table') {
        return selStart(path, { type: 'list', where: 'after' });
    }
    // TODO... if we are inside of a rich text ... then this text is different.
    // SHOULD that just be a flag on the /text/? hm. idk it might be worth denormalizing?
    const ploc = parentLoc(path);
    if (ploc != null && richNode(top.nodes[ploc])) {
        if (node.spans.length === 0) {
            return selStart(path, { type: 'list', where: 'inside' });
        }
        const idx = node.spans.length - 1;
        return spanEnd(node.spans[idx], path, idx, top, plus1);
    }
    if (plus1) {
        if (node.spans.length === 0) {
            return selStart(path, { type: 'list', where: 'inside' });
        }
        const index = node.spans.length - 1;
        return spanEnd(node.spans[index], path, index, top, false);
    }
    return selStart(path, { type: 'list', where: 'after' });
};

export const richNode = (node: Node | undefined) => {
    return (node?.type === 'list' || node?.type === 'table') && isRich(node.kind);
};

export const goLateral = (path: Path, top: Top, left: boolean, tab = false): SelStart | void => {
    return left ? goLeft(path, top, tab) : goRight(path, top, tab);
};

export const goLeft = (path: Path, top: { nodes: Nodes }, tab = false): SelStart | void => {
    const loc = lastChild(path);
    const ploc = parentLoc(path);
    const pnode = top.nodes[ploc];
    if (!pnode) return;
    if (pnode.type === 'list') {
        if (isTag(pnode.kind) && pnode.kind.node === loc) {
            return selStart(parentPath(path), { type: 'list', where: 'before' });
        }
        if (isTag(pnode.kind) && pnode.kind.attributes === loc) {
            return selectEnd(pathWithChildren(parentPath(path), pnode.kind.node), top, false);
        }
        const at = pnode.children.indexOf(loc);
        if (at === -1) return;
        if (tab && hasControls(pnode.kind)) {
            return selStart(parentPath(path), { type: 'control', index: at });
        }
        if (at === 0) {
            if (isTag(pnode.kind)) {
                if (pnode.kind.attributes != null) {
                    return selectEnd(pathWithChildren(parentPath(path), pnode.kind.attributes), top, true);
                }
                return selectEnd(pathWithChildren(parentPath(path), pnode.kind.node), top);
            }
            if (pnode.kind === 'smooshed' || pnode.kind === 'spaced') {
                return goLeft(parentPath(path), top);
            }
            return selStart(parentPath(path), { type: 'list', where: 'before' });
        }
        const next = pathWithChildren(parentPath(path), pnode.children[at - 1]);
        return selectEnd(next, top, !tab && pnode.kind === 'smooshed');
    }

    if (pnode.type === 'table') {
        const { row, col } = findTableLoc(pnode.rows, loc);
        if (row === 0 && col === 0) {
            return selStart(parentPath(path), { type: 'list', where: 'before' });
        }
        if (col === 0) {
            return selectEnd(pathWithChildren(parentPath(path), pnode.rows[row - 1][pnode.rows[row - 1].length - 1]), top);
        }
        return selectEnd(pathWithChildren(parentPath(path), pnode.rows[row][col - 1]), top);
    }

    if (pnode.type === 'text') {
        const index = pnode.spans.findIndex((n) => n.type === 'embed' && n.item === loc);
        if (index === -1) throw new Error('not actually in the text idk ' + loc);
        return selStart(parentPath(path), { type: 'text', end: { index, cursor: 0 } });
    }
};

export const goRight = (path: Path, top: Top, tab = false): SelStart | void => {
    const loc = lastChild(path);
    const ploc = parentLoc(path);
    const pnode = top.nodes[ploc];
    if (!pnode) return;
    if (pnode.type === 'list') {
        if (isTag(pnode.kind) && pnode.kind.node === loc) {
            if (pnode.kind.attributes != null) {
                return selectStart(pathWithChildren(parentPath(path), pnode.kind.attributes), top, true, tab);
            }
            if (!pnode.children.length) {
                return selStart(parentPath(path), { type: 'list', where: 'inside' });
            }
            return selectStart(pathWithChildren(parentPath(path), pnode.children[0]), top, false, tab);
        }
        if (isTag(pnode.kind) && pnode.kind.attributes === loc) {
            if (!pnode.children.length) {
                return selStart(parentPath(path), { type: 'list', where: 'inside' });
            }
            return selectStart(pathWithChildren(parentPath(path), pnode.children[0]), top, false, tab);
        }
        const at = pnode.children.indexOf(loc);
        if (at === -1) {
            console.warn(`child not in parent`, loc, pnode.children);
            return;
        }
        if (at === pnode.children.length - 1) {
            if (pnode.kind === 'smooshed' || pnode.kind === 'spaced') {
                return goRight(parentPath(path), top);
            }
            return selStart(parentPath(path), { type: 'list', where: 'after' });
        }
        if (tab && hasControls(pnode.kind)) {
            return selStart(parentPath(path), { type: 'control', index: at + 1 });
        }
        return selectStart(pathWithChildren(parentPath(path), pnode.children[at + 1]), top, !tab && pnode.kind === 'smooshed', tab);
    }

    if (pnode.type === 'table') {
        const { row, col } = findTableLoc(pnode.rows, loc);
        if (row === pnode.rows.length - 1 && col === pnode.rows[row].length - 1) {
            return selStart(parentPath(path), { type: 'list', where: 'after' });
        }
        if (col === pnode.rows[row].length - 1) {
            return selectStart(pathWithChildren(parentPath(path), pnode.rows[row + 1][0]), top, false, tab);
        }
        return selectStart(pathWithChildren(parentPath(path), pnode.rows[row][col + 1]), top, false, tab);
    }

    if (pnode.type === 'text') {
        const index = pnode.spans.findIndex((n) => n.type === 'embed' && n.item === loc);
        if (index === -1) throw new Error('not actually in the text idk ' + loc);
        return selStart(parentPath(path), { type: 'text', end: { index, cursor: 1 } });
    }
};

export const handleNav = (key: 'ArrowLeft' | 'ArrowRight', state: TestState): SelStart | void => {
    if (key === 'ArrowLeft') {
        const current = getCurrent(state.sel, state.top);
        return navLeft(current, state);
    }
    if (key === 'ArrowRight') {
        const current = getCurrent(state.sel, state.top);
        return navRight(current, state);
    }
};

export const sideEqual = (one: { cursor: NodeID; index: TextIndex }, two: { cursor: NodeID; index: TextIndex }) =>
    one.cursor === two.cursor && one.index === two.index;

export const navRight = (current: Current, state: TestState): SelStart | void => {
    switch (current.type) {
        case 'id': {
            if (current.start != null && current.start !== current.cursor.end) {
                const { right } = cursorSides(current.cursor, current.start);
                return selStart(current.path, { type: 'id', end: right });
            }
            const text = idText(current.cursor, current.node);
            if (current.cursor.end < text.length) {
                return selStart(current.path, { type: 'id', end: current.cursor.end + 1 });
            }
            const sel = goRight(current.path, state.top);
            if (sel) {
                return sel;
            }
            break;
        }
        case 'text': {
            if (current.cursor.type === 'text') {
                // if (current.cursor.start && !sideEqual(current.cursor.start, current.cursor.end)) {
                //     const { right } = textCursorSides2(current.cursor);
                //     return selStart(current.path, { type: 'text', end: right });
                // }
                const { end } = current.cursor;
                const span = getSpan(current.node, end.index);
                const at = current.node.spans.indexOf(span);
                if (span.type !== 'text') {
                    if (end.cursor === 0) {
                        return spanStart(span, end.index, current.path, state.top, true);
                    }
                    if (at < current.node.spans.length - 1) {
                        return spanStart(current.node.spans[at + 1], at + 1, current.path, state.top, true);
                    }
                    return selStart(current.path, { type: 'list', where: 'after' });
                }
                const text = spanText(span);
                if (end.cursor < text.length) {
                    return selStart(current.path, {
                        type: 'text',
                        end: { index: end.index, cursor: end.cursor + 1 },
                    });
                }
                if (at >= current.node.spans.length - 1) {
                    const parent = state.top.nodes[parentLoc(current.path)];
                    // Rich Text, we jump to the next item thankx
                    if (richNode(parent)) {
                        return goRight(current.path, state.top);
                    }
                    return selStart(current.path, { type: 'list', where: 'after' });
                }
                const idx = at + 1;
                return spanStart(current.node.spans[idx], idx, current.path, state.top, true);
            }

            if (current.cursor.type === 'list') {
                switch (current.cursor.where) {
                    case 'after':
                    case 'end':
                        return goRight(current.path, state.top);
                    case 'before':
                    case 'start':
                        if (current.node.spans.length > 0) {
                            return spanStart(current.node.spans[0], 0, current.path, state.top, false);
                        } else {
                            return selStart(current.path, { type: 'list', where: 'inside' });
                        }
                    case 'inside':
                        // TODO isRich
                        return selStart(current.path, { type: 'list', where: 'after' });
                }
            }
            return;
        }
        case 'list': {
            if (current.cursor.type === 'list') {
                switch (current.cursor.where) {
                    case 'after':
                        return goRight(current.path, state.top);
                    case 'before':
                    case 'start':
                        if (current.node.type === 'list') {
                            if (isTag(current.node.kind)) {
                                return selectStart(pathWithChildren(current.path, current.node.kind.node), state.top);
                            }
                            if (current.node.children.length > 0) {
                                return selectStart(pathWithChildren(current.path, current.node.children[0]), state.top);
                            } else {
                                return selStart(current.path, { type: 'list', where: 'inside' });
                            }
                        }
                        if (current.node.type === 'table') {
                            if (current.node.rows.length > 0) {
                                return selectStart(pathWithChildren(current.path, current.node.rows[0][0]), state.top);
                            } else {
                                return selStart(current.path, { type: 'list', where: 'inside' });
                            }
                        }
                    case 'inside':
                    case 'end':
                        return selStart(current.path, { type: 'list', where: 'after' });
                }
            }
        }
    }
};

export const navLeft = (current: Current, state: TestState): SelStart | void => {
    switch (current.type) {
        case 'id': {
            if (current.start != null && current.start !== current.cursor.end) {
                const { left } = cursorSides(current.cursor, current.start);
                return selStart(current.path, { type: 'id', end: left });
            }
            if (current.cursor.end > 0) {
                return selStart(current.path, { type: 'id', end: current.cursor.end - 1 });
            }
            const sel = goLeft(current.path, state.top);
            if (sel) {
                return sel;
            }
            break;
        }
        case 'text': {
            if (current.cursor.type === 'text') {
                // if (current.cursor.start && !sideEqual(current.cursor.start, current.cursor.end)) {
                //     const { left } = textCursorSides2(current.cursor);
                //     return selStart(current.path, { type: 'text', end: left });
                // }
                const { end } = current.cursor;
                const span = getSpan(current.node, end.index);
                if (end.cursor > 0) {
                    if (span.type !== 'text') {
                        return spanEnd(span, current.path, end.index, state.top, true);
                    }

                    return selStart(current.path, {
                        type: 'text',
                        end: { index: end.index, cursor: end.cursor - 1 },
                    });
                }
                const at = current.node.spans.indexOf(span);
                if (at > 0) {
                    const idx = at - 1;
                    return spanEnd(current.node.spans[idx], current.path, idx, state.top, true);
                }
                if (richNode(state.top.nodes[parentLoc(current.path)])) {
                    return goLeft(current.path, state.top);
                }
                return selStart(current.path, { type: 'list', where: 'before' });
            }
        }
        case 'list': {
            if (current.cursor.type === 'control' && current.node.type === 'list') {
                const at = typeof current.cursor.index === 'number' ? current.cursor.index : current.node.children.indexOf(current.cursor.index);
                if (at === 0) {
                    return goLeft(current.path, state.top);
                }
                return selectEnd(pathWithChildren(current.path, current.node.children[at - 1]), state.top);
            }
            if (current.cursor.type === 'list') {
                switch (current.cursor.where) {
                    case 'before':
                        return goLeft(current.path, state.top);
                    case 'start':
                        return selStart(current.path, { type: 'list', where: 'before' });
                    case 'after':
                    case 'end':
                        if (current.node.type === 'list') {
                            if (current.node.children.length > 0) {
                                return selectEnd(pathWithChildren(current.path, current.node.children[current.node.children.length - 1]), state.top);
                            } else {
                                return selStart(current.path, { type: 'list', where: 'inside' });
                            }
                        } else if (current.node.type === 'text') {
                            if (current.node.spans.length === 0) {
                                return selStart(current.path, { type: 'list', where: 'inside' });
                            } else {
                                return spanEnd(
                                    current.node.spans[current.node.spans.length - 1],
                                    current.path,
                                    current.node.spans.length - 1,
                                    state.top,
                                    false,
                                );
                            }
                        }
                        if (current.node.type === 'table') {
                            if (current.node.rows.length > 0) {
                                const last = current.node.rows[current.node.rows.length - 1];
                                return selectEnd(pathWithChildren(current.path, last[last.length - 1]), state.top);
                            } else {
                                return selStart(current.path, { type: 'list', where: 'inside' });
                            }
                        }
                    case 'inside':
                        if (current.node.type === 'list' && isTag(current.node.kind)) {
                            if (current.node.kind.attributes) {
                                return selectEnd(pathWithChildren(current.path, current.node.kind.attributes), state.top);
                            }
                            return selectEnd(pathWithChildren(current.path, current.node.kind.node), state.top);
                        }
                        if (richNode(current.node)) {
                            return goLeft(current.path, state.top);
                        }
                        return selStart(current.path, { type: 'list', where: 'before' });
                }
            }
        }
    }
};

export function spanEnd(last: TextSpan<NodeID>, path: Path, index: TextIndex, top: { nodes: Nodes }, plus1: boolean) {
    switch (last.type) {
        case 'text':
            return selStart(path, { type: 'text', end: { index, cursor: splitGraphemes(last.text).length - (plus1 ? 1 : 0) } });
        case 'embed':
            if (plus1) {
                return selectEnd(pathWithChildren(path, last.item), top);
            }
            return selStart(path, { type: 'text', end: { index, cursor: 1 } });
        default:
            return selStart(path, { type: 'control', index });
    }
}

export const spanStart = (span: TextSpan<NodeID>, index: TextIndex, path: Path, top: Top, plus1: boolean) => {
    if (span.type === 'text') {
        return selStart(path, { type: 'text', end: { index, cursor: plus1 ? 1 : 0 } });
    }
    if (span.type === 'embed') {
        if (plus1) {
            return selectStart(pathWithChildren(path, span.item), top);
        }
        return selStart(path, { type: 'text', end: { index, cursor: 0 } });
    }
    return selStart(path, { type: 'control', index });
};
