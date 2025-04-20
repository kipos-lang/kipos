import { Module } from '../../types';
import { Project } from '../storage';
import { Backend, Change } from '../versionings';

export interface Storage {
    get length(): number;
    key(i: number): string | null;
    setItem(key: string, value: string): void;
    getItem(key: string): string | null;
    removeItem(key: string): void;
}

export class LS implements Backend {
    storage: Storage;
    constructor(storage: Storage = localStorage) {
        this.storage = storage;
    }

    async listProjects() {
        return [{ id: 'default', created: Date.now(), name: 'Default project', opened: Date.now() }];
    }

    loadProject(id: string) {
        return loadModules(this.storage);
    }

    async createProject(project: Project) {
        throw new Error(`localStorage backend only supports one project atm`);
    }

    async saveModule(project: string, module: Module) {
        saveModule(module, this.storage);
    }

    async history(id: string, start: string | null, count: number) {
        return []; // not implemented at all
    }

    async saveChange(project: string, change: Change, message: string) {
        Object.entries(change).forEach(([id, mod]) => {
            if (!mod) {
                return this.storage.removeItem(moduleKey(id));
            }
            let module = loadModule(id, this.storage);
            if (!module) {
                if (!mod.meta) {
                    throw new Error(`non-meta update of nonexistant module`);
                }
                module = { ...mod.meta, history: [], toplevels: {} };
            } else if (mod.meta) {
                Object.assign(module, mod.meta);
            }
            if (mod.toplevels) {
                Object.entries(mod.toplevels).forEach(([id, top]) => {
                    if (!top) {
                        delete module.toplevels[id];
                    } else {
                        module.toplevels[id] = top.top;
                    }
                });
            }
            saveModule(module, this.storage);
        });
    }
}

export const key = (id: string) => `kipos:${id}`;
const moduleKey = (id: string) => key('module:' + id);

export const saveModule = (module: Module, storage: Storage) => {
    storage.setItem(moduleKey(module.id), JSON.stringify(module));
};

export const loadModule = (id: string, storage: Storage): Module | null => {
    const current = storage.getItem(moduleKey(id))!;
    return current ? JSON.parse(current) : null;
};

export const loadModules = async (storage: Storage) => {
    const modules: Record<string, Module> = {};
    for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key?.startsWith('kipos:module:')) {
            const module = JSON.parse(storage.getItem(key)!);
            modules[module.id] = module;
        }
    }
    return modules;
};
