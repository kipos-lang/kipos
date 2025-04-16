import equal from 'fast-deep-equal';
import { RecNode } from '../../../shared/cnodes';
import { Stmt, TopItem } from '../../../syntaxes/algw-s2-types';
import { Dependencies } from '../editorStore';
import {
    CompilerEvents,
    EvaluationResult,
    Compiler,
    CompilerListenersMap,
    ParseKind,
    eventKey,
    FailureKind,
    Meta,
    Renderable,
    ModuleTestResults,
} from '../language';
import { TInfo } from './default-lang';
import { Resolutions, stmtToString, testToString, toString } from './to-string';
import { id, list, text } from '../../../keyboard/test-utils';

const addFn = <K extends keyof CompilerEvents>(
    key: string,
    record: Record<string, ((data: CompilerEvents[K]['data']) => void)[]>,
    fn: (data: CompilerEvents[K]['data']) => void,
) => {
    if (!record[key]) {
        record[key] = [fn];
    } else {
        record[key].push(fn);
    }
    return () => {
        const at = record[key].indexOf(fn);
        if (at !== -1) {
            record[key].splice(at, 1);
        }
    };
};
/*

I have code for a top

in order to evaluate it, ...
OK FOLKS I'm just gonna cache stuff,
and mutability be darned.




*/

const anyToRenderable = (value: any): Renderable | undefined => {
    const meta: Record<string, Meta> = {};
    let id = 0;
    const node = anyToCST(value, meta, () => id++ + '');
    if (!node) return;
    return { node, meta };
};

const anyToCST = (value: any, meta: Record<string, Meta>, nextLoc: () => string): RecNode | undefined => {
    if (value === null) return;
    if (typeof value === 'number') {
        const l = nextLoc();
        meta[l] = { kind: 'number' };
        return id(value.toString(), l);
    }
    if (typeof value === 'string') {
        return text([{ type: 'text', loc: nextLoc(), text: value }], nextLoc());
    }
    if (Array.isArray(value)) {
        return list('square')(
            value.map((v) => anyToCST(v, meta, nextLoc) ?? id('unserializable', nextLoc())),
            nextLoc(),
        );
    }
    return;
};

const test = (source: string, deps: Record<string, any>, names: Record<string, string>): EvaluationResult[] => {
    const f = new Function(
        'deps',
        '$$check',
        Object.entries(names)
            .map(([name, key]) => `const $${name} = deps['${key}'];\n`)
            .join('') + `\n\n${source}`,
    );
    const results: EvaluationResult[] = [];
    try {
        f(deps, (name: string, target: null | Function, finput: () => any, foutput: () => any, outloc: string) => {
            let input, output;
            try {
                input = finput();
                if (target) {
                    input = target(input);
                }
            } catch (err) {
                results.push({ type: 'test-result', result: { type: 'error', message: `input: ${err}` }, name, loc: outloc });
                return;
            }
            try {
                output = foutput();
            } catch (err) {
                results.push({ type: 'test-result', result: { type: 'error', message: `output: ${err}` }, name, loc: outloc });
                return;
            }
            // TODO: want to be able to exception guard the input
            if (equal(input, output)) {
                results.push({ type: 'test-result', result: { type: 'pass' }, name, loc: outloc });
            } else {
                results.push({
                    type: 'test-result',
                    result: { type: 'mismatch', actual: anyToRenderable(input), expected: anyToRenderable(output) },
                    name,
                    loc: outloc,
                });
            }
        });
    } catch (err) {
        results.push({ type: 'exception', message: (err as Error).message });
    }
    return results;
};

const evaluate = (source: string, deps: Record<string, any>, names: Record<string, string>): EvaluationResult[] => {
    const f = new Function(
        'deps',
        Object.entries(names)
            .map(([name, key]) => `const $${name} = deps['${key}'];\n`)
            .join('') + `\n\n${source}`,
    );
    try {
        const value = f(deps);
        try {
            if (typeof value === 'string') {
                return [{ type: 'plain', data: value }];
            }
            return [{ type: 'plain', data: JSON.stringify(value) ?? 'undefined' }];
        } catch (err) {
            return [{ type: 'plain', data: `Result cant be stringified: ${value}` }];
        }
    } catch (err) {
        return [{ type: 'exception', message: (err as Error).message }];
    }
};

const define = (source: string, provides: string[], deps: Record<string, any>, names: Record<string, string>) => {
    const f = new Function(
        'deps',
        Object.entries(names)
            .map(([name, key]) => `const $${name} = deps['${key}'];\n`)
            .join('') + `\n\n${source}\n\nreturn {${provides.join(', ')}}`,
    );
    return f(deps);
};

