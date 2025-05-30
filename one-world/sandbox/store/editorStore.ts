import index from 'isomorphic-git';
import { root } from '../../keyboard/root';
import { Event } from '../../syntaxes/dsl3';
import { Import, Module, ParsedImport, Toplevel } from '../types';
import { collapseComponents, Components } from './dependency-graph';
import { Annotation, Compiler, Language, Meta, ParseKind, ParseResult, ValidateResult } from './language';
import { findSpans, srcKey } from './makeEditor';
import equal from 'fast-deep-equal';
import { genId } from '../../keyboard/ui/genId';

export type EditorState<AST, TypeInfo> = {
    processLog: { [top: string]: string[] };
    parseResults: { [top: string]: ParseResult<AST, ParseKind> };
    importResults: { [top: string]: ParseResult<ParsedImport, null> };
    validatedImports: { [top: string]: ValidateResult<Import | null> };
    // validation, is ~by "head", where if there's a dependency cycle,
    // we choose the (sort()[0]) first one as the 'head'
    validationResults: { [head: string]: ValidateResult<TypeInfo> };
    spans: { [top: string]: Record<string, string[][]> };
    dependencies: Dependencies;
    prevAnnotations: Record<string, Record<string, Annotation[]>>;
};

export type Dependencies = {
    components: Components;
    headDeps: Record<string, string[]>;
    importDeps: Record<string, { module: string; top: string }[]>;
    // top -> deep list of dependent tops, in the right order
    // so we can just go down the list, validating & executing
    // each one, and things will get updated correctly.
    deepDeps: Record<string, string[]>;
    dependents: Record<string, string[]>;
    traversalOrder: string[];
};

export class EditorStore {
    state: Record<string, EditorState<any, any>>;
    modules: Record<string, Module>;
    modulesLog: { [module: string]: string[] };
    languages: Record<string, Language<any, any, any>>;
    compilers: Record<string, Compiler<any, any>>;
    moduleDeps: { forward: { [module: string]: { [top: string]: { module: string; top: string }[] } }; sorted: string[] };

    constructor(modules: Record<string, Module>, languages: Record<string, Language<any, any, any>>) {
        this.state = {};
        this.moduleDeps = { forward: {}, sorted: [] };
        this.modulesLog = {};
        this.modules = modules;
        this.languages = languages;
        this.compilers = {};
        Object.keys(languages).forEach((k) => {
            this.compilers[k] = languages[k].compiler();
        });
        this.initialProcess();
    }

