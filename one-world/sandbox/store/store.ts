import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Action, AppState } from './state';
import { Node } from '../../shared/cnodes';
import { useHash } from '../../useHash';
import { Module, Toplevel } from '../types';
import { genId } from '../../keyboard/ui/genId';
import { Cursor, Highlight, NodeSelection, Path, selStart, Top } from '../../keyboard/utils';
import { loadModules, saveModule } from './storage';
import { makeEditor } from './makeEditor';
import { Meta } from './language';

export type ModuleTree = {
    node?: Module;
    children: ModuleTree[];
};

type ModuleUpdate = Partial<Omit<Module, 'toplevels' | 'history' | 'selections'>> & { id: string };

interface Store {
    module(id: string): Module;
    // get languageConfigs(): Record<string, LanguageConfiguration>;
    // get moduleTree(): ModuleTree;
    select(id: string): void;
    addModule(module: Module): void;
    updateeModule(update: ModuleUpdate): void;
    // get selectedModule(): string
    useEditor(): EditorStore;
    useSelected(): string;
    useModuleTree(): ModuleTree;
}

interface EditorStore {
    useModule(): Module;
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
    useNode(path: Path): { node: Node; sel?: SelStatus; meta?: Meta };
}

export const newModule = (name = 'NewModule'): Module => {
    const id = genId();
    const tid = genId();
    const rid = genId();
    return {
        id,
        name,
        history: [],
        editorPlugins: {},
        macroImports: [],
        ffiImports: [],
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

export type Evt = 'modules' | 'selected' | `top:${string}` | `node:${string}` | `module:${string}` | `module:${string}:roots`;

// const makeLanguage = (configurations: Record<string, LanguageConfiguration>) => {
//     const languages = {};
// };

const createStore = (): Store => {
    const modules = loadModules();
    // const configs = loadLanguageConfigs();

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

    const editors: Record<string, EditorStore> = {};

    return {
        module(id: string) {
            return modules[id];
        },
        updateeModule(update) {
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
        // get languageConfigs() {
        //     return configs;
        // },
        useModuleTree() {
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
        useEditor() {
            useTick(`selected`);
            if (!editors[selected]) {
                editors[selected] = makeEditor(selected, modules, useTick, shout);
            }
            useTick(`module:${selected}:roots`);
            return editors[selected];
        },
    };
};

const StoreCtx = createContext({ store: null } as { store: null | Store });

export const useStore = (): Store => {
    const v = useContext(StoreCtx);
    if (!v.store) v.store = createStore();

    useEffect(() => {
        const f = () => {
            const id = location.hash.slice(1);
            v.store!.select(id);
        };
        window.addEventListener('hashchange', f);
        return () => window.removeEventListener('hashchange', f);
    }, []);

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
