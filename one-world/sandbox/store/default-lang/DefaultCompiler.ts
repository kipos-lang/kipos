import { RecNode } from '../../../shared/cnodes';
import { Stmt } from '../../../syntaxes/algw-s2-types';
import { Dependencies } from '../editorStore';
import { CompilerEvents, EvaluationResult, Compiler, CompilerListenersMap, ParseKind, eventKey, FailureKind } from '../language';
import { TInfo } from './default-lang';
import { Resolutions, stmtToString, toString } from './to-string';

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
export class DefaultCompiler implements Compiler<Stmt, TInfo> {
    listeners: CompilerListenersMap = { results: {}, viewSource: {}, failure: {} };
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
    results(moduleId: string, top: string): EvaluationResult[] | null {
        const res = this._results[moduleId]?.[top];
        if (res?.type === 'evaluate') {
            return res.result;
        }
        return null;
    }
    logFailure(module: string, top: string, kind: FailureKind) {
        if (!this._failures[module]) this._failures[module] = {};
        this._failures[module][top] = kind;
        this.emit('failure', { module, top }, kind);
    }
    loadModule(module: string, deps: Dependencies, asts: Record<string, { kind: ParseKind; ast: Stmt }>, infos: Record<string, TInfo>): void {
        if (!this.code[module]) this.code[module] = {};
        if (!this._results[module]) this._results[module] = {};
        deps.traversalOrder.forEach((hid) => {
            if (!asts[hid] || !infos[hid]) return; // skipping Iguess

            // TODO: ... if names are duplicated ... do something about that
            const components = deps.components.entries[hid];
            components.forEach((top) => {
                const deps: Record<string, any> = {};
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
                            missingDeps.push({ ...source, message: `doesn't export ${source.name} at ${source.src.left}` });
                            return;
                        }
                        const key = `${source.module}.${source.toplevel}.${source.src.left}`;
                        deps[key] = top.scope[source.src.left];
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

                const code = stmtToString(asts[top].ast, fixedSources, true);
                const source = toString(code);
                this.code[module][top] = source;
                this.emit('viewSource', { module, top }, { source });

                if (missingDeps.length) {
                    this.logFailure(module, top, { type: 'dependencies', deps: missingDeps });
                    return; // skip it
                }

                if (asts[top].kind.type === 'evaluation') {
                    const result = evaluate(source, deps, names);
                    this._results[module][top] = { type: 'evaluate', result };
                    this.emit('results', { module, top }, { results: result });
                } else if (asts[top].kind.type === 'definition') {
                    try {
                        const rawscope = define(
                            source,
                            asts[top].kind.provides.filter((p) => p.kind === 'value').map((p) => p.name),
                            deps,
                            names,
                        );
                        const scope: Record<string, any> = {};
                        asts[top].kind.provides
                            .filter((p) => p.kind === 'value')
                            .forEach((p) => {
                                scope[p.loc] = rawscope[p.name];
                            });

                        this._results[module][top] = { type: 'definition', scope };
                    } catch (err) {
                        // console.error('bad news bears', err);
                        this.logFailure(module, top, { type: 'evaluation', message: (err as Error).message });
                    }
                }
            });
        });
    }

    listen<K extends keyof CompilerEvents>(evt: K, args: CompilerEvents[K]['args'], fn: (data: CompilerEvents[K]['data']) => void): () => void {
        const key = eventKey(evt, args);
        // console.log(`listen ${evt} : ${key}`);
        switch (evt) {
            case 'failure': {
                const failure = this._failures[args.module]?.[args.top];
                if (failure) {
                    fn(failure);
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
