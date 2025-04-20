import { test, expect } from 'bun:test';
import { LS, Storage } from './localStorage';
import { newModule, Store } from '../store';
import { Timers } from '../storage';
import { DefaultCompiler } from '../default-lang/DefaultCompiler';
import { defaultLang } from '../default-lang/default-lang';

const newTimers = () => {
    const state = {
        timers: {} as Record<number, { fn: Function; time: number }>,
        tid: 0,
    };

    return {
        set(fn: Function, time: number) {
            let id = state.tid++;
            state.timers[id] = { fn, time };
            return id as any;
        },
        clear(id: Timer) {
            delete state.timers[id as any];
        },
        flush() {
            Object.keys(state.timers).forEach((k) => {
                state.timers[k as any].fn();
                delete state.timers[k as any];
            });
        },
        state,
    };
};

const storage = (): Storage => {
    const state: Record<string, string> = {};
    return {
        // state,
        setItem(key, value) {
            state[key] = value;
        },
        getItem(key) {
            return state[key];
        },
        key(i) {
            return Object.keys(state)[i] ?? null;
        },
        get length() {
            return Object.keys(state).length;
        },
        removeItem(key) {
            delete state[key];
        },
    };
};

test('a full run of the backend', async () => {
    const ls = new LS(storage());
    const timers = newTimers();
    expect(await ls.listProjects()).toMatchObject([{ id: 'default', name: 'Default project' }]);
    expect(await ls.loadProject('default')).toEqual({});
    const store = new Store('default', {}, '', ls, { default: { ...defaultLang, compiler: () => new DefaultCompiler() } }, timers, ls.storage);
    timers.flush();
    await new Promise((res) => res(1));
    const nm = store.modules[store.selected];
    expect(await ls.loadProject('default')).toEqual({ [nm.id]: nm });
    const saved = JSON.parse(JSON.stringify(nm));

    // Now we do some changes
    'wat'.split('').forEach((key) => store.update(nm.id, { type: 'key', key, mods: {} }));
    expect(nm.history).toHaveLength(1);
    ' hi'.split('').forEach((key) => store.update(nm.id, { type: 'key', key, mods: {} }));
    expect(nm.history).toHaveLength(3);
    timers.flush();
    await new Promise((res) => res(1));
    expect(await ls.loadProject('default')).toEqual({ [nm.id]: { ...nm, history: [] } });
});
