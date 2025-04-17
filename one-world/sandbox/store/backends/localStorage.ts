import { Module } from '../../types';
import { Project } from '../storage';
import { Backend, Change } from '../versionings';

export const LS: Backend = {
    async listProjects() {
        return [{ id: 'default', created: Date.now(), name: 'Default project', opened: Date.now() }];
    },
    loadProject(id: string) {
        return loadModules();
    },
    async createProject(project: Project) {
        throw new Error(`localStorage backend only supports one project atm`);
    },
    async saveModule(project, module) {
        saveModule(module);
    },
    async history(id: string, start: string | null, count: number) {
        return []; // not implemented at all
    },
    async saveChange(project: string, change: Change, message: string) {
        throw new Error('not yet');
    },
};

export const key = (id: string) => `kipos:${id}`;
const moduleKey = (id: string) => key('module:' + id);

export const saveModule = (module: Module) => {
    localStorage.setItem(moduleKey(module.id), JSON.stringify(module));
};

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
