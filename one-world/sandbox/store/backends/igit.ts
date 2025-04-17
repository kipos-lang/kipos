import LightningFS from '@isomorphic-git/lightning-fs';
import http from 'isomorphic-git/http/web';
import git from 'isomorphic-git';
import { Buffer } from 'buffer';
import { Module, Toplevel } from '../../types';
import { ModuleMeta, Project } from '../storage';
import { Backend, Change } from '../versionings';

// Bundlers require Buffer to be defined on window
window.Buffer = Buffer;
// Initialize isomorphic-git with a file system
const fs = new LightningFS('kipos');
// I prefer using the Promisified version honestly
const pfs = fs.promises;

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

export const IGit: Backend = {
    listProjects,
    loadProject,
    async createProject(project: Project) {
        //
    },
    async saveModule(project, module) {
        // broad brush
    },
    async history(id: string, start: string | null, count: number) {
        throw new Error('not yet');
    },
    async saveChange(project: string, change: Change, message: string) {
        throw new Error('not yet');
    },
};
