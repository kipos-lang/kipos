import { parser } from '../../../syntaxes/algw-s2-return';
import { Stmt, Type } from '../../../syntaxes/algw-s2-types';
import { Event, Rule } from '../../../syntaxes/dsl3';
import { Annotation, AnnotationText, Language } from '../language';
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
                externalReferences: [],
                ffiReferences: [],
                result: result.result,
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

        const annotations: Record<string, Annotation[]> = {
            [ast.src.left]: [
                res ? { type: 'type', annotation: typeToNode(res.value), primary: true } : { type: 'error', message: ['unable to infer...', error!] },
            ],
        };

        const add = (src: string, annotation: Annotation) => {
            if (!annotations[src]) annotations[src] = [annotation];
            else annotations[src].push(annotation);
        };

        glob.events.forEach((evt) => {
            if (evt.type === 'error' || evt.type === 'warning') {
                const message: AnnotationText[] = evt.message.map((item) => {
                    if (typeof item === 'string') {
                        return item;
                    }
                    return { type: 'renderable', renderable: typeToNode(item.typ) };
                });
                evt.sources.forEach((src) => {
                    add(src.left, { type: evt.type, message, spans: evt.sources });
                });
            }
            if (evt.type === 'infer') {
                add(evt.src.left, { type: 'type', annotation: typeToNode(typeApply(glob.subst, evt.value)) });
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
