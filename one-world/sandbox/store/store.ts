import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { genId } from '../../keyboard/ui/genId';
import { Cursor, Highlight, NodeSelection, Path, selStart } from '../../keyboard/utils';
import { validate, validateLocs, validateNodes } from '../../keyboard/validate';
import { Node } from '../../shared/cnodes';
import { TopItem } from '../../syntaxes/algw-s2-types';
import { Module } from '../types';
import { defaultLang, TInfo } from './default-lang/default-lang';
import { EditorState, EditorStore } from './editorStore';
import { Compiler, Language, Meta, ParseKind } from './language';
import { Action, AppState, keyUpdates, reduce } from './state';
import { committer, Status, Storage, Timers } from './storage';
import { useTick } from './editorHooks';
import { applyDiff, Backend, Diff } from './versionings';

export type ModuleChildren = Record<string, string[]>;

type ModuleUpdate = Partial<Omit<Module, 'toplevels' | 'history' | 'selections'>> & { id: string };

export class Store {
    estore: EditorStore;
    modules: Record<string, Module>;
    treeCache: ModuleChildren;
    listeners: Partial<Record<Evt, (() => void)[]>>;
    selected: string;
    committer: (module: Module, withMeta: boolean, tops: ChangedTops) => void;
    backend: Backend;
    project: string;
    savingStatus: Status = 'clean';
    frozen: null | {
        selected: string;
        // selections: Record<string, NodeSelection[]>;
        modules: Record<string, Module>;
    } = null;

    constructor(
        project: string,
        modules: Record<string, Module>,
        selected: string,
        backend: Backend,
        languages: Record<string, Language<any, any, any>>,
        timers?: Timers,
        storage?: Storage,
    ) {
        this.project = project;
        this.listeners = {};
        console.log(modules);

        const { commit, change } = committer({
            timer: timers,
            async commit(change) {
                console.log('saving a change', change);
                backend.saveChange(project, change, `auto commit`);
            },
            minWait: 2000,
            maxWait: 30000,
            onStatus: (status) => {
                this.savingStatus = status;
                this.shout('saving:status');
            },
            storage: storage ?? {
                setItem(key, value) {
                    localStorage[project + ':' + key] = value;
                },
                getItem(key) {
                    return localStorage[project + ':' + key];
                },
            },
        });
        this.committer = commit;
        this.backend = backend;
        // Load up any saved `change`s
        if (change) {
            console.log(`restoring uncommitted change`, change);
        }
        Object.entries(change ?? {}).forEach(([id, mod]) => {
            if (!mod) delete modules[id];
            else {
                if (mod.meta) {
                    Object.assign(modules[id], mod.meta);
                }
                if (mod.toplevels) {
                    Object.entries(mod.toplevels).forEach(([tid, top]) => {
                        if (!top) {
                            delete modules[id].toplevels[tid];
                        } else {
                            modules[id].toplevels[tid] = top.top;
                        }
                    });
                }
            }
        });
        // TODO:

        this.treeCache = makeModuleTree(modules);
        this.modules = modules;
        this.selected = selected;
        if (!this.selected || !modules[this.selected]) {
            if (this.treeCache.root.length) {
                this.selected = this.treeCache.root[0];
                console.log('selecting', this.selected);
            }
        }
        if (!this.selected || !modules[this.selected]) {
            const module = newModule();
            modules[module.id] = module;
            this.selected = module.id;
            this.treeCache.root.push(module.id);
            // this.backend.saveModule(this.project, module);
            this.committer(module, true, Object.fromEntries(Object.keys(module.toplevels).map((id) => [id, { meta: true, nodes: true }])));
        }

        this.estore = new EditorStore(modules, languages);
    }
    compiler(): Compiler<any, any> {
        return this.estore.compilers.default;
    }

    // frozen aware accessors
    module(id: string) {
        // if (this.frozen) {
        //     return frozenModule(this.frozen.previews[id], this.modules[id], this.frozen.selections[id]);
        // }
        return this.modules[id];
    }

