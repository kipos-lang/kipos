import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { genId } from '../../keyboard/ui/genId';
import { Cursor, Highlight, NodeSelection, Path, selStart } from '../../keyboard/utils';
import { validate } from '../../keyboard/validate';
import { Node } from '../../shared/cnodes';
import { TopItem } from '../../syntaxes/algw-s2-types';
import { Module } from '../types';
import { defaultLang, TInfo } from './default-lang/default-lang';
import { EditorState, EditorStore } from './editorStore';
import { Compiler, Language, Meta, ParseKind } from './language';
import { Action, AppState, reduce } from './state';
import { committer } from './storage';
import { useTick } from './editorHooks';
import { Backend } from './versionings';

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

    constructor(project: string, modules: Record<string, Module>, backend: Backend) {
        this.project = project;
        const { commit, change } = committer({
            async commit(change) {
                // backend.saveChange(project, change, `auto commit`)
                console.log('committting change');
            },
            minWait: 2000,
            maxWait: 30000,
            onStatus(status) {
                console.log(`status!`, status);
            },
            storage: {
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
        this.selected = location.hash.slice(1);
        if (!this.selected) {
            if (this.treeCache.root.length) {
                this.selected = this.treeCache.root[0];
            }
        }
        if (!this.selected) {
            const module = newModule();
            modules[module.id] = module;
            this.selected = module.id;
            this.treeCache.root.push(module.id);
        }

        this.listeners = {};

        const f = () => {
            const id = location.hash.slice(1);
            this.selected = id;
            this.shout('selected');
        };
        window.addEventListener('hashchange', f);

        this.estore = new EditorStore(modules, { default: defaultLang });
    }
    compiler(): Compiler<any, any> {
        return this.estore.compilers.default;
    }
    module(id: string) {
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
        Object.assign(this.modules[update.id], update);
        this.backend.saveModule(this.project, this.modules[update.id]);
        this.committer(this.modules[update.id], true, {});
        this.treeCache = makeModuleTree(this.modules);
        this.shout(`module:${update.id}`);
        this.shout(`modules`);
    }
    addModule(module: Module) {
        this.modules[module.id] = module;
        this.backend.saveModule(this.project, module);
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
        this.selected = id;
        this.shout('selected');
    }
    useSelected() {
        useTick('selected');
        return this.selected;
    }
    update(module: string, action: Action) {
        const mod = this.modules[this.selected];
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

        this.backend.saveModule(this.project, mod);
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
    | 'modules'
    | 'selected'
    | `annotation:${string}`
    | `top:${string}`
    | `node:${string}`
    | `module:${string}`
    | `module:${string}:roots`;

export const createStore = (project: string, modules: Record<string, Module>, backend: Backend): Store => {
    return new Store(project, modules, backend);
};

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
