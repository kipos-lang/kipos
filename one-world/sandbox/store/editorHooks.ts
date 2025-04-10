import { useEffect, useRef, useState } from 'react';
import { Evt, useStore } from './store';
import { EvaluationResult, FailureKind } from './language';

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
    const module = store.selected();
    const estore = store.estore(module);

    useTick(`top:${top}:parse-results`);
    return {
        ...estore.state.parseResults[top],
        validation: estore.state.validationResults[estore.state.dependencies.components.pointers[top]],
        spans: {},
    };
};

export function useDependencyGraph() {
    const store = useStore();
    const selected = store.selected();
    const estore = store.estore(selected);
    useTick(`module:${selected}:dependency-graph`);
    return estore.state.dependencies;
}

export function useTopSource(top: string) {
    const store = useStore();
    const selected = store.selected();
    const compiler = store.compiler();
    const [results, setResults] = useState(null as null | string);
    useEffect(() => {
        return compiler.listen('viewSource', { module: selected, top }, ({ source }) => setResults(source));
    }, [top]);
    return results;
}
export function useTopFailure(top: string) {
    const store = useStore();
    const selected = store.selected();
    const compiler = store.compiler();
    const [results, setResults] = useState(null as null | FailureKind[]);
    useEffect(() => {
        return compiler.listen('failure', { module: selected, top }, (results) => setResults(results));
    }, [top]);
    return results;
}
export function useTopResults(top: string) {
    const store = useStore();
    const selected = store.selected();
    const compiler = store.compiler();
    const [results, setResults] = useState(null as null | EvaluationResult[]);
    useEffect(() => {
        return compiler.listen('results', { module: selected, top }, ({ results }) => setResults(results));
    }, [top]);
    return results;
}

export function useParseResults() {
    const store = useStore();
    const selected = store.selected();
    const estore = store.estore(selected);
    useTick(`module:${selected}:parse-results`);
    return estore.state.parseResults;
}
export function useModule() {
    const store = useStore();
    const selected = store.selected();
    useTick(`module:${selected}`);
    return store.module(selected);
}
export function useSelection() {
    const store = useStore();
    const selected = store.selected();
    useTick(`module:${selected}:selection`);
    return store.module(selected).selections;
}
export function useIsSelectedTop(top: string) {
    const store = useStore();
    const selected = store.selected();
    return useTickCompute(`module:${selected}:selection`, store.module(selected).selections[0].start.path.root.top === top, (old) => {
        return store.module(selected).selections[0].start.path.root.top === top;
    });
}
export function useSelectedTop() {
    const store = useStore();
    const selected = store.selected();
    return useTickCompute(`module:${selected}:selection`, store.module(selected).selections[0].start.path.root.top, (old) => {
        return store.module(selected).selections[0].start.path.root.top;
    });
}
