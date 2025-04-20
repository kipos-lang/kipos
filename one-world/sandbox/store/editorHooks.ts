import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Evt, useStore } from './store';
import { EvaluationResult, FailureKind, ModuleTestResults } from './language';
import { lastChild, mergeHighlights, NodeSelection, Path, pathKey, SelectionStatuses } from '../../keyboard/utils';
import { getSelectionStatuses } from '../../keyboard/selections';
import equal from 'fast-deep-equal';
import { Toplevel } from '../types';

export const useTickCompute = <T>(evt: Evt, initial: T, f: (c: T) => T) => {
    const store = useStore();
    const [ticker, setTick] = useState(initial);
    const latest = useRef(ticker);
    latest.current = ticker;
    useEffect(() => {
        return store.listen(evt, () => {
            const n = f(latest.current);
            if (latest.current !== n) {
                // console.log('tick', evt);
                setTick(n);
            }
        });
    }, [evt]);
    return ticker;
};

export const useTick = (evt: Evt) => {
    const store = useStore();
    const [ticker, setTick] = useState(0);
    useEffect(() => {
        return store.listen(evt, () => {
            setTick((t) => t + 1);
        });
    }, [evt]);
    return ticker;
};

export const useTopParseResults = (top: string) => {
    const store = useStore();
    const module = store.selected;
    const estore = store.estore;

    useTick(`top:${top}:parse-results`);
    return {
        ...estore.state[module]?.parseResults[top],
        validation: estore.state[module]?.validationResults[estore.state[module].dependencies.components.pointers[top]],
        spans: {},
    };
};

export function useDependencyGraph() {
    const store = useStore();
    const selected = store.selected;
    const estore = store.estore;
    useTick(`module:${selected}:dependency-graph`);
    return estore.state[selected]?.dependencies;
}

export function useTopSource(top: string) {
    const store = useStore();
    const selected = store.selected;
    const compiler = store.compiler();
    const [results, setResults] = useState(null as null | string);
    useEffect(() => {
        setResults(null);
    }, [top]);
    useEffect(() => {
        return compiler.listen('viewSource', { module: selected, top }, ({ source }) => setResults(source));
    }, [top]);
    return results;
}
export function useTopFailure(top: string) {
    const store = useStore();
    const selected = store.selected;
    const compiler = store.compiler();
    const [results, setResults] = useState(null as null | FailureKind[]);
    useEffect(() => {
        return compiler.listen('failure', { module: selected, top }, (results) => setResults(results));
    }, [top]);
    return results;
}

export function useTestResults(module: string) {
    const store = useStore();
    const compiler = store.compiler();
    const [results, setResults] = useState(null as null | ModuleTestResults);
    useEffect(() => {
        return compiler.listen('testResults', { module }, ({ results }) => setResults(results));
    }, [top]);
    return results;
}

export function useTopResults(top: string) {
    const store = useStore();
    const selected = store.selected;
    const compiler = store.compiler();
    const [results, setResults] = useState(null as null | EvaluationResult[]);
    useEffect(() => {
        return compiler.listen('results', { module: selected, top }, ({ results }) => setResults(results));
    }, [top]);
    return results;
}

export function useParseResults() {
    const store = useStore();
    const selected = store.selected;
    const estore = store.estore;
    useTick(`module:${selected}:parse-results`);
    return estore.state[selected].parseResults;
}
export function useModule() {
    const store = useStore();
    const selected = store.selected;
    useTick(`module:${selected}`);
    return store.module(selected);
}
export function useSelection() {
    const store = useStore();
    const selected = store.selected;
    useTick(`module:${selected}:selection`);
    return store.module(selected).selections;
}
export function useIsSelectedTop(top: string) {
    const store = useStore();
    const selected = store.selected;
    return useTickCompute(`module:${selected}:selection`, store.module(selected).selections[0].start.path.root.top === top, (old) => {
        return store.module(selected).selections[0].start.path.root.top === top;
    });
}
export function useSelectedTop() {
    const store = useStore();
    const selected = store.selected;
    return useTickCompute(`module:${selected}:selection`, store.module(selected).selections[0].start.path.root.top, (old) => {
        return store.module(selected).selections[0].start.path.root.top;
    });
}

