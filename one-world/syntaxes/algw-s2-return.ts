// import { js, TestParser } from '../keyboard/test-utils';
import { Id, Loc, NodeID, RecNode, TextSpan } from '../shared/cnodes';
import {
    Ctx,
    list,
    match,
    or,
    Rule,
    ref,
    tx,
    seq,
    kwd,
    group,
    id,
    star,
    Src,
    number,
    text,
    table,
    opt,
    meta,
    Event,
    declaration,
    reference,
    scope,
    loc,
} from './dsl3';
// import { binops, Block, Expr, kwds, Stmt } from './js--types';
import { mergeSrc, nodesSrc } from './ts-types';
import { Config } from './lexer';
import { Block, CallArgs, CallRow, Expr, ObjectRow, Pat, PatArgs, PatCallRow, Spread, Stmt, TopItem, Type } from './algw-s2-types';
import { genId } from '../keyboard/ui/genId';

export const kwds = ['test', 'for', 'return', 'new', 'await', 'throw', 'if', 'switch', 'case', 'else', 'let', 'const', '=', '..', '.'];
export const binops = ['<', '>', '<=', '>=', '!=', '==', '+', '-', '*', '/', '^', '%', '=', '+=', '-=', '|=', '/=', '*='];

const tableConfig = tx(
    group(
        'items',
        table(
            'curly',
            tx(seq(group('name', meta(id(null), 'attribute')), ref('expr', 'value')), (ctx, src) => ({
                name: ctx.ref<Id<string>>('name'),
                value: ctx.ref<Expr>('value'),
            })),
        ),
    ),
    (ctx, src) => {
        const items = ctx.ref<{ name: Id<string>; value: Expr }[]>('items');
        const config: Record<string, Expr> = {};
        items.forEach(({ name, value }) => (config[name.text] = value));
        return { type: 'tableConfig', config };
    },
);

const toplevels_spaced: Record<string, Rule<TopItem>> = {
    test_stmt: tx<TopItem>(
        seq(
            kwd('test'),
            group('config', or(meta(text({ type: 'none' }), 'text'), id(null), tableConfig)),
            group(
                'cases',
                table(
                    'curly',
                    tx(
                        seq(
                            meta(group('name', or(text({ type: 'none' }), id(null))), 'text'),
                            group('input', ref('expr')),
                            loc('outloc', group('output', ref('expr'))),
                        ),
                        (ctx, src) => {
                            const name = ctx.ref<Id<string> | TextSpan<any, any>[]>('name');
                            return {
                                name: Array.isArray(name) ? name.map((s) => (s.type === 'text' ? s.text : '**')).join('') : name.text,
                                input: ctx.ref<Expr>('input'),
                                output: ctx.ref<Expr>('output'),
                                outloc: ctx.ref<string>('outloc'),
                                src,
                            };
                        },
                    ),
                ),
            ),
        ),
        (ctx, src) => {
            const config = ctx.ref<Id<string> | { type: 'tableConfig'; config: Record<string, Expr> } | TextSpan<any, any>[]>('config');
            let name: string | null = null;
            let target: undefined | Expr = undefined;
            // console.log(config);
            if (Array.isArray(config)) {
                name = config.map((s) => (s.type === 'text' ? s.text : '**')).join('');
            } else if (config.type === 'tableConfig') {
                const ename = config.config['name'];
                if (ename?.type === 'var' && ename.name) {
                    name = ename.name;
                } else if (ename?.type === 'str') {
                    name = ename.value;
                }
                target = config.config['target'];
            } else if (config.text) {
                name = config.text;
            }
            return {
                type: 'test',
                name,
                target,
                cases: ctx.ref<{ name?: string; target?: Expr; input: Expr; output: Expr; outloc: string; src: Src }[]>('cases'),
                src,
            };
        },
    ),
    type_stmt: tx<TopItem>(
        seq(
            kwd('type'),
            group('name', declaration('type')),
            kwd('=', 'punct'),
            group(
                'constructors',
                table(
                    'curly',
                    tx(
                        seq(
                            group('name', declaration('constructor')),
                            group(
                                'args',
                                table(
                                    'round',
                                    tx(
                                        seq(group('name', meta(id(null), 'attribute')), ref('type', 'value'), opt(ref('expr', 'default'))),
                                        (ctx, src) => ({
                                            name: textLoc(ctx.ref<Id<string>>('name')),
                                            value: ctx.ref<Type>('value'),
                                            default: ctx.ref<Expr | undefined>('default'),
                                        }),
                                    ),
                                ),
                            ),
                        ),
                        (ctx, src) => ({
                            type: 'constructor',
                            name: textLoc(ctx.ref<Id<string>>('name')),
                            args: ctx.ref<{}[]>('args'),
                        }),
                    ),
                ),
            ),
        ),
        (ctx, src) => ({
            type: 'type',
            src,
            name: textLoc(ctx.ref<Id<string>>('name')),
            constructors: ctx.ref('constructors'),
        }),
    ),
};

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
};

