import { cp } from 'fs/promises';
import { RecNode } from '../../../shared/cnodes';
import { parser } from '../../../syntaxes/algw-s2-return';
import { Block, Expr, Pat, Stmt, Type } from '../../../syntaxes/algw-s2-types';
import { Event, Rule } from '../../../syntaxes/dsl3';
import { Dependencies } from '../editorStore';
import {
    Annotation,
    AnnotationText,
    Language,
    Compiler,
    EvaluationResult,
    CompilerEvents,
    CompilerListenersMap,
    eventKey,
    ParseKind,
} from '../language';
import { findSpans, srcKey } from '../makeEditor';
import {
    builtinEnv,
    getGlobalState,
    gtypeApply,
    inferStmt,
    inferStmts,
    newTypeVar,
    resetState,
    Scheme,
    Source,
    typeApply,
    typeToNode,
    typeToString,
    unify,
    Event as VEvent,
} from './validate';

type Macro = {
    parent: string;
    id: string;
    body: Rule<any>;
};

export type TInfo = {
    scope: Record<string, { scheme: Scheme; source: Source }>;
    resolutions: Record<string, Source>;
};

export const defaultLang: Language<Macro, Stmt, TInfo> = {
    version: 1,
    // intern: (ast, info) => ({ ast, info }),
    parser: {
        config: parser.config,
        parse(macros, node) {
            const trace: Event[] = [];
            const TRACE = false;
            const result = parser.parse(
                macros,
                node,
                TRACE
                    ? (evt) => {
                          trace.push(evt);
                      }
                    : undefined,
            );
            return {
                input: node,
                trace,
                ctx: { meta: result.ctx.meta },
                externalReferences: result.ctx.externalUsages,
                internalReferences: result.ctx.usages,
                ffiReferences: [],
                result: result.result,
                kind: result.result?.type === 'expr' ? { type: 'evaluation' } : { type: 'definition', provides: result.ctx.scopes[0] },
            };
        },
        spans(ast) {
            return [];
        },
    },
    validate(moduleId, asts, deps) {
        resetState();

        const env = builtinEnv();
        const glob = getGlobalState();

        // console.log(deps);
        deps.forEach(({ scope }) => Object.assign(env.scope, scope));

        let res: Type[] | null = null;
        let error: string | null = null;
        const eventsByTop: VEvent[][] = [];
        // NOTE: This limits us to 1 def per name, can't do static overloading in a world like this
        const scope: Record<string, { scheme: Scheme; source: Source }> = {};
        try {
            if (asts.length > 1) {
                const full = inferStmts(
                    env,
                    asts.map((a) => a.ast),
                );
                res = full.values;
                full.scopes.forEach((sub, i) => {
                    Object.entries(sub).forEach(([key, scheme]) => {
                        scope[key] = { scheme, source: { type: 'toplevel', name: key, toplevel: asts[i].tid, module: moduleId, src: scheme.src } };
                    });
                });
                full.events.forEach(([start, end]) => {
                    eventsByTop.push(glob.events.slice(start, end));
                });
            } else {
                const result = inferStmt(env, asts[0].ast);
                if (result.scope) {
                    Object.entries(result.scope).forEach(([key, scheme]) => {
                        scope[key] = { scheme, source: { type: 'toplevel', name: key, toplevel: asts[0].tid, module: moduleId, src: scheme.src } };
                    });
                }
                res = [result.value];
                eventsByTop.push(glob.events.slice());
            }
        } catch (err) {
            console.log('bad inference', err);
            error = (err as Error).message;
            res = null;
        }

        const allAnnotations: Record<string, Record<string, Annotation[]>> = {};

        asts.forEach(({ ast, tid }, i) => {
            const annotations: Record<string, Annotation[]> = {};
            allAnnotations[tid] = annotations;

            const add = (annotation: Annotation) => {
                const key = srcKey(annotation.src);
                if (!annotations[key]) annotations[key] = [annotation];
                else annotations[key].push(annotation);
            };
            if (res) {
                add({ type: 'type', annotation: typeToNode(res[i]), src: ast.src, primary: true });
            } else {
                add({ type: 'error', message: ['unable to infer: ', error!], src: ast.src });
            }

            // console.log('events', tid, eventsByTop[i]);

            eventsByTop[i]?.forEach((evt) => {
                if (evt.type === 'error' || evt.type === 'warning') {
                    const message: AnnotationText[] = evt.message.map((item) => {
                        if (typeof item === 'string') {
                            return item;
                        }
                        return { type: 'renderable', renderable: typeToNode(item.typ) };
                    });
                    evt.sources.forEach((src) => {
                        add({ type: evt.type, message, spans: evt.sources, src });
                    });
                }
                if (evt.type === 'infer') {
                    add({ type: 'type', annotation: typeToNode(typeApply(glob.subst, evt.value)), src: evt.src });
                }
            });
        });

        // console.log('result scope', scope, glob.resolutions);

        // return { glob, res, cst, node, parsed };
        return {
            result: { scope, resolutions: glob.resolutions },
            meta: {},
            events: glob.events,
            annotations: allAnnotations,
        };
    },
    compiler() {
        return new DefaultCompiler();
    },
};

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

