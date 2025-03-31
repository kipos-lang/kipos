// import { js, TestParser } from '../keyboard/test-utils';
import { Id, Loc, NodeID, RecNode, TextSpan } from './nodes';
import { Ctx, list, match, or, Rule, ref, tx, seq, kwd, group, id, star, Src, number, text, table, opt, meta } from './parse-dsl';
// import { binops, Block, Expr, kwds, Stmt } from './js--types';
import { mergeSrc, nodesSrc } from './ts-types';
import { Config } from './lexer';
import { Block, Expr, Pat, Spread, Stmt } from '../infer/algw/Type';

export const kwds = ['for', 'return', 'new', 'await', 'throw', 'if', 'case', 'else', 'let', 'const', '=', '..', '.', 'fn'];
export const binops = ['<', '>', '<=', '>=', '!=', '==', '+', '-', '*', '/', '^', '%', '=', '+=', '-=', '|=', '/=', '*='];

const stmts_spaced: Record<string, Rule<Stmt>> = {
    let: tx<Stmt>(seq(kwd('let'), ref('pat', 'pat'), kwd('=', 'punct'), ref('expr ', 'value')), (ctx, src) => ({
        type: 'let',
        pat: ctx.ref<Pat>('pat'),
        init: ctx.ref<Expr>('value'),
        src,
    })),
    return: tx<Stmt>(seq(kwd('return'), group('value', opt(ref('expr ')))), (ctx, src) => ({
        type: 'return',
        value: ctx.ref<undefined | Expr>('value'),
        src,
    })),
    for: tx(
        seq(kwd('for'), meta(list('round', seq(ref('stmt', 'init'), ref('expr', 'cond'), ref('expr', 'update'))), 'semi-list'), ref('block', 'body')),
        (ctx, src) => ({
            type: 'for',
            init: ctx.ref<Stmt>('init'),
            cond: ctx.ref<Expr>('cond'),
            update: ctx.ref<Expr>('update'),
            body: ctx.ref<Block>('body'),
            src,
        }),
    ),
    // throw: tx<Stmt>(seq(kwd('throw'), ref('expr ', 'value')), (ctx, src) => ({
    //     type: 'throw',
    //     value: ctx.ref<Expr>('value'),
    //     src,
    // })),
    // // just for show, not going to be part of js--
    // switch: tx<Stmt>(seq(kwd('switch'), list('round', ref('expr', 'target')), table('curly', seq(ref('expr'), ref('stmt')))), (_, __) => ({
    //     type: 'show',
    // })),
};

export type Suffix =
    | { type: 'index'; index: Expr; src: Src }
    | { type: 'call'; items: Expr[]; src: Src }
    | { type: 'attribute'; attribute: Id<Loc>; src: Src };

const parseSmoosh = (base: Expr, suffixes: Suffix[], src: Src): Expr => {
    if (!suffixes.length) return base;
    suffixes.forEach((suffix, i) => {
        switch (suffix.type) {
            case 'attribute':
                // base = { type: 'attribute', target: base, attribute: suffix.attribute, src: mergeSrc(base.src, nodesSrc(suffix.attribute)) };
                base = {
                    type: 'app',
                    target: { type: 'var', name: suffix.attribute.text, src: nodesSrc(suffix.attribute) },
                    args: [base],
                    src: mergeSrc(base.src, suffix.src),
                };
                return;
            case 'call':
                if (i > 0 && suffixes[i - 1].type === 'attribute' && base.type === 'app') {
                    base.args.push(...suffix.items);
                    base.src = mergeSrc(base.src, suffix.src);
                } else {
                    base = { type: 'app', target: base, args: suffix.items, src: mergeSrc(base.src, suffix.src) };
                }
                return;
            case 'index':
                // base = { type: 'index', target: base, index: suffix.index, src: mergeSrc(base.src, suffix.src) };
                base = {
                    type: 'app',
                    target: { type: 'var', name: 'index', src: suffix.src },
                    args: [base, suffix.index],
                    src: mergeSrc(base.src, suffix.src),
                };
                return;
            // default:
            //     throw new Error(`not doing ${(suffix as any).type} right now`);
        }
    });
    return { ...base, src };
};

type BareLet = { type: 'bare-let'; pat: Pat; init: Expr; src: Src };

const textString = (spans: TextSpan<string>[]) => {
    for (let span of spans) {
        if (span.type === 'text') return span.text;
    }
    return '';
};

