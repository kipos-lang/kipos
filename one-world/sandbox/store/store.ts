import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Action, AppState } from './state';
import { Node } from '../../shared/cnodes';
import { useHash } from '../../useHash';
import { Module, Toplevel } from '../types';
import { genId } from '../../keyboard/ui/genId';
import { Cursor, Highlight, NodeSelection, Path, selStart, Top } from '../../keyboard/utils';
import { loadModules, saveModule } from './storage';
import { LangResult, makeEditor } from './makeEditor';
import { Annotation, Compiler, EvaluationResult, FailureKind, Meta, ParseKind, ParseResult } from './language';
import { Event } from '../../syntaxes/dsl3';
import { Dependencies, EditorState, EditorStore } from './editorStore';
import { defaultLang, TInfo } from './default-lang/default-lang';
import { TopItem } from '../../syntaxes/algw-s2-types';

export type ModuleChildren = Record<string, string[]>;

type ModuleUpdate = Partial<Omit<Module, 'toplevels' | 'history' | 'selections'>> & { id: string };

export interface Store {
    compiler(): Compiler<any, any>;
    estore(id: string): EditorStore<any, any>;
    module(id: string): Module;
    // get languageConfigs(): Record<string, LanguageConfiguration>;
    // get moduleTree(): ModuleTree;
    listen(evt: Evt, f: () => void): () => void;
    selected(): string;
    select(id: string): void;
    addModule(module: Module): void;
    updateModule(update: ModuleUpdate): void;
    // get selectedModule(): string
    useEditor(): EditorStoreI;
    useSelected(): string;
    useModuleChildren(): ModuleChildren;
    moduleChildren(): ModuleChildren;
}

export interface EditorStoreI {
    // es: EditorStore<any, any>;
    // useTopParseResults(top: string): LangResult;
    // useParseResults(): Record<string, ParseResult<any>>;
    // useDependencyGraph(): Dependencies;
    // useTopResults(top: string): null | EvaluationResult[];
    // useTopFailure(top: string): null | FailureKind[];
    // useTopSource(top: string): null | string; // make it cst pleeeease
    // useModule(): Module;
    // useSelection(): NodeSelection[];
    // useIsSelectedTop(top: string): boolean;
    // useSelectedTop(): string;
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

    const language = defaultLang;

    const compiler = language.compiler();

    const estores: Record<string, EditorStore<any, any>> = {};
    const editors: Record<string, EditorStoreI> = {};

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
    // this.runCompilation(onlyUpdate ?? this.state.dependencies.traversalOrder);

    return {
        compiler() {
            return compiler;
        },
        estore(id) {
            if (!estores[id]) {
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
                if (!estores[selected]) {
                    estores[selected] = new EditorStore(modules[selected], language);
                    const s = estores[selected];
                    recompile(selected, s.state.dependencies.traversalOrder, s.state);
                }
                editors[selected] = makeEditor(
                    selected,
                    modules,
                    useTick,
                    useTickCompute,
                    shout,
                    (ids, state) => recompile(selected, ids, state),
                    compiler,
                    estores[selected],
                );
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