export type Suffix =
    | { type: 'index'; index: Expr[]; src: Src }
    // | { type: 'call'; items: (Expr | Spread<Expr>)[]; src: Src }
    | CallArgs
    | { type: 'attribute'; attribute: Id<Loc>; src: Src };

const parseSmoosh = (base: Expr, suffixes: Suffix[], src: Src & { id: string }): Expr => {
    if (!suffixes.length) return base;
    suffixes.forEach((suffix, i) => {
        switch (suffix.type) {
            case 'attribute':
                base = {
                    type: 'attribute',
                    target: base,
                    attribute: textLoc(suffix.attribute),
                    src: mergeSrc(base.src, nodesSrc(suffix.attribute)),
                };
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
    'expr var': tx(group('id', meta(reference('value'), 'ref')), (ctx, src) => ({ type: 'var', name: ctx.ref<Id<Loc>>('id').text, src })),
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
        rows: ctx.ref<(Spread<Expr> | { type: 'row'; name: Expr; value: Expr; src: Src & { id: string } })[]>('rows'),
        src,
    })),
    'expr tuple': tx<Expr>(list('round', group('items', star(or(ref('spread'), ref('expr'))))), (ctx, src) => {
        return { type: 'tuple', src, items: ctx.ref<(Expr | Spread<Expr>)[]>('items') };
    }),
    'expr array': tx(list('square', group('items', star(or(ref('spread'), ref('expr'))))), (ctx, src) => {
        return { type: 'array', src, items: ctx.ref<(Expr | Spread<Expr>)[]>('items') };
    }),
    'expr!': list('smooshed', ref('expr..')),
    'expr wrap': tx(list('round', ref('expr', 'inner')), (ctx, _) => ctx.ref<Expr>('inner')),
};