type TraceableString = string | { type: 'group'; id: string; contents: TraceableString[] } | { type: 'indent'; contents: TraceableString[] };

const toString = (ts: TraceableString): string => {
    if (typeof ts === 'string') return ts;
    if (ts.type === 'group') {
        return ts.contents.map(toString).join('');
    }
    return ts.contents.map(toString).join('').replace(/\n/g, '\n  ');
};

type Resolutions = Record<string, Source>;

const exprToString = (expr: Expr, res: Resolutions): TraceableString => {
    switch (expr.type) {
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
            return group(expr.src.id, ['() => {', ifToString(expr, res, true), '}']);
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
                ...expr.items.flatMap((item) => (item.type === 'spread' ? [`...`, exprToString(item.inner, res)] : [exprToString(item, res), ', '])),
                ']',
            ]);
        case 'prim':
            return expr.prim.value.toString();
        case 'var': {
            const resolution = res[expr.src.id];
            if (!resolution) {
                throw new Error(`no resolution for variable ${expr.src.id} at ${expr.src.left}`);
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
        // case 'str':
        //     return `"${expr.value}"`;
        // case 'quote':
        //     return `'${exprToString(expr.expr, res)}`;
        // case 'unquote':
        //     return `,${exprToString(expr.expr, res)}`;
        case 'bop':
            return group(expr.src.id, [
                exprToString(expr.left, res),
                ...expr.rights.flatMap(({ op, right }) => [' ', op.text, ' ', exprToString(right, res)]),
            ]);
        case 'lambda':
            return group(expr.src.id, ['(', ...expr.args.flatMap((arg) => [patToString(arg, res), ', ']), ') => ', exprToString(expr.body, res)]);
        // case 'tuple':
        //     return group(expr.src.id, ['(', ...expr.items.map((item) => exprToString(item, res)), ')']);
        case 'app':
            return group(expr.src.id, [
                '(',
                exprToString(expr.target, res),
                ')(',
                ...expr.args.args.flatMap((arg) =>
                    arg.type === 'spread'
                        ? ['...', exprToString(arg.inner, res)]
                        : arg.type === 'row'
                          ? [arg.value ? exprToString(arg.value, res) : arg.name.text]
                          : [exprToString(arg, res), ', '],
                ),
                ')',
            ]);
        // case 'throw':
        //     return group(expr.src.id, ['throw ', exprToString(expr.expr, res)]);
        // case 'new':
        //     return group(expr.src.id, ['new ', exprToString(expr.target, res), '(', ...expr.args.map((arg) => exprToString(arg, res)), ')']);
        // case 'attribute':
        //     return group(expr.src.id, [exprToString(expr.target, res), '.', expr.name]);
        // case 'index':
        //     return group(expr.src.id, [exprToString(expr.target, res), '[', exprToString(expr.index, res), ']']);
        // case 'constructor':
        //     return group(expr.src.id, [expr.name, '(', ...expr.args.map((arg) => exprToString(arg, res)), ')']);
    }
    throw new Error('no' + expr.type);
};

const group = (id: string, contents: TraceableString[]): TraceableString => ({ type: 'group', id, contents });

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
        { type: 'indent', contents: block.stmts.map((stmt, i) => stmtToString(stmt, res, i === block.stmts.length - 1 ? vbl : undefined)) },
        '}',
    ]);
};

