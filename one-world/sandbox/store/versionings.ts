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

export const describeDiff = (diff: Diff) => {
    return Object.entries(diff).flatMap(([mid, mod]) => [
        `For mdule ${mid}:`,
        ...(mod.meta ? [!mod.meta.next ? '  - delete module' : !mod.meta.prev ? '  - create module' : ` - meta change`] : []),
        ...(mod.toplevels
            ? Object.entries(mod.toplevels).flatMap(([tid, top]) => [
                  `  For top ${tid}:`,
                  ...(top.meta ? [!top.meta.next ? '    - delete top' : !top.meta.prev ? '    - create top' : `    - meta change`] : []),
                  ...(top.nodes
                      ? Object.entries(top.nodes).flatMap(([nid, node]) => [
                            !node.next ? `    - node ${nid} delete` : !node.prev ? `    - node ${nid} create` : `    - node ${nid} change`,
                        ])
                      : []),
              ])
            : []),
    ]);
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

export const applyDiff = (modules: Record<string, Module>, base: Record<string, Module>, diff: Diff) => {
    const evts: Evt[] = [];
    const changedModules: Record<string, string[]> = {};
    Object.entries(diff).forEach(([id, diff]) => {
        if (diff.meta && !diff.meta.next) {
            // removing the module
            delete modules[id];
            evts.push('modules');
            return;
        }
        changedModules[id] = [];
        if (diff.meta && !diff.meta.prev) {
            modules[id] = { ...diff.meta.next!, history: [], toplevels: {} };
        }
        if (!modules[id]) {
            throw new Error(`got a modification delta for mdule ${id}, but not present in base`);
        }
        if (modules[id] === base[id]) {
            modules[id] = { ...base[id], toplevels: { ...base[id].toplevels }, history: [] };
        }
        const mod = modules[id];
        if (diff.meta) {
            const proots = mod.roots;
            const psel = mod.selections;
            Object.assign(mod, diff.meta.next);
            evts.push(`module:${id}`);
            if (!equal(proots, mod.roots)) {
                evts.push(`module:${id}:roots`);
            }
            if (!equal(psel, mod.selections)) {
                evts.push(`module:${id}:selection`);
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
                changedModules[id].push(tid);
                if (tdiff.meta && !tdiff.meta.prev) {
                    mod.toplevels[tid] = { ...tdiff.meta.next!, nodes: {} };
                }
                if (!mod.toplevels[tid]) {
                    throw new Error(`got a modification delta for toplevel ${tid} of module ${id}, but not present in base`);
                }
                // got to clone before modifying
                if (mod.toplevels[tid] === base[id].toplevels[tid]) {
                    mod.toplevels[tid] = { ...mod.toplevels[tid], nodes: { ...mod.toplevels[tid].nodes } };
                }
                const top = mod.toplevels[tid];
                if (tdiff.meta) {
                    const root = top.root;
                    const children = top.children;
                    const submodule = top.submodule;
                    Object.assign(top, tdiff.meta.next);
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
                        top.nodes[nid] = node.next;
                        // if (!base[id].toplevels[tid].nodes[nid])
                        // if (top.nodes[nid] === base[id].toplevels[tid].nodes[nid]) {
                        //     top.nodes[nid] = { ...top.nodes[nid] };
                        // }
                        // Object.assign(top.nodes[nid], node.next);
                    });
                }
            });
        }
    });
    return { evts, changedModules };
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