    initialProcess() {
        let language = 'default';

        const moduleGraph: Record<string, string[]> = {};

        const modulesByName: Record<string, string> = {};
        Object.entries(this.modules).forEach(([key, { name }]) => (modulesByName[name] = key));

        const add = <T>(obj: Record<string, T[]>, key: string, value: T) => {
            if (!obj[key]) obj[key] = [value];
            else if (!obj[key].includes(value)) obj[key].push(value);
        };

        // TODO: do a toposort on them
        // TODO: also know what language we're dealing with
        Object.keys(this.modules).forEach((key) => {
            this.state[key] = {
                processLog: {},
                parseResults: {},
                importResults: {},
                validationResults: {},
                validatedImports: {},
                spans: {},
                dependencies: {
                    components: { pointers: {}, entries: {} },
                    importDeps: {},
                    headDeps: {},
                    deepDeps: {},
                    traversalOrder: [],
                    dependents: {},
                },
                prevAnnotations: {},
            };
            moduleGraph[key] = [];

            if (!Array.isArray(this.modules[key].imports)) this.modules[key].imports = [];
            this.modules[key].imports.forEach((id) => {
                const top = this.modules[key].toplevels[id];
                let res;
                try {
                    const rec = root<string>({ top });
                    res = this.languages[language].parser.parseImport(rec);
                    this.state[key].importResults[top.id] = res;
                } catch (err) {
                    debugger;
                    console.log('no dice');
                    console.log(top);
                    return;
                }
                if (res.result) {
                    if (res.result.source.type === 'raw') {
                        const other = modulesByName[res.result.source.text];
                        if (other != null) {
                            add(moduleGraph, key, other);
                        } else {
                            console.log(`cant resolve module by name`, res.result.source.text);
                        }
                    }
                    // console.log('`parse', res);
                    if (res.result.source.type === 'project') {
                        const other = res.result.source.module;
                        if (other != null) {
                            add(moduleGraph, key, other);
                        } else {
                            console.log(`cant resolve module by name`, res.result.source.module);
                        }
                    }
                }
                this.log(key, top.id, `Parsed import ${res.result ? '' : 'un'}successfully`);
            });
        });

        const components = collapseComponents(moduleGraph);
        const uncycled: Record<string, string[]> = {};
        Object.entries(moduleGraph).forEach(([key, deps]) => {
            key = components.pointers[key];
            uncycled[key] = [];
            deps.forEach((dep) => add(uncycled, key, components.pointers[dep]));
        });

        const sorted = toposort(uncycled);
        if (!sorted) {
            throw new Error(`after removing cycles, there were still cycles???`);
        }
        sorted.reverse();

        sorted.forEach((key) => {
            if (components.entries[key].length !== 1) {
                console.error(`Skipping modules with cycle`, components.entries[key]);
                components.entries[key].forEach((mid) => {
                    this.mlog(mid, `Module has cycle! ${components.entries[key].join(', ')}`);
                });
            }

            const macros: any[] = [];
            const imports: { [kind: string]: { [name: string]: { module: string; top: string }[] } } = {};
            this.modules[key].imports.forEach((id) => {
                this.handleImportValidation(key, id);
                getImports(this.state[key].validatedImports[id]?.result, imports);
            });

            this.modules[key].roots.forEach((id) => {
                let top = this.modules[key].toplevels[id];
                if ('top' in top) {
                    debugger;
                    top = top.top as Toplevel;
                }
                try {
                    const rec = root<string>({ top });
                    const pr = this.languages[language].parser.parse(macros, rec);
                    this.state[key].parseResults[top.id] = pr;
                    this.log(key, top.id, `Parsed toplevel ${pr.result ? '' : 'un'}successfully`);
                } catch (err) {
                    this.log(key, top.id, `Error parsing... ${err}`);
                }
            });
            this.state[key].dependencies = calculateDependencyGraph(parseResultsDependencyInput(this.state[key].parseResults, imports));
            this.runValidation(key);
        });

        // NOW: set up forward module dependencies
        this.moduleDeps.sorted = sorted;

        sorted.forEach((key) => {
            this.moduleDeps.forward[key] = {};
            Object.entries(this.state[key].dependencies.importDeps).forEach(([tid, deps]) => {
                deps.forEach(({ module, top }) => {
                    add(this.moduleDeps.forward[module], top, { module: key, top: tid });
                });
            });
        });
        // console.log(`forward deps`, this.moduleDeps);

        sorted.forEach((id) => {
            this.recompile(id);
        });
    }

    recompile(module: string, heads: string[] = this.state[module].dependencies.traversalOrder) {
        if (!heads.length) return;
        this.mlog(module, `recompile ` + heads.join(', '));
        type AST = any;
        type TInfo = any;
        const asts: Record<string, { ast: AST; kind: ParseKind }> = {};
        heads.forEach((hid) => {
            if (this.modules[module].imports.includes(hid)) throw new Error('trying to compile an import');
            this.state[module].dependencies.components.entries[hid].forEach((key) => {
                const parse = this.state[module].parseResults[key];
                if (!parse?.result) {
                    return;
                }
                asts[key] = { ast: parse.result, kind: parse.kind };
            });
        });
        const infos: Record<string, TInfo> = {};
        heads.forEach((key) => {
            const vr = this.state[module].validationResults[key];
            infos[key] = vr?.failed ? undefined : vr?.result;
            const ready = !!infos[key] && this.state[module].dependencies.components.entries[key].every((id) => !!asts[id]);
            this.log(module, key, ready ? `ready to compile` : `not ready to compile`);
        });
        try {
            this.compilers[this.modules[module].languageConfiguration].loadModule(module, this.state[module].dependencies, asts, infos);
        } catch (err) {
            console.log(err);
        }
    }

    updateModules(mod: string, ids: string[], changed: Record<string, true>, changedKeys: Record<string, true>) {
        this.mlog(mod, `updateModules, toplevels: ` + ids.join(', '));
        // Toplevels to update within each module
        const thingsToUpdate: { [module: string]: string[] } = {};
        thingsToUpdate[mod] = ids;

        this.moduleDeps.sorted.forEach((mid) => {
            if (!thingsToUpdate[mid]) return; // fine
            // do the module level update, it's fine
            const updatedHeads = this.updateTops(mid, thingsToUpdate[mid], changed, changedKeys);
            this.recompile(mid, updatedHeads);
            updatedHeads.forEach((head) => {
                this.state[mid].dependencies.components.entries[head].forEach((head) => {
                    this.moduleDeps.forward[mid]?.[head]?.forEach((child) => {
                        if (!thingsToUpdate[child.module]) thingsToUpdate[child.module] = [];
                        thingsToUpdate[child.module].push(child.top);
                    });
                });
            });
        });
    }

