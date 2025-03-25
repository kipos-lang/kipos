import { LanguageConfiguration, Module } from './types';

export const key = (id: string) => `kipos:${id}`;

const moduleKey = (id: string) => key('module:' + id);
const lcKey = (id: string) => key('language:' + id);

export const saveModule = (module: Module) => {
    localStorage.setItem(moduleKey(module.id), JSON.stringify(module));
};

export const loadLanguageConfigs = () => {
    const configs: Record<string, LanguageConfiguration> = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('kipos:language:')) {
            const module = JSON.parse(localStorage.getItem(key)!);
            configs[module.id] = module;
        }
    }
    return configs;
};

export const loadModules = () => {
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
