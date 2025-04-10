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
import { loadModules, saveModule } from './storage';
import { useTick } from './editorHooks';

export type ModuleChildren = Record<string, string[]>;

type ModuleUpdate = Partial<Omit<Module, 'toplevels' | 'history' | 'selections'>> & { id: string };

export interface Store {
    compiler(): Compiler<any, any>;
    estore(id: string): EditorStore<any, any>;
    module(id: string): Module;
    listen(evt: Evt, f: () => void): () => void;
    selected(): string;
    select(id: string): void;
    addModule(module: Module): void;
    updateModule(update: ModuleUpdate): void;
    update(module: string, action: Action): void;
    useSelected(): string;
    useModuleChildren(): ModuleChildren;
    moduleChildren(): ModuleChildren;
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

const createStore = (): Store => {
    const modules = loadModules();

    let treeCache = makeModuleTree(modules);
    let selected = location.hash.slice(1);
    if (!selected) {
        if (treeCache.root.length) {
            selected = treeCache.root[0];
        }
    }
    if (!selected) {
        const module = newModule();
        modules[module.id] = module;
        selected = module.id;
        treeCache.root.push(module.id);
    }

    const listeners: Partial<Record<Evt, (() => void)[]>> = {};
    const listen = (evt: Evt, fn: () => void) => {
        if (!listeners[evt]) listeners[evt] = [fn];
        else listeners[evt].push(fn);
        return () => {
            if (!listeners[evt]) return;
            const at = listeners[evt].indexOf(fn);
            if (at !== -1) listeners[evt].splice(at, 1);
        };
    };
    const shout = (evt: Evt) => listeners[evt]?.forEach((f) => f());

    const f = () => {
        const id = location.hash.slice(1);
        selected = id;
        shout('selected');
    };
    window.addEventListener('hashchange', f);

    const language = defaultLang;

    const compiler = language.compiler();

    const recompile = (module: string, heads: string[], state: EditorState<any, any>) => {
        const asts: Record<string, { ast: TopItem; kind: ParseKind }> = {};
        heads.forEach((hid) => {
            state.dependencies.components.entries[hid].forEach((key) => {
                const parse = state.parseResults[key];
                if (!parse?.result) return;
                asts[key] = { ast: parse.result, kind: parse.kind };
            });
        });
        const infos: Record<string, TInfo> = {};
        heads.forEach((key) => {
            infos[key] = state.validationResults[key]?.result;
        });
        try {
            compiler.loadModule(module, state.dependencies, asts, infos);
        } catch (err) {
            console.log(err);
        }
    };

    const estores: Record<string, EditorStore<any, any>> = {};
    // Object.keys(modules).forEach((id) => {
    //     estores[id] = new EditorStore(modules[id], language);
    //     const s = estores[id];
    //     recompile(id, s.state.dependencies.traversalOrder, s.state);
    //     // console.log('should have loadded', id);
    // });

    return {
        compiler() {
            return compiler;
        },
        estore(id) {
            if (!estores[id]) {
                console.warn(`late adding module mauybe`);
                estores[id] = new EditorStore(modules[id], language);
                const s = estores[id];
                recompile(id, s.state.dependencies.traversalOrder, s.state);
            }
            return estores[id];
        },
        module(id: string) {
            return modules[id];
        },
        listen,
        selected() {
            return selected;
        },
        updateModule(update) {
            Object.assign(modules[update.id], update);
            saveModule(modules[update.id]);
            treeCache = makeModuleTree(modules);
            shout(`module:${update.id}`);
            shout(`modules`);
        },
        addModule(module) {
            modules[module.id] = module;
            saveModule(module);
            treeCache = makeModuleTree(modules);
            shout('modules');
        },
        moduleChildren: () => treeCache,
        useModuleChildren() {
            useTick(`modules`);
            return treeCache;
        },
        select(id: string) {
            selected = id;
            shout('selected');
        },
        useSelected() {
            useTick('selected');
            return selected;
        },
        update(module: string, action: Action) {
            const mod = modules[selected];
            const { changed, changedTops, evts } = update(mod, language, action);
            if (changedTops.length) {
                const keys: Record<string, true> = {};
                const estore = this.estore(module);
                const topsToCompile = estore.updateTops(changedTops, changed, keys);
                recompile(module, topsToCompile, estore.state);
                Object.keys(keys).forEach((k) => evts.push(`annotation:${k}`));

                evts.push(`module:${mod.id}:dependency-graph`);
                evts.push(`module:${mod.id}:parse-results`);
                changedTops.forEach((key) => {
                    evts.push(`top:${key}:parse-results`);
                });
            }

            evts.forEach((evt) => shout(evt));

            Object.keys(changed).forEach((k) => {
                shout(`node:${k}`);
            });

            saveModule(mod);
        },
    };
};

const StoreCtx = createContext({ store: null } as { store: null | Store });

export const useStore = (): Store => {
    const v = useContext(StoreCtx);
    if (!v.store) v.store = createStore();

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

const applyChanges = (result: AppState, mod: Module) => {
    const evts: Evt[] = [];
    const changed = allIds(result.selections);
    Object.assign(changed, allIds(mod.selections));
    if (mod.selections !== result.selections) {
        mod.selections = result.selections;
        evts.push(`module:${mod.id}:selection`);
    }

    const changedTops: string[] = [];

    Object.entries(result.tops).forEach(([key, top]) => {
        if (!mod.toplevels[key]) {
            mod.toplevels[key] = top;
            return;
        }
        let nodesChanged = false;
        Object.keys(top.nodes).forEach((k) => {
            if (mod.toplevels[key].nodes[k] !== top.nodes[k]) {
                changed[k] = true;
                nodesChanged = true;
            }
        });
        mod.toplevels[key].nodes = top.nodes;
        if (mod.toplevels[key].root !== top.root) {
            mod.toplevels[key].root = top.root;
            evts.push(`top:${key}:root`);
            evts.push(`top:${key}`);
            nodesChanged = true;
        }
        if (top.children !== mod.toplevels[key].children) {
            mod.toplevels[key].children = top.children;
            evts.push(`top:${key}:children`);
            evts.push(`top:${key}`);
        }

        if (nodesChanged) {
            changedTops.push(key);
        }
    });

    return { changed, changedTops, evts };
};