    listen(evt: Evt, fn: () => void): () => void {
        if (!this.listeners[evt]) this.listeners[evt] = [fn];
        else this.listeners[evt].push(fn);
        return () => {
            if (!this.listeners[evt]) return;
            const at = this.listeners[evt].indexOf(fn);
            if (at !== -1) this.listeners[evt].splice(at, 1);
        };
    }
    shout(evt: Evt) {
        this.listeners[evt]?.forEach((f) => f());
    }
    updateModule(update: ModuleUpdate) {
        if (this.frozen) return;
        Object.assign(this.modules[update.id], update);
        // this.backend.saveModule(this.project, this.modules[update.id]);
        this.committer(this.modules[update.id], true, {});
        this.treeCache = makeModuleTree(this.modules);
        this.shout(`module:${update.id}`);
        this.shout(`modules`);
    }
    addModule(module: Module) {
        if (this.frozen) return;
        this.modules[module.id] = module;
        // this.backend.saveModule(this.project, module);
        this.committer(module, true, Object.fromEntries(Object.keys(module.toplevels).map((id) => [id, { meta: true, nodes: true }])));
        this.treeCache = makeModuleTree(this.modules);
        this.shout('modules');
    }
    moduleChildren() {
        return this.treeCache;
    }
    useModuleChildren() {
        useTick(`modules`);
        return this.treeCache;
    }
    select(id: string) {
        if (id === this.selected) return;
        if (!this.modules[id]) {
            console.warn(`trying to select nonexistant module ${id}`);
            return;
        }
        this.selected = id;
        this.shout('selected');
    }
    useSelected() {
        useTick('selected');
        return this.selected;
    }

    freeze() {
        // const selections: Record<string, NodeSelection[]> = Object.fromEntries(Object.values(this.modules).map((mod) => [mod.id, mod.selections]));
        this.frozen = {
            selected: this.selected,
            // selections: {},
            modules: { ...this.modules },
        };
    }

    frozenDiff(diff: Diff) {
        if (!this.frozen) throw new Error(`cant frozen diff, not frozen`);
        const { evts, changedModules } = applyDiff(this.modules, this.frozen.modules, diff);

        const changed: Record<string, true> = {};
        this.estore.moduleDeps.sorted.forEach((id) => {
            const changedTops = changedModules[id];
            if (changedTops?.length) {
                changedTops.forEach((tid) => {
                    const top = this.modules[id].toplevels[tid];
                    validateLocs(top);
                    validateNodes(top, top.root);
                });

                const keys: Record<string, true> = {};
                const estore = this.estore;
                estore.updateModules(id, changedTops, changed, keys);
                Object.keys(keys).forEach((k) => evts.push(`annotation:${k}`));

                evts.push(`module:${id}:dependency-graph`);
                evts.push(`module:${id}:parse-results`);
                changedTops.forEach((key) => {
                    evts.push(`top:${key}:parse-results`);
                });
            }
        });
        evts.forEach((evt) => this.shout(evt));
    }

    unfreeze() {
        if (!this.frozen) return;
        const selected = this.frozen.selected;
        this.modules = this.frozen.modules;
        this.estore.modules = this.modules;
        this.frozen = null;
        this.select(selected);
    }

    update(module: string, action: Action) {
        const mod = this.module(module);
        const language = this.estore.languages[mod.languageConfiguration];
        if (this.frozen) {
            let selections = mod.selections;
            if (action.type === 'selections') {
                selections = action.selections;
            } else if (action.type === 'key') {
                const result = keyUpdates(selections, mod.toplevels, action, language.parser.config);
                if (result.changed) {
                    console.log('key resulted in change no');
                    return;
                }
                selections = result.selections;
            } else {
                return;
            }
            if (selections === mod.selections) return;
            const changed = allIds(selections);
            Object.assign(changed, allIds(mod.selections));
            if (mod === this.frozen.modules[module]) {
                this.modules[module] = { ...mod };
            }
            this.modules[module].selections = selections;
            console.log('sel', selections);
            this.shout(`module:${mod.id}:selection`);
            Object.keys(changed).forEach((c) => this.shout(`node:${c}`));
            return;
        }

        const { changed, changedTops, evts } = update(mod, this.estore.languages[mod.languageConfiguration], action);
        if (Object.keys(changedTops).length) {
            const keys: Record<string, true> = {};
            const estore = this.estore;
            estore.updateModules(module, Object.keys(changedTops), changed, keys);
            Object.keys(keys).forEach((k) => evts.push(`annotation:${k}`));

            evts.push(`module:${mod.id}:dependency-graph`);
            evts.push(`module:${mod.id}:parse-results`);
            Object.keys(changedTops).forEach((key) => {
                evts.push(`top:${key}:parse-results`);
            });
        }

        evts.forEach((evt) => this.shout(evt));

        Object.keys(changed).forEach((k) => {
            this.shout(`node:${k}`);
        });

        // this.backend.saveModule(this.project, mod);
        if (Object.keys(changedTops).length) {
            this.committer(mod, true, changedTops);
        }
    }
}