// this... seems like something that could be abstracted.
// like, "a normal compiler"
export class DefaultCompiler implements Compiler<TopItem, TInfo> {
    listeners: CompilerListenersMap = { results: {}, viewSource: {}, failure: {}, testResults: {} };
    code: { [module: string]: { [top: string]: string } } = {};
    _failures: { [module: string]: { [top: string]: FailureKind } } = {};
    _results: {
        [module: string]: {
            [top: string]:
                | {
                      type: 'definition';
                      scope: Record<string, any>;
                  }
                // TODO: type: 'test'
                | { type: 'evaluate'; result: EvaluationResult[] };
        };
    } = {};
    constructor() {}
    testResults(moduleId: string): ModuleTestResults {
        const results: ModuleTestResults = [];
        Object.entries(this._results[moduleId] ?? {}).forEach(([top, tres]) => {
            if (tres.type === 'evaluate') {
                const matchined = tres.result.filter((res) => res.type === 'test-result');
                if (matchined.length) {
                    results.push({ top, results: matchined });
                }
            }
        });
        return results;
    }
    results(moduleId: string, top: string): EvaluationResult[] | null {
        const res = this._results[moduleId]?.[top];
        if (res?.type === 'evaluate') {
            return res.result;
        }
        return null;
    }
    logFailure(module: string, top: string, kind: FailureKind | null) {
        if (!this._failures[module]) this._failures[module] = {};
        if (!kind) {
            delete this._failures[module][top];
            this.emit('failure', { module, top }, []);
        } else {
            this._failures[module][top] = kind;
            console.log('FAILURE', module, top, kind);
            this.emit('failure', { module, top }, [kind]);
        }
    }
    loadModule(module: string, deps: Dependencies, asts: Record<string, { kind: ParseKind; ast: TopItem }>, infos: Record<string, TInfo>): void {
        // console.warn(`loading module ${module}`);
        if (!this.code[module]) this.code[module] = {};
        if (!this._results[module]) this._results[module] = {};
        deps.traversalOrder.forEach((hid) => {
            if (!asts[hid] || !infos[hid]) return; // skipping Iguess

            const depValues: Record<string, any> = {};
            const names: Record<string, string> = {};
            if (!infos[hid]) throw new Error(`type infos not provided for ${hid}`);
            const fixedSources: Resolutions = { ...infos[hid].resolutions };

            let missingDeps: { module: string; toplevel: string; message?: string }[] = [];

            Object.entries(infos[hid].resolutions).forEach(([rkey, source]) => {
                if (source.type === 'toplevel') {
                    const top = this._results[source.module][source.toplevel];
                    if (!top) {
                        missingDeps.push({ ...source, message: `no result` });
                        return;
                    }
                    if (top.type !== 'definition') {
                        missingDeps.push({ ...source, message: `not a definition` });
                        return;
                    }
                    if (!(source.src.left in top.scope)) {
                        console.log(source, top.scope);
                        missingDeps.push({ ...source, message: `doesn't export ${source.name} at ${source.src.left}` });
                        return;
                    }
                    const key = `${source.module}.${source.toplevel}.${source.src.left}`;
                    depValues[key] = top.scope[source.src.left];
                    if (!names[source.name] || names[source.name] === key) {
                        names[source.name] = key;
                        fixedSources[rkey] = { ...source, name: '$' + source.name };
                        return;
                    } else {
                        let i = 2;
                        for (; i < 100; i++) {
                            const name = `${source.name}${i}`;
                            if (!names[name] || names[name] === key) {
                                names[name] = key;
                                fixedSources[rkey] = { ...source, name: '$' + name };
                                return;
                            }
                        }
                        throw new Error(`do you really have 100 dependencies all named ${source.name}???`);
                    }
                }
            });

            // TODO: ... if names are duplicated ... do something about that
            const components = deps.components.entries[hid];

            if (components.length > 1 || asts[components[0]].kind.type === 'definition') {
                const codes = components.map((top) => {
                    const code = stmtToString((asts[top].ast as TopItem & { type: 'stmt' }).stmt, fixedSources, true);
                    const source = toString(code);
                    this.code[module][top] = source;
                    this.emit('viewSource', { module, top }, { source });
                    return source;
                });
                const provides = components.flatMap((top) =>
                    (asts[top].kind as ParseKind & { type: 'definition' }).provides.filter((p) => p.kind === 'value'),
                );

                try {
                    const rawscope = define(
                        codes.join('\n\n'),
                        provides.map((p) => p.name),
                        depValues,
                        names,
                    );
                    components.forEach((top) => {
                        const scope: Record<string, any> = {};
                        (asts[top].kind as ParseKind & { type: 'definition' }).provides
                            .filter((p) => p.kind === 'value')
                            .forEach((p) => {
                                scope[p.loc] = rawscope[p.name];
                            });

                        this._results[module][top] = { type: 'definition', scope };
                        this.logFailure(module, top, null);
                    });
                } catch (err) {
                    // console.error('bad news bears', err);
                    components.forEach((top) => {
                        this.logFailure(module, top, { type: 'evaluation', message: (err as Error).message });
                    });
                }
            } else {
                const top = components[0];
                const single = asts[top].ast;
                if (single.type === 'stmt') {
                    const code = stmtToString(single.stmt, fixedSources, true);
                    const source = toString(code);
                    this.code[module][top] = source;
                    this.emit('viewSource', { module, top }, { source });

                    if (missingDeps.length) {
                        this.logFailure(module, top, { type: 'dependencies', deps: missingDeps });
                        return; // skip it
                    }

                    if (asts[top].kind.type === 'evaluation') {
                        const result = evaluate(source, depValues, names);
                        this._results[module][top] = { type: 'evaluate', result };
                        this.emit('results', { module, top }, { results: result });
                        if (result.some((r) => r.type === 'test-result')) {
                            this.emit('testResults', { module }, { results: this.testResults(module) });
                        }
                        this.logFailure(module, top, null);
                    } else if (asts[top].kind.type === 'definition') {
                        throw new Error(`unreachable`);
                    }
                } else if (single.type === 'test') {
                    const code = testToString(single, fixedSources);
                    const source = toString(code);
                    this.code[module][top] = source;
                    this.emit('viewSource', { module, top }, { source });

                    if (missingDeps.length) {
                        this.logFailure(module, top, { type: 'dependencies', deps: missingDeps });
                        return; // skip it
                    }

                    if (asts[top].kind.type === 'test') {
                        // could we ... use the type information...
                        // from these things, to know how to serialize them?
                        // or to know whether they are serializeable?
                        // Seems like that would be totally doable.
                        const result = test(source, depValues, names);
                        // infos[top].resolutions
                        this._results[module][top] = { type: 'evaluate', result };
                        this.emit('results', { module, top }, { results: result });
                        if (result.some((r) => r.type === 'test-result')) {
                            this.emit('testResults', { module }, { results: this.testResults(module) });
                        }
                        this.logFailure(module, top, null);
                    }
                } else {
                    throw new Error(`cant evaluate ${single.type}`);
                }
            }
        });
    }

