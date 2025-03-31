//

export type NodeID = string;

export type Loc = NodeID;

// ccls = "char class" i.e. what kind of punctuation. 0 = normal text
export type Id<Loc> = { type: 'id'; text: string; loc: Loc; ccls?: number };

export type Link = { type: 'www'; href: string } | { type: 'term'; id: string; hash?: string } | { type: 'doc'; id: string; hash?: string };

export const linksEqual = (one?: Link, two?: Link) => {
    if (!one || !two) return one === two;
    if (one.type === 'www' && two.type === 'www') return one.href === two.href;
    if (one.type === 'term' && two.type === 'term') return one.id === two.id && one.hash === two.hash;
    if (one.type === 'doc' && two.type === 'doc') return one.id === two.id && one.hash === two.hash;
    return false;
};

export type TextSpan<Embed, Loc = string> =
    | { type: 'text'; text: string; loc: Loc }
    // Jump back to a normal node I guess
    | { type: 'embed'; item: Embed; loc: Loc };
// | { type: 'attachment'; attachment: string; display: 'name' | 'small' | 'large'; loc: Loc }
// // I kinda forget what this was about? Maybe like letting you supply rich-text plugins or something
// | { type: 'custom'; plugin: string; data: any; loc: Loc }
// // How are these different from `embed`? Well these actually yoink the source
// // of the referenced term and plop it in there.
// // Embed would either be a ref to it, or duplicate the code
// | { type: 'include'; id: string; hash: string; loc: Loc }
// | { type: 'diff'; before: { id: string; hash: string }; after: { id: string; hash: string }; loc: Loc };

export type RichKind =
    | { type: 'plain' }
    | { type: 'section'; level?: number } // collapsible, and first item is treated as a header
    | { type: 'list'; ordered: boolean }
    | { type: 'checks'; checked: Record<NodeID, boolean> }
    | { type: 'opts'; which?: NodeID }
    | { type: 'indent'; quote: boolean }
    | { type: 'callout'; vibe: 'info' | 'warning' | 'error' };

export const isRich = (kind: ListKind<any> | TableKind) => typeof kind !== 'string' && kind.type !== 'tag';
export const hasControls = (kind: ListKind<any>) => typeof kind !== 'string' && (kind.type === 'opts' || kind.type === 'checks');

export type ListKind<Tag> =
    | 'round'
    | 'square'
    | 'angle'
    | 'curly'
    // these are for items juxtaposed without spaces in between
    | 'smooshed'
    // these are for binops and such. not used for lisp-mode
    | 'spaced'
    | { type: 'tag'; node: Tag; attributes?: Tag }
    | RichKind;

export type Text<Loc> = { type: 'text'; spans: TextSpan<Loc>[]; loc: Loc };
export type List<Loc> = {
    type: 'list';
    kind: Extract<ListKind<NodeID>, string>;
    // Whether the user has specified that it should be multiline.
    // If absent, multiline is calculated based on pretty-printing logic
    forceMultiline?: boolean;
    children: NodeID[];
    loc: Loc;
};
export type TableKind = 'round' | 'square' | 'curly' | { type: 'rich'; colWidths?: Record<number, number> };
export type Collection<Loc> = List<Loc> | Table<Loc>;
export type Table<Loc> = {
    type: 'table';
    kind: TableKind;
    forceMultiline?: boolean;
    rows: NodeID[][];
    loc: Loc;
};

export type NodeT<Loc> = Id<Loc> | Text<Loc> | Collection<Loc>;
export type Node = NodeT<NodeID>;

export type RecList<Loc> = {
    type: 'list';
    kind: Extract<ListKind<RecNodeT<Loc>>, string>;
    // Whether the user has specified that it should be multiline.
    // If absent, multiline is calculated based on pretty-printing logic
    forceMultiline?: boolean;
    children: RecNodeT<Loc>[];
    loc: Loc;
};

export type RecText<Loc> = {
    type: 'text';
    spans: TextSpan<RecNodeT<Loc>, Loc>[];
    loc: Loc;
};

