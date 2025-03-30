import { parser } from '../../../syntaxes/algw-s2-return';
import { Stmt, Type } from '../../../syntaxes/algw-s2-types';
import { Event, Rule } from '../../../syntaxes/dsl3';
import { Language } from '../language';
import { builtinEnv, getGlobalState, inferStmt, resetState, typeToNode, typeToString } from './validate';

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
        try {
            res = inferStmt(env, ast);
        } catch (err) {
            console.log('bad inference', err);
            res = null;
        }

        // return { glob, res, cst, node, parsed };
        return {
            result: res?.value,
            meta: {},
            events: glob.events,
            annotations: {
                [ast.src.left]: [
                    res ? { type: 'type', annotation: typeToNode(res.value), primary: true } : { type: 'error', message: 'unable to infer...' },
                ],
            },
        };
    },
};