    updateTops(mod: string, ids: string[], changed: Record<string, true>, changedKeys: Record<string, true>): string[] {
        const lang = this.languages[this.modules[mod].languageConfiguration];
        const module = this.modules[mod];

        const imports: { [kind: string]: { [name: string]: { module: string; top: string }[] } } = {};

        const modulesByName: Record<string, string> = {};
        Object.entries(this.modules).forEach(([key, { name }]) => (modulesByName[name] = key));

        module.imports.forEach((id) => {
            if (ids.includes(id)) {
                const result = lang.parser.parseImport(root({ top: module.toplevels[id] }));

                Object.entries(result.ctx.meta).forEach(([loc, value]) => {
                    if (!equal(value, this.state[mod].importResults[id]?.ctx.meta[loc])) {
                        changed[loc] = true;
                    }
                });

                this.state[mod].importResults[id] = result;
                this.handleImportValidation(mod, id, changedKeys);
            }
            getImports(this.state[mod].validatedImports[id]?.result, imports);
        });

        ids.forEach((id) => {
            if (module.imports.includes(id)) {
                return;
            }

            const result = lang.parser.parse([], root({ top: module.toplevels[id] }));

            Object.entries(result.ctx.meta).forEach(([loc, value]) => {
                if (!equal(value, this.state[mod].parseResults[id]?.ctx.meta[loc])) {
                    changed[loc] = true;
                }
            });

            this.state[mod].parseResults[id] = result;
        });

        // TODO: do some caching so we don't recalc this on every update.
        const newDeps = calculateDependencyGraph(parseResultsDependencyInput(this.state[mod].parseResults, imports));
        const otherNotified: string[] = [];
        // If we /leave/ a mutually recursive group, we need to notify the ones that were left
        ids.forEach((id) => {
            const prevhid = this.state[mod].dependencies.components.pointers[id];
            const nowhid = newDeps.components.pointers[id];
            if (prevhid !== nowhid) {
                otherNotified.push(...(this.state[mod].dependencies.components.entries[prevhid] ?? []));
            }
        });
        // console.log('other notified', ids, otherNotified);
        this.state[mod].dependencies = newDeps;
        return this.runValidation(mod, ids.concat(otherNotified), changedKeys);
    }

    mlog(mod: string, message: string) {
        if (!this.modulesLog[mod]) {
            this.modulesLog[mod] = [message];
        } else {
            this.modulesLog[mod].push(message);
        }
    }

    log(mod: string, top: string, message: string) {
        if (!this.state[mod].processLog[top]) {
            this.state[mod].processLog[top] = [message];
        } else {
            this.state[mod].processLog[top].push(message);
        }
    }

    validateImport(mod: string, top: string, imp: ParsedImport): ValidateResult<Import | null> {
        const modulesByName: Record<string, string> = {};
        Object.entries(this.modules).forEach(([key, { name }]) => (modulesByName[name] = key));

        const annotations: Record<string, Annotation[]> = {};
        const meta: Record<string, Meta> = {};
        let result = null as null | Import;

        const add = (annotation: Annotation) => {
            const key = srcKey(annotation.src);
            if (!annotations[key]) annotations[key] = [annotation];
            else annotations[key].push(annotation);
        };

        if (imp.source.type === 'raw') {
            const other = modulesByName[imp.source.text];
            if (other != null) {
                result = { type: 'import', items: [], macros: [], plugins: [], source: { type: 'project', module: other, src: imp.source.src } };
            } else {
                add({ type: 'error', src: imp.source.src, message: ['Unknonwn module named "', imp.source.text, '"'] });
            }
        }

        let failed = result == null;

        if (result != null) {
            if (result.source.type === 'project') {
                const other = result.source.module;
                const state = this.state[other];
                // TODO: handle access control
                const avail = moduleDeclarations(state.parseResults);
                imp.macros.forEach(({ name, loc }) => {
                    add({ type: 'error', src: { left: loc, type: 'src', id: genId() }, message: ['no macros yet'] });
                });
                imp.plugins.forEach(({ name, loc }) => {
                    add({ type: 'error', src: { left: loc, type: 'src', id: genId() }, message: ['no plugins yet'] });
                });
                imp.items.forEach((item) => {
                    if (item.kind) {
                        const got = avail[item.kind]?.[item.name];
                        if (got != null) {
                            result.items.push({ ...item, kind: item.kind!, id: got });
                        } else {
                            add({
                                type: 'error',
                                src: { left: item.loc, id: genId(), type: 'src' },
                                message: [`no export of kind "${item.kind}" named "${item.name}"`],
                            });
                        }
                    } else {
                        let found = false;
                        Object.keys(avail).forEach((kind) => {
                            const got = avail[kind]?.[item.name];
                            if (got != null) {
                                result.items.push({ ...item, kind, id: got });
                                found = true;
                            }
                        });
                        if (!found) {
                            add({ type: 'error', src: { left: item.loc, id: genId(), type: 'src' }, message: [`no export named "${item.name}"`] });
                        }
                    }
                });
            }
        }

        return {
            result,
            annotations: { [top]: annotations },
            failed,
            meta,
        };
    }

