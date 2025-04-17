import LightningFS from '@isomorphic-git/lightning-fs';
import http from 'isomorphic-git/http/web';
import git from 'isomorphic-git';
import { Buffer } from 'buffer';
import { Module, Toplevel } from '../../types';
import { moduleMeta, ModuleMeta, Project } from '../storage';
import { Backend, Change, Diff } from '../versionings';
import path from 'path';
import equal from 'fast-deep-equal';
import { Node } from '../../../shared/cnodes';
import { Delta } from '../../history';

// Bundlers require Buffer to be defined on window
window.Buffer = Buffer;
// Initialize isomorphic-git with a file system
const fs = new LightningFS('kipos');
// I prefer using the Promisified version honestly
const pfs = fs.promises;

let cache: any = {};

export const listProjects = async () => {
    const projects = await pfs.readdir('/');
    const loaded = (
        await Promise.all(
            projects.map((fname) =>
                pfs
                    .readFile(`/${fname}/project.json`, { encoding: 'utf8' })
                    .then((v) => JSON.parse(v as string) as Project)
                    .catch(() => null),
            ),
        )
    ).filter(Boolean);
    return loaded as Project[];
};

export const loadModule = async (project: string, module: string): Promise<Module> => {
    const meta = pfs.readFile(`/${project}/modules/${module}/module.json`, { encoding: 'utf8' }).then((v) => JSON.parse(v as string) as ModuleMeta);
    const tops = pfs.readdir(`/${project}/modules/${module}/toplevels`);
    const toplevels = tops.then((tops) =>
        Promise.all(
            tops.map((top) =>
                pfs.readFile(`/${project}/modules/${module}/toplevels/${top}`, { encoding: 'utf8' }).then((v) => JSON.parse(v as string) as Toplevel),
            ),
        ),
    );
    const [metaV, topV] = await Promise.all([meta, toplevels]);
    return { ...metaV, history: [], toplevels: Object.fromEntries(topV.map((top) => [top.id, top])) };
};

export const loadProject = async (id: string): Promise<Record<string, Module>> => {
    const modules = await pfs.readdir(`/${id}/modules`);
    const loaded = await Promise.all(modules.map((module) => loadModule(id, module)));
    return Object.fromEntries(loaded.map((mod) => [mod.id, mod]));
};

const exists = async (path: string) => {
    try {
        await pfs.stat(path);
        return true;
    } catch (err) {
        return false;
    }
};

const rmdir = async (dirpath: string, gitbase: string): Promise<void> => {
    const dirfull = path.join(gitbase, dirpath);
    const contents = await pfs.readdir(dirfull);
    await Promise.all(
        contents.map(async (item) => {
            const full = path.join(dirfull, item);
            const rel = path.join(dirpath, item);
            const st = await pfs.stat(full);
            if (st.isDirectory()) {
                return rmdir(rel, gitbase);
            }
            await Promise.all([pfs.unlink(full), git.remove({ fs, dir: gitbase, filepath: rel, cache })]);
        }),
    );
};

const author = { name: 'kipos', email: 'kipos@kipos.kipos' };

const writeFile = async (gitbase: string, relpath: string, contents: string) => {
    await pfs.writeFile(path.join(gitbase, relpath), contents);
    await git.add({ fs, dir: gitbase, filepath: relpath });
};

