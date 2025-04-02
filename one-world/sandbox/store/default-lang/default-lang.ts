import { parser } from '../../../syntaxes/algw-s2-return';
import { Stmt, Type } from '../../../syntaxes/algw-s2-types';
import { Event, Rule } from '../../../syntaxes/dsl3';
import { Annotation, AnnotationText, Language } from '../language';
import { srcKey } from '../makeEditor';
import { builtinEnv, getGlobalState, inferStmt, resetState, typeApply, typeToNode, typeToString } from './validate';

type Macro = {
    parent: string;
    id: string;
    body: Rule<any>;
};

export const defaultLang: Language<Macro, Stmt, Type> = {
    version: 1,
    parser: {
        config: parser.config,
        parse(macros, node, trace?: (evt: Event) => undefined) {
            const result = parser.parse(macros, node, trace);
            return {
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
    validate(ast) {
        resetState();

        const env = builtinEnv();
        const glob = getGlobalState();

        let res;
        let error: string | null = null;
        try {
            res = inferStmt(env, ast);
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
        add(
            res
                ? { type: 'type', annotation: typeToNode(res.value), src: ast.src, primary: true }
                : { type: 'error', message: ['unable to infer: ', error!], src: ast.src },
        );

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
            result: res?.value,
            meta: {},
            events: glob.events,
            annotations,
        };
    },
};
