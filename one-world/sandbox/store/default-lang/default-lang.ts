import { parser } from '../../../syntaxes/algw-s2-return';
import { Stmt, TopItem, Type } from '../../../syntaxes/algw-s2-types';
import { Event, Rule } from '../../../syntaxes/dsl3';
import { Annotation, AnnotationText, Language } from '../language';
import { srcKey } from '../makeEditor';
import { DefaultCompiler } from './DefaultCompiler';
import {
    builtinEnv,
    getGlobalState,
    inferStmt,
    inferLets,
    resetState,
    Scheme,
    Source,
    typeApply,
    typeToNode,
    Event as VEvent,
    inferToplevel,
} from './validate';
import { WorkerCompiler } from './WorkerCompiler';

type Macro = {
    parent: string;
    id: string;
    body: Rule<any>;
};

export type TInfo = {
    scope: Record<string, { scheme: Scheme; source: Source }>;
    resolutions: Record<string, Source>;
};

export const defaultLang: Language<Macro, TopItem, TInfo> = {
    version: 1,
    // intern: (ast, info) => ({ ast, info }),
    parser: {
        config: parser.config,
        parseImport(node) {
            const trace: Event[] = [];
            const TRACE = false;
            const result = parser.parseImport(
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
                // Must have no references
                externalReferences: [],
                internalReferences: {},
                ffiReferences: [],
                result: result.result,
                // hmmm maybe have type: 'import' here? hmmm.
                kind: {
                    type: 'definition',
                    provides: result.result?.items ?? [],
                },
            };
        },
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
                kind:
                    result.result?.type === 'stmt' && result.result?.stmt.type === 'expr'
                        ? { type: 'evaluation' }
                        : result.result?.type === 'test'
                          ? { type: 'test' }
                          : { type: 'definition', provides: result.ctx.scopes[0] },
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
                if (
                    asts.every(
                        (ast) =>
                            ast.ast.type === 'stmt' &&
                            ast.ast.stmt.type === 'let' &&
                            ast.ast.stmt.pat.type === 'var' &&
                            ast.ast.stmt.init.type === 'lambda',
                    )
                ) {
                    const full = inferLets(
                        env,
                        (asts as { ast: TopItem & { type: 'stmt'; stmt: { type: 'let'; pat: { type: 'var' }; init: { type: 'lambda' } } } }[]).map(
                            (a) => a.ast.stmt,
                        ),
                    );
                    res = full.values;
                    full.scopes.forEach((sub, i) => {
                        Object.entries(sub).forEach(([key, scheme]) => {
                            scope[key] = {
                                scheme,
                                source: { type: 'toplevel', name: key, toplevel: asts[i].tid, module: moduleId, src: scheme.src },
                            };
                        });
                    });
                    full.events.forEach(([start, end]) => {
                        eventsByTop.push(glob.events.slice(start, end));
                    });
                } else {
                    throw new Error('not all let lambdas');
                }
                // for (let stmt of stmts) {
                //     if (stmt.type !== 'let') {
                //         throw new Error(`mutual recursion must be "let"s`);
                //     }
                //     if (stmt.pat.type !== 'var') {
                //         throw new Error(`mutual recursion must be let {var}`);
                //     }
                //     if (stmt.init.type !== 'lambda') {
                //         throw new Error(`mutual recursion must be let {var} = {lambda}`);
                //     }
                // }
                // const lets = stmts as (Stmt & { type: 'let'; pat: { type: 'var' }; init: { type: 'lambda' } })[];
            } else {
                const single = asts[0].ast;
                const result = inferToplevel(env, single);
                if (result.scope) {
                    Object.entries(result.scope).forEach(([key, scheme]) => {
                        scope[key] = {
                            scheme,
                            source: { type: 'toplevel', name: key, toplevel: asts[0].tid, module: moduleId, src: scheme.src },
                        };
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
        // return new DefaultCompiler();
        return new WorkerCompiler();
    },
};
