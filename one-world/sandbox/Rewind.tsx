import React, { useState, useEffect, useRef } from 'react';
import { useStore } from './store/store';
import { describeDiff, reverseDiff } from './store/versionings';

const usePromise = <T,>(f: () => Promise<T>) => {
    const [v, set] = useState(null as null | T);
    useEffect(() => {
        f().then(set);
    }, []);
    return v;
};

export const Rewind = () => {
    const [on, setOn] = useState(false);
    const store = useStore();
    useEffect(() => {
        if (!on) return;
        store.freeze();
        return () => store.unfreeze();
    }, [on]);

    return (
        <div>
            <button onClick={() => setOn(!on)}>Toggle</button>
            {on ? <RewindInner /> : null}
        </div>
    );
};

export const RewindInner = () => {
    const store = useStore();
    const history = usePromise(() => store.backend.history(store.project, null, 100));
    const [at, setAt] = useState(0);
    const lat = useRef(at);
    useEffect(() => {
        if (!history) return;
        // if (at === 0) {
        //     store.unfreeze();
        //     return;
        // }
        if (lat.current === 0) {
            store.freeze();
        }
        if (at > lat.current) {
            console.log('from', lat.current, 'up to', at);
            for (let i = lat.current + 1; i <= at; i++) {
                const back = reverseDiff(history[i].diff);
                // console.log('back applying diff:\n' + describeDiff(back).join('\n'));
                store.frozenDiff(back);
            }
        } else {
            console.log('from', lat.current, 'down to', at);
            for (let i = lat.current; i > at; i--) {
                // console.log('now at', i, history[i]);
                store.frozenDiff(history[i].diff);
                // console.log('applying diff:\n' + describeDiff(history[i].diff).join('\n'));
            }
        }
        lat.current = at;
    }, [at, history]);
    if (!history) return 'Loading...';
    // console.log(history);
    return (
        <div>
            <h4>History {history.length}</h4>
            {/* the first history item is the creation of the current module, so we skip that */}
            <input type="range" min="0" max={history.length - 2} value={at} onChange={(evt) => setAt(+evt.target.value)} />
            {at}
        </div>
    );
};
