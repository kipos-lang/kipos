import { parser } from '../../../syntaxes/algw-s2-return';
import { Stmt, Type } from '../../../syntaxes/algw-s2-types';
import { Event, Rule } from '../../../syntaxes/dsl3';
import { Annotation, AnnotationText, Language } from '../language';
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

export const defaultLang: Language<Macro, Stmt, Record<string, Scheme>> = {
    version: 1,
    intern: (ast, info) => ({ ast, info }),
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
    validate(asts, deps) {
        resetState();

        const env = builtinEnv();
        const glob = getGlobalState();

        deps.forEach((scope) => Object.assign(env.scope, scope));

        let res: Type[] | null = null;
        let error: string | null = null;
        const eventsByTop: VEvent[][] = [];
        // NOTE: This limits us to 1 def per name, can't do static overloading in a world like this
        const scope: Record<string, Scheme> = {};
        try {
            if (asts.length > 1) {
                const full = inferStmts(
                    env,
                    asts.map((a) => a.ast),
                );
                res = full.values;
                Object.assign(scope, full.scope);
                full.events.forEach(([start, end]) => {
                    eventsByTop.push(glob.events.slice(start, end));
                });
            } else {
                const result = inferStmt(env, asts[0].ast);
                if (result.scope) {
                    Object.assign(scope, result.scope);
                }
                res = [result.value];
                eventsByTop.push(glob.events);
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

        // return { glob, res, cst, node, parsed };
        return {
            result: scope,
            meta: {},
            events: glob.events,
            annotations: allAnnotations,
        };
    },
};