export interface EditorStoreI {
    update(action: Action): void;
}

export type SelStatus = {
    cursors: Cursor[];
    highlight?: Highlight;
};

export type UseNode = (path: Path) => {
    node: Node;
    sel?: SelStatus;
    meta?: Meta;
    spans?: string[][];
};

export const newModule = (name = 'NewModule'): Module => {
    const id = genId();
    const tid = genId();
    const rid = genId();
    return {
        id,
        name,
        history: [],
        pluginConfig: {},
        imports: [],
        roots: [tid],
        parent: 'root',
        selections: [{ start: selStart({ root: { top: tid, ids: [] }, children: [rid] }, { type: 'id', end: 0 }) }],
        languageConfiguration: defaultLanguageConfig,
        toplevels: {
            [tid]: {
                id: tid,
                root: rid,
                children: [],
                nodes: { [rid]: { type: 'id', text: '', loc: rid } },
            },
        },
    };
};

const makeModuleTree = (modules: Record<string, Module>) => {
    const children: ModuleChildren = { root: [] };
    Object.values(modules).forEach((mod) => {
        if (!children[mod.id]) {
            children[mod.id] = [];
        }
        if (!children[mod.parent]) {
            children[mod.parent] = [];
        }
        children[mod.parent].push(mod.id);
    });
    Object.values(children).forEach((lst) => lst.sort((a, b) => cmp(modules[a].name, modules[b].name)));
    return children;
};

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export const defaultLanguageConfig = 'default';

export type Evt =
    | 'saving:status'
    | 'modules'
    | 'selected'
    | `annotation:${string}`
    | `top:${string}`
    | `node:${string}`
    | `module:${string}`
    | `module:${string}:roots`;

// export const createStore = (project: string, modules: Record<string, Module>, backend: Backend): Store => {
//     return new Store(project, modules, backend);
// };

export const StoreCtx = createContext({
    get store(): Store {
        throw new Error(`no context`);
    },
} as { readonly store: Store });

export const useStore = (): Store => {
    const v = useContext(StoreCtx);

    return v.store;
};

export const allIds = (sels: NodeSelection[]) => {
    const ids: Record<string, true> = {};
    sels.forEach((sel) => {
        sel.start.path.children.forEach((id) => (ids[id] = true));
        sel.end?.path.children.forEach((id) => (ids[id] = true));
    });
    return ids;
};
const diffIds = (one: Record<string, true>, two: Record<string, true>) => {
    const res: Record<string, true> = {};
    Object.keys(two).forEach((k) => {
        if (!one[k]) res[k] = true;
    });
    return res;
};

const update = (mod: Module, language: Language<any, any, any>, action: Action) => {
    const result = reduce(
        {
            config: language.parser.config,
            tops: { ...mod.toplevels },
            roots: mod.roots,
            imports: mod.imports,
            history: mod.history,
            selections: mod.selections,
        },
        action,
        false,
        genId,
    );
    mod.history = result.history;
    if (mod.history.length > 200) {
        mod.history = mod.history.slice(-200);
    }

    const { changed, changedTops, evts } = applyChanges(result, mod);

    if (mod.roots !== result.roots) {
        evts.push(`module:${mod.id}`, `module:${mod.id}:roots`);
        mod.roots = result.roots;
    }

    if (mod.imports !== result.imports) {
        evts.push(`module:${mod.id}`, `module:${mod.id}:imports`);
        mod.imports = result.imports;
    }

    mod.selections.forEach((sel) => {
        if (!sel.start.path) {
            console.log('WHAT SEL');
            debugger;
        }
        try {
            validate({ sel, top: mod.toplevels[sel.start.path.root.top] });
        } catch (err) {
            debugger;
            validate({ sel, top: mod.toplevels[sel.start.path.root.top] });
        }
    });

    return { changed, changedTops, evts };
};

