import { Module } from '../types';

import LightningFS from '@isomorphic-git/lightning-fs';
import http from 'isomorphic-git/http/web';
import git from 'isomorphic-git';
import { Buffer } from 'buffer';

export const key = (id: string) => `kipos:${id}`;

const moduleKey = (id: string) => key('module:' + id);
const lcKey = (id: string) => key('language:' + id);

// what we should do:
//

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