const ifToString = (iff: Expr & { type: 'if' }, res: Resolutions, vbl?: string | true): TraceableString => {
    return group(iff.src.id, [
        'if (',
        exprToString(iff.cond, res),
        ') ',
        blockToString(iff.yes, res, vbl),
        iff.no ? ` else ${iff.no.type === 'if' ? ifToString(iff.no, res, vbl) : blockToString(iff.no, res, vbl)}\n` : '\n',
    ]);
};

const stmtToString = (stmt: Stmt, res: Resolutions, last?: true | string): TraceableString => {
    switch (stmt.type) {
        case 'for':
            return group(stmt.src.id, [
                `for (`,
                stmtToString(stmt.init, res),
                '; ',
                exprToString(stmt.cond, res),
                '; ',
                exprToString(stmt.update, res),
                ') ',
                blockToString(stmt.body, res),
                '\n',
            ]);
        case 'let':
            if (stmt.init.type === 'block') {
                if (stmt.pat.type === 'var') {
                    return group(stmt.src.id, [`let `, patToString(stmt.pat, res), ';\n', blockToString(stmt.init, res, stmt.pat.name), ';\n']);
                }
            }
            return group(stmt.src.id, [`let `, patToString(stmt.pat, res), ` = `, exprToString(stmt.init, res), ';\n']);
        case 'expr':
            switch (stmt.expr.type) {
                case 'block':
                    return blockToString(stmt.expr, res, last);
                case 'if':
                    return ifToString(stmt.expr, res, last);
            }
            if (last === true) {
                return group(stmt.src.id, ['return ', exprToString(stmt.expr, res), ';\n']);
            } else if (last) {
                return group(stmt.src.id, [last, ' = ', exprToString(stmt.expr, res), ';\n']);
            } else {
                return group(stmt.src.id, [exprToString(stmt.expr, res), ';\n']);
            }
        case 'type':
            throw new Error('wat');
        case 'return':
            return group(stmt.src.id, stmt.value ? [`return `, exprToString(stmt.value, res), `;\n`] : [`return;\n`]);
    }
};

const addFn = <K extends keyof CompilerEvents>(
    key: string,
    record: Record<string, ((data: CompilerEvents[K]['data']) => void)[]>,
    fn: (data: CompilerEvents[K]['data']) => void,
) => {
    if (!record[key]) {
        record[key] = [fn];
    } else {
        record[key].push(fn);
    }
    return () => {
        const at = record[key].indexOf(fn);
        if (at !== -1) {
            record[key].splice(at, 1);
        }
    };
};

/*

I have code for a top

in order to evaluate it, ...
OK FOLKS I'm just gonna cache stuff,
and mutability be darned.




*/

const evaluate = (source: string, deps: Record<string, any>, names: Record<string, string>): EvaluationResult[] => {
    const f = new Function(
        'deps',
        Object.entries(names)
            .map(([name, key]) => `const $${name} = deps['${key}'];\n`)
            .join('') + `\n\n${source}`,
    );
    try {
        const value = f(deps);
        try {
            return [{ type: 'plain', data: JSON.stringify(value) ?? 'undefined' }];
        } catch (err) {
            return [{ type: 'plain', data: `Result cant be stringified: ${value}` }];
        }
    } catch (err) {
        return [{ type: 'exception', message: (err as Error).message }];
    }
};

const define = (source: string, provides: string[], deps: Record<string, any>, names: Record<string, string>) => {
    const f = new Function(
        'deps',
        Object.entries(names)
            .map(([name, key]) => `const $${name} = deps['${key}'];\n`)
            .join('') + `\n\n${source}\n\nreturn {${provides.join(', ')}}`,
    );
    return f(deps);
};

