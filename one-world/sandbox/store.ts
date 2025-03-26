import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Action, AppState, reduce } from './state';
import { Node } from '../shared/cnodes';
import { useHash } from '../useHash';
import { LanguageConfiguration, Module, Toplevel } from './types';
import { genId } from '../keyboard/ui/genId';
import { NodeSelection, selStart, Top } from '../keyboard/utils';
import { loadLanguageConfigs, loadModules, saveModule } from './storage';

export type ModuleTree = {
    node?: Module;
    children: ModuleTree[];
};

interface Store {
    module(id: string): Module;
    get languageConfigs(): Record<string, LanguageConfiguration>;
    get moduleTree(): ModuleTree;
    // get selectedModule(): string
    useEditor(): EditorStore;
    useSelected(): string;
}

interface EditorStore {
    get module(): Module;
    useTop(id: string): TopStore;
    update(action: Action): void;
}

interface TopStore {
    top: Toplevel;
    useNode(id: string): Node;
}

const newModule = (): Module => {
    const id = genId();
    const tid = genId();
    const rid = genId();
    return {
        id,
        history: [],
        editorPlugins: {},
        name: 'Hello',
        roots: [tid],
        parent: 'root',
        selections: [{ start: selStart({ root: { top: tid, ids: [] }, children: [rid] }, { type: 'id', end: 0 }) }],
        languageConfiguration: defaultLanguageConfig,
        toplevels: {
            [tid]: {
                id: tid,
                root: rid,
                children: [],
                nodes: { [rid]: { type: 'id', text: 'Hello', loc: rid } },
            },
        },
    };
};

const makeModuleTree = (modules: Record<string, Module>) => {
    const root: ModuleTree = { children: [] };
    const byId: Record<string, ModuleTree> = { root };
    Object.values(modules).forEach((mod) => {
        if (!byId[mod.id]) {
            byId[mod.id] = { children: [] };
        }
        byId[mod.id].node = mod;
        if (!byId[mod.parent]) {
            byId[mod.parent] = { children: [] };
        }
        byId[mod.parent].children.push(byId[mod.id]);
    });
    return root;
};

export const defaultLanguageConfig = 'default';

type Evt = 'selected' | `top:${string}` | `node:${string}`;

const createStore = (): Store => {
    const modules = loadModules();
    const configs = loadLanguageConfigs();

    let treeCache = makeModuleTree(modules);
    let selected = location.hash.slice(1);
    if (!selected) {
        if (treeCache.children.length && treeCache.children[0].node) {
            selected = treeCache.children[0].node!.id;
        }
    }
    if (!selected) {
        const module = newModule();
        modules[module.id] = module;
        selected = module.id;
        treeCache.children.push({ node: module, children: [] });
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

    const useTick = (evt: Evt) => {
        const [_, setTick] = useState(0);
        useEffect(() => {
            return listen(evt, () => setTick((t) => t + 1));
        }, [evt]);
    };

    return {
        module(id: string) {
            return modules[id];
        },
        get languageConfigs() {
            return configs;
        },
        get moduleTree() {
            return treeCache;
        },
        useSelected() {
            useTick('selected');
            return selected;
        },
        useEditor() {
            useTick(`selected`);
            return {
                get module() {
                    return modules[selected];
                },
                update(action: Action) {
                    // const top = '';
                    const mod = modules[selected];
                    // const tl = mod.toplevels[top];
                    const tops: Record<string, Top> = {};
                    Object.entries(mod.toplevels).forEach(([key, top]) => {
                        tops[key] = { ...top, nextLoc: genId };
                    });
                    const state: AppState = {
                        tops,
                        history: mod.history,
                        selections: mod.selections,
                    };
                    const result = reduce(state, action, false);
                    mod.history = result.history;
                    const changed = diffIds(allIds(mod.selections), allIds(result.selections));
                    mod.selections = result.selections;

                    Object.entries(result.tops).forEach(([key, top]) => {
                        Object.keys(top.nodes).forEach((k) => {
                            if (mod.toplevels[key].nodes[k] !== top.nodes[k]) {
                                changed[k] = true;
                            }
                        });
                        mod.toplevels[key].nodes = top.nodes;
                        if (mod.toplevels[key].root !== top.root) {
                            mod.toplevels[key].root = top.root;
                            shout(`top:${key}:root`);
                        }
                    });

                    Object.keys(changed).forEach((k) => {
                        shout(`node:${k}`);
                    });
                    saveModule(mod);
                },
                useTop(top: string) {
                    useTick(`top:${top}`);
                    return {
                        useNode(id: string) {
                            useTick(`node:${id}`);
                            return modules[selected].toplevels[top].nodes[id];
                        },
                        get top() {
                            return modules[selected].toplevels[top];
                        },
                    };
                },
            };
        },
    };
};

const StoreCtx = createContext({ store: null } as { store: null | Store });

export const useStore = (): Store => {
    const v = useContext(StoreCtx);
    if (!v.store) v.store = createStore();
    return v.store;
};

const allIds = (sels: NodeSelection[]) => {
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