const exprs: Record<string, Rule<Expr>> = {
    'expr num': tx(group('value', number), (ctx, src) => ({ type: 'prim', prim: { type: 'int', value: ctx.ref<number>('value') }, src })),
    'expr var': tx(group('id', meta(id(null), 'ref')), (ctx, src) => ({ type: 'var', name: ctx.ref<Id<Loc>>('id').text, src })),
    'expr text': tx(group('spans', meta(text(ref('expr')), 'text')), (ctx, src) => ({
        type: 'str',
        src,
        value: textString(ctx.ref<TextSpan<string>[]>('spans')),
    })),
    // ({ type:'str', spans: ctx.ref<TextSpan<Expr>[]>('spans'), src })),
    'expr tuple': tx<Expr>(list('round', group('items', star(ref('expr')))), (ctx, src) => {
        const items = ctx.ref<Expr[]>('items');
        if (items.length === 0) {
            return { type: 'var', name: 'null', src };
        }
        if (items.length === 1) return items[0];
        return items.reduceRight((right, left) => ({
            type: 'app',
            target: { type: 'var', name: ',', src },
            args: [left, right],
            src,
        }));
    }),
    'expr array': tx(list('square', group('items', star(or(or(ref('spread'), ref('expr')))))), (ctx, src) => {
        return { type: 'array', src, items: ctx.ref<(Expr | Spread<Expr>)[]>('items') };
    }),
    // 'expr table': tx(
    //     group(
    //         'rows',
    //         table(
    //             'curly',
    //             tx(seq(group('key', id(null)), ref('expr', 'value')), (ctx, src) => ({
    //                 name: ctx.ref<Id<Loc>>('key').text,
    //                 value: ctx.ref<Expr>('value'),
    //             })),
    //         ),
    //     ),
    //     (ctx, src) => ({ type: 'object', items: ctx.ref<{ name: Id<Loc>; value: Expr }[]>('rows'), src }),
    // ),
    'expr!': list('smooshed', ref('expr..')),
    'expr wrap': tx(list('round', ref('expr', 'inner')), (ctx, _) => ctx.ref<Expr>('inner')),
};

const rules = {
    stmt: or<Stmt>(
        list('spaced', or(...Object.keys(stmts_spaced).map((name) => ref<Stmt>(name)))),
        // tx(ref('block'), (ctx, src),
        // tx(kwd('return'), (_, src) => ({ type: 'return', value: null, src })),
        // kwd('continue'),
        tx(ref('expr', 'expr'), (ctx, src) => ({ type: 'expr', expr: ctx.ref<Expr>('expr'), src })),
    ),
    pat: or<Pat>(
        tx(kwd('_'), (ctx, src) => ({ type: 'any', src })),
        // tx(number, (ctx, src) => ({type: 'any', src})),
        tx(group('value', number), (ctx, src) => ({ type: 'prim', prim: { type: 'int', value: ctx.ref<number>('value') }, src })),
        tx(group('value', or(kwd('true'), kwd('false'))), (ctx, src) => ({
            type: 'prim',
            prim: { type: 'bool', value: ctx.ref<Id<Loc>>('value').text === 'true' },
            src,
        })),
        tx(group('id', meta(id(null), 'decl')), (ctx, src) => ({ type: 'var', name: ctx.ref<Id<Loc>>('id').text, src })),
        tx(list('smooshed', seq(group('name', id(null)), list('round', group('args', star(ref('pat')))))), (ctx, src) => ({
            type: 'con',
            name: ctx.ref<Id<Loc>>('name').text,
            args: ctx.ref<Pat[]>('args'),
            src,
        })),
        tx<Pat>(list('round', group('items', star(ref('pat')))), (ctx, src) => {
            const items = ctx.ref<Pat[]>('items');
            if (items.length === 0) {
                return { type: 'var', name: 'null-tuple', src };
            }
            if (items.length === 1) return items[0];
            return items.reduceRight((right, left) => ({
                type: 'con',
                name: ',',
                args: [left, right],
                src,
            }));
        }),
    ),
    comment: list('smooshed', seq(kwd('//', 'comment'), { type: 'any' })),
    block: tx<Block>(
        list(
            'curly',
            group(
                'contents',
                star(
                    or(
                        tx(list({ type: 'plain' }, star({ type: 'any' })), (_, __) => true),
                        ref('stmt'),
                    ),
                ),
            ),
        ),
        (ctx, src) => {
            // let result = null as null | Expr;
            // const items = ctx.ref<(BareLet | Expr | true)[]>('contents').filter((x) => x !== true);
            // if (!items.length) {
            //     return { type: 'var', name: 'null', src };
            // }
            // while (items.length) {
            //     const last = items.pop()!;
            //     if (last.type === 'bare-let') {
            //         result = {
            //             type: 'let',
            //             vbls: [{ pat: last.pat, init: last.init }],
            //             body: result ?? { type: 'var', name: 'void', src: last.src },
            //             src: last.src,
            //         };
            //     } else {
            //         result = result ?? last;
            //     }
            // }
            // return result ?? { type: 'var', name: 'empty-block', src };
            return { type: 'block', stmts: ctx.ref<Stmt[]>('contents'), src };
        },
    ),
    ...stmts_spaced,
    'expr..': tx<Expr>(
        seq(
            ref('expr', 'base'),
            group(
                'suffixes',
                star(
                    or<Suffix>(
                        tx(seq(kwd('.', 'punct'), group('attribute', meta(id('attribute'), 'attribute'))), (ctx, src) => ({
                            type: 'attribute',
                            attribute: ctx.ref<Id<Loc>>('attribute'),
                            src,
                        })),
                        tx(list('square', ref('expr', 'index')), (ctx, src) => ({
                            type: 'index',
                            index: ctx.ref<Expr>('index'),
                            src,
                        })),
                        tx(list('round', group('items', star(ref('expr')))), (ctx, src) => ({
                            type: 'call',
                            items: ctx.ref<Expr[]>('items'),
                            src,
                        })),
                    ),
                ),
            ),
        ),
        (ctx, src) => parseSmoosh(ctx.ref<Expr>('base'), ctx.ref<Suffix[]>('suffixes'), src),
    ),
    expr: or(...Object.keys(exprs).map((name) => ref(name)), list('spaced', ref('expr ')), ref('block')),
    spread: tx<Spread<Expr>>(list('smooshed', seq(kwd('...'), ref('expr..', 'expr'))), (ctx, src) => ({
        type: 'spread',
        inner: ctx.ref<Expr>('expr'),
        src,
    })),
    ...exprs,
    bop: or(...binops.map((m) => kwd(m, 'bop'))),
    if: tx<Expr>(
        seq(kwd('if'), ref('expr', 'cond'), ref('block', 'yes'), opt(seq(kwd('else'), group('no', or(ref('if'), ref('block')))))),
        (ctx, src) => ({
            type: 'if',
            cond: ctx.ref<Expr>('cond'),
            yes: ctx.ref<Block>('yes'),
            no: ctx.ref<undefined | Expr>('no'),
            src,
        }),
    ),
    'expr ': or(
        tx<Expr>(
            seq(meta(list('round', group('args', star(ref('pat')))), 'fn-args'), kwd('=>'), group('body', or(ref('block'), ref('expr ')))),
            (ctx, src) => ({
                type: 'lambda',
                args: ctx.ref<Pat[]>('args'),
                body: ctx.ref<Expr>('body'),
                src,
            }),
        ),
        ref('if'),

        tx<Expr>(
            seq(
                kwd('switch'),
                list('round', ref('expr', 'target')),
                group(
                    'cases',
                    table(
                        'curly',
                        tx(seq(ref('pat', 'pat'), ref('block', 'body')), (ctx, src) => ({ pat: ctx.ref<Pat>('pat'), body: ctx.ref<Block>('body') })),
                    ),
                ),
            ),
            (ctx, src) => ({
                type: 'match',
                target: ctx.ref<Expr>('target'),
                cases: ctx.ref<{ pat: Pat; body: Expr }[]>('cases'),
                src,
            }),
        ),
        tx<Expr>(seq(ref('expr', 'left'), ref('bop', 'op'), ref('expr', 'right')), (ctx, src) => ({
            type: 'app',
            target: { type: 'var', name: ctx.ref<Id<Loc>>('op').text, src },
            args: [ctx.ref<Expr>('left'), ctx.ref<Expr>('right')],
            src,
        })),
        ref('expr'),
    ),
};

