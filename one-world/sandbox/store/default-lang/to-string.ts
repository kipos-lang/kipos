import { interleaveF } from '../../../keyboard/interleave';
import { Expr, Pat, Block, Stmt, TopItem } from '../../../syntaxes/algw-s2-types';
import { Source } from './validate';

/*
for this basic thing, I want:

- each toplevel becomes ... some javascript.
    toplevel lets are `toplevels[moduleId]["{name}_{src.id}"] = ...`
- evals are just themselves...

when we eval a thing, we ... reconstruct the whole source code? concatenating everything together.
later I can do caching and stuff.
hm like I could determine from the types if something is JSONable, and do that...


Things to think about when compiling:
- source maps! How do do do
- coverage n stuff
- tracing support
- I'm thinking the Toplevel has a record like {[loc: string]: TraceConfig}
    where TraceConfig might have a condition on it, and maybe a transformation function

*/
type TraceableString = string | { type: 'group'; id: string | null; contents: TraceableString[] } | { type: 'indent'; contents: TraceableString[] };

export const toString = (ts: TraceableString): string => {
    if (typeof ts === 'string') return ts;
    if (ts.type === 'group') {
        return ts.contents.map(toString).join('');
    }
    return '  ' + ts.contents.map(toString).join('').replace(/\n/g, '\n  ').trimRight() + '\n';
};

export type Resolutions = Record<string, Source>;

const needsWrap = (expr: Expr) => {
    switch (expr.type) {
        case 'block':
        case 'if':
        case 'match':
        case 'bop':
        case 'lambda':
        case 'throw':
        case 'new':
            return true;

        case 'prim':
        case 'object':
        case 'array':
        case 'var':
        case 'str':
        case 'quote':
        case 'unquote':
        case 'tuple':
        case 'app':
        case 'attribute':
        case 'index':
            return false;
    }
};

const maybeWrap = (expr: Expr, res: Resolutions) => {
    const inner = exprToString(expr, res);
    return needsWrap(expr) ? group(null, ['(', inner, ')']) : inner;
};

const exprToString = (expr: Expr, res: Resolutions): TraceableString => {
    switch (expr.type) {
        case 'uop':
            return group(expr.src.id, [expr.op.text, maybeWrap(expr.target, res)]);
        case 'throw':
            return group(expr.src.id, ['(() => {throw ', exprToString(expr.value, res), ';})()']);
        case 'new':
            return group(expr.src.id, ['new ', exprToString(expr.value, res)]);
        case 'block':
            return blockToString(expr, res);
        case 'object':
            return group(expr.src.id, [
                '{',
                {
                    type: 'indent',
                    contents: expr.rows.flatMap((row): TraceableString[] =>
                        row.type === 'spread'
                            ? [`...`, exprToString(row.inner, res)]
                            : row.value
                              ? [exprToString(row.name, res), ': ', exprToString(row.value, res), `,\n`]
                              : [exprToString(row.name, res), ',\n'],
                    ),
                },
                '}',
            ]);
        case 'if':
            return group(expr.src.id, ['(() => {', ifToString(expr, res, true), '})()']);
        case 'match':
            return group(expr.src.id, [
                '() => {',
                'switch (',
                exprToString(expr.target, res),
                ') {\n',
                { type: 'indent', contents: expr.cases.map((c) => `${patToString(c.pat, res)} => ${exprToString(c.body, res)},\n`) },
                '}\n}',
            ]);
        case 'array':
            return group(expr.src.id, [
                '[',
                ...interleaveF(
                    expr.items.map((item) =>
                        item.type === 'spread' ? group(item.src.id, [`...`, exprToString(item.inner, res)]) : exprToString(item, res),
                    ),
                    () => ', ',
                ),
                ']',
            ]);
        case 'prim':
            return group(expr.src.id, [expr.prim.value.toString()]);
        case 'var': {
            const resolution = res[expr.src.id];
            if (!resolution) {
                if (!expr.name) {
                    throw new Error(`blank identifier found during code generation`);
                    // return `(() => {throw new Error('blank identifier')})()`;
                }
                // console.warn(`no resolution for variable ${expr.src.id} at ${expr.src.left}`);
                return expr.name;
            }
            switch (resolution.type) {
                case 'builtin':
                case 'local':
                    return expr.name;
                case 'toplevel':
                    // This will have been replaced ... if needed ...
                    // ooh I need to make sure this cant shadowwwwwww
                    return resolution.name;
            }
        }
        case 'str':
            return group(expr.src.id, [JSON.stringify(expr.value)]);
        // case 'quote':
        //     return `'${exprToString(expr.expr, res)}`;
        // case 'unquote':
        //     return `,${exprToString(expr.expr, res)}`;
        case 'bop':
            return group(expr.src.id, [
                maybeWrap(expr.left, res),
                ...expr.rights.flatMap(({ op, right }) => [' ', op.text, ' ', maybeWrap(right, res)]),
            ]);
        case 'lambda':
            return group(expr.src.id, [
                '(',
                ...interleaveF(
                    expr.args.map((arg) => patToString(arg, res)),
                    () => ', ',
                ),
                ') => ',
                ...(expr.body.type === 'constructor' ? ['(', exprToString(expr.body, res), ')'] : [exprToString(expr.body, res)]),
            ]);
        // case 'tuple':
        //     return group(expr.src.id, ['(', ...expr.items.map((item) => exprToString(item, res)), ')']);
        case 'app':
            return group(expr.src.id, [
                maybeWrap(expr.target, res),
                '(',
                ...interleaveF(
                    expr.args.args.map((arg) =>
                        arg.type === 'spread'
                            ? group(arg.src.id, ['...', exprToString(arg.inner, res)])
                            : arg.type === 'row'
                              ? arg.value
                                  ? exprToString(arg.value, res)
                                  : arg.name.text
                              : exprToString(arg, res),
                    ),
                    () => ', ',
                ),
                ')',
            ]);
        // case 'throw':
        //     return group(expr.src.id, ['throw ', exprToString(expr.expr, res)]);
        // case 'new':
        //     return group(expr.src.id, ['new ', exprToString(expr.target, res), '(', ...expr.args.map((arg) => exprToString(arg, res)), ')']);
        case 'attribute':
            return group(expr.src.id, [maybeWrap(expr.target, res), '.', expr.attribute.text]);
        case 'index':
            return group(expr.src.id, [
                maybeWrap(expr.target, res),
                '[',
                ...interleaveF(
                    expr.index.map((item) => exprToString(item, res)),
                    () => ', ',
                ).flat(),
                ']',
            ]);
        case 'constructor':
            if (!expr.args) {
                return group(expr.src.id, ['{"type":', JSON.stringify(expr.name.text), '}']);
            }
            // expr.name
            return group(expr.src.id, [
                '{"type":',
                JSON.stringify(expr.name.text),
                ...expr.args.args.flatMap((arg) =>
                    arg.type === 'row'
                        ? arg.value
                            ? [', ', JSON.stringify(arg.name.text), ': ', exprToString(arg.value, res)]
                            : [', ', arg.name.text]
                        : arg.type === 'spread'
                          ? ['...', exprToString(arg.inner, res)]
                          : [', ', exprToString(arg, res)],
                ),
                '}',
            ]);
    }
    throw new Error('no to-string for ' + expr.type);
};
const group = (id: string | null, contents: TraceableString[]): TraceableString => ({ type: 'group', id, contents });
const patToString = (pat: Pat, res: Resolutions): TraceableString => {
    switch (pat.type) {
        case 'any':
            return '_' + pat.src.id;
        case 'unquote':
            throw new Error(`unexpanded macrooo`);
        case 'var':
            return pat.name;
        case 'tuple':
            return group(pat.src.id, ['[', ...pat.items.flatMap((item) => [patToString(item, res), ', ']), ']']);
        case 'con':
            throw new Error('con patterns not happening');
        case 'str':
            throw new Error('string patterns not happening');
        case 'prim':
            throw new Error('prim pattern onpe');
    }
};
const blockToString = (block: Block, res: Resolutions, vbl?: string | true) => {
    return group(block.src.id, [
        '{\n',
        {
            type: 'indent',
            contents: interleaveF(
                block.stmts.map((stmt, i) => stmtToString(stmt, res, i === block.stmts.length - 1 ? vbl : undefined)),
                () => '\n',
            ),
        },
        '}',
    ]);
};
const ifToString = (iff: Expr & { type: 'if' }, res: Resolutions, vbl?: string | true): TraceableString => {
    return group(iff.src.id, [
        'if (',
        exprToString(iff.cond, res),
        ') ',
        blockToString(iff.yes, res, vbl),
        ...(iff.no ? [` else `, iff.no.type === 'if' ? ifToString(iff.no, res, vbl) : blockToString(iff.no, res, vbl)] : []),
    ]);
};