    handleImportValidation(mod: string, id: string, changedKeys?: Record<string, true>) {
        const imp = this.state[mod].importResults[id];
        if (!imp.result) return;
        this.state[mod].validatedImports[id] = this.validateImport(mod, id, imp.result);

        if (changedKeys) {
            Object.entries(this.state[mod].validatedImports[id].annotations[id] ?? {}).forEach(([k, ann]) => {
                if (!equal(ann, this.state[mod].prevAnnotations[id]?.[k])) {
                    changedKeys[k] = true;
                }
            });

            Object.keys(this.state[mod].prevAnnotations[id] ?? {}).forEach((k) => {
                if (!this.state[mod].validatedImports[id].annotations[id]?.[k]) {
                    changedKeys[k] = true;
                }
            });
        }
        this.state[mod].prevAnnotations[id] = this.state[mod].validatedImports[id].annotations[id];
    }

    runValidation(mod: string, changedTops?: string[], changedKeys?: Record<string, true>): string[] {
        this.mlog(mod, `running validation for ${changedTops?.join(', ') ?? 'all'}`);
        const lang = this.languages[this.modules[mod].languageConfiguration];
        const module = this.modules[mod];

        if (!lang.validate) return [];
        let onlyUpdate = null as null | string[];
        if (changedTops) {
            onlyUpdate = [];
            changedTops.forEach((id) => {
                if (module.imports.includes(id)) return;
                const hid = this.state[mod].dependencies.components.pointers[id];
                if (!onlyUpdate!.includes(hid)) onlyUpdate!.push(hid);
            });
        }
        // Ok, so.
        for (let id of this.state[mod].dependencies.traversalOrder) {
            if (onlyUpdate) {
                if (!onlyUpdate.includes(id)) continue;
            }
            const entries = this.state[mod].dependencies.components.entries[id];
            this.log(mod, id, entries.length > 1 ? `validate head ${id} of group ${entries.join(', ')}` : `validate singleton ${id}`);
            let skip = false;
            let parseResults: { tid: string; ast: any }[] = [];
            for (let cid of entries) {
                if (!this.state[mod].parseResults[cid]) {
                    // This should be ... smoother.
                    throw new Error(`something didnt get parsed: ${cid}`);
                }
                const { result } = this.state[mod].parseResults[cid];
                if (!result) {
                    skip = true;
                    break;
                    // This should be ... smoother.
                    // throw new Error(`parse error for ${cid}`);
                }
                if (!Array.isArray(module.imports)) module.imports = [];
                if (module.imports.includes(cid)) {
                    // Imports are skipped for validation
                    continue;
                }
                parseResults.push({ tid: cid, ast: result });
            }
            if (skip) {
                this.log(mod, id, `skipping validation because of parse error`);
                continue;
            }
            for (let did of this.state[mod].dependencies.headDeps[id]) {
                if (!this.state[mod].validationResults[did]) {
                    this.log(mod, id, `wrong evaluation order: ${did} should be ready before ${id}`);
                    throw new Error(`wrong evaluation order: ${did} should be ready before ${id}`);
                }
            }

            this.log(mod, id, `local dependencies: ` + this.state[mod].dependencies.headDeps[id].join(', '));

            const localDeps = this.state[mod].dependencies.headDeps[id].map((did) => this.state[mod].validationResults[did].result);
            const projectDeps = this.state[mod].dependencies.importDeps[id]
                .map(({ module, top }) => this.state[module]?.validationResults[top]?.result)
                .filter(Boolean);

            const vr = lang.validate(module.id, parseResults, projectDeps.concat(localDeps));
            this.state[mod].validationResults[id] = vr;
            this.log(mod, id, vr.failed ? `validation failed` : `validation complete.`);

            // NEED a way, if a previous thing fails,
            // to indicate that a value exists but has type errors
            for (let cid of this.state[mod].dependencies.components.entries[id]) {
                if (changedKeys) {
                    // console.log(`annotations for`, cid, results[id].annotations[cid], this.prevAnnotations[cid]);
                    Object.entries(this.state[mod].validationResults[id].annotations[cid] ?? {}).forEach(([k, ann]) => {
                        if (!equal(ann, this.state[mod].prevAnnotations[cid]?.[k])) {
                            changedKeys[k] = true;
                        }
                    });

                    Object.keys(this.state[mod].prevAnnotations[cid] ?? {}).forEach((k) => {
                        if (!this.state[mod].validationResults[id].annotations[cid]?.[k]) {
                            changedKeys[k] = true;
                        }
                    });
                }

                this.state[mod].prevAnnotations[cid] = this.state[mod].validationResults[id].annotations[cid];

                // this.state.irResults[cid] = this.language.intern(this.state.parseResults[cid].result!, results[id].result);
            }

            for (let cid of this.state[mod].dependencies.components.entries[id]) {
                const prev = this.state[mod].spans[cid];
                if (module.toplevels[cid]) {
                    this.state[mod].spans[cid] = this.calculateSpans(cid, module.toplevels[cid], this.state[mod].validationResults[id]);
                    if (changedKeys) {
                        Object.entries(this.state[mod].spans[cid]).forEach(([loc, spans]) => {
                            if (!prev) changedKeys[loc] = true;
                            else if (!equal(spans, prev[loc])) {
                                changedKeys[loc] = true;
                            }
                        });
                    }
                }
            }

            // TODO: here's where we would determine whether the `results[id]` had meaningfully changed
            // from the previous one, and only then would we add dependencies to the onlyUpdate list.
            if (onlyUpdate) {
                onlyUpdate.push(...(this.state[mod].dependencies.dependents[id]?.filter((id) => !onlyUpdate.includes(id)) ?? []));
            }
        }

        return onlyUpdate ?? this.state[mod].dependencies.traversalOrder;
    }

