import { Module } from '../types';

import { Change } from './versionings';

export type ModuleMeta = Omit<Module, 'toplevels' | 'history'>;

export type Project = {
    id: string;
    name: string;
    created: number;
    opened: number;
};

const moduleMeta = (module: Module): ModuleMeta => {
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

const loadChange = (storage: Storage): Change | null => {
    const data = storage.getItem(changeKey);
    if (!data) return null;
    return JSON.parse(data);
};
const saveChange = (change: Change | null, storage: Storage) => {
    storage.setItem(changeKey, JSON.stringify(change));
};

const loadSaveChange = (storage: Storage): Change | null => {
    const data = storage.getItem(savingKey);
    if (!data) return null;
    return JSON.parse(data);
};
const saveSaveChange = (change: Change | null, storage: Storage) => {
    storage.setItem(savingKey, JSON.stringify(change));
};

type Storage = { setItem(key: string, value: string): void; getItem(key: string): string | null };

export type Args = {
    commit: (change: Change) => Promise<void>;
    onStatus: (status: Status) => void;
    minWait: number;
    maxWait: number;
    timer?: {
        set: (f: () => void, time: number) => Timer;
        clear: (t: Timer) => void;
    };
    storage?: Storage;
};

export function committer({
    commit,
    minWait,
    maxWait,
    onStatus,
    storage = localStorage,
    timer = { set: (f, t) => setTimeout(f, t), clear: (t) => clearTimeout(t) },
}: Args) {
    let last = 0;
    let tid = null as null | Timer;
    let status: Status = 'clean';
    // TODO load the buffer from localStorage
    let change: Change | null = loadChange(storage);
    let saving: Change | null = loadSaveChange(storage);
    if (saving) {
        mergeChanges(saving, change);
        change = saving;
        saving = null;
        saveChange(change, storage);
        saveSaveChange(saving, storage);
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
        saveChange(change, storage);
        saveSaveChange(saving, storage);
        setStatus('saving');
        commit(saving).then(
            () => {
                setStatus('clean');
                saving = null;
                saveSaveChange(saving, storage);
                if (change != null && tid == null) {
                    setStatus('dirty');
                    tid = timer.set(save, minWait);
                }
            },
            (err) => {
                console.warn('failed to save');
                setStatus('failed');
                mergeChanges(saving!, change);
                change = saving!;
                saving = null;
                saveChange(change, storage);
                saveSaveChange(saving, storage);
            },
        );
    };

    // We loaded up dirty, let's get ready to save
    if (change) {
        setStatus('dirty');
        tid = timer.set(() => {
            tid = null;
            save();
        }, minWait);
    }

    const externalCommit = (module: Module, withMeta: boolean, changedTops: string[]) => {
        if (!change) change = {};
        addToChange(change, module, withMeta, changedTops);
        saveChange(change, storage);
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
    return { commit: externalCommit, change };
}

// YHR OLF WAY

export const key = (id: string) => `kipos:${id}`;
const moduleKey = (id: string) => key('module:' + id);
const lcKey = (id: string) => key('language:' + id);

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
