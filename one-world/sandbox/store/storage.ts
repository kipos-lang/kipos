import { Module } from '../types';

import LightningFS from '@isomorphic-git/lightning-fs';
import http from 'isomorphic-git/http/web';
import git from 'isomorphic-git';
import { Buffer } from 'buffer';
import { Change } from './versionings';

export const key = (id: string) => `kipos:${id}`;

const moduleKey = (id: string) => key('module:' + id);
const lcKey = (id: string) => key('language:' + id);

// what we should do:
//

const moduleMeta = (module: Module): Omit<Module, 'toplevels' | 'history'> => {
    const { toplevels, history, ...meta } = module;
    return meta;
};

const mergeChanges = (one: Change, two: Change | null) => {
    if (!two) return;
    Object.entries(two).forEach(([key, mod]) => {
        if (!mod || !one[key]) {
            one[key] = mod;
            return;
        }
        if (mod.meta) one[key].meta = mod.meta;
        if (mod.toplevels) {
            if (!one[key].toplevels) {
                one[key].toplevels = mod.toplevels;
            } else {
                Object.assign(one[key].toplevels, mod.toplevels);
            }
        }
    });
};

const addToChange = (change: Change, module: Module, withMeta: boolean, tops: string[]) => {
    let meta = change[module.id]?.meta;
    let toplevels = change[module.id]?.toplevels;
    if (withMeta) {
        meta = moduleMeta(module);
    }
    if (tops.length) {
        if (!toplevels) toplevels = {};
        tops.forEach((id) => (toplevels![id] = module.toplevels[id] ?? null));
    }
    change[module.id] = { meta, toplevels };
};

export type Status = 'clean' | 'dirty' | 'saving' | 'failed';

export const changeKey = `kipos:change:pending`;
export const savingKey = `kipos:change:saving`;

const loadChange = (storage: Args['localStorage']): Change | null => {
    const data = storage.getItem(changeKey);
    if (!data) return null;
    return JSON.parse(data);
};
const saveChange = (change: Change | null, storage: Args['localStorage']) => {
    storage.setItem(changeKey, JSON.stringify(change));
};

const loadSaveChange = (storage: Args['localStorage']): Change | null => {
    const data = storage.getItem(savingKey);
    if (!data) return null;
    return JSON.parse(data);
};
const saveSaveChange = (change: Change | null, storage: Args['localStorage']) => {
    storage.setItem(savingKey, JSON.stringify(change));
};

export type Args = {
    commit: (change: Change) => Promise<boolean>;
    onStatus: (status: Status) => void;
    minWait: number;
    maxWait: number;
    timer?: {
        set: (f: () => void, time: number) => Timer;
        clear: (t: Timer) => void;
    };
    localStorage: { setItem(key: string, value: string): void; getItem(key: string): string | undefined };
};

export function committer({ commit, minWait, maxWait, onStatus, localStorage, timer = { set: setTimeout, clear: clearTimeout } }: Args) {
    let last = 0;
    let tid = null as null | Timer;
    let status: Status = 'clean';
    // TODO load the buffer from localStorage
    let change: Change | null = loadChange(localStorage);
    let saving: Change | null = loadSaveChange(localStorage);
    if (saving) {
        mergeChanges(saving, change);
        change = saving;
        saving = null;
        saveChange(change, localStorage);
        saveSaveChange(saving, localStorage);
    }

    const setStatus = (ns: Status) => {
        if (ns !== status) {
            status = ns;
            onStatus(ns);
        }
    };

    const save = () => {
        if (saving != null) return console.error('trying to save, but save is already underway');
        if (change == null) return console.error(`no change? while saving`);
        saving = change;
        change = null;
        saveChange(change, localStorage);
        saveSaveChange(saving, localStorage);
        setStatus('saving');
        commit(saving).then(
            () => {
                setStatus('clean');
                saving = null;
                saveSaveChange(saving, localStorage);
                if (change != null && tid == null) {
                    tid = timer.set(save, minWait);
                }
            },
            (err) => {
                console.warn('failed to save');
                setStatus('failed');
                mergeChanges(saving!, change);
                change = saving!;
                saving = null;
                saveChange(change, localStorage);
                saveSaveChange(saving, localStorage);
            },
        );
    };

    return (module: Module, withMeta: boolean, changedTops: string[]) => {
        if (!change) change = {};
        addToChange(change, module, withMeta, changedTops);
        saveChange(change, localStorage);
        if (status === 'saving') {
            return; // we wait
        }
        if (tid) timer.clear(tid);
        setStatus('dirty');
        // TODO: if (Date.now() - last >= maxWait)
        // then we just sit tight
        tid = timer.set(() => {
            tid = null;
            save();
        }, minWait);
    };
}

export const saveModule = (module: Module, changedTops: string[]) => {
    // const current = localStorage.getItem(moduleKey(module.id));
    // ... should we amend ... lets not for the moment
    localStorage.setItem(moduleKey(module.id), JSON.stringify(module));
};

// export const loadLanguageConfigs = () => {
//     const configs: Record<string, LanguageConfiguration> = {};
//     for (let i = 0; i < localStorage.length; i++) {
//         const key = localStorage.key(i);
//         if (key?.startsWith('kipos:language:')) {
//             const module = JSON.parse(localStorage.getItem(key)!);
//             configs[module.id] = module;
//         }
//     }
//     return configs;
// };

export const loadModules = async () => {
    const modules: Record<string, Module> = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('kipos:module:')) {
            const module = JSON.parse(localStorage.getItem(key)!);
            modules[module.id] = module;
        }
    }
    return modules;
};