// this... seems like something that could be abstracted.
// like, "a normal compiler"
class DefaultCompiler implements Compiler<Stmt, TInfo> {
    listeners: CompilerListenersMap = {
        results: {},
        viewSource: {},
    };
    code: { [module: string]: { [top: string]: string } } = {};
    _results: {
        [module: string]: {
            [top: string]:
                | {
                      type: 'definition';
                      scope: Record<string, any>;
                  }
                | { type: 'evaluate'; result: EvaluationResult[] };
        };
    } = {};
    constructor() {
        //
    }
    results(moduleId: string, top: string): EvaluationResult[] | null {
        const res = this._results[moduleId]?.[top];
        if (res?.type === 'evaluate') {
            return res.result;
        }
        return null;
    }
    loadModule(module: string, deps: Dependencies, asts: Record<string, { kind: ParseKind; ast: Stmt }>, infos: Record<string, TInfo>): void {
        if (!this.code[module]) this.code[module] = {};
        if (!this._results[module]) this._results[module] = {};
        // console.log('deps', deps.traversalOrder);
        deps.traversalOrder.forEach((hid) => {
            if (!asts[hid] || !infos[hid]) return; // skipping Iguess
            // console.log('processing', hid);
            // TODO: ... if names are duplicated ... do something about that
            const components = deps.components.entries[hid];
            components.forEach((top) => {
                const deps: Record<string, any> = {};
                const names: Record<string, string> = {};
                if (!infos[hid]) throw new Error(`type infos not provided for ${hid}`);
                const fixedSources: Resolutions = { ...infos[hid].resolutions };

                Object.entries(infos[hid].resolutions).forEach(([rkey, source]) => {
                    if (source.type === 'toplevel') {
                        const top = this._results[source.module][source.toplevel];
                        if (top.type !== 'definition') throw new Error(`source in a top thats not a definition`);
                        if (!(source.src.left in top.scope)) {
                            // console.log('have', source.src, top.scope);
                            throw new Error(`source id ${source.src.left} not defined`);
                        }
                        const key = `${source.module}.${source.toplevel}.${source.src.left}`;
                        deps[key] = top.scope[source.src.left];
                        if (!names[source.name] || names[source.name] === key) {
                            names[source.name] = key;
                            fixedSources[rkey] = { ...source, name: '$' + source.name };
                            return;
                        } else {
                            let i = 2;
                            for (; i < 100; i++) {
                                const name = `${source.name}${i}`;
                                if (!names[name] || names[name] === key) {
                                    names[name] = key;
                                    fixedSources[rkey] = { ...source, name: '$' + name };
                                    return;
                                }
                            }
                            throw new Error(`do you really have 100 dependencies all named ${source.name}???`);
                        }
                    }
                });

                const code = stmtToString(asts[top].ast, fixedSources, true);
                // console.log('to string');
                // console.log(code);
                const source = toString(code);
                // console.log(source);
                this.code[module][top] = source;
                this.emit('viewSource', { module, top }, { source });
                if (asts[top].kind.type === 'evaluation') {
                    const result = evaluate(source, deps, names);
                    this._results[module][top] = { type: 'evaluate', result };
                    this.emit('results', { module, top }, { results: result });
                } else if (asts[top].kind.type === 'definition') {
                    try {
                        const rawscope = define(
                            source,
                            asts[top].kind.provides.filter((p) => p.kind === 'value').map((p) => p.name),
                            deps,
                            names,
                        );
                        const scope: Record<string, any> = {};
                        asts[top].kind.provides
                            .filter((p) => p.kind === 'value')
                            .forEach((p) => {
                                scope[p.loc] = rawscope[p.name];
                            });

                        this._results[module][top] = { type: 'definition', scope };
                    } catch (err) {
                        console.error('bad news bears', err);
                    }
                }
            });
        });
    }

    update(
        updateId: string,
        moduleId: string,
        deps: Dependencies,
        ast: Record<string, { kind: ParseKind; ast: Stmt }>,
        infos: Record<string, TInfo>,
    ): void {
        //
    }
    listen<K extends keyof CompilerEvents>(evt: K, args: CompilerEvents[K]['args'], fn: (data: CompilerEvents[K]['data']) => void): () => void {
        const key = eventKey(evt, args);
        return addFn(key, this.listeners[evt], fn);
    }
    has<K extends keyof CompilerEvents>(evt: K, args: CompilerEvents[K]['args']) {
        return this.listeners[evt][eventKey(evt, args)]?.length;
    }
    emit<K extends keyof CompilerEvents>(evt: K, args: CompilerEvents[K]['args'], data: CompilerEvents[K]['data']) {
        this.listeners[evt][eventKey(evt, args)]?.forEach((fn) => fn(data));
    }
    input(
        inputId: string,
        value:
            | { type: 'int' | 'float'; value: number }
            | { type: 'text'; value: string }
            | { type: 'cst'; value: RecNode }
            | { type: 'boolean'; value: boolean },
    ): void {
        //
    }
}
