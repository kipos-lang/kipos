import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Action, AppState } from './state';
import { Node } from '../../shared/cnodes';
import { useHash } from '../../useHash';
import { Module, Toplevel } from '../types';
import { genId } from '../../keyboard/ui/genId';
import { Cursor, Highlight, NodeSelection, Path, selStart, Top } from '../../keyboard/utils';
import { loadModules, saveModule } from './storage';
import { LangResult, makeEditor } from './makeEditor';
import { Annotation, EvaluationResult, FailureKind, Meta, ParseResult } from './language';
import { Event } from '../../syntaxes/dsl3';
import { Dependencies } from './editorStore';

export type ModuleChildren = Record<string, string[]>;

type ModuleUpdate = Partial<Omit<Module, 'toplevels' | 'history' | 'selections'>> & { id: string };

export interface Store {
    module(id: string): Module;
    // get languageConfigs(): Record<string, LanguageConfiguration>;
    // get moduleTree(): ModuleTree;
    listen(evt: Evt, f: () => void): () => void;
    selected(): string;
    select(id: string): void;
    addModule(module: Module): void;
    updateeModule(update: ModuleUpdate): void;
    // get selectedModule(): string
    useEditor(): EditorStoreI;
    useSelected(): string;
    useModuleChildren(): ModuleChildren;
    moduleChildren(): ModuleChildren;
}

export interface EditorStoreI {
    useTopParseResults(top: string): LangResult;
    useParseResults(): Record<string, ParseResult<any>>;
    useDependencyGraph(): Dependencies;
    useTopResults(top: string): null | EvaluationResult[];
    useTopFailure(top: string): null | FailureKind[];
    useTopSource(top: string): null | string; // make it cst pleeeease
    useModule(): Module;
    useSelection(): NodeSelection[];
    useIsSelectedTop(top: string): boolean;
    useSelectedTop(): string;
    useTop(id: string): TopStore;
    getTop(id: string): Toplevel;
    update(action: Action): void;
}

export type SelStatus = {
    cursors: Cursor[];
    highlight?: Highlight;
};

export type UseNode = (path: Path) => {
    //
    node: Node;
    sel?: SelStatus;
    meta?: Meta;
    spans?: string[][];
};

interface TopStore {
    top: Toplevel;
    useRoot(): string;
    useNode: UseNode;
    useAnnotations(key: string): undefined | Annotation[];
}

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
    return children;
};

export const defaultLanguageConfig = 'default';

export type Evt =
    | 'modules'
    | 'selected'
    | `annotation:${string}`
    | `top:${string}`
    | `node:${string}`
    | `module:${string}`
    | `module:${string}:roots`;

// const makeLanguage = (configurations: Record<string, LanguageConfiguration>) => {
//     const languages = {};
// };

const createStore = (): Store => {
    const modules = loadModules();
    // const configs = loadLanguageConfigs();

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

    const useTickCompute = <T>(evt: Evt, initial: T, f: (c: T) => T) => {
        const [ticker, setTick] = useState(initial);
        const latest = useRef(ticker);
        latest.current = ticker;
        useEffect(() => {
            return listen(evt, () => {
                const n = f(latest.current);
                if (latest.current !== n) {
                    // console.log('tick', evt);
                    setTick(n);
                }
            });
        }, [evt]);
        return ticker;
    };

    const useTick = (evt: Evt) => {
        const [ticker, setTick] = useState(0);
        useEffect(() => {
            return listen(evt, () => {
                // console.log('tick', evt);
                setTick((t) => t + 1);
            });
        }, [evt]);
        return ticker;
    };

    const f = () => {
        const id = location.hash.slice(1);
        selected = id;
        shout('selected');
    };
    window.addEventListener('hashchange', f);

    const editors: Record<string, EditorStoreI> = {};

    return {
        module(id: string) {
            return modules[id];
        },
        listen,
        selected() {
            return selected;
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
        useEditor() {
            useTick(`selected`);
            if (!editors[selected]) {
                editors[selected] = makeEditor(selected, modules, useTick, useTickCompute, shout);
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
