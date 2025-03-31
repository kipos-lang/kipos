import { Src } from '../../keyboard/handleShiftNav';
import { Config } from '../../keyboard/test-utils';
import { RecNode } from '../../shared/cnodes';
import { Event } from '../../syntaxes/dsl3';

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
    externalReferences: { loc: string; name: string; namespace?: string[] }[];
    ffiReferences: { loc: string; namespace: string[]; name: string }[];
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
    parse(macros: Macro[], node: RecNode, trace?: (evt: Event) => undefined): ParseResult<AST>;
    spans(ast: AST): Src[];
};

export type Renderable = { node: RecNode; meta: Record<string, Meta> };

export type Annotation =
    | { type: 'error'; message: string; spans?: Src[] }
    | { type: 'warning'; message: string; spans?: Src[] }
    | { type: 'info'; message: string; spans?: Src[] }
    | { type: 'type'; annotation: Renderable; spans?: Src[]; primary?: boolean };

export type ValidateResult<ValidationInfo> = {
    result?: ValidationInfo;
    // hmm oh errors
    meta: Record<string, Meta>;
    // big question here: should annotations ... need to be anchored anywhere...
    annotations: Record<string, Annotation[]>; // todo make this better
    events?: any[]; // add this in from the stepping debugger
};

/*

so we can say
parse -> infer -> compile -> print
parse -> infer -> compile -> eval
or
parse -> infer -> compile
parse -> infer -> eval

in the first example,

*/

export type Language<Macro, AST, ValidationInfo, IR = { ast: AST; info: ValidationInfo }, Target = string> = {
    version: 1;
    parser: Parser<Macro, AST>;
    validate?(ast: AST): ValidateResult<ValidationInfo>;
    intern?: (ast: AST, info: ValidationInfo) => IR;
    compile?(ir: IR, deps: Record<string, IR>): Target;
    eval?(ir: IR, deps: Record<string, any>): any;
};