export const IGit: Backend = {
    listProjects,
    loadProject,
    async createProject(project: Project) {
        await pfs.mkdir(`/${project.id}`);
        await pfs.mkdir(`/${project.id}/modules`);

        await git.init({ fs, dir: `/${project.id}`, defaultBranch: 'main' });
        await writeFile(project.id, 'project.json', JSON.stringify(project));
        await git.commit({ fs, dir: project.id, author, message: 'create project' });
    },

    async saveModule(project, module) {
        const base = `/${project}/modules/${module.id}`;
        if (!(await exists(base))) {
            await pfs.mkdir(base);
            await pfs.mkdir(`${base}/toplevels`);
        }
        await writeFile(project, `modules/${module.id}/module.json`, JSON.stringify(moduleMeta(module)));
        const tops = Object.values(module.toplevels).map((top) =>
            writeFile(project, `modules/${module.id}/toplevels/${top.id}.json`, JSON.stringify(top)),
        );
        await Promise.all(tops);
        await git.commit({ fs, dir: project, author, message: `save module ${module.id}` });
    },

    async saveChange(project: string, change: Change, message: string) {
        await Promise.all(
            Object.entries(change).map(async ([module, change]) => {
                if (!change) {
                    await rmdir(`modules/${module}`, '/' + project);
                    return;
                }
                if (change.meta) {
                    await writeFile(project, `modules/${module}/module.json`, JSON.stringify(change.meta));
                }
                if (change.toplevels) {
                    await Promise.all(
                        Object.entries(change.toplevels).map(async ([id, top]) => {
                            if (!top) {
                                await pfs.unlink(`project/modules/${module}/toplevels/${id}.json`);
                                await git.remove({ fs, dir: project, filepath: `modules/${module}/toplevels/${id}.json` });
                                return;
                            }
                            await writeFile(project, `modules/${module}/toplevels/${id}.json`, JSON.stringify(top));
                        }),
                    );
                }
            }),
        );
        await git.commit({ fs, dir: project, author, message: `changes to modules ${Object.keys(change).join(', ')}` });
    },

    async history(project: string, start: string | null, count: number) {
        const log = await git.log({ fs, dir: project, cache, depth: count, ref: start ?? 'HEAD' });
        const dec = new TextDecoder();
        return Promise.all(
            log.map(async (item, i) => {
                const change: Diff = {};

                await git.walk({
                    fs,
                    dir: project,
                    cache,
                    trees: [git.TREE({ ref: i === 0 ? (start ?? 'HEAD') : log[i - 1].oid }), git.TREE({ ref: item.oid })],
                    map: async (filepath, [newer, older]) => {
                        if (!filepath.endsWith('.json')) return;
                        // things this could be:
                        // project.json
                        // modules/{id}/module.json
                        // modules/{id}/toplevels/{toplevel}.json
                        if (filepath === 'project.json') return;
                        const parts = filepath.split('/');
                        if (parts[0] !== 'modules') {
                            console.log(`unexpected file path`, parts);
                            return;
                        }
                        if (parts.length < 2) {
                            console.warn(`unexpected situation`);
                            return;
                        }
                        const nid = newer ? await newer.oid() : null;
                        const oid = older ? await older.oid() : null;
                        if (nid === oid) return; // no change

                        const mid = parts[1];
                        if (!change[mid]) {
                            change[mid] = {};
                        }

                        if (parts.length === 3 && parts[2] === 'module.json') {
                            change[mid].meta = {
                                next: newer ? JSON.parse(dec.decode((await newer.content())!)) : null,
                                prev: older ? JSON.parse(dec.decode((await older.content())!)) : null,
                            };
                            return;
                        }

                        if (!change[mid].toplevels) change[mid].toplevels = {};
                        if (parts.length === 4 && parts[2] === 'toplevels') {
                            const tid = parts[3].slice(0, -'.json'.length);
                            const next: Toplevel | null = newer ? JSON.parse(dec.decode((await newer.content())!)) : null;
                            const prev: Toplevel | null = older ? JSON.parse(dec.decode((await older.content())!)) : null;
                            change[mid].toplevels[tid] = topDelta(next, prev);
                        }

                        console.warn(`unknown path`, filepath);
                    },
                });

                return { diff: change, ts: item.commit.author.timestamp, message: item.commit.message, id: item.oid };
            }),
        );
        // throw new Error('not yet');
    },
};

const topDelta = (next: Toplevel | null, prev: Toplevel | null): NonNullable<Diff['']['toplevels']>[''] => {
    if (!next && prev) {
        const { nodes: pnodes, ...pmeta } = prev;
        const nodes: Record<string, Delta<Node | null>> = {};
        Object.entries(pnodes).forEach(([id, node]) => {
            nodes[id] = { prev: node, next: null };
        });
        return { meta: { prev: pmeta, next: null }, nodes };
    }
    if (next && !prev) {
        const { nodes: nnodes, ...nmeta } = next;
        const nodes: Record<string, Delta<Node | null>> = {};
        Object.entries(nnodes).forEach(([id, node]) => {
            nodes[id] = { next: node, prev: null };
        });
        return { meta: { next: nmeta, prev: null }, nodes };
    }
    if (!next || !prev) {
        return {};
    }

    let changed = false;
    const { nodes: pnodes, ...pmeta } = prev;
    const { nodes: nnodes, ...nmeta } = next;
    const nodes: Record<string, Delta<Node | null>> = {};
    Object.entries(pnodes).forEach(([id, node]) => {
        if (!equal(node, nnodes[id])) {
            nodes[id] = { prev: node, next: nnodes[id] ?? null };
            changed = true;
        }
    });
    Object.entries(nnodes).forEach(([id, node]) => {
        if (!pnodes[id]) {
            nodes[id] = { next: node, prev: null };
            changed = true;
        }
    });
    return { meta: equal(pmeta, nmeta) ? undefined : { prev: pmeta, next: nmeta }, nodes: changed ? nodes : undefined };
};
