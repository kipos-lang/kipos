import equal from 'fast-deep-equal';
import { isTag } from '../keyboard/handleNav';
import { ListKind, Loc, NodeID, RecNode, TableKind, TextSpan } from '../shared/cnodes';
import { genId } from '../keyboard/ui/genId';

export type MatchParent = {
    type: 'match_parent';
    nodes: RecNode[];
    loc: Loc;
    sub?: { type: 'text'; index: number } | { type: 'table'; row: number } | { type: 'xml'; which: 'tag' | 'attributes' };
};

export type Src = { type: 'src'; left: Loc; right?: Loc; id: string };

type AutoComplete = string;

export type TraceText = string | { type: 'rule'; rule: Rule<any> } | TraceText[] | { type: 'node'; node: RecNode };

export type Event =
    | { type: 'stack-push'; text: TraceText; loc?: Loc }
    | { type: 'stack-pop' }
    | { type: 'match'; loc: Loc; message: TraceText }
    | { type: 'extra'; loc: Loc }
    | { type: 'mismatch'; loc?: Loc; message: TraceText };

export class MismatchError extends Error {
    text: TraceText;
    loc?: Loc;
    constructor(text: TraceText, loc?: Loc) {
        super('');
        this.text = text;
        this.loc = loc;
    }
}

export type Ctx = {
    allowIdKwds?: boolean;
    ref<T>(name: string): T;
    scopes: { name: string; kind: string; loc: string }[][];
    usages: {
        [src: string]: { name: string; kind: string; usages: string[] };
    };
    externalUsages: { name: string; kind: string; loc: string }[];
    rules: Record<string, Rule<any>>;
    trace?: (evt: Event) => undefined;
    scope?: null | Record<string, any>;
    kwds: string[];
    meta: Record<NodeID, { kind?: string; placeholder?: string }>;
    autocomplete?: {
        loc: NodeID;
        concrete: AutoComplete[];
        kinds: (string | null)[];
    };
};

export type Rule<T> =
    | { type: 'or'; opts: Rule<T>[] }
    | { type: 'tx'; inner: Rule<any>; f: (ctx: Ctx, src: Src & { id: string }) => T }
    | { type: 'meta'; meta: string; inner: Rule<T> }
    | { type: 'kwd'; kwd: string; meta?: string }
    | { type: 'ref'; name: string; bind?: string }
    | { type: 'seq'; rules: Rule<any>[] }
    | { type: 'group'; name: string; inner: Rule<T> }
    | { type: 'star'; inner: Rule<unknown> }
    | { type: 'opt'; inner: Rule<unknown> }
    | { type: 'loc'; name: string; inner: Rule<unknown> }
    | { type: 'any' }
    | { type: 'none' }
    // usage tracking : TODO: support "unordered" scope, and maybe nonrecursive
    | { type: 'scope'; inner: Rule<T> }
    | { type: 'declaration'; kind: string }
    | { type: 'reference'; kind: string }
    //
    | { type: 'id'; kind?: string | null }
    | { type: 'number'; just?: 'int' | 'float' }
    | { type: 'text'; embed: Rule<unknown> }
    | { type: 'list'; kind: ListKind<Rule<unknown>>; item: Rule<unknown> }
    | { type: 'table'; kind: TableKind; row: Rule<unknown> };

const show = (rule: Rule<unknown>): string => {
    switch (rule.type) {
        case 'scope':
            return `scope(${show(rule.inner)})`;
        case 'reference':
            return `reference(${rule.kind})`;
        case 'declaration':
            return `declaration(${rule.kind})`;
        case 'kwd':
            return rule.kwd;
        case 'ref':
            return '$' + rule.name;
        case 'meta':
            return `meta(${show(rule.inner)},${rule.meta})`;
        case 'seq':
            return `seq(${rule.rules.map(show).join(' ')})`;
        case 'star':
            return `${show(rule.inner)}*`;
        case 'loc':
            return `loc(${show(rule.inner)})`;
        case 'opt':
            return `${show(rule.inner)}?`;
        case 'id':
            return `id`;
        case 'text':
            return `text(${show(rule.embed)})`;
        case 'list':
            return `list[${isTag(rule.kind) ? show(rule.kind.node) : typeof rule.kind === 'string' ? rule.kind : JSON.stringify(rule.kind)}](${show(
                rule.item,
            )})`;
        case 'table':
            return `table[${rule.kind}](${show(rule.row)})`;
        case 'or':
            return `(${rule.opts.map(show).join('|')})`;
        case 'tx':
            return show(rule.inner);
        case 'group':
            return show(rule.inner);
        case 'none':
            return '<none>';
        case 'any':
            return '<any>';
        case 'number':
            return `<number>`;
    }
};

