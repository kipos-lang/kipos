import { NodeSelection } from '../keyboard/utils';
import { Nodes } from '../shared/cnodes';
import { Src } from '../syntaxes/dsl3';
import { HistoryItem } from './history';
import { AccessControlLevel } from './store/language';
import { HistoryChange } from './store/state';

export type ParsedImport = {
    type: 'import';
    source: { type: 'raw'; text: string; src: Src } | Import['source'];
    all?: boolean;
    // these might be nail-downable as wellll
    macros: { name: string; loc: string }[];
    plugins: { name: string; loc: string }[];
    // soo these might want to be resolvable to the actual toplevels, potentially.
    items: { name: string; loc: string; kind?: string; accessControl: AccessControlLevel; rename?: string }[];
};

export type Import = {
    type: 'import';
    source:
        | {
              type: 'project';
              module: string;
              // TODO: allow specifying a custom interpreter from [them] to [us]
              foreign?: string; // languageConfiguration, if different then our own
              src: Src;
          }
        | {
              // Submodules, yeah
              type: 'local';
              toplevel: string;
              foreign?: string;
              src: Src;
          }
        | {
              type: 'vendor';
              uri: string; // this is like probably a url. and we cache it.
              foreign?: string;
              src: Src;
          };
    macros: string[];
    plugins: string[];
    items: { name: string; id: string[]; loc: string; kind: string; accessControl: AccessControlLevel; rename?: string }[];
    all?: boolean;
};

export type Module = {
    id: string;
    name: string;
    parent: string;
    languageConfiguration: string;
    toplevels: Record<string, Toplevel>;

    imports: string[];

    pluginConfig: Record<string, any>;
    roots: string[];
    history: HistoryItem<HistoryChange>[];
    selections: NodeSelection[];
};

export type Toplevel = {
    id: string;
    children: string[];
    root: string;
    nodes: Nodes;
    // yay
    submoduleName?: string;
    languageConfiguration?: string;
    imports?: Import[];
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
    // Gonna go evergreen for now
    // built: number; // timestamp
    // hash: string; // TODO maybe the ID should just be a hash? orrr maybe this will be the HEAD commit hash
    ffi: {
        [foreignLanguage: string]: {
            module: string;
            // this will be ... a function, that takes a JSON blob of that other language's
            // type definition and stuff, and produces .. a local ... AST ... of a local type definition.
            exportedName: string;
            // it's also possible that there would ... like need to be some setup & teardown
            // of the foreign function. like for memory management or something.
            // so we'll probably want an exportedName for a wrapper too ...
            // potentially.
        };
    };
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
