import { useEffect, useMemo, useState } from 'react';
import { Action, AppState } from './state';
import { Node } from '../shared/cnodes';
import { useHash } from '../useHash';
import { LanguageConfiguration, Module, Toplevel } from './types';
import { genId } from '../keyboard/ui/genId';
import { selStart } from '../keyboard/utils';
import { loadLanguageConfigs, loadModules } from './storage';

type ModuleTree = {
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
}

interface TopStore {
    top: Toplevel;
    update(action: Action): void;
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

export const useStore = (): Store => {
    return useMemo((): Store => {
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

        const listeners: Record<string, (() => void)[]> = {};
        const listen = (evt: string, fn: () => void) => {
            if (!listeners[evt]) listeners[evt] = [fn];
            else listeners[evt].push(fn);
            return () => {
                const at = listeners[evt].indexOf(fn);
                if (at !== -1) listeners[evt].splice(at, 1);
            };
        };

        const useTick = (evt: string) => {
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
                    useTop(top: string) {
                        useTick(`top:${top}`);
                        return {
                            update(action: Action) {
                                // const state: AppState = {
                                //     top: modules[selected].toplevels[top],
                                //     history: modules[selected].history,
                                //     selections: modules[selected].selections,
                                // };
                            },
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
    }, []);
};