/*

ok so
we go through each test
and do a little equivocarion

*/

export const testToString = (test: TopItem & { type: 'test' }, res: Resolutions): TraceableString => {
    return group(test.src.id, [
        `// ${test.name}\n`,
        ...test.cases.map(({ name, input, output, outloc, src }) => {
            return group(src.id, [
                `$$check(`,
                JSON.stringify(name),
                ', ',
                test.target ? exprToString(test.target, res) : 'null',
                ', () => ',
                exprToString(input, res),
                ', () => ',
                exprToString(output, res),
                ', ',
                JSON.stringify(outloc),
                ');\n',
            ]);
        }),
    ]);
};

export const stmtToString = (stmt: Stmt, res: Resolutions, last?: true | string): TraceableString => {
    switch (stmt.type) {
        // case 'test':
        //     return group(stmt.src.id, ['TESTMAYBE()']);
        // case 'type':
        //     throw new Error('wat');
        case 'for':
            return group(stmt.src.id, [
                `for (`,
                stmtToString(stmt.init, res),
                ' ',
                exprToString(stmt.cond, res),
                '; ',
                exprToString(stmt.update, res),
                ') ',
                blockToString(stmt.body, res),
            ]);
        case 'let':
            if (stmt.init.type === 'block') {
                if (stmt.pat.type === 'var') {
                    return group(stmt.src.id, [`let `, patToString(stmt.pat, res), ';\n', blockToString(stmt.init, res, stmt.pat.name), ';']);
                }
            }
            return group(stmt.src.id, [`let `, patToString(stmt.pat, res), ` = `, exprToString(stmt.init, res), ';']);
        case 'expr':
            switch (stmt.expr.type) {
                case 'block':
                    return blockToString(stmt.expr, res, last);
                case 'if':
                    return ifToString(stmt.expr, res, last);
                case 'throw':
                    return group(stmt.expr.src.id, [`throw `, exprToString(stmt.expr.value, res), ';']);
            }
            if (last === true) {
                return group(stmt.src.id, ['return ', exprToString(stmt.expr, res), ';']);
            } else if (last) {
                return group(stmt.src.id, [last, ' = ', exprToString(stmt.expr, res), ';']);
            } else {
                return group(stmt.src.id, [exprToString(stmt.expr, res), ';']);
            }
        case 'return':
            return group(stmt.src.id, stmt.value ? [`return `, exprToString(stmt.value, res), `;`] : [`return;`]);
    }
};