export type RecCollection<Loc> =
    | RecList<Loc>
    | {
          type: 'table';
          kind: TableKind;
          rows: RecNodeT<Loc>[][];
          forceMultiline?: boolean;
          loc: Loc;
      };

export type RecNodeT<Loc> = Id<Loc> | RecText<Loc> | RecCollection<Loc>;
export type RecNode = RecNodeT<Loc>;
export type Nodes = Record<NodeID, Node>;

export const equal = <One, Two>(one: RecNodeT<One>, two: RecNodeT<Two>, loc: (one: One, two: Two) => boolean): boolean => {
    if (one.type === 'id') {
        if (two.type !== 'id') return false;
        return one.text === two.text && loc(one.loc, two.loc);
    }
    if (one.type === 'list') {
        if (two.type !== 'list') return false;
        return (
            one.kind === two.kind &&
            one.forceMultiline === two.forceMultiline &&
            one.children.length === two.children.length &&
            one.children.every((one, i) => equal(one, two.children[i], loc))
        );
    }
    if (one.type === 'text') {
        // STOPSHIP
        return false;
    }
    return (
        two.type === 'table' &&
        one.kind === two.kind &&
        one.rows.length === two.rows.length &&
        one.rows.every((row, r) => row.length === two.rows[r].length && row.every((cell, c) => equal(cell, two.rows[r][c], loc)))
    );
};

export const childNodes = <Loc>(node: RecNodeT<Loc>): RecNodeT<Loc>[] => {
    switch (node.type) {
        case 'id':
            return [];
        case 'list':
            return node.children;
        case 'table':
            return node.rows.flat();
        case 'text':
            return node.spans.map((s) => (s.type === 'embed' ? s.item : undefined)).filter((x) => x != null) as RecNodeT<Loc>[];
    }
};

export const childLocs = (node: Node): NodeID[] => {
    switch (node.type) {
        case 'id':
            return [];
        case 'list':
            return node.children;
        case 'table':
            return node.rows.flat();
        case 'text':
            return node.spans.map((s) => (s.type === 'embed' ? s.item : undefined)).filter((x) => x != null) as NodeID[];
    }
};

export const fromMap = <Loc>(id: NodeID, nodes: Nodes, toLoc: (l: NodeID) => Loc): RecNodeT<Loc> => {
    const node = nodes[id];
    if (!node) {
        throw new Error(`id "${id}" not found in nodes map`);
    }
    const loc = toLoc(node.loc);
    switch (node.type) {
        case 'id':
            return { ...node, loc };
        case 'text':
            return {
                ...node,
                loc,
                spans: node.spans.map((span) =>
                    span.type === 'embed'
                        ? { ...span, item: fromMap(span.item, nodes, toLoc), loc: toLoc(span.loc) }
                        : { ...span, loc: toLoc(span.loc) },
                ),
            };
        case 'list':
            return {
                ...node,
                loc,
                kind: node.kind,
                // typeof node.kind !== 'string' && node.kind.type === 'tag'
                //     ? {
                //           ...node.kind,
                //           node: fromMap(node.kind.node, nodes, toLoc),
                //           attributes: node.kind.attributes != null ? fromMap(node.kind.attributes, nodes, toLoc) : undefined,
                //       }
                //     : node.kind,
                children: node.children.map((id) => fromMap(id, nodes, toLoc)),
            };
        case 'table':
            return {
                ...node,
                loc,
                rows: node.rows.map((row) => row.map((id) => fromMap(id, nodes, toLoc))),
            };
    }
};