    calculateSpans(tid: string, top: Toplevel, validation: ValidateResult<any>) {
        const spans: Record<string, string[][]> = {};
        const simpleSpans = findSpans(Object.values(validation.annotations[tid] ?? {}).flatMap((a) => a.map((a) => a.src)));
        Object.entries(top.nodes).forEach(([key, node]) => {
            if (node.type === 'list') {
                spans[key] = node.children.map((child) => {
                    if (!simpleSpans[child]) return [];
                    return simpleSpans[child]
                        .map((id) => ({ id, idx: node.children.indexOf(id) }))
                        .sort((a, b) => b.idx - a.idx)
                        .map((s) => s.id);
                });
            }
        });
        return spans;
    }
}

const moduleDeclarations = (parseResults: Record<string, ParseResult<unknown, ParseKind>>) => {
    const available: { [kind: string]: { [name: string]: string[] } } = {};
    Object.entries(parseResults).forEach(([tid, results]) => {
        if (results.kind.type === 'definition') {
            results.kind.provides.forEach((item) => {
                if (!Object.hasOwn(available, item.kind)) available[item.kind] = {};
                if (!Object.hasOwn(available[item.kind], item.name)) available[item.kind][item.name] = [];
                available[item.kind][item.name].push(tid);
            });
        }
    });

    return available;
};

