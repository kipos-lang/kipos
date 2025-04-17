import { expect, test } from 'bun:test';
import { Module } from '../types';
import { Args, changeKey, committer, savingKey, Status } from './storage';
import { Change } from './versionings';

const newArgs = (save: Change | null, change: Change | null) => {
    const state = {
        storage: {
            [changeKey]: change ? JSON.stringify(change) : null,
            [savingKey]: save ? JSON.stringify(save) : null,
        },
        status: null as null | Status,
        timers: {} as Record<number, { fn: Function; time: number }>,
        tid: 0,
        commit: null as null | { rej: (e: Error) => void; res: (f: boolean) => void; change: Change },
    };
    return {
        state,
        args: {
            commit(change) {
                return new Promise((res, rej) => {
                    state.commit = { res, rej, change };
                });
            },
            minWait: 10,
            maxWait: 20,
            onStatus(status) {
                state.status = status;
            },
            timer: {
                set(fn, time) {
                    let id = state.tid++;
                    state.timers[id] = { fn, time };
                    return id as any;
                },
                clear(id) {
                    delete state.timers[id as any];
                },
            },
            storage: {
                setItem(key, value) {
                    state.storage[key as typeof changeKey] = value;
                },
                getItem(key) {
                    return state.storage[key as typeof changeKey];
                },
            },
        } satisfies Args,
    };
};

const basicMeta: Omit<Module, 'toplevels' | 'history'> = {
    id: 'ok',
    imports: [],
    languageConfiguration: '',
    name: '',
    parent: '',
    pluginConfig: {},
    roots: [],
    selections: [],
};

test('very basic', async () => {
    const { args, state } = newArgs(null, null);
    const save = committer(args);
    expect(state.status).toBe(null);

    // Add a change with just meta, it should set a timer
    save({ ...basicMeta, history: [], toplevels: {}, name: 'newname' }, true, []);
    expect(state.status).toBe('dirty');
    expect(state.tid).toBe(1);
    expect(state.commit).toBe(null);

    // Trigger the debounce timer, it should call `commit()`
    state.timers[0].fn();
    expect(state.status).toBe('saving');
    expect(state.commit).not.toBe(null);
    expect(state.commit?.change).toEqual({
        [basicMeta.id]: { meta: { ...basicMeta, name: 'newname' } },
    });
    expect(state.storage[changeKey]).toBe('null');
    expect(state.storage[savingKey]).toBe(JSON.stringify(state.commit!.change));

    // Signal commit success, it should clean up
    state.commit!.res(true);
    await tick();
    expect(state.status).toBe('clean');
    expect(state.storage[changeKey]).toBe('null');
    expect(state.storage[savingKey]).toBe('null');
});

const tick = () => new Promise((res) => res(null));

test('change while saving', async () => {
    const { args, state } = newArgs(null, null);
    const save = committer(args);
    expect(state.status).toBe(null);

    // First save
    save({ ...basicMeta, history: [], toplevels: {} }, true, []);

    // Trigger the debounce timer, it should call `commit()`
    state.timers[0].fn();

    // Save in the middle
    save({ ...basicMeta, history: [], toplevels: {}, name: 'newname' }, true, []);

    // Signal commit success, it should clean up
    state.commit!.res(true);
    await tick();
    expect(state.status).toBe('dirty');
    expect(JSON.parse(state.storage[changeKey]!)).toEqual({
        [basicMeta.id]: { meta: { ...basicMeta, name: 'newname' } },
    });
    expect(state.storage[savingKey]).toBe('null');

    // Trigger the next timer, it should call `commit()`
    state.timers[1].fn();
    state.commit!.res(true);
    await tick();
    // And all is right with the world
    expect(state.status).toBe('clean');
    expect(state.storage[changeKey]).toBe('null');
    expect(state.storage[savingKey]).toBe('null');
});

/*
I want to test:

- [x] one change, wait the time, saving completes
- [-] multiple changes, wait the time, saving completes
- [x] multiple changes, wait the time, while saving is happening, make more changes
- saving fails and there are pending changes, should merge back together
- the page closes in the middle of saving
    - equivalent to opening the page w/ :saving populated (and maybe :pending)
- the page closes in the middle of waiting
    - equivalent to opening the page w/ :pending populated
*/
