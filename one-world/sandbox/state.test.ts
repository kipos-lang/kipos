import { RecNodeT } from '../shared/cnodes';
import { shape } from '../shared/shape';
// import { applyUpdate, testCtree } from './applyUpdate';
// import { check } from './check.test';
// import { handleKey } from './handleKey';
// import { root } from './root';
import { asTop, atPath, id, idc, js, listc, nloc, noText, round, selPath, smoosh, spaced, TestState, text } from '../keyboard/test-utils';
import { AppState, reduce } from './state';
import { selStart } from '../keyboard/utils';
import { root } from '../keyboard/root';
import { Mods } from '../keyboard/handleShiftNav';
// import { keyUpdate } from './ui/keyUpdate';
// import { Cursor } from './utils';
// import { validate } from './validate';

const show = (state: AppState) => state.roots.map((id) => shape(root({ top: state.tops[id] }))).join('\n');

const initial = (): AppState => ({
    history: [],
    roots: ['a'],
    selections: [{ start: selStart({ root: { top: 'a', ids: [] }, children: ['b'] }, { type: 'id', end: 0 }) }],
    tops: { a: { children: [], id: 'a', nodes: { b: { type: 'id', text: '', loc: 'b' } }, root: 'b' } },
});

test('ok can do have a little undo', () => {
    const nextLoc = nloc();
    let state = reduce(initial(), { type: 'key', key: 'a', config: js, mods: {} }, false, nextLoc);
    expect(show(state)).toEqual('id(a/0)');
    state = reduce(state, { type: 'undo' }, false, nextLoc);
    expect(show(state)).toEqual('id()');
});

test('arrow shouldnt add history', () => {
    const nextLoc = nloc();
    let state = reduce(initial(), { type: 'key', key: 'a', config: js, mods: {} }, false, nextLoc);
    expect(show(state)).toEqual('id(a/0)');
    state = reduce(state, { type: 'key', key: 'ArrowLeft', config: js, mods: {} }, false, nextLoc);
    expect(show(state)).toEqual('id(a/0)');
    expect(state.history).toHaveLength(1);
});

const dontLoc = () => {
    throw new Error(`I wasn't expecting to need to generate a loc`);
};

const key = (state: AppState, key: string, nextLoc: () => string = dontLoc, mods: Mods = {}) =>
    reduce(state, { type: 'key', key, config: js, mods }, false, nextLoc);

test('closing string', () => {
    const nextLoc = nloc();
    let state = initial();
    'a("a"'.split('').forEach((letter) => (state = key(state, letter, nextLoc)));
    expect(show(state)).toEqual('list[smooshed](id(a/0) (text(a)))');
});

const left = (state: AppState, count: number, shift = false) => {
    for (let i = 0; i < count; i++) {
        state = key(state, 'ArrowLeft', undefined, { shift });
    }
    return state;
};

test('space wrap', () => {
    const nextLoc = nloc();
    let state = initial();
    'a b'.split('').forEach((letter) => (state = key(state, letter, nextLoc)));
    state = left(state, 3, true);
    state = key(state, '(', nextLoc);
    expect(show(state)).toEqual('(list[spaced](id(a/0) id(b/0)))');
});

// test('can we wrap', () => {
//     const nextLoc = nloc();
//     let state = reduce(initial(), { type: 'key', key: 'a', config: js, mods: {} }, false, nextLoc);
//     expect(show(state)).toEqual('id(a/0)');
//     state = reduce(state, { type: 'undo' }, false, nextLoc);
//     expect(show(state)).toEqual('id()');
// });
