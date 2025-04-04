import { parser } from '../../../syntaxes/algw-s2-return';
import { Stmt, Type } from '../../../syntaxes/algw-s2-types';
import { Event, Rule } from '../../../syntaxes/dsl3';
import { Annotation, AnnotationText, Language } from '../language';
import { findSpans, srcKey } from '../makeEditor';
import { builtinEnv, getGlobalState, inferStmt, resetState, Scheme, typeApply, typeToNode, typeToString } from './validate';

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
                provides: result.ctx.scopes[0],
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

        let res;
        let error: string | null = null;
        // NOTE: This limits us to 1 def per name, can't do static overloading in a world like this
        const scope: Record<string, Scheme> = {};
        try {
            res = asts.map((ast) => inferStmt(env, ast));
            res.forEach((res) => {
                if (res.scope) {
                    Object.assign(scope, res.scope);
                }
            });
        } catch (err) {
            console.log('bad inference', err);
            error = (err as Error).message;
            res = null;
        }

        const annotations: Record<string, Annotation[]> = {};

        const add = (annotation: Annotation) => {
            const key = srcKey(annotation.src);
            if (!annotations[key]) annotations[key] = [annotation];
            else annotations[key].push(annotation);
        };
        if (res) {
            res.forEach(({ value }, i) => {
                add({ type: 'type', annotation: typeToNode(value), src: asts[i].src, primary: true });
            });
        } else {
            asts.forEach((ast) => {
                add({ type: 'error', message: ['unable to infer: ', error!], src: ast.src });
            });
        }

        glob.events.forEach((evt) => {
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

        // return { glob, res, cst, node, parsed };
        return {
            result: scope,
            meta: {},
            events: glob.events,
            annotations,
        };
    },
};