const rules = {
    toplevel_spaced: or(...Object.keys(toplevels_spaced).map((name) => ref<TopItem>(name))),
    toplevel: or<TopItem>(
        list(
            'spaced',
            or(
                ref<TopItem>('toplevel_spaced'),
                tx<TopItem>(ref<Stmt>('stmt_spaced', 'stmt'), (ctx, src) => ({ type: 'stmt', stmt: ctx.ref<Stmt>('stmt'), src })),
            ),
        ),
        tx(ref('expr', 'expr'), (ctx, src) => ({
            type: 'stmt',
            stmt: { type: 'expr', expr: ctx.ref<Expr>('expr'), src: { ...src, id: genId() } },
            src,
        })),
    ),
    stmt_spaced: or(...Object.keys(stmts_spaced).map((name) => ref<Stmt>(name))),
    stmt: or<Stmt>(
        list('spaced', ref('stmt_spaced')),
        // tx(ref('block'), (ctx, src),
        tx<Stmt>(kwd('return'), (_, src) => ({ type: 'return', value: undefined, src })),
        // kwd('continue'),
        tx(ref('expr', 'expr'), (ctx, src) => ({ type: 'expr', expr: ctx.ref<Expr>('expr'), src })),
    ),
    'pat call row': tx<PatCallRow>(seq(group('name', id(null)), opt(ref('pat', 'value'))), (ctx, src) => ({
        type: 'row',
        name: textLoc(ctx.ref<Id<Loc>>('name')),
        value: ctx.ref<Pat>('value'),
        src,
    })),
    'call row': tx<CallRow>(seq(group('name', id(null)), opt(ref('expr', 'value'))), (ctx, src) => ({
        type: 'row',
        name: textLoc(ctx.ref<Id<Loc>>('name')),
        value: ctx.ref<Expr | undefined>('value'),
        src,
    })),
    'object row': tx<ObjectRow>(seq(ref('expr', 'name'), ref('expr', 'value')), (ctx, src) => ({
        type: 'row',
        name: ctx.ref<Expr>('name'),
        value: ctx.ref<Expr>('value'),
        src,
    })),
    'pat-call-args': or<PatArgs>(
        tx<PatArgs>(list('round', group('args', star(or(ref('spread pat'), ref('pat'))))), (ctx, src) => ({
            type: 'unnamed',
            args: ctx.ref<(Pat | Spread<Pat>)[]>('args'),
            src,
        })),
        tx<PatArgs>(group('args', table('round', or(ref('spread pat'), ref('pat call row')))), (ctx, src) => ({
            type: 'named',
            args: ctx.ref<PatCallRow[]>('args'),
            src,
        })),
    ),
    'call-args': or<CallArgs>(
        tx<CallArgs>(list('round', group('args', star(or(ref('spread'), ref('expr'))))), (ctx, src) => ({
            type: 'unnamed',
            args: ctx.ref<(Expr | Spread<Expr>)[]>('args'),
            src,
        })),
        tx<CallArgs>(group('args', table('round', or(ref('spread'), ref('call row')))), (ctx, src) => ({
            type: 'named',
            args: ctx.ref<CallRow[]>('args'),
            src,
        })),
    ),
    type: or<Type>(
        tx(group('id', meta(reference('type'), 'decl')), (ctx, src) => ({ type: 'var', name: ctx.ref<Id<Loc>>('id').text, src })),
        tx(
            list('smooshed', seq(group('name', meta(reference('type'), 'constructor')), list('round', group('args', star(ref('type')))))),
            (ctx, src) => ({
                type: 'app',
                target: {
                    type: 'con',
                    name: ctx.ref<Id<Loc>>('name').text,
                    src: {
                        type: 'src',
                        left: ctx.ref<Id<Loc>>('name').loc,
                        id: genId(),
                    },
                },
                args: ctx.ref<Type[]>('args'),
                src,
            }),
        ),
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
        tx(group('id', meta(declaration('value'), 'decl')), (ctx, src) => ({ type: 'var', name: ctx.ref<Id<Loc>>('id').text, src })),
        tx(
            list('smooshed', seq(kwd('.'), group('name', meta(reference('constructor'), 'constructor')), ref('pat-call-args', 'args'))),
            (ctx, src) => ({
                type: 'con',
                name: ctx.ref<Id<Loc>>('name').text,
                args: ctx.ref<PatArgs>('args'),
                src,
            }),
        ),
        tx<Pat>(list('round', group('items', star(ref('pat')))), (ctx, src) => {
            const items = ctx.ref<Pat[]>('items');
            return { type: 'tuple', items, src };
        }),
    ),
    comment: meta(list('smooshed', seq(kwd('//', 'comment'), star(meta({ type: 'any' }, 'comment')))), 'comment'),
    block: tx<Block>(
        scope(
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
        ),
        (ctx, src) => {
            return { type: 'block', stmts: ctx.ref<Stmt[]>('contents'), src };
        },
    ),
    ...stmts_spaced,
    ...toplevels_spaced,
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
                        ),
                    ),
                ),
            ),
            (ctx, src) => parseSmoosh(ctx.ref<Expr>('base'), ctx.ref<Suffix[]>('suffixes'), src),
        ),
    ),
    expr: or(...Object.keys(exprs).map((name) => ref(name)), list('spaced', ref('expr ')), ref('block')),
    'spread pat': tx<Spread<Pat>>(list('smooshed', seq(kwd('...'), ref('pat', 'pat'))), (ctx, src) => ({
        type: 'spread',
        inner: ctx.ref<Pat>('pat'),
        src,
    })),
    spread: tx<Spread<Expr>>(list('smooshed', seq(kwd('...'), ref('expr..', 'expr'))), (ctx, src) => ({
        type: 'spread',
        inner: ctx.ref<Expr>('expr'),
        src,
    })),
    ...exprs,
    bop: or(...binops.map((m) => kwd(m, 'bop'))),
    if: tx<Expr>(
        seq(kwd('if'), list('round', ref('expr', 'cond')), ref('block', 'yes'), opt(seq(kwd('else'), group('no', or(ref('if'), ref('block')))))),
        (ctx, src) => ({
            type: 'if',
            cond: ctx.ref<Expr>('cond'),
            yes: ctx.ref<Block>('yes'),
            no: ctx.ref<undefined | Block | (Expr & { type: 'if' })>('no'),
            src,
        }),
    ),
    'expr ': or(
        tx<Expr>(
            scope(seq(meta(list('round', group('args', star(ref('pat')))), 'fn-args'), kwd('=>'), group('body', or(ref('block'), ref('expr '))))),
            (ctx, src) => ({
                type: 'lambda',
                args: ctx.ref<Pat[]>('args'),
                body: ctx.ref<Expr>('body'),
                src,
            }),
        ),
        ref('if'),

        tx<Expr>(seq(kwd('new'), ref('expr ', 'expr')), (ctx, src) => ({ type: 'new', value: ctx.ref<Expr>('expr'), src })),
        tx<Expr>(seq(kwd('throw'), ref('expr ', 'expr')), (ctx, src) => ({ type: 'throw', value: ctx.ref<Expr>('expr'), src })),

        tx<Expr>(
            seq(
                kwd('switch'),
                ref('expr tuple'),
                group(
                    'cases',
                    table(
                        'curly',
                        tx(seq(ref('pat', 'pat'), group('body', or(ref('block'), ref('stmt')))), (ctx, src) => ({
                            pat: ctx.ref<Pat>('pat'),
                            body: ctx.ref<Block | Stmt>('body'),
                        })),
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
            (ctx, src) => {
                const rights = ctx.ref<{ op: { text: string; loc: string }; right: Expr }[]>('rights');
                if (!rights.length) return ctx.ref<Expr>('left');
                return {
                    type: 'bop',
                    left: ctx.ref<Expr>('left'),
                    rights,
                    src,
                };
            },
        ),
        ref('expr'),
    ),
};

export const ctx: Ctx = {
    rules,
    scopes: [],
    usages: {},
    externalUsages: [],
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
        const myctx: Ctx = { ...ctx, meta: {}, rules: { ...ctx.rules }, trace, scopes: [[]], usages: {}, externalUsages: [] };
        macros.forEach((macro) => {
            if (!myctx.rules[macro.parent]) {
                console.warn(`Specified macro parent ${macro.parent} not found`);
            } else {
                myctx.rules[macro.id] = macro.body;
                myctx.rules[macro.parent] = or(macro.body, ref(macro.id));
            }
        });
        const res = match<TopItem>({ type: 'ref', name: 'toplevel' }, myctx, { type: 'match_parent', nodes: [node], loc: '' }, 0);
        // console.log(myctx.usages, myctx.externalUsages);
        // if (res?.value?.type === 'let')
        // console.log('provides', myctx.scopes);
        return { result: res?.value, ctx: myctx };
    },
};