// Top Hooks nowww

export function useAnnotations(top: string, key: string) {
    const store = useStore();
    const estore = store.estore;
    const tick = useTick(`annotation:${key}`);
    return useMemo(() => {
        const state = estore.state[store.selected];
        const mod = store.module(store.selected);
        if (mod.imports.includes(top)) {
            // console.log('getting from the vali', state.validatedImports[top]);
            return state.validatedImports[top]?.annotations[top]?.[key];
        }
        // store.compiler.
        const hid = state.dependencies.components.pointers[top];
        const fromValidation = state.validationResults[hid]?.annotations[top]?.[key];
        return fromValidation;
    }, [tick, key]);
}

export function useRoot(top: string) {
    const store = useStore();
    useTick(`top:${top}:root`);
    return store.module(store.selected).toplevels[top].root;
}

export function useNode(top: string, path: Path) {
    const tstore = useStore();
    const store = tstore.estore;
    const loc = lastChild(path);
    useTick(`node:${loc}`);
    const mstate = store.state[tstore.selected];
    const results = mstate.parseResults[top] ?? mstate.importResults[top];
    let meta = results?.ctx.meta[loc];
    const refs = results?.internalReferences[loc];
    const statuses = useSelectionStatuses(pathKey(path)) ?? undefined;
    if (refs) {
        if (refs.usages.length === 0 && (results.kind.type !== 'definition' || !results.kind.provides.some((r) => r.loc === loc))) {
            meta = { kind: 'unused' };
        } else {
            meta = { kind: 'used' };
        }
    }
    return {
        node: tstore.module(tstore.selected).toplevels[top].nodes[loc],
        sel: statuses, // selectionStatuses[pathKey(path)],
        meta,
        spans: mstate.spans[top]?.[loc] ?? [], // STOPSHIP store.state.parseResults[top]?.spans[loc],
    };
}

// selection statuses ... calculate once (contexttt?) thanks.

// export const ProvideSelectionStatuses = ({ top }:{top:string}) => {
//     const onSS = useMakeSelectionStatuses(top)
//     return <SelectionStatusCtx.Provider value={onSS}>
//     </SelectionStatusCtx.Provider>
// }

export const getAllSelectionStatuses = (top: Toplevel, selection: NodeSelection[]) => {
    const statuses: SelectionStatuses = {};
    selection.forEach((s) => {
        if (s.start.path.root.top === top.id) {
            const st = getSelectionStatuses(s, top);
            Object.entries(st).forEach(([key, status]) => {
                if (statuses[key]) {
                    statuses[key].cursors.push(...status.cursors);
                    statuses[key].highlight = mergeHighlights(statuses[key].highlight, status.highlight);
                } else {
                    statuses[key] = status;
                }
            });
        }
    });
    return statuses;
};

export const useMakeSelectionStatuses = (top: string) => {
    const store = useStore();
    const selection = useSelection();
    const state = useMemo(
        () => ({ listeners: {} as Record<string, (ss: SelectionStatuses[''] | null) => void>, prev: {} as SelectionStatuses }),
        [top],
    );
    useEffect(() => {
        const statuses = getAllSelectionStatuses(store.module(store.selected).toplevels[top], selection);
        Object.entries(statuses).forEach(([key, value]) => {
            if (!equal(value, state.prev[key])) {
                state.listeners[key]?.(value);
            }
        });
        Object.keys(state.prev).forEach((key) => {
            if (!statuses[key]) state.listeners[key]?.(null);
        });
        state.prev = statuses;
    }, [selection]);

    return useCallback(
        (key: string) => {
            const [value, set] = useState(state.prev[key] as null | SelectionStatuses['']);
            useEffect(() => {
                state.listeners[key] = set;
                return () => {
                    if (state.listeners[key] === set) delete state.listeners[key];
                };
            }, [key]);
            return value;
        },
        [top],
    );
};

export const SelectionStatusCtx = createContext<(key: string) => SelectionStatuses[''] | null>(() => {
    return null;
});

export const useSelectionStatuses = (key: string) => {
    return useContext(SelectionStatusCtx)(key);
};
