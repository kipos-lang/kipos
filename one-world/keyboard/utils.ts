import { splitGraphemes } from '../splitGraphemes';
import { Nodes, Id, Collection, Text, Node, TextSpan, NodeID } from '../shared/cnodes';
import { SelStart } from './handleShiftNav';

export const spanLength = (span: TextSpan<unknown>, text: undefined | { index: TextIndex; text?: string[] }, index: TextIndex) =>
    index === text?.index && text?.text ? text.text.length : span.type === 'text' ? splitGraphemes(span.text).length : 1;

// import { IRSelection } from "../shared/IR/intermediate";
/*
ok: kinds of places a cursor could be:

ID
- just an index into the graphemes list

Text
- index into a text span
- if it's in an embed, the node has its own selection
- fully selecting a /custom/ or /include/ probably? although that could be
  handled by having 'text' spans on either side. yeah I think I'll want to enforce
  that you can't have two non-text spans next to each other.

List
- |(lol) before the opener
- (lol)| after the closer
- "selecting" the opener or closer
- (|) technically the 'inside' of an empty list
- same for [] {} <>
- spaced and smooshed don't have any cursor positions of their own
- <tag {|lol|yes;some|things|}>inner;children</tag>
    - doesn't look like there are any special positions here either.
- rich[list] has bullets that might be selectable as a group
- rich[checks] and [opts] have bullets that can be selected individually
- rich[callout] should have the icon be selectable, and activating it opens a dropdown menu to switch the kind

Table
- before/after and 'select brace' ought to cover it

*/

export const lastChild = (path: Path) => path.children[path.children.length - 1];
export const parentLoc = (path: Path) => path.children[path.children.length - 2];
export const gparentLoc = (path: Path) => path.children[path.children.length - 3];
export const parentPath = (path: Path): Path => ({
    ...path,
    children: path.children.slice(0, -1),
});
export const pathWithChildren = (path: Path, ...children: NodeID[]) => ({
    ...path,
    children: path.children.concat(children),
});

export type IdCursor = {
    type: 'id';
    end: number;
};

export type TextIndex = number | string;

export const getSpanIndex = (spans: TextSpan<any>[], index: TextIndex) =>
    typeof index === 'number' ? index : spans.findIndex((s) => s.loc === index);

export const getSpan = (text: Text<any>, index: TextIndex) =>
    typeof index === 'number' ? text.spans[index] : text.spans.find((s) => s.loc === index)!;

export type TextCursor = {
    type: 'text';
    end: {
        index: TextIndex;
        cursor: number;
        // text?: string[]
    };
};
export type ListWhere = 'before' | 'start' | 'inside' | 'end' | 'after';
export type CollectionCursor = ListCursor | { type: 'control'; index: TextIndex };
export type ListCursor = { type: 'list'; where: ListWhere };

export type Cursor = IdCursor | TextCursor | CollectionCursor;

export type Path = {
    root: { ids: string[]; top: string };
    children: NodeID[];
};

export const pathKey = (path: Path) => `${path.root.ids.join(',')};${path.root.top};${path.children.join(',')}`;
export const selStart = (path: Path, cursor: Cursor): NodeSelection['start'] => ({
    path,
    cursor,
    key: pathKey(path),
});

export type PartialSel = { children: NodeID[]; cursor: Cursor };

export const selectedPath = (sel: NodeSelection) => (sel.end ? null : sel.start.path);
export const selectedLoc = (sel: NodeSelection) => {
    const path = selectedPath(sel);
    return path ? lastChild(path) : null;
};

export const singleSelect = (sel: SelStart): NodeSelection => ({ start: sel });

// TODO maybe join path & key into a `pk: {path, key}` thing
export type NodeSelection = {
    start: { path: Path; key: string; cursor: Cursor; returnToHoriz?: number; level?: number };
    end?: { path: Path; key: string; cursor: Cursor; level?: number; excel?: number };
};

export type TmpText = undefined | never; // Record<string, string[]>;

// tmpText... on top? yeah ok seems like the right spot for it.
export type Top = {
    nodes: Nodes;
    root: NodeID;
    // nextLoc?(): string;
};

export const getNode = (path: Path, top: Top) => top.nodes[path.children[path.children.length - 1]];

export type Current =
    | { type: 'id'; node: Id<NodeID>; cursor: IdCursor; start?: number; path: Path }
    | {
          type: 'text';
          node: Text<NodeID>;
          cursor: TextCursor | ListCursor;
          path: Path;
      }
    | {
          type: 'list';
          node: Collection<NodeID>;
          cursor: CollectionCursor;
          path: Path;
      };

