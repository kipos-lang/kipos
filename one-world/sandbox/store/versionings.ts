import { Node } from '../../shared/cnodes';
import { Delta } from '../history';
import { Module, Toplevel } from '../types';
import { Project } from './storage';

// export type Commit = {
//     ts: number;
//     id: string;
//     hash: string;
//     treeHash: string;
//     message: string;
// };

// export type InMemory = {
//     modules: Record<string, Module>;
//     // a cache of the hashes
//     moduleHashes: Record<string, { hash: string; toplevels: Record<string, string> }>;
//     commits: Record<string, Commit>;
//     // name -> HEAD
//     branches: Record<string, string>;
// };

// can I make an interface that could be backed by either git or my custom thing?
// git could do `git show SHA:/path/to/file`

// If I knew the line numbers of things, I could probably
// calculate a `Diff` myself and skip the need to send over the whole 'change'.
// that's a job for another day.

export type Change = {
    [module: string]: null | {
        // module.json
        meta?: Omit<Module, 'toplevels' | 'history'>;
        // toplevels/{id}.json
        toplevels?: { [toplevel: string]: null | { top: Toplevel; changedNodes: { meta: boolean; nodes: true | string[] } } };
    };
};

export type Diff = {
    [module: string]: {
        // module.json
        meta?: Delta<null | Omit<Module, 'toplevels' | 'history'>>;
        // toplevels/{id}.json
        toplevels?: {
            [toplevel: string]: {
                meta?: Delta<null | Omit<Toplevel, 'nodes'>>;
                nodes?: { [node: string]: Delta<Node | null> };
            };
        };
    };
};

// export interface VCS {
//     loadWorkspace(): Promise<{ modules: { [module: string]: Module }; head: string }>;
//     // write that to disk thanksss
//     applyChange(change: Change, message: string, amend: boolean): Promise<string>;
//     diff(current: string | null, past: string): Promise<Diff>;
//     history(current: string | null, count: number): Promise<{ diff: Diff; ts: number; message: string }[]>;
//     head(): Promise<string>;
// }

export interface Backend {
    listProjects(): Promise<Project[]>;
    createProject(project: Project): Promise<void>;
    loadProject(project: string): Promise<Record<string, Module>>;
    saveModule(project: string, module: Module): Promise<void>;
    saveChange(project: string, change: Change, message: string): Promise<void>;
    history(project: string, current: string | null, count: number): Promise<{ diff: Diff; ts: number; message: string; id: string }[]>;
}