export const ctx: Ctx = {
    rules,
    ref(name) {
        if (!this.scope) throw new Error(`no  scope`);
        return this.scope[name];
    },
    kwds: kwds,
    meta: {},
};

export type MatchError =
    | {
          type: 'mismatch' | 'extra';
          // matcher: Matcher<any>;
          node: RecNode;
      }
    | {
          type: 'missing';
          //   matcher: Matcher<any>;
          at: number;
          parent: Loc;
          sub?: { type: 'text'; index: number } | { type: 'table'; row: number } | { type: 'xml'; which: 'tag' | 'attributes' };
      };

export type ParseResult<T> = {
    result: T | undefined;
    goods: RecNode[];
    bads: MatchError[];
    ctx: Pick<Ctx, 'autocomplete' | 'meta'>;
};

export type TestParser<T> = {
    config: Config;
    parse(node: RecNode, cursor?: NodeID): ParseResult<T>;
    spans(ast: any): Src[];
};

export const parser: TestParser<Stmt> = {
    config: {
        punct: ['.', '/', '~`!@#$%^&*+-=\\/?:><'],
        space: ' ',
        sep: ',;\n',
        tableCol: ',:',
        tableRow: ';\n',
        tableNew: ':',
        xml: true,
    },
    spans: () => [],
    parse(node, cursor) {
        const c = {
            ...ctx,
            meta: {},
            autocomplete: cursor != null ? { loc: cursor, concrete: [], kinds: [] } : undefined,
        };
        const res = match<Stmt>({ type: 'ref', name: 'stmt' }, c, { nodes: [node], loc: '' }, 0);
        // if (res?.value?.type === 'bare-let') {
        //     res.value = {
        //         type: 'let',
        //         vbls: [{ pat: res.value.pat, init: res.value.init }],
        //         src: res.value.src,
        //         body: {
        //             type: 'var',
        //             name: 'null',
        //             src: res.value.src,
        //         },
        //     };
        // }

        return {
            result: res?.value,
            ctx: { meta: c.meta },
            bads: [],
            goods: [],
        };
    },
};