function parseResultsDependencyInput(
    parseResults: Record<string, ParseResult<unknown, ParseKind>>,
    imports: { [kind: string]: { [name: string]: { module: string; top: string }[] } },
) {
    const available = moduleDeclarations(parseResults);

    // NOTE: ignore external dependencies for the moment...
    // as they don't factor into dependency graph generation.
    // console.log(`names available for offer`, available);

    // NOTE: in some future time, exact dependencies ... may be only resolvable at inference time.
    // which means we'll have some spurious dependencies, but that's fine. you depend on everything that matches.
    const dependencies: Record<string, string[]> = {};
    const importDeps: Record<string, { module: string; top: string }[]> = {};
    Object.entries(parseResults).forEach(([tid, results]) => {
        if (!dependencies[tid]) dependencies[tid] = [];
        if (!importDeps[tid]) importDeps[tid] = [];
        results.externalReferences.forEach((ref) => {
            const sources = available[ref.kind]?.[ref.name] ?? [];
            for (let other of sources) {
                if (!dependencies[tid].includes(other)) {
                    // console.log(`found a source for ${ref.kind}:${ref.name}`, other);
                    dependencies[tid].push(other);
                }
            }
            const outside = imports[ref.kind]?.[ref.name] ?? [];
            for (let other of outside) {
                importDeps[tid].push(other);
            }
        });
    });

    return { dependencies, importDeps };
}

function calculateDependencyGraph({
    dependencies,
    importDeps,
}: {
    importDeps: Record<string, { module: string; top: string }[]>;
    dependencies: Record<string, string[]>;
}): Dependencies {
    // ok now we have a graph, I do believe
    const components = collapseComponents(dependencies);

    const headDeps: Record<string, string[]> = {};

    Object.entries(dependencies).forEach(([tid, deps]) => {
        const head = components.pointers[tid];
        if (!headDeps[head]) headDeps[head] = [];
        deps.forEach((dep) => {
            const tail = components.pointers[dep];
            if (tail !== head && !headDeps[head].includes(tail)) {
                headDeps[head].push(tail);
            }
        });
    });

    // OK: headDeps now has the collapsed dependencies, with components represented by their heads

    const deep: Record<string, string[]> = {};

    const deepify = (id: string, parentDeps: string[][]) => {
        parentDeps.forEach((deps) => (deps.includes(id) ? null : deps.push(id)));
        if (!deep[id]) deep[id] = headDeps[id].slice();
        const next = parentDeps.concat([deep[id]]);
        headDeps[id].forEach((child) => (child !== id ? deepify(child, next) : null));
    };

    // This is quite wasteful. It would be enough to just
    // go through the heads that aren't a dependency of anything.
    Object.keys(headDeps).forEach((head) => deepify(head, []));

    const fullSort = toposort(headDeps);
    if (!fullSort) throw new Error(`cycle in headDeps! Should not happen`);
    fullSort.reverse();
    const sortHeads = (one: string, two: string) => fullSort.indexOf(one) - fullSort.indexOf(two);

    Object.keys(deep).forEach((k) => {
        deep[k].sort(sortHeads);
    });

    const dependents: Record<string, string[]> = {};
    Object.entries(headDeps).forEach(([hid, deps]) => {
        deps.forEach((did) => {
            if (!dependents[did]) dependents[did] = [hid];
            else dependents[did].push(hid);
        });
    });

    return { components, headDeps, deepDeps: deep, traversalOrder: fullSort, dependents, importDeps };
}

const toposort = (dependencies: Record<string, string[]>) => {
    const inDegree: Record<string, number> = {};
    Object.entries(dependencies).forEach(([key, deps]) => {
        deps.forEach((v) => {
            if (v === key) return; // ignore self-references
            if (!inDegree[v]) inDegree[v] = 0;
            inDegree[v] += 1;
        });
        if (!inDegree[key]) inDegree[key] = 0;
    });

    const queue = Object.keys(inDegree).filter((k) => inDegree[k] === 0);
    const sorted: string[] = [];

    while (queue.length) {
        const next = queue.pop()!;
        sorted.push(next);
        for (let neighbor of dependencies[next]) {
            if (neighbor === next) continue;
            inDegree[neighbor]--;
            if (inDegree[neighbor] === 0) {
                queue.push(neighbor);
            }
        }
    }

    // There was a cycle! Unable to sort
    if (Object.keys(dependencies).length !== sorted.length) {
        return null;
    }

    return sorted;
};

const add = <T>(obj: Record<string, T[]>, key: string, value: T) => {
    if (!obj[key]) obj[key] = [value];
    else if (!obj[key].includes(value)) obj[key].push(value);
};

const getImports = (imp: Import | null, imports: { [kind: string]: { [name: string]: { module: string; top: string }[] } }) => {
    if (!imp) return;
    if (imp.source.type === 'project') {
        const mod = imp.source.module;
        imp.items.forEach((item) => {
            if (!imports[item.kind]) imports[item.kind] = {};
            item.id.forEach((id) => {
                add(imports[item.kind], item.name, { module: mod, top: id });
            });
        });
    }
};
