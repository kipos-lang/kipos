import { parser } from '../../../syntaxes/algw-s2-return';
import { Stmt, Type } from '../../../syntaxes/algw-s2-types';
import { Rule } from '../../../syntaxes/dsl3';
import { Language } from '../language';

type Macro = {
    parent: string;
    id: string;
    body: Rule<any>;
};

export const defaultLang: Language<Macro, Stmt, Type, any> = {
    version: 1,
    parser: {
        config: parser.config,
        parse(macros, node) {
            const result = parser.parse(macros, node);
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
};
