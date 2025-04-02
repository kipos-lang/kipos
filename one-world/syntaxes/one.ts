// import { js, TestParser } from '../keyboard/test-utils';
import { Id, Loc, NodeID, RecNode, TextSpan } from '../shared/cnodes';
import { Ctx, list, match, or, Rule, ref, tx, seq, kwd, group, id, star, Src, number, text, table, opt, meta, Event } from './dsl3';
// import { binops, Block, Expr, kwds, Stmt } from './js--types';
import { Config } from './lexer';
import {
    binops,
    Expr,
    kwds,
    mergeSrc,
    nodesSrc,
    partition,
    Pat,
    RecordRow,
    Right,
    SExpr,
    SPat,
    Stmt,
    stmtSpans,
    Suffix,
    suffixops,
    Type,
    unops,
} from './ts-types';

const types: Record<string, Rule<Type>> = {
    'type ref': tx(group('id', id(null)), (ctx, src) => ({ type: 'ref', name: ctx.ref<Id<Loc>>('id').text, src })),
};

const parseSmoosh = (base: Expr, suffixes: Suffix[], prefixes: Id<Loc>[], src: Src): Expr => {
    if (!suffixes.length && !prefixes.length) return base;
    suffixes.forEach((suffix) => {
        switch (suffix.type) {
            case 'attribute':
                base = { type: 'attribute', target: base, attribute: suffix.attribute, src: mergeSrc(base.src, nodesSrc(suffix.attribute)) };
                return;
            case 'call':
                base = { type: 'call', target: base, args: suffix.items, src: mergeSrc(base.src, suffix.src) };
                return;
            case 'index':
                base = { type: 'index', target: base, items: suffix.items, src: mergeSrc(base.src, suffix.src) };
                return;
            case 'suffix':
                base = { type: 'uop', op: suffix.op, src: mergeSrc(base.src, suffix.src), target: base };
                return;
        }
    });
    for (let i = prefixes.length - 1; i >= 0; i--) {
        base = { type: 'uop', op: prefixes[i], target: base, src: mergeSrc(nodesSrc(prefixes[i]), base.src) };
    }
    return { ...base, src };
};

const exprs: Record<string, Rule<Expr>> = {
    'expr num': tx(group('value', number), (ctx, src) => ({ type: 'number', value: ctx.ref<number>('value'), src })),
    'expr var': tx(group('id', id(null)), (ctx, src) => ({ type: 'var', name: ctx.ref<Id<Loc>>('id').text, src })),
    'expr text': tx(group('spans', text(ref('expr'))), (ctx, src) => ({ type: 'text', spans: ctx.ref<TextSpan<Expr>[]>('spans'), src })),
    'expr table': tx(
        group(
            'rows',
            table(
                'curly',
                or(
                    tx(seq(group('key', id(null)), ref('expr', 'value')), (ctx, src) => ({
                        type: 'row',
                        name: ctx.ref<Id<Loc>>('key').text,
                        src,
                        value: ctx.ref<Expr>('value'),
                    })),
                    list('smooshed', seq(kwd('...'), ref('expr', 'value'))),
                    tx(group('single', id(null)), (ctx, src) => {
                        const key = ctx.ref<Id<Loc>>('single');
                        return { type: 'row', name: key.text, src, nsrc: src, value: { type: 'var', name: key.text, src: nodesSrc(key) } };
                    }),
                ),
            ),
        ),
        (ctx, src) => ({ type: 'record', rows: ctx.ref<RecordRow[]>('rows'), src }),
    ),
    'expr!': list('smooshed', ref('expr..')),
    'expr jsx': tx(
        list(
            {
                type: 'tag',
                node: ref('expr', 'tag'),
                attributes: opt(ref('expr', 'attributes')),
            },
            group('items', star(ref('expr'))),
        ),
        (ctx, src) => {
            const attrs = ctx.ref<Expr | null>('attributes');
            return {
                type: 'jsx',
                src,
                attributes: attrs?.type === 'record' ? attrs.rows : undefined,
                children: ctx.ref<Expr[]>('items'),
                tag: ctx.ref<Expr>('tag'),
            };
        },
    ),
};