let indent = 0;

type Result<T> = { value?: T; consumed: number };

export const match = <T>(rule: Rule<T>, ctx: Ctx, parent: MatchParent, at: number): undefined | null | Result<T> => {
    if (ctx.rules.comment) {
        const { comment, ...without } = ctx.rules;
        ctx.trace?.({ type: 'stack-push', loc: parent.nodes[at]?.loc, text: ['> comment'] });
        const cm = match_(ctx.rules.comment, { ...ctx, rules: without }, parent, at);
        if (cm) {
            for (let i = 0; i < cm.consumed; i++) {
                const node = parent.nodes[at + i];
                ctx.meta[node.loc] = { kind: 'comment' };
            }
            at += cm.consumed;
        }
        ctx.trace?.({ type: 'stack-pop' });
    }
    ctx.trace?.({
        type: 'stack-push',
        loc: parent.nodes[at]?.loc,
        text: ['> ' + ctx.scopes.length, ' ', { type: 'rule', rule }],
    });
    // console.log(`> `.padStart(2 + indent), show(rule));
    // indent++;
    const res = match_(rule, ctx, parent, at);
    // indent--;
    // console.log(`${res ? '<' : 'x'} `.padStart(2 + indent), show(rule));
    ctx.trace?.({ type: 'stack-pop' });
    return res;
};

