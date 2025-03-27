import { Src } from '../../keyboard/handleShiftNav';
import { Config } from '../../keyboard/test-utils';
import { RecNode } from '../../shared/cnodes';

export type MatchError =
    | {
          type: 'mismatch' | 'extra';
          // matcher: Matcher<any>;
          node: RecNode;
      }
    | {
          type: 'missing';
          //   matcher: Matcher<any>;
          at: number;
          parent: string;
          sub?: { type: 'text'; index: number } | { type: 'table'; row: number } | { type: 'xml'; which: 'tag' | 'attributes' };
      };

export type Meta = { kind?: string; placeholder?: string };

export type ParseResult<T> = {
    result: T | undefined;
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

export type Parser<AST> = {
    config: Config;
    parse(node: RecNode, cursor?: string): ParseResult<AST>;
    spans(ast: any): Src[];
};

type InferResult<Type> = {
    types: Record<string, Type>;
    // hmm oh errors
    meta: Record<string, Meta>;
    errors: Record<string, string>; // todo make this better
    events?: any[]; // add this in from the stepping debugger
};

type Inferrer<AST, Type> = {
    infer(ast: AST): InferResult<Type>;
    typeToCST(type: Type): { cst: RecNode; meta: Record<string, Meta> };
};

type Language<AST, Type> = {
    parser: Parser<AST>;
    // typeInference
    // compiler
    // interpreter
};
