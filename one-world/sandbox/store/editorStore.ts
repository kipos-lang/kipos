import index from 'isomorphic-git';
import { root } from '../../keyboard/root';
import { Event } from '../../syntaxes/dsl3';
import { Module, Toplevel } from '../types';
import { collapseComponents, Components } from './dependency-graph';
import { Annotation, Compiler, Language, ParseResult, ValidateResult } from './language';
import { findSpans } from './makeEditor';
import equal from 'fast-deep-equal';

export type EditorState<AST, TypeInfo> = {
    parseResults: { [top: string]: ParseResult<AST> };
    // validation, is ~by "top", where if there's a dependency cycle,
    // we choose the (sort()[0]) first one as the 'head'
    validationResults: { [top: string]: ValidateResult<TypeInfo> };
    spans: { [top: string]: Record<string, string[][]> };
    // top -> deep list of dependent tops, in the right order
    // so we can just go down the list, validating & executing
    // each one, and things will get updated correctly.
    // deepDependencies: Record<string, string[]>;
    dependencies: Dependencies;
};

export type Dependencies = {
    components: Components;
    headDeps: Record<string, string[]>;
    deepDeps: Record<string, string[]>;
    dependents: Record<string, string[]>;
    traversalOrder: string[];
};

export class EditorStore<AST, TypeInfo> {
    state: EditorState<AST, TypeInfo>;
    module: Module;
    language: Language<any, AST, TypeInfo>;
    prevAnnotations: Record<string, Record<string, Annotation[]>> = {};
    compiler: Compiler<AST, TypeInfo>;

    constructor(module: Module, language: Language<any, AST, TypeInfo>) {
        this.state = {
            parseResults: {},
            validationResults: {},
            spans: {},
            dependencies: {
                components: { pointers: {}, entries: {} },
                headDeps: {},
                deepDeps: {},
                traversalOrder: [],
                dependents: {},
            },
        };
        this.module = module;
        this.language = language;
        this.compiler = language.compiler();
        this.initialProcess();
    }

    initialProcess() {
        Object.values(this.module.toplevels).forEach((top) => {
            this.state.parseResults[top.id] = this.language.parser.parse([], root({ top }));
        });
        this.state.dependencies = this.calculateDependencyGraph(this.state.parseResults);
        this.runValidation(this.state.dependencies, this.state.validationResults);
        const asts: Record<string, AST> = {};
        Object.entries(this.state.parseResults).forEach(([key, parse]) => {
            if (!parse.result) return;
            asts[key] = parse.result;
        });
        const infos: Record<string, TypeInfo> = {};
        Object.entries(this.state.validationResults).forEach(([key, result]) => {
            infos[key] = result.result;
        });
        this.compiler.loadModule(this.module.id, this.state.dependencies, asts, infos);
    }

    updateTops(ids: string[], changed: Record<string, true>, changedKeys: Record<string, true>) {
        // const depsChanged = []

        ids.forEach((id) => {
            const result = this.language.parser.parse([], root({ top: this.module.toplevels[id] }));

            Object.entries(result.ctx.meta).forEach(([loc, value]) => {
                if (!equal(value, this.state.parseResults[id]?.ctx.meta[loc])) {
                    changed[loc] = true;
                }
            });

            this.state.parseResults[id] = result;
        });

        // TODO: do some caching so we don't recalc this on every update.
        const newDeps = this.calculateDependencyGraph(this.state.parseResults);
        const otherNotified: string[] = [];
        // If we /leave/ a mutually recursive group, we need to notify the ones that were left
        ids.forEach((id) => {
            const prevhid = this.state.dependencies.components.pointers[id];
            const nowhid = newDeps.components.pointers[id];
            if (prevhid !== nowhid) {
                otherNotified.push(...(this.state.dependencies.components.entries[prevhid] ?? []));
            }
        });
        // console.log('other notified', ids, otherNotified);
        this.state.dependencies = newDeps;
        this.runValidation(this.state.dependencies, this.state.validationResults, ids.concat(otherNotified), changedKeys);
    }