// TODO: track a pathhhh
export const match_ = (rule: Rule<any>, ctx: Ctx, parent: MatchParent, at: number): undefined | null | Result<any> => {
    const node = parent.nodes[at] as RecNode | null;
    switch (rule.type) {
        case 'kwd':
            if (node?.type !== 'id' || node.text !== rule.kwd)
                return ctx.trace?.({
                    type: 'mismatch',
                    message: 'not the kwd "' + rule.kwd + '" - ' + (node?.type === 'id' ? node.text : `type: ${node?.type}`),
                });
            ctx.meta[node.loc] = { kind: rule.meta ?? 'kwd' };
            ctx.trace?.({ type: 'match', loc: node.loc, message: 'is a kwd: ' + node.text });
            return { value: node, consumed: 1 };
        case 'reference': {
            if (node?.type !== 'id' || (!ctx.allowIdKwds && ctx.kwds.includes(node.text)))
                return ctx.trace?.({ type: 'mismatch', message: 'not id or is kwd' });
            ctx.trace?.({ type: 'match', loc: node.loc, message: 'is an id: ' + node.text });
            let src = undefined;
            for (let i = ctx.scopes.length - 1; i >= 0; i--) {
                const got = ctx.scopes[i].findLast((d) => d.name === node.text && d.kind === rule.kind);
                if (got) {
                    src = got.loc;
                    break;
                }
            }

            if (src) {
                ctx.usages[src].usages.push(node.loc);
            } else {
                ctx.externalUsages.push({ name: node.text, kind: rule.kind, loc: node.loc });
            }
            return { value: node, consumed: 1 };
        }
        case 'declaration': {
            if (node?.type !== 'id' || (!ctx.allowIdKwds && ctx.kwds.includes(node.text)))
                return ctx.trace?.({ type: 'mismatch', message: 'not id or is kwd' });
            ctx.trace?.({ type: 'match', loc: node.loc, message: 'is an id: ' + node.text });
            if (!ctx.scopes.length) throw new Error(`declaration but no scopes`);
            ctx.scopes[ctx.scopes.length - 1].push({ kind: rule.kind, loc: node.loc, name: node.text });
            ctx.usages[node.loc] = { name: node.text, kind: rule.kind, usages: [] };
            return { value: node, consumed: 1 };
        }
        case 'id':
            if (node?.type !== 'id' || (!ctx.allowIdKwds && ctx.kwds.includes(node.text)))
                return ctx.trace?.({ type: 'mismatch', message: 'not id or is kwd' });
            ctx.trace?.({ type: 'match', loc: node.loc, message: 'is an id: ' + node.text });
            return { value: node, consumed: 1 };
        case 'number': {
            if (node?.type !== 'id' || !node.text) return ctx.trace?.({ type: 'mismatch', message: 'not id' });
            if (rule.just === 'float' && !node.text.includes('.')) return ctx.trace?.({ type: 'mismatch', message: 'not float: ' + node.text });
            const num = Number(node.text);
            if (!Number.isFinite(num)) return ctx.trace?.({ type: 'mismatch', message: 'NaN: ' + node.text });
            if (rule.just === 'int' && !Number.isInteger(num)) return ctx.trace?.({ type: 'mismatch', message: 'not int: ' + node.text });
            ctx.meta[node.loc] = { kind: 'number' };
            ctx.trace?.({ type: 'match', loc: node.loc, message: 'is a number: ' + node.text });
            return { value: num, consumed: 1 };
        }
        case 'text':
            if (node?.type !== 'text') return;
            const spans: TextSpan<any, any>[] = [];
            for (let i = 0; i < node.spans.length; i++) {
                const span = node.spans[i];
                if (span.type === 'embed') {
                    const m = match(rule.embed, ctx, { type: 'match_parent', nodes: [span.item], loc: node.loc, sub: { type: 'text', index: i } }, 0);
                    if (!m) return; // recovery
                    spans.push({ ...span, item: m.value });
                } else {
                    spans.push(span);
                }
            }
            ctx.trace?.({ type: 'match', loc: node.loc, message: 'is a text' });
            return { value: spans, consumed: 1 };

        case 'table': {
            if (node?.type !== 'table') return;
            const res: any[] = [];
            for (let i = 0; i < node.rows.length; i++) {
                ctx.trace?.({ type: 'stack-pop' });
                ctx.trace?.({ type: 'stack-push', text: ['table(', node.rows.map((_, j) => (j === i ? '*' : '_')), ')'] });

                const m = match(
                    rule.row,
                    { ...ctx, scope: null },
                    { type: 'match_parent', nodes: node.rows[i], loc: node.loc, sub: { type: 'table', row: i } },
                    0,
                );
                if (m) {
                    res.push(m.value);
                } else {
                    node.rows[i].forEach((node) => {
                        ctx.meta[node.loc] = { kind: 'unparsed' };
                    });
                }
            }
            ctx.trace?.({ type: 'match', loc: node.loc, message: 'is a table' });
            return { value: res, consumed: 1 };
        }

        case 'list': {
            if (node?.type !== 'list') return;
            if (isTag(node.kind)) {
                if (!isTag(rule.kind)) return;
                const tag = match(
                    rule.kind.node,
                    ctx,
                    { type: 'match_parent', nodes: [node.kind.node], loc: node.loc, sub: { type: 'xml', which: 'tag' } },
                    0,
                );
                if (!tag) return; // TODO recovery?
                if (rule.kind.attributes) {
                    const attributes = match(
                        rule.kind.attributes,
                        ctx,
                        {
                            type: 'match_parent',
                            nodes: node.kind.attributes ? [node.kind.attributes] : [],
                            loc: node.loc,
                            sub: { type: 'xml', which: 'attributes' },
                        },
                        0,
                    );
                    // console.log('rule kind', attributes, node.kind.attributes);
                    if (!attributes) return; // TODO recovery?
                } else if (node.kind.attributes) {
                    // attributes not matched? make an 'extra' error
                    return;
                }
            } else if (!equal(node.kind, rule.kind)) {
                return;
            }

            const res = match(rule.item, ctx, { type: 'match_parent', nodes: node.children, loc: node.loc }, 0);
            if (res && res.consumed < node.children.length) {
                for (let i = res.consumed; i < node.children.length; i++) {
                    const child = node.children[i];
                    ctx.meta[child.loc] = { kind: 'unparsed' };
                }
            }
            return res ? { value: res.value, consumed: 1 } : res;
        }

        case 'opt': {
            if (!node) return { consumed: 0 };
            const inner = match(rule.inner, ctx, parent, at);
            // console.log('matching opt', inner, rule.inner);
            if (!inner) return { consumed: 0 };
            return inner;
        }

        case 'loc': {
            if (!node) return;
            const inner = match(rule.inner, ctx, parent, at);
            if (inner) {
                if (!ctx.scope) throw new Error(`not in a scoped context, cant save 'loc' as ${rule.name}`);
                ctx.scope[rule.name] = node.loc;
            }
            return inner;
        }

        case 'none':
            return;

        case 'any':
            if (!node) return;
            return { consumed: 1, value: node };

        case 'scope': {
            const inner = match(
                rule.inner,
                {
                    ...ctx,
                    scopes: ctx.scopes.concat([[]]),
                },
                parent,
                at,
            );
            return inner;
        }
        case 'meta': {
            if (!node) return;
            const inner = match(rule.inner, ctx, parent, at);
            if (inner) ctx.meta[node.loc] = { kind: rule.meta };
            return inner;
        }
        case 'ref': {
            // console.log('ref', rule.name);
            if (!ctx.rules[rule.name]) throw new Error(`no rule named '${rule.name}'`);
            const inner = match(ctx.rules[rule.name], { ...ctx, scope: null }, parent, at);
            if (!inner) return;
            if (rule.bind) {
                if (!ctx.scope) throw new Error(`not in a scoped context, cant bind ${rule.bind} for ${rule.name}`);
                ctx.scope[rule.bind] = inner.value;
                return { consumed: inner.consumed };
            }
            return inner;
        }
        case 'seq': {
            const start = at;
            let i = 0;
            for (let item of rule.rules) {
                ctx.trace?.({ type: 'stack-pop' });
                ctx.trace?.({ type: 'stack-push', text: ['seq(', rule.rules.map((_, j) => (j === i ? '*' : '_')), ')'] });
                const m = match(item, ctx, parent, at);
                if (!m) return; // err? err. errrr
                at += m.consumed;
                i++;
            }
            return { consumed: at - start };
        }
        case 'star': {
            const start = at;
            const values: any[] = [];
            while (at < parent.nodes.length) {
                ctx.trace?.({ type: 'stack-pop' });
                ctx.trace?.({ type: 'stack-push', text: ['star(', values.length + '', ')'] });
                if (isBlank(parent.nodes[at])) {
                    at++;
                    continue;
                }
                const m = match(rule.inner, ctx, parent, at);
                if (!m) break;
                values.push(m.value);
                at += m.consumed;
            }
            ctx.trace?.({ type: 'stack-pop' });
            ctx.trace?.({ type: 'stack-push', text: ['star(', values.length + '', ') - finished'] });
            return { consumed: at - start, value: values };
        }
        case 'or': {
            let i = 0;
            for (let opt of rule.opts) {
                ctx.trace?.({ type: 'stack-pop' });
                ctx.trace?.({ type: 'stack-push', text: ['or(', rule.opts.map((_, j) => (j === i ? '*' : '_')), ')'] });
                const m = match(opt, ctx, parent, at);
                if (m) return m;
                i++;
            }
            return; // TODO errsss
        }
        case 'tx': {
            const ictx: Ctx = { ...ctx, scope: {} };
            const left = at < parent.nodes.length ? parent.nodes[at].loc : '';
            const m = match(rule.inner, ictx, parent, at);
            if (!m) return;
            const rat = at + m.consumed - 1;
            if (rat >= parent.nodes.length) throw new Error(`consume doo much ${at} ${rat} ${parent.nodes.length} ${m.consumed}`);
            // if (rat >= parent.nodes.length) console.error(`consume doo much ${at} ${rat} ${parent.nodes.length} ${m.consumed}`);
            const right = m.consumed > 1 && rat < parent.nodes.length ? parent.nodes[at + m.consumed - 1].loc : undefined;
            try {
                return { value: rule.f(ictx, { type: 'src', left, right, id: genId() }), consumed: m.consumed };
            } catch (err) {
                if (err instanceof MismatchError) {
                    ctx.trace?.({ type: 'mismatch', message: err.message, loc: err.loc });
                    if (err.loc != null) {
                        ctx.meta[err.loc] = { kind: 'error' };
                    }
                    return null;
                }
                console.error(`failed to run tx`);
                return;
            }
        }
        case 'group': {
            if (!ctx.scope) throw new Error(`group ${rule.name} out of scope, must be within a tx()`);
            const m = match(rule.inner, { ...ctx, scope: null }, parent, at);
            if (!m) return;
            ctx.scope[rule.name] = m.value;
            return { consumed: m.consumed };
        }
    }
};