const pats: Record<string, Rule<Pat>> = {
    'pattern var': tx(group('id', id(null)), (ctx, src) => ({ type: 'var', name: ctx.ref<Id<Loc>>('id').text, src })),
    'pattern array': tx(list('square', group('items', star(ref('pat*')))), (ctx, src) => ({ type: 'array', src, values: ctx.ref<SPat[]>('items') })),
    'pattern default': tx(list('spaced', seq(ref('pat', 'inner'), kwd('=', 'punct'), ref('expr ', 'value'))), (ctx, src) => ({
        type: 'default',
        inner: ctx.ref<Pat>('inner'),
        value: ctx.ref<Expr>('value'),
        src,
    })),
    'pattern typed': tx(list('smooshed', seq(ref('pat', 'inner'), kwd(':', 'punct'), ref('type', 'annotation'))), (ctx, src) => ({
        type: 'typed',
        inner: ctx.ref<Pat>('inner'),
        ann: ctx.ref<Type>('annotation'),
        src,
    })),
    'pattern constructor': tx(
        list('smooshed', seq(group('constr', id('constructor')), list('round', group('args', star(ref('pat*')))))),
        (ctx, src) => ({ type: 'constr', constr: ctx.ref<Id<Loc>>('constr'), args: ctx.ref<Pat[]>('args'), src }),
    ),
    'pattern text': tx(group('spans', text(ref<Pat>('pat'))), (ctx, src) => ({ type: 'text', spans: ctx.ref<TextSpan<Pat>[]>('spans'), src })),
};

const stmts: Record<string, Rule<Stmt>> = {
    for: tx(
        seq(kwd('for'), list('round', seq(ref('stmt', 'init'), ref('expr', 'cond'), ref('expr', 'update'))), ref('block', 'body')),
        (ctx, src) => ({
            type: 'for',
            init: ctx.ref<Stmt>('init'),
            cond: ctx.ref<Expr>('cond'),
            update: ctx.ref<Expr>('update'),
            body: ctx.ref<Stmt[]>('body'),
            src,
        }),
    ),
    return: tx(seq(kwd('return'), ref('expr ', 'value')), (ctx, src) => ({ type: 'return', value: ctx.ref<Expr>('value'), src })),
    throw: tx(seq(kwd('throw'), ref('expr ', 'target')), (ctx, src) => ({ type: 'throw', target: ctx.ref<Expr>('target'), src })),
    let: tx(seq(kwd('let'), ref('pat', 'pat'), kwd('=', 'punct'), ref('expr ', 'value')), (ctx, src) => ({
        type: 'let',
        pat: ctx.ref<Pat>('pat'),
        value: ctx.ref<Expr>('value'),
        src,
    })),
};

const stmtSpaced = or(...Object.keys(stmts).map((name) => ref(name)));

