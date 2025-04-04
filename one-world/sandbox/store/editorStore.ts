import index from 'isomorphic-git';
import { root } from '../../keyboard/root';
import { Event } from '../../syntaxes/dsl3';
import { Module } from '../types';
import { collapseComponents, Components } from './dependency-graph';
import { Language, ParseResult, ValidateResult } from './language';

export type EditorState<AST, TypeInfo, IR> = {
    parseResults: { [top: string]: ParseResult<AST> };
    // validation, is ~by "top", where if there's a dependency cycle,
    // we choose the (sort()[0]) first one as the 'head'
    validationResults: { [top: string]: ValidateResult<TypeInfo> };
    irResults: { [top: string]: IR };
    spans: { [top: string]: Record<string, string[][]> };
    // top -> deep list of dependent tops, in the right order
    // so we can just go down the list, validating & executing
    // each one, and things will get updated correctly.
    // deepDependencies: Record<string, string[]>;
    dependencies: {
        components: Components;
        headDeps: Record<string, string[]>;
        deepDeps: Record<string, string[]>;
        traversalOrder: string[];
    };
};

export class EditorStore<AST, TypeInfo, IR> {
    state: EditorState<AST, TypeInfo, IR>;
    module: Module;
    language: Language<any, AST, TypeInfo, IR>;

    constructor(module: Module, language: Language<any, AST, TypeInfo, IR>) {
        this.state = {
            parseResults: {},
            validationResults: {},
            spans: {},
            dependencies: {
                components: { pointers: {}, entries: {} },
                headDeps: {},
                deepDeps: {},
                traversalOrder: [],
            },
            irResults: {},
        };
        this.module = module;
        this.language = language;
        this.initialParse();
    }

    initialParse() {
        Object.values(this.module.toplevels).forEach((top) => {
            this.state.parseResults[top.id] = this.language.parser.parse([], root({ top }));
        });
        // START HERE
        this.calculateDependencyGraph();
        this.runValidation();
    }

    runValidation() {
        // Ok, so.
        if (this.language.validate) {
            for (let id of this.state.dependencies.traversalOrder) {
                for (let cid of this.state.dependencies.components.entries[id]) {
                    if (!this.state.parseResults[cid]) {
                        // This should be ... smoother.
                        throw new Error(`something didnt get parsed: ${cid}`);
                    }
                }
                for (let did of this.state.dependencies.headDeps[id]) {
                    if (!this.state.validationResults[did]) {
                        throw new Error(`wrong evaluation order: ${did} should be ready before ${id}`);
                    }
                }
                this.state.validationResults[id] = this.language.validate(
                    this.state.dependencies.components.entries[id].map((id) => this.state.parseResults[id].result!),
                    this.state.dependencies.headDeps[id].map((did) => this.state.validationResults[did].result),
                );
                // this.language.intern()
                // NEED a way, if a previous thing fails,
                // to indicate that a value exists but has type errors
                for (let cid of this.state.dependencies.components.entries[id]) {
                    this.state.irResults[cid] = this.language.intern(this.state.parseResults[cid].result!, this.state.validationResults[id].result);
                }
            }
        }
    }

    calculateDependencyGraph() {
        const available: { [kind: string]: { [name: string]: string[] } } = {};
        Object.entries(this.state.parseResults).forEach(([tid, results]) => {
            results.provides.forEach((item) => {
                if (!available[item.kind]) available[item.kind] = {};
                if (!available[item.kind][item.name]) available[item.kind][item.name] = [];
                available[item.kind][item.name].push(tid);
            });
        });
        // NOTE: ignore external dependencies for the moment...
        // as they don't factor into dependency graph generation.

        // NOTE: in some future time, exact dependencies ... may be only resolvable at inference time.
        // which means we'll have some spurious dependencies, but that's fine. you depend on everything that matches.
        const dependencies: Record<string, string[]> = {};
        Object.entries(this.state.parseResults).forEach(([tid, results]) => {
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

        this.state.dependencies = { components, headDeps, deepDeps: deep, traversalOrder: fullSort };

        // Ok, once we have those, we need to be able to calculate a total ordering
        // const totalOrder = Object.keys(deep).sort(sortHeads);
        // console.log(dependencies, components, headDeps, deep, fullSort);
        // console.log(totalOrder);

        // then we ... intern it? maybe. I'll deal with that later.
    }
}

const toposort = (dependencies: Record<string, string[]>) => {
    console.log('DEPS', dependencies);
    const inDegree: Record<string, number> = {};
    Object.entries(dependencies).forEach(([key, deps]) => {
        deps.forEach((v) => {
            if (v === key) return; // ignore self-references
            if (!inDegree[v]) inDegree[v] = 0;
            inDegree[v] += 1;
        });
        if (!inDegree[key]) inDegree[key] = 0;
    });

    console.log('initial', { ...inDegree });

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

    console.log('final', sorted, inDegree);

    return sorted;
};
