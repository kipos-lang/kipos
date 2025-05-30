import { Config } from '../../keyboard/test-utils';
import { RecNode } from '../../shared/cnodes';
import { Event, Src } from '../../syntaxes/dsl3';
import { Import, ParsedImport } from '../types';
import { StackText } from './default-lang/validate';
import { Dependencies } from './editorStore';

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

export type AccessControlLevel = 'public' | 'package' | 'module' | 'submodule';

export type ParseKind =
    | {
          type: 'definition';
          provides: {
              loc: string;
              name: string;
              kind:
                  | string
                  // there are some 'special kinds'
                  | 'kipos:plugin:parser'
                  | 'kipos:plugin:validate'
                  | 'kipos:plugin:compile'
                  | 'kipos:plugin:editor'
                  | 'kipos:language';
              accessControl: AccessControlLevel;
          }[];
      }
    | { type: 'evaluation' }
    | { type: 'test' };

export type ParseResult<T, Kind> = {
    input: RecNode;
    result: T | undefined;
    kind: Kind;
    // hmm. how do we communicate that a macro is happening.
    // because, we need like a way to ... evaluate it?
    // ok so maybe the evaluator will have a special mode that's like
    // "evaluateMacro", and we provide the loc that we got.
    // that sounds good to me.
    // providesMacro
    externalReferences: { loc: string; name: string; kind: string }[];
    internalReferences: { [src: string]: { kind: string; name: string; usages: string[] } };
    ffiReferences: { loc: string; namespace: string[]; name: string }[];
    trace?: Event[];
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
    parseImport(node: RecNode, trace?: (evt: Event) => undefined): ParseResult<ParsedImport, null>;
    parse(macros: Macro[], node: RecNode, trace?: (evt: Event) => undefined): ParseResult<AST, ParseKind>;
    spans(ast: AST): Src[];
};

export type Renderable = { node: RecNode; meta: Record<string, Meta> };

export type AnnotationText = { type: 'renderable'; renderable: Renderable; src?: Src } | string;
export type Annotation =
    | { type: 'error'; message: AnnotationText[]; src: Src; spans?: Src[] }
    | { type: 'warning'; message: AnnotationText[]; src: Src; spans?: Src[] }
    | { type: 'info'; message: AnnotationText[]; src: Src; spans?: Src[] }
    | { type: 'type'; annotation: Renderable; src: Src; spans?: Src[]; primary?: boolean };

export type ValidateResult<ValidationInfo> = {
    result: ValidationInfo;
    failed: boolean;
    // hmm oh errors
    meta: Record<string, Meta>;
    // big question here: should annotations ... need to be anchored anywhere...
    annotations: { [top: string]: Record<string, Annotation[]> }; // todo make this better
    events?: any[]; // add this in from the stepping debugger
};

// SOO this setup doesn't allow for like OffscreenCanvas ... will think about that later.

export type TestResult =
    | { type: 'pass'; message?: string }
    | { type: 'fail'; message?: string }
    // hrm. should this be RecNode?
    | { type: 'mismatch'; expected?: Renderable; actual?: Renderable; message?: string }
    | { type: 'error'; message?: string };

export type LocatedTestResult = {
    type: 'test-result';
    result: TestResult;
    name?: string;
    loc?: string;
};
export type EvaluationResult =
    | LocatedTestResult
    | { type: 'exception'; message: string }
    | { type: 'plain'; data: string; mime?: string }
    // | { type: 'structured', data: any }
    | { type: 'render'; renderable: Renderable }
    // A "stream" can update itself...
    | { type: 'stream'; id: string; contents: EvaluationResult[] }
    | { type: 'input'; id: string; kind: 'int' | 'float' | 'text' | 'cst' | 'boolean' };
// Also want something like render plugins ... so you can pass back structured data ...
// but maybe with a fallback? hmm. So a top could have multiple evaluationResults
// hmm also might want to have like ... streaming updates?
// YEAH ok so if you get multiple updates with the same UpdateID, that means you /append/.
// (hrm I guess you might want to replace?)

type InputValue =
    | { type: 'int' | 'float'; value: number }
    | { type: 'text'; value: string }
    | { type: 'cst'; value: RecNode }
    | { type: 'boolean'; value: boolean };

// export type Update = { updateId: string; moduleId: string; tops: Record<string, EvaluationResult[]> };

export type FailureKind =
    | { type: 'compilation'; message: string }
    | { type: 'dependencies'; deps: { module: string; toplevel: string; name: string; message?: string }[] }
    | { type: 'evaluation'; message: string };

export type ModuleTestResults = { top: string; results: LocatedTestResult[] }[];

export type CompilerEvents = {
    viewSource: { args: { module: string; top: string }; data: { source: string } };
    testResults: { args: { module: string }; data: { results: ModuleTestResults } };
    results: { args: { module: string; top: string }; data: { results: EvaluationResult[] } };
    failure: { args: { module: string; top: string }; data: FailureKind[] };
};

export type CompilerListenersMap = { [K in keyof CompilerEvents]: Record<string, ((data: CompilerEvents[K]['data']) => void)[]> };

export const eventKey = <K extends keyof CompilerEvents>(evt: K, args: CompilerEvents[K]['args']): string => {
    if ('top' in args) {
        return `${args.module} : ${args.top}`;
    }
    return args.module;
};

export interface Compiler<AST, ValidationInfo> {
    loadModule(
        moduleId: string,
        deps: Dependencies,
        asts: Record<string, { kind: ParseKind; ast: AST }>,
        infos: Record<string, ValidationInfo>,
    ): void;
    // results(moduleId: string, top: string): EvaluationResult[] | null;
    // update(
    //     updateId: string,
    //     moduleId: string,
    //     deps: Dependencies,
    //     ast: Record<string, { kind: ParseKind; ast: AST }>,
    //     infos: Record<string, ValidationInfo>,
    // ): void;
    listen<K extends keyof CompilerEvents>(evt: K, args: CompilerEvents[K]['args'], fn: (data: CompilerEvents[K]['data']) => void): () => void;
    input(inputId: string, value: InputValue): void;
}

export type Language<Macro, AST, ValidationInfo> = {
    version: 1;
    parser: Parser<Macro, AST>;
    validate?(moduleId: string, ast: { ast: AST; tid: string }[], infos: ValidationInfo[]): ValidateResult<ValidationInfo>;
    compiler(): Compiler<AST, ValidationInfo>;
    // intern: (ast: AST, info: ValidationInfo) => IR;
    // compile?(ir: IR, deps: Record<string, IR>): Target;
    // eval?(ir: IR, deps: Record<string, any>): any;
};
