// import { js, TestParser } from '../keyboard/test-utils';
import { Id, Loc, NodeID, RecNode, TextSpan } from '../shared/cnodes';
import { Ctx, list, match, or, Rule, ref, tx, seq, kwd, group, id, star, Src, number, text, table, opt, meta, Event } from './dsl3';
// import { binops, Block, Expr, kwds, Stmt } from './js--types';
import { mergeSrc, nodesSrc } from './ts-types';
import { Config } from './lexer';
import { Block, CallArgs, Expr, ObjectRow, Pat, Spread, Stmt, Type } from './algw-s2-types';

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
    | { type: 'index'; index: Expr[]; src: Src }
    // | { type: 'call'; items: (Expr | Spread<Expr>)[]; src: Src }
    | CallArgs
    | { type: 'attribute'; attribute: Id<Loc>; src: Src };

const parseSmoosh = (base: Expr, suffixes: Suffix[], src: Src): Expr => {
    if (!suffixes.length) return base;
    suffixes.forEach((suffix, i) => {
        switch (suffix.type) {
            case 'attribute':
                base = { type: 'attribute', target: base, attribute: textLoc(suffix.attribute), src: mergeSrc(base.src, nodesSrc(suffix.attribute)) };
                // base = {
                //     type: 'app',
                //     target: { type: 'var', name: suffix.attribute.text, src: nodesSrc(suffix.attribute) },
                //     args: [base],
                //     src: mergeSrc(base.src, suffix.src),
                // };
                return;
            case 'named':
            case 'unnamed':
                base = {
                    type: 'app',
                    target: base,
                    args: suffix,
                    src: mergeSrc(base.src, suffix.src),
                };
                return;
            case 'index':
                base = { type: 'index', target: base, index: suffix.index, src: mergeSrc(base.src, suffix.src) };
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

const textLoc = (id: Id<Loc>): { text: string; loc: Loc } => ({ text: id.text, loc: id.loc });

const exprs: Record<string, Rule<Expr>> = {
    'expr num': tx(group('value', number), (ctx, src) => ({ type: 'prim', prim: { type: 'int', value: ctx.ref<number>('value') }, src })),
    'expr var': tx(group('id', meta(id(null), 'ref')), (ctx, src) => ({ type: 'var', name: ctx.ref<Id<Loc>>('id').text, src })),
    'expr text': tx(group('spans', meta(text(ref('expr')), 'text')), (ctx, src) => ({
        type: 'str',
        src,
        value: textString(ctx.ref<TextSpan<string>[]>('spans')),
    })),
    'expr constructor': tx(
        list('smooshed', seq(kwd('.'), group('id', meta(id(null), 'constructor')), group('args', opt(ref('call-args'))))),
        (ctx, src) => ({
            type: 'constructor',
            name: textLoc(ctx.ref<Id<Loc>>('id')),
            args: ctx.ref<CallArgs | null>('args') ?? undefined,
            src,
        }),
    ),
    'expr object': tx<Expr>(group('rows', table('curly', or(ref('spread'), ref('object row')))), (ctx, src) => ({
        type: 'object',
        rows: ctx.ref<(Spread<Expr> | { type: 'row'; name: Expr; value: Expr; src: Src })[]>('rows'),
        src,
    })),
    // ({ type:'str', spans: ctx.ref<TextSpan<Expr>[]>('spans'), src })),
    'expr tuple': tx<Expr>(list('round', group('items', star(or(ref('spread'), ref('expr'))))), (ctx, src) => {
        return { type: 'tuple', src, items: ctx.ref<(Expr | Spread<Expr>)[]>('items') };
    }),
    'expr array': tx(list('square', group('items', star(or(ref('spread'), ref('expr'))))), (ctx, src) => {
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
    'object row': tx<ObjectRow>(seq(ref('expr', 'name'), ref('expr', 'value')), (ctx, src) => ({
        type: 'row',
        name: ctx.ref<Expr>('name'),
        value: ctx.ref<Expr>('value'),
        src,
    })),
    'call-args': or<CallArgs>(
        tx<CallArgs>(list('round', group('args', star(or(ref('spread'), ref('expr'))))), (ctx, src) => ({
            type: 'unnamed',
            args: ctx.ref<(Expr | Spread<Expr>)[]>('args'),
            src,
        })),
        tx<CallArgs>(group('args', table('round', star(or(ref('spread'), ref('object row'))))), (ctx, src) => ({
            type: 'named',
            args: ctx.ref<ObjectRow[]>('args'),
            src,
        })),
    ),
    pat: or<Pat>(
        tx(kwd('_'), (ctx, src) => ({ type: 'any', src })),
        tx<Pat>(list('smooshed', seq(kwd('`'), ref('pat', 'contents'))), (ctx, src) => ({
            type: 'unquote',
            src,
            contents: ctx.ref<Pat>('contents'),
        })),
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
    comment: meta(list('smooshed', seq(kwd('//', 'comment'), star(meta({ type: 'any' }, 'comment')))), 'comment'),
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
    // typ_quote: tx<Expr>(
    //     seq(kwd('@'), kwd('t'), list('round', ref('type', 'contents'))),
    //     (ctx, src): Expr => ({ type: 'quote', src, quote: { type: 'type', contents: ctx.ref<Type>('contents') } }),
    // ),
    pat_quote: tx<Expr>(
        seq(kwd('@'), kwd('p'), list('round', ref('pat', 'contents'))),
        (ctx, src): Expr => ({ type: 'quote', src, quote: { type: 'pattern', contents: ctx.ref<Pat>('contents') } }),
    ),
    quote: tx<Expr>(
        seq(kwd('@'), ref('expr', 'contents')),
        (ctx, src): Expr => ({ type: 'quote', src, quote: { type: 'expr', contents: ctx.ref<Expr>('contents') } }),
    ),
    raw_quote: tx<Expr>(
        seq(kwd('@@'), group('contents', { type: 'any' })),
        (ctx, src): Expr => ({ type: 'quote', src, quote: { type: 'raw', contents: ctx.ref<RecNode>('contents') } }),
    ),
    unquote: tx<Expr>(seq(kwd('`'), ref('expr', 'contents')), (ctx, src): Expr => ({ type: 'unquote', src, contents: ctx.ref<Expr>('contents') })),
    'expr..': or(
        ref('unquote'),
        ref('raw_quote'),
        ref('pat_quote'),
        // ref('typ_quote'),
        ref('quote'),
        tx<Expr>(
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
                            tx(list('square', group('index', star(ref('expr')))), (ctx, src) => ({
                                type: 'index',
                                index: ctx.ref<Expr[]>('index'),
                                src,
                            })),
                            ref('call-args'),
                            // tx(list('round', group('items', star(or(ref('spread'), ref('expr'))))), (ctx, src) => ({
                            //     type: 'call',
                            //     items: ctx.ref<(Expr | Spread<Expr>)[]>('items'),
                            //     src,
                            // })),
                        ),
                    ),
                ),
            ),
            (ctx, src) => parseSmoosh(ctx.ref<Expr>('base'), ctx.ref<Suffix[]>('suffixes'), src),
        ),
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
        tx<Expr>(
            seq(
                ref('expr', 'left'),
                group(
                    'rights',
                    star(tx(seq(ref('bop', 'op'), ref('expr', 'right')), (ctx, src) => ({ op: ctx.ref('op'), right: ctx.ref('right') }))),
                ),
            ),
            (ctx, src) => ({
                type: 'bop',
                op: ctx.ref<Id<Loc>>('op'),
                left: ctx.ref<Expr>('left'),
                rights: ctx.ref<{ op: { text: string; loc: string }; right: Expr }[]>('rights'),
                src,
            }),
        ),
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
    // goods: RecNode[];
    // bads: MatchError[];
    ctx: Pick<Ctx, 'autocomplete' | 'meta'>;
};

type Macro = {
    parent: string;
    id: string;
    body: Rule<any>;
};

export const parser = {
    config: {
        punct: ['.', '/', '`', '@', '~!#$%^&*+-=\\/?:><'],
        space: ' ',
        sep: ',;\n',
        tableCol: ':',
        tableRow: ';,\n',
        tableNew: ':',
        xml: true,
    },
    spans: () => [],
    parse(macros: Macro[], node: RecNode, trace?: (evt: Event) => undefined) {
        const myctx = { ...ctx, meta: {}, rules: { ...ctx.rules }, trace };
        macros.forEach((macro) => {
            if (!myctx.rules[macro.parent]) {
                console.warn(`Specified macro parent ${macro.parent} not found`);
            } else {
                myctx.rules[macro.id] = macro.body;
                myctx.rules[macro.parent] = or(macro.body, ref(macro.id));
            }
        });
        const res = match<Stmt>({ type: 'ref', name: 'stmt' }, myctx, { nodes: [node], loc: '' }, 0);
        return { result: res?.value, ctx: { meta: myctx.meta } };
    },
};
