// ok let's do one that's more ... syntaxy

// import { Id, RecNode, TextSpan } from '../shared/cnodes';
// import { Ctx, Event, group, id, kwd, list, opt, or, seq, star, text, tx } from '../syntaxes/dsl3';
// import { Import } from './types';

// const rules = {
//     source: tx<Import['source']>(
//         group('value', or(
//             text({ type: 'none' }),
//             id(null),
//             // 'ref'
//         )),
//         (ctx, src) => {
//             const value = ctx.ref<TextSpan<never>[] | Id<string>>('value')
//             if (Array.isArray(value)) {
//                 const text = value.filter(v => v.type === 'text').map(v => v.text).join('')
//                 return {type: 'vendor', src: text}
//             }
//         }
//     ),
//     ['import']: tx<Import>(
//         list(
//             'spaced',
//             seq(
//                 kwd('import'),
//                 group('source', or(
//                     text({ type: 'none' }),
//                     id(null),
//                     // 'ref'
//                 )),
//                 kwd('from'),
//                 list(
//                     'curly',
//                     group('items', star(
//                         or(
//                             list('spaced', seq(or(kwd('macro'), kwd('plugin')), id(null))),
//                             list('spaced', seq(id(null), kwd('as'), id(null))),
//                             id(null)
//                         ),
//                     )),
//                 ),
//                 opt(
//                     seq(
//                         kwd('using'),
//                         group('foreign', id(null))
//                     )
//                 )
//             ),
//         ),
//     ),
// };

// export const baseCtx: Ctx = {
//     rules,
//     scopes: [],
//     usages: {},
//     allowIdKwds: true,
//     externalUsages: [],
//     ref(name) {
//         if (!this.scope) throw new Error(`no  scope`);
//         return this.scope[name];
//     },
//     kwds: ['import', 'from', 'macro', 'plugin', '*'],
//     meta: {},
// };

// const parse = (node: RecNode, trace?: (evt: Event) => undefined) => {
//     const myctx: Ctx = { ...baseCtx, meta: {}, rules: { ...baseCtx.rules }, trace, scopes: [[]], usages: {}, externalUsages: [] };
// };
