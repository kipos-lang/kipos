import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Action, AppState, reduce } from './state';
import { Node } from '../shared/cnodes';
import { useHash } from '../useHash';
import { LanguageConfiguration, Module, Toplevel } from './types';
import { genId } from '../keyboard/ui/genId';
import { Cursor, Highlight, lastChild, mergeHighlights, NodeSelection, Path, pathKey, SelectionStatuses, selStart, Top } from '../keyboard/utils';
import { loadLanguageConfigs, loadModules, saveModule } from './storage';
import { getSelectionStatuses } from '../keyboard/selections';

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
    useSelection(): NodeSelection[];
    useTop(id: string): TopStore;
    update(action: Action): void;
}

export type SelStatus = {
    cursors: Cursor[];
    highlight?: Highlight;
};

interface TopStore {
    top: Toplevel;
    useRoot(): string;
    useNode(path: Path): { node: Node; sel?: SelStatus };
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

type Evt = 'selected' | 'selection' | `top:${string}` | `node:${string}`;

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

    let selectionStatuses: Record<string, SelStatus> = recalcSelectionStatuses(modules[selected]);

    const makeEditor = (selected: string) => ({
        selected,
        get module() {
            return modules[selected];
        },
        useSelection() {
            useTick(`selection`);
            useTick(`selected`);
            return modules[selected].selections;
        },
        update(action: Action) {
            const mod = modules[selected];
            const tops: Record<string, Top> = { ...mod.toplevels };
            const state: AppState = {
                tops,
                history: mod.history,
                selections: mod.selections,
            };
            const result = reduce(state, action, false, genId);
            mod.history = result.history;
            const changed = allIds(result.selections);
            Object.assign(changed, allIds(mod.selections));
            if (mod.selections !== result.selections) {
                mod.selections = result.selections;
                shout('selection');
            }

            const old = selectionStatuses;
            selectionStatuses = recalcSelectionStatuses(mod);
            Object.keys(old).forEach((k) => {});

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
                useNode(path: Path) {
                    useTick(`node:${lastChild(path)}`);
                    return {
                        node: modules[selected].toplevels[top].nodes[lastChild(path)],
                        sel: selectionStatuses[pathKey(path)],
                    };
                },
                useRoot() {
                    useTick(`top:${top}:root`);
                    return modules[selected].toplevels[top].root;
                },
                get top() {
                    return modules[selected].toplevels[top];
                },
            };
        },
    });

    let editor = makeEditor(selected);

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
            if (editor.selected !== selected) {
                editor = makeEditor(selected);
            }
            return editor;
        },
    };
};

// const nodeStatus = (id: string, selections: NodeSelection): SelStatus | undefined => {};

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

const recalcSelectionStatuses = (mod: Module) => {
    const statuses: SelectionStatuses = {};
    mod.selections.forEach((sel) => {
        const st = getSelectionStatuses(sel, mod.toplevels[sel.start.path.root.top]);

        Object.entries(st).forEach(([key, status]) => {
            if (statuses[key]) {
                statuses[key].cursors.push(...status.cursors);
                statuses[key].highlight = mergeHighlights(statuses[key].highlight, status.highlight);
            } else {
                statuses[key] = status;
            }
        });
    });
    return statuses;
};