    runValidation(
        dependencies: Dependencies,
        results: Record<string, ValidateResult<TypeInfo>>,
        changedTops?: string[],
        changedKeys?: Record<string, true>,
    ) {
        if (!this.language.validate) return {};
        // const results: Record<string, ValidateResult<TypeInfo>> = {};
        let onlyUpdate = null as null | string[];
        if (changedTops) {
            onlyUpdate = [];
            changedTops.forEach((id) => {
                const hid = dependencies.components.pointers[id];
                if (!onlyUpdate!.includes(hid)) onlyUpdate!.push(hid);
            });
        }
        // Ok, so.
        for (let id of dependencies.traversalOrder) {
            if (onlyUpdate) {
                if (!onlyUpdate.includes(id)) continue;
            }
            let skip = false;
            for (let cid of dependencies.components.entries[id]) {
                if (!this.state.parseResults[cid]) {
                    // This should be ... smoother.
                    throw new Error(`something didnt get parsed: ${cid}`);
                }
                if (!this.state.parseResults[cid].result) {
                    skip = true;
                    break;
                    // This should be ... smoother.
                    // throw new Error(`parse error for ${cid}`);
                }
            }
            if (skip) {
                console.warn(`skipping validation for ${id} because of parse error`);
                continue;
            }
            for (let did of dependencies.headDeps[id]) {
                if (!results[did]) {
                    throw new Error(`wrong evaluation order: ${did} should be ready before ${id}`);
                }
            }
            // const prev = results[id];
            results[id] = this.language.validate(
                this.module.id,
                dependencies.components.entries[id].map((id) => ({ tid: id, ast: this.state.parseResults[id].result! })),
                dependencies.headDeps[id].map((did) => results[did].result),
            );

            // NEED a way, if a previous thing fails,
            // to indicate that a value exists but has type errors
            for (let cid of dependencies.components.entries[id]) {
                if (changedKeys) {
                    // console.log(`annotations for`, cid, results[id].annotations[cid], this.prevAnnotations[cid]);
                    Object.entries(results[id].annotations[cid]).forEach(([k, ann]) => {
                        if (!equal(ann, this.prevAnnotations[cid]?.[k])) {
                            changedKeys[k] = true;
                        }
                    });

                    Object.keys(this.prevAnnotations[cid] ?? {}).forEach((k) => {
                        if (!results[id].annotations[cid]?.[k]) {
                            changedKeys[k] = true;
                        }
                    });
                }

                this.prevAnnotations[cid] = results[id].annotations[cid];

                // this.state.irResults[cid] = this.language.intern(this.state.parseResults[cid].result!, results[id].result);
            }

            for (let cid of dependencies.components.entries[id]) {
                const prev = this.state.spans[cid];
                this.state.spans[cid] = this.calculateSpans(cid, this.module.toplevels[cid], results[id]);
                if (changedKeys) {
                    Object.entries(this.state.spans[cid]).forEach(([loc, spans]) => {
                        if (!prev) changedKeys[loc] = true;
                        else if (!equal(spans, prev[loc])) {
                            changedKeys[loc] = true;
                        }
                    });
                }
            }

            // TODO: here's where we would determine whether the `results[id]` had meaningfully changed
            // from the previous one, and only then would we add dependencies to the onlyUpdate list.
            if (onlyUpdate) {
                onlyUpdate.push(...(dependencies.dependents[id]?.filter((id) => !onlyUpdate.includes(id)) ?? []));
            }
        }
        // return results;
    }

    calculateSpans(tid: string, top: Toplevel, validation: ValidateResult<TypeInfo>) {
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

    calculateDependencyGraph(parseResults: Record<string, ParseResult<AST>>): Dependencies {
        const available: { [kind: string]: { [name: string]: string[] } } = {};
        Object.entries(parseResults).forEach(([tid, results]) => {
            if (results.kind.type === 'definition') {
                results.kind.provides.forEach((item) => {
                    if (!available[item.kind]) available[item.kind] = {};
                    if (!available[item.kind][item.name]) available[item.kind][item.name] = [];
                    available[item.kind][item.name].push(tid);
                });
            }
        });
        // NOTE: ignore external dependencies for the moment...
        // as they don't factor into dependency graph generation.

        // NOTE: in some future time, exact dependencies ... may be only resolvable at inference time.
        // which means we'll have some spurious dependencies, but that's fine. you depend on everything that matches.
        const dependencies: Record<string, string[]> = {};
        Object.entries(parseResults).forEach(([tid, results]) => {
            if (!dependencies[tid]) dependencies[tid] = [];
            results.externalReferences.forEach((ref) => {
                const sources = available[ref.kind]?.[ref.name] ?? [];
                for (let other of sources) {
                    if (!dependencies[tid].includes(other)) {
                        dependencies[tid].push(other);
                    }
                }
            });
        });

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

        // Now, we go through

        // Is this a valid sort?
        // noooo because a could be independent of b and b be independent of c, but a could be in relationship with c.
        const fullSort = toposort(headDeps).reverse();
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

        return { components, headDeps, deepDeps: deep, traversalOrder: fullSort, dependents };
    }
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

    return sorted;
};
