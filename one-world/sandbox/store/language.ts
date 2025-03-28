import { Src } from '../../keyboard/handleShiftNav';
import { Config } from '../../keyboard/test-utils';
import { RecNode } from '../../shared/cnodes';

// export type MatchError =
//     | {
//           type: 'mismatch' | 'extra';
//           // matcher: Matcher<any>;
//           node: RecNode;
//       }
//     | {
//           type: 'missing';
//           //   matcher: Matcher<any>;
//           at: number;
//           parent: string;
//           sub?: { type: 'text'; index: number } | { type: 'table'; row: number } | { type: 'xml'; which: 'tag' | 'attributes' };
//       };

export type Meta = { kind?: string; placeholder?: string };

export type ParseResult<T> = {
    result: T | undefined;
    externalReferences: { loc: string; name: string; namespace?: string }[];
    // hmmm do I really need the `goods` at this point...
    // goods: RecNode[];
    // bads: MatchError[];
    ctx: {
        meta: Record<string, Meta>;
        autocomplete?: {
            loc: string;
            concrete: string[];
            kinds: (string | null)[];
        };
    };
};

export type Parser<Macro, AST> = {
    config: Config;
    parse(macros: Macro[], node: RecNode, cursor?: string): ParseResult<AST>;
    spans(ast: AST): Src[];
};

type InferResult<Type, TypeInfo> = {
    result?: TypeInfo;
    types: Record<string, Type>;
    // hmm oh errors
    meta: Record<string, Meta>;
    errors: Record<string, string>; // todo make this better
    events?: any[]; // add this in from the stepping debugger
};

type Inferrer<AST, Type, TypeInfo> = {
    infer(ast: AST): InferResult<Type, TypeInfo>;
    typeToCST(type: Type): { cst: RecNode; meta: Record<string, Meta> };
};

// type Compiler<AST, TypeInfo> = {
//     // hmm ... I think I need multiple ASTs? or wait, maybe IRs?
// };

/*

so we can say
parse -> infer -> compile -> print
parse -> infer -> compile -> eval
or
parse -> infer -> compile
parse -> infer -> eval

in the first example,

*/

// type Inferner<AST, TypeInfo, IR> = {
//     intern?: (ast: AST, tinfo: TypeInfo) => IR;
// };

type Language<Macro, AST, Type, TypeInfo, IR = { ast: AST; tinfo: TypeInfo }, Target = string> = {
    parser: Parser<Macro, AST>;
    inferrer: Inferrer<AST, Type, TypeInfo>;
    intern?: (ast: AST, tinfo: TypeInfo) => IR;
    compile(ir: IR, deps: Record<string, IR>): Target;
    eval(ir: IR, deps: Record<string, any>): any;
};
