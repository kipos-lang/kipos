import equal from 'fast-deep-equal';
import { Node } from '../../shared/cnodes';
import { Delta, revDelta } from '../history';
import { Module, Toplevel } from '../types';
import { Project } from './storage';
import { Evt } from './store';

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

export const applyDiff = (modules: Record<string, Module>, base: Record<string, Module>, diff: Diff): Evt[] => {
    const evts: Evt[] = [];
    Object.entries(diff).forEach(([id, diff]) => {
        if (diff.meta && !diff.meta.next) {
            // removing the module
            delete modules[id];
            evts.push('modules');
            return;
        }
        if (!modules[id]) {
            if (!base[id]) {
                throw new Error(`got a modification delta for mdule ${id}, but not present in base`);
            }
            modules[id] = { ...base[id], toplevels: {}, history: [] };
        }
        const mod = modules[id];
        if (diff.meta) {
            const proots = mod.roots;
            Object.assign(mod, diff.meta.next);
            evts.push(`module:${id}`);
            if (!equal(proots, mod.roots)) {
                evts.push(`module:${id}:roots`);
            }
        }

        if (diff.toplevels) {
            Object.entries(diff.toplevels).forEach(([tid, tdiff]) => {
                if (tdiff.meta && !tdiff.meta.next) {
                    // removing the toplevel
                    delete mod.toplevels[tid];
                    evts.push(`top:${tid}`);
                    return;
                }
                if (!mod.toplevels[tid]) {
                    if (!base[id].toplevels[tid]) {
                        throw new Error(`got a modification delta for toplevel ${tid} of module ${id}, but not present in base`);
                    }
                    mod.toplevels[tid] = { ...base[id].toplevels[tid], nodes: {} };
                }
                const top = mod.toplevels[tid];
                if (tdiff.meta) {
                    const root = top.root;
                    const children = top.children;
                    const submodule = top.submodule;
                    Object.assign(top, tdiff.meta);
                    if (!equal(root, top.root)) evts.push(`top:${tid}:root`);
                    if (!equal(children, top.children)) evts.push(`top:${tid}:children`);
                    if (!equal(submodule, top.submodule)) evts.push(`top:${tid}:submodule`);
                    evts.push(`top:${tid}`);
                }
                if (tdiff.nodes) {
                    Object.entries(tdiff.nodes).forEach(([nid, node]) => {
                        evts.push(`node:${nid}`);
                        if (!node.next) {
                            delete top.nodes[nid];
                            return;
                        }
                        if (!top.nodes[nid]) {
                            top.nodes[nid] = { ...base[id].toplevels[tid].nodes[nid] };
                        }
                        Object.assign(top.nodes[nid], node.next);
                    });
                }
            });
        }
    });
    return evts;
};

export const reverseDiff = (diff: Diff) =>
    Object.fromEntries(
        Object.entries(diff).map(([id, diff]) => [
            id,
            {
                meta: diff.meta ? revDelta(diff.meta) : undefined,
                toplevels: diff.toplevels
                    ? Object.fromEntries(
                          Object.entries(diff.toplevels).map(([id, top]) => [
                              id,
                              {
                                  meta: top.meta ? revDelta(top.meta) : undefined,
                                  nodes: top.nodes
                                      ? Object.fromEntries(Object.entries(top.nodes).map(([id, node]) => [id, revDelta(node)]))
                                      : undefined,
                              },
                          ]),
                      )
                    : undefined,
            },
        ]),
    );

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
    // saveModule(project: string, module: Module): Promise<void>;
    saveChange(project: string, change: Change, message: string): Promise<void>;
    history(project: string, current: string | null, count: number): Promise<{ diff: Diff; ts: number; message: string; id: string }[]>;
}