const isBlank = (node: RecNode) => node.type === 'id' && node.text === '';

// const isSingle = (rule: Rule<any>, ctx: Ctx): boolean => {
//     switch (rule.type) {
//         case 'kwd':
//         case 'any':
//             return true;
//         case 'ref':
//             return isSingle(ctx.rules[rule.name], ctx);
//         case 'seq':
//             return rule.rules.length === 1 && isSingle(rule.rules[0], ctx);
//         case 'star':
//             return false;
//         case 'id':
//             return true;
//         case 'text':
//             return true;
//         case 'list':
//             return true;
//         case 'opt':
//             return false;
//         case 'or':
//             return rule.opts.every((opt) => isSingle(opt, ctx));
//         case 'tx':
//             return isSingle(rule.inner, ctx);
//         case 'group':
//             return isSingle(rule.inner, ctx);
//     }
// };

// regex stuff
export const or = <T>(...opts: Rule<T>[]): Rule<T> => ({ type: 'or', opts });
export const tx = <T>(inner: Rule<any>, f: (ctx: Ctx, src: Src & { id: string }) => T): Rule<T> => ({ type: 'tx', inner, f });
export const ref = <T>(name: string, bind?: string): Rule<T> => ({ type: 'ref', name, bind });
export const opt = <T>(inner: Rule<T>): Rule<T | null> => ({ type: 'opt', inner });
export const loc = <T>(name: string, inner: Rule<T>): Rule<T> => ({ type: 'loc', name, inner });
export const seq = (...rules: Rule<any>[]): Rule<unknown> => ({ type: 'seq', rules });
export const group = <T>(name: string, inner: Rule<T>): Rule<T> => ({ type: 'group', name, inner });
export const star = <T>(inner: Rule<T>): Rule<T[]> => ({ type: 'star', inner });
export const text = <T>(embed: Rule<T>): Rule<TextSpan<T>[]> => ({ type: 'text', embed });

