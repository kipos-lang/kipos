import { NodeSelection } from '../keyboard/utils';
import { Nodes } from '../shared/cnodes';
import { HistoryItem } from './history';
import { HistoryChange } from './store/state';

export type Module = {
    id: string;
    name: string;
    parent: string;
    languageConfiguration: string;
    toplevels: Record<string, Toplevel>;
    editorPlugins: Record<string, any>;
    macroImports: { module: string; macros: true | string[] }[]; // true for "all" (recursive)
    ffiImports: { module: string; names: string[]; languageConfiguration: string }[];
    roots: string[];
    history: HistoryItem<HistoryChange>[];
    selections: NodeSelection[];
};

export type Toplevel = {
    id: string;
    children: string[];
    root: string;
    nodes: Nodes;
};

// Can be serialized to `module : exportedName : languageConfiguration`
export type Artifact = {
    module: string; // by id
    exportedName: string; // by name
    languageConfiguration: string; // by id
};

export type LanguageConfiguration = {
    id: string;
    name: string;
    artifact: Artifact;
    built: number; // timestamp
    hash: string; // TODO maybe the ID should just be a hash? orrr maybe this will be the HEAD commit hash
};

// hm
// Is there a way to enforce that they're all using the same
// ~type definitions for (AST) | (TInfo) | etc?
// I could have the parser be an object,
// and one of the items of that object is ... like a ...
// module:toplevelid reference to the AST type definition?
// Is that a thing that I want to be able to produce in userland?
// hm. I guess I want to be able to insert a /reference/ to a
// toplevel in a rich text block. So maybe that's it.
