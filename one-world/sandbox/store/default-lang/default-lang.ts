import { Type } from '../../../syntaxes/algw-s2-types';
import { Rule } from '../../../syntaxes/dsl3';
import { Stmt } from '../../../syntaxes/js--types';
import { js } from '../../../syntaxes/lexer';
import { Language } from '../language';

type Macro = {
    parent: string;
    id: string;
    body: Rule<any>;
};

export const defaultLang: Language<Macro, Stmt, Type, any> = {
    version: 1,
    parser: {
        config: js,
        parse(macros, node) {
            return {
                ctx: { meta: {} },
                externalReferences: [],
                ffiReferences: [],
                result: undefined,
            };
        },
        spans(ast) {
            return [];
        },
    },
};