// standard intermediate representation
// intermediate general representation
// - Id
// - Text
// - List
// - Table
export const kwd = (kwd: string, meta?: string): Rule<unknown> => ({ type: 'kwd', kwd, meta });
export const meta = (inner: Rule<unknown>, meta: string): Rule<unknown> => ({ type: 'meta', meta, inner });
export const id = (kind?: string | null): Rule<unknown> => ({ type: 'id', kind });
const int: Rule<number> = { type: 'number', just: 'int' };
const float: Rule<number> = { type: 'number', just: 'float' };
export const number: Rule<number> = { type: 'number' };
export const list = <T>(kind: ListKind<Rule<unknown>>, item: Rule<T>): Rule<T> => ({ type: 'list', kind, item });
export const table = <T>(kind: TableKind, row: Rule<T>): Rule<T> => ({ type: 'table', kind, row });

export const scope = (inner: Rule<unknown>): Rule<unknown> => ({ type: 'scope', inner });
export const declaration = (kind: string): Rule<unknown> => ({ type: 'declaration', kind });
export const reference = (kind: string): Rule<unknown> => ({ type: 'reference', kind });

/*

OK so I think what I want
is a parsing traceback

like
"here's the path to get here"
- both from the CST side
- and from the ... parse ... tree ... side?
andd we can introspect at each point, to
see why a given rule wasn't taken.
yeah.

that would be super cool

*/