    listen<K extends keyof CompilerEvents>(evt: K, args: CompilerEvents[K]['args'], fn: (data: CompilerEvents[K]['data']) => void): () => void {
        const key = eventKey(evt, args);
        if (!('top' in args)) {
            const got = this.testResults(args.module);
            if (got.length) {
                fn({ results: got as any });
            }
            return addFn(args.module, this.listeners[evt], fn);
        }
        switch (evt) {
            case 'failure': {
                const failure = this._failures[args.module]?.[args.top];
                if (failure) {
                    fn([failure]);
                }
                break;
            }
            case 'results': {
                const results = this.results(args.module, args.top);
                if (results) {
                    fn({ results });
                }
                break;
            }
            case 'viewSource': {
                if (this.code[args.module][args.top]) {
                    fn({ source: this.code[args.module][args.top] });
                }
                break;
            }
        }
        return addFn(key, this.listeners[evt], fn);
    }
    has<K extends keyof CompilerEvents>(evt: K, args: CompilerEvents[K]['args']) {
        return this.listeners[evt][eventKey(evt, args)]?.length;
    }
    emit<K extends keyof CompilerEvents>(evt: K, args: CompilerEvents[K]['args'], data: CompilerEvents[K]['data']) {
        const key = eventKey(evt, args);
        // if (!this.listeners[evt][key]) console.warn(`no listeners for ${evt} : ${key}`);
        this.listeners[evt][key]?.forEach((fn) => fn(data));
    }
    input(
        inputId: string,
        value:
            | { type: 'int' | 'float'; value: number }
            | { type: 'text'; value: string }
            | { type: 'cst'; value: RecNode }
            | { type: 'boolean'; value: boolean },
    ): void {
        //
    }
}
