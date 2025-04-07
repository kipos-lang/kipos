import { parser } from '../../../syntaxes/algw-s2-return';
import { Stmt, Type } from '../../../syntaxes/algw-s2-types';
import { Event, Rule } from '../../../syntaxes/dsl3';
import { Annotation, AnnotationText, Language } from '../language';
import { srcKey } from '../makeEditor';
import { DefaultCompiler } from './DefaultCompiler';
import { builtinEnv, getGlobalState, inferStmt, inferStmts, resetState, Scheme, Source, typeApply, typeToNode, Event as VEvent } from './validate';
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
        // return new DefaultCompiler();
        return new WorkerCompiler();
    },
};