export const fromRec = <Loc>(node: RecNodeT<Loc>, map: Nodes, get: (l: Loc, node: null, path: NodeID[]) => NodeID, path: NodeID[] = []): NodeID => {
    const loc = get(node.loc, null, path);
    const inner = path.concat([loc]);
    switch (node.type) {
        case 'id':
            map[loc] = { ...node, loc };
            return loc;
        case 'text':
            map[loc] = {
                ...node,
                loc,
                spans: node.spans.map((span) =>
                    span.type === 'embed'
                        ? { ...span, item: fromRec(span.item, map, get, inner), loc: get(span.loc, null, inner) }
                        : { ...span, loc: get(span.loc, null, inner) },
                ),
            };
            return loc;
        case 'list':
            map[loc] = {
                ...node,
                loc,
                kind: node.kind,
                // typeof node.kind !== 'string' && node.kind.type === 'tag'
                //     ? {
                //           ...node.kind,
                //           node: fromRec(node.kind.node, map, get, inner),
                //           attributes: node.kind.attributes != null ? fromRec(node.kind.attributes, map, get, inner) : undefined,
                //       }
                //     : node.kind,
                children: node.children.map((id) => fromRec(id, map, get, inner)),
            };
            return loc;
        case 'table':
            map[loc] = {
                ...node,
                loc,
                rows: node.rows.map((row) => row.map((id) => fromRec(id, map, get, inner))),
            };
            return loc;
    }
};

export const mapLocs = <From, To>(node: RecNodeT<From>, get: (l: From, path: To[]) => To, path: To[] = []): RecNodeT<To> => {
    const loc = get(node.loc, path);
    const inner = path.concat([loc]);
    switch (node.type) {
        case 'id':
            return { ...node, loc };
        case 'text': {
            const spans = node.spans.map((span) => {
                const loc = get(span.loc, inner);
                if (span.type === 'embed') {
                    return { ...span, item: mapLocs(span.item, get, inner), loc };
                }
                return { ...span, loc };
            });
            return { ...node, loc, spans };
        }
        case 'list':
            return {
                ...node,
                loc,
                kind: node.kind,
                // typeof node.kind !== 'string' && node.kind.type === 'tag'
                //     ? {
                //           ...node.kind,
                //           node: mapLocs(node.kind.node, get, inner),
                //           attributes: node.kind.attributes != null ? mapLocs(node.kind.attributes, get, inner) : undefined,
                //       }
                //     : node.kind,
                children: node.children.map((id) => mapLocs(id, get, inner)),
            };
        case 'table':
            return {
                ...node,
                loc,
                rows: node.rows.map((row) => row.map((id) => mapLocs(id, get, inner))),
            };
    }
};

export const shape = (node: RecNodeT<unknown>): string => {
    switch (node.type) {
        case 'id':
            return `id(${node.text}${node.ccls != null ? '/' + node.ccls : ''})`;
        case 'list':
            const ml = node.forceMultiline ? '/ML' : '';
            if (node.kind === 'round') {
                return `(${node.children.map(shape).join(' ')}${ml})`;
            }
            if (node.kind === 'square') {
                return `[${node.children.map(shape).join(' ')}${ml}]`;
            }
            if (typeof node.kind === 'string') {
                return `list[${node.kind}](${node.children.map(shape).join(' ')}${ml})`;
            }
        // if (node.kind.type === 'tag') {
        //     return `xml[${shape(node.kind.node)}${node.kind.attributes ? ' ' + shape(node.kind.attributes) : ''}](${node.children
        //         .map(shape)
        //         .join(' ')}${ml})`;
        // }
        // return `list[${node.kind.type}](${node.children.map(shape).join(' ')}${ml})`;
        case 'table':
            const mi = node.rows.map((row) => row.map(shape).join(',')).join(';');
            if (node.kind === 'curly') {
                return `{:${mi}:}`;
            }
            if (node.kind === 'round') {
                return `(:${mi}:)`;
            }
            return `[:${mi}:]`;
        case 'text':
            return `text(${node.spans
                .map((span) => {
                    switch (span.type) {
                        case 'text':
                            return span.text;
                        case 'embed':
                            return `\${${shape(span.item)}}`;
                        // default:
                        //     throw new Error('not shaping a ' + span.type);
                    }
                })
                .join('|')})`;
    }
};