/*

ok so actually what I want is:
- cursors[] Cursor
- highlight : SelectionHighlight

*/

export type SelectionStatuses = Record<
    string,
    {
        cursors: Cursor[];
        highlight?: Highlight;
    }
>;

export type Highlight =
    | { type: 'full' }
    | { type: 'id'; spans: { start?: number; end?: number }[] }
    | { type: 'list'; opener: boolean; closer: boolean; paired?: number }
    // TODO table??
    | { type: 'text'; spans: (boolean | { start?: number; end?: number }[])[]; opener: boolean; closer: boolean };

export const mergeHighlights = (one: Highlight | undefined, two: Highlight | undefined): Highlight | undefined => {
    if (!one) return two;
    if (!two) return one;
    if (one.type === 'full') return one;
    if (two.type === 'full') return two;
    if (one.type === 'id' && two.type === 'id') {
        return { type: 'id', spans: one.spans.concat(two.spans) };
    }
    if (one.type === 'text' && two.type === 'text') {
        return {
            type: 'text',
            opener: one.opener || two.opener,
            closer: one.closer || two.closer,
            spans: one.spans.map((s, i) =>
                s === true || two.spans[i] === true ? true : s === false ? two.spans[i] : two.spans[i] === false ? s : [...s, ...two.spans[i]],
            ),
        };
    }
    if (one.type === 'list' && two.type === 'list') {
        return { type: 'list', closer: one.closer || two.closer, opener: one.opener || two.opener, paired: one.paired ?? two.paired };
    }
    return one; // arbitrary
};

/*

TopAction = {
    type: 'update',
    nodes: Record<string, Node | null>;
    root?: number;
    nextLoc?: number;
    // the selectionChange would update the Selection to the new dealio, right?
    selectionChange?: SelectionChange;
}

{
    type: 'selection',
}

Action...

ok, so an update should ... also have like a 'selectionDiff'

hrmmmm whattttt about start/enddddd.
so, for the most part, updates... hm.
OK So SelectionUpdate is updating a Cursor.
but a cursor might jump to a different path.
OK So more concretely, it's updating a SelStart.

? is it possible for an Update action to need multiple SelectionUpdates? might be.
ooh ok so the /multicursor/ case would be like /dup + update/


Multi select:
selUpdates -
- move NodeSelection
- reparent Path -> Path
- dump (like if a bunch of nodes were deleted, you list the path keys to filter by, and all visits within get dumped on a single spot)
- if a list was unwrapped, handle before/after
-

*/

export const move = (to: NodeSelection): SelUpdate => ({ type: 'move', to });

export type SelUpdate =
    | { type: 'move'; to: NodeSelection }
    // | { type: 'reparent'; oldPath: Path; newPath: Path }
    | { type: 'unparent'; loc: NodeID } // remove from a parent list
    | { type: 'addparent'; loc: NodeID; parent: NodeID }
    // | { type: 'to-sibling'; loc: number; dest: number; at: 'start' | 'end' }
    // | { type: 'unwrapList'; path: Path; left: SelStart; right: SelStart }
    // | { type: 'delete'; paths: Path[]; dest: SelStart }
    // This assumes:
    // that for a split, the [right] side is what gets a new path. I think that's fine to
    // rely on?
    // How about for a join? Again it would be the Right side that would be subsumed.
    // Assuming that from and to are siblings. things would break otherwise
    | { type: 'id'; from: { loc: NodeID; offset: number }; to: { loc: NodeID; offset: number } };
// | { type: 'id'; from: { path: Path; offset: number }; to: { path: Path; offset: number } };

export type JustSelUpdate = Omit<Update, 'selection'> & { selection?: NodeSelection };

export type UNodes = Record<NodeID, Node | null>;

export type Update = {
    nodes: UNodes;
    root?: NodeID;
    selection?: NodeSelection | SelUpdate[];
};

export const withPartial = (path: Path, sel?: PartialSel) =>
    sel
        ? {
              start: selStart(pathWithChildren(path, ...sel.children), sel.cursor),
          }
        : undefined;

export const findTableLoc = (rows: NodeID[][], loc: NodeID) => {
    for (let row = 0; row < rows.length; row++) {
        for (let col = 0; col < rows[row].length; col++) {
            if (rows[row][col] === loc) {
                return { row, col };
            }
        }
    }
    return { row: 0, col: 0 };
};