export const rules = {
    id: id(null),
    stmt: or(
        list('spaced', stmtSpaced),
        tx<Stmt>(ref('expr', 'expr'), (ctx, src) => ({ type: 'expr', expr: ctx.ref<Expr>('expr'), src })),
    ),
    comment: list('smooshed', seq(kwd('//', 'comment'), { type: 'any' })),
    block: list('curly', star(ref('stmt'))),
    ...stmts,
    '...expr': or(
        tx<SExpr>(seq(kwd('...'), ref('expr..', 'inner')), (ctx, src) => ({ type: 'spread', inner: ctx.ref<Expr>('inner'), src })),
        ref('expr'),
    ),
    'expr..': tx<Expr>(
        seq(
            group('prefixes', star(or(...unops.map((k) => kwd(k, 'uop'))))),
            ref('expr', 'base'),
            group(
                'suffixes',
                star(
                    or<Suffix>(
                        tx(seq(kwd('.'), group('attribute', id('attribute'))), (ctx, src) => ({
                            type: 'attribute',
                            attribute: ctx.ref<Id<Loc>>('attribute'),
                            src,
                        })),
                        tx(list('square', group('items', star(ref('...expr')))), (ctx, src) => ({
                            type: 'index',
                            items: ctx.ref<SExpr[]>('items'),
                            src,
                        })),
                        tx(list('round', group('items', star(ref('...expr')))), (ctx, src) => ({
                            type: 'call',
                            items: ctx.ref<SExpr[]>('items'),
                            src,
                        })),
                        tx(group('op', or(...suffixops.map((s) => kwd(s, 'uop')))), (ctx, src) => ({
                            type: 'suffix',
                            op: ctx.ref<Id<Loc>>('op'),
                            src,
                        })),
                    ),
                ),
            ),
        ),
        (ctx, src) => parseSmoosh(ctx.ref<Expr>('base'), ctx.ref<Suffix[]>('suffixes'), ctx.ref<Id<Loc>[]>('prefixes'), src),
    ),
    'pattern spread': tx(list('smooshed', seq(kwd('...'), ref('pat', 'inner'))), (ctx, src) => ({ type: 'spread', inner: ctx.ref<Pat>('inner') })),
    expr: or(...Object.keys(exprs).map((name) => ref(name)), list('spaced', ref('expr '))),
    'expr ': tx<Expr>(
        seq(
            ref('fancy', 'left'),
            group(
                'rights',
                star(tx(seq(ref('bop', 'op'), ref('fancy', 'right')), (ctx, src) => ({ op: ctx.ref<Id<Loc>>('op'), right: ctx.ref<Expr>('right') }))),
            ),
        ),
        (ctx, src) => {
            const rights = ctx.ref<Right[]>('rights');
            const left = ctx.ref<Expr>('left');
            return rights.length ? { ...partition(left, rights), src } : left;
        },
    ),
    fancy: or<Expr>(
        tx(seq(list('round', group('args', star(ref('pat')))), kwd('=>', 'punct'), group('body', or(ref('expr'), ref('block')))), (ctx, src) => ({
            type: 'fn',
            args: ctx.ref<Pat[]>('args'),
            src,
            body: ctx.ref<Expr | Stmt[]>('body'),
        })),
        tx(seq(kwd('if'), ref('expr', 'cond'), ref('block', 'yes'), kwd('else'), ref('block', 'no')), (ctx, src) => ({
            type: 'if',
            cond: ctx.ref<Expr>('cond'),
            yes: ctx.ref<Stmt[]>('yes'),
            no: ctx.ref<Stmt[]>('no'),
            src,
        })),
        tx(
            seq(
                kwd('case'),
                ref('expr', 'target'),
                group(
                    'cases',
                    table(
                        'curly',
                        tx(seq(ref('pat', 'pat'), ref('block', 'body')), (ctx, src) => ({
                            pat: ctx.ref<Pat>('pat'),
                            body: ctx.ref<Stmt[]>('body'),
                        })),
                    ),
                ),
            ),
            (ctx, src) => ({
                type: 'case',
                target: ctx.ref<Expr>('target'),
                src,
                cases: ctx.ref<{ pat: Pat; body: Stmt[] | Expr }[]>('cases'),
            }),
        ),
        ref('expr'),
    ),
    bop: or(...binops.map((m) => kwd(m, 'bop'))),
    ...exprs,
    ...pats,
    pat: or(...Object.keys(pats).map((name) => ref(name))),
    type: or(...Object.keys(types).map((name) => ref(name))),
    ...types,
    'pat*': or(ref('pattern spread'), ...Object.keys(pats).map((name) => ref(name))),
};

export const ctx: Ctx = {
    rules,
    externalUsages: [],
    usages: {},
    scopes: [],
    ref(name) {
        if (!this.scope) throw new Error(`no  scope`);
        return this.scope[name];
    },
    kwds: kwds,
    meta: {},
};

// export const parser: TestParser<Stmt> = {
//     config: js,
//     parse(node, cursor) {
//         const c = {
//             ...ctx,
//             meta: {},
//             autocomplete: cursor != null ? { loc: cursor, concrete: [], kinds: [] } : undefined,
//         };
//         const res = match<Stmt>({ type: 'ref', name: 'stmt' }, c, { nodes: [node], loc: '' }, 0);

//         return {
//             result: res?.value,
//             ctx: { meta: c.meta },
//             bads: [],
//             goods: [],
//         };
//     },
//     spans: stmtSpans,
// };