export type ChangedTops = Record<string, { meta: boolean; nodes: true | string[] }>;

const applyChanges = (result: AppState, mod: Module) => {
    const evts: Evt[] = [];
    const changed = allIds(result.selections);
    Object.assign(changed, allIds(mod.selections));
    if (mod.selections !== result.selections) {
        mod.selections = result.selections;
        evts.push(`module:${mod.id}:selection`);
    }

    const changedTops: ChangedTops = {};

    Object.entries(result.tops).forEach(([key, top]) => {
        if (!mod.toplevels[key]) {
            mod.toplevels[key] = top;
            changedTops[key] = { meta: true, nodes: true };
            return;
        }

        let metaChanged = false;
        let nodesChanged: string[] = [];
        Object.keys(top.nodes).forEach((k) => {
            if (mod.toplevels[key].nodes[k] !== top.nodes[k]) {
                changed[k] = true;
                nodesChanged.push(k);
            }
        });
        Object.keys(mod.toplevels[key].nodes).forEach((k) => {
            if (!top.nodes[k]) {
                changed[k] = true;
                nodesChanged.push(k);
            }
        });

        mod.toplevels[key].nodes = top.nodes;
        if (mod.toplevels[key].root !== top.root) {
            mod.toplevels[key].root = top.root;
            evts.push(`top:${key}:root`);
            evts.push(`top:${key}`);
            metaChanged = true;
        }
        if (top.children !== mod.toplevels[key].children) {
            mod.toplevels[key].children = top.children;
            evts.push(`top:${key}:children`);
            evts.push(`top:${key}`);
            metaChanged = true;
        }
        if (mod.toplevels[key].submodule !== top.submodule) {
            mod.toplevels[key].submodule = top.submodule;
            evts.push(`top:${key}:submodule`);
            evts.push(`top:${key}`);
            metaChanged = true;
        }

        if (nodesChanged.length || metaChanged) {
            changedTops[key] = { meta: metaChanged, nodes: nodesChanged };
        }
    });

    return { changed, changedTops, evts };
};

// Note this might report some things being present when it has been deleted
export const frozenModule = (frozen: Module | undefined, base: Module, selections?: NodeSelection[]): Module => {
    if (!frozen) {
        if (!selections) return base;
        return new Proxy(base, {
            get(_, prop) {
                if (prop === 'selections') {
                    return selections;
                }
                return base[prop as 'id'];
            },
        });
    }

    return new Proxy(base, {
        get(target, prop) {
            if (prop === 'toplevels') {
                return new Proxy(frozen.toplevels, {
                    get(target, tid) {
                        return new Proxy(
                            {},
                            {
                                get(_, attr) {
                                    if (attr === 'nodes') {
                                        return new Proxy(
                                            {},
                                            {
                                                get(_, id) {
                                                    return (
                                                        frozen?.toplevels[tid as '']?.nodes[id as ''] ?? base.toplevels[tid as '']?.nodes[id as '']
                                                    );
                                                },
                                            },
                                        );
                                    } else {
                                        return frozen?.toplevels[tid as '']?.[attr as 'id'] ?? base.toplevels[tid as '']?.[attr as 'id'];
                                    }
                                },
                            },
                        );
                    },
                });
            } else if (prop === 'selections') {
                return selections ?? frozen.selections;
            } else {
                return frozen[prop as 'id'] ?? base[prop as 'id'];
            }
        },
        set(target, prop, value) {
            throw new Error(`not allowed set on a frozen Module`);
        },
    });
};
