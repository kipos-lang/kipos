import { useEffect, useMemo, useState } from 'react';
import { root } from '../../keyboard/root';
import { getSelectionStatuses } from '../../keyboard/selections';
import { genId } from '../../keyboard/ui/genId';
import { Path, SelectionStatuses, lastChild, mergeHighlights, pathKey } from '../../keyboard/utils';
import { validate } from '../../keyboard/validate';
import { Loc } from '../../shared/cnodes';
import { Event, Src } from '../../syntaxes/dsl3';
import { Module, Toplevel } from '../types';
import { defaultLang } from './default-lang/default-lang';
import { EditorStore } from './editorStore';
import { EvaluationResult, FailureKind, Language, ParseResult, ValidateResult } from './language';
import { Action, reduce } from './state';
import { saveModule } from './storage';
import { EditorStoreI, Evt, allIds } from './store';

const recalcSelectionStatuses = (mod: Module) => {
    const statuses: SelectionStatuses = {};
    mod.selections.forEach((sel) => {
        const st = getSelectionStatuses(sel, mod.toplevels[sel.start.path.root.top]);

        Object.entries(st).forEach(([key, status]) => {
            if (statuses[key]) {
                statuses[key].cursors.push(...status.cursors);
                statuses[key].highlight = mergeHighlights(statuses[key].highlight, status.highlight);
            } else {
                statuses[key] = status;
            }
        });
    });
    return statuses;
};

export const findSpans = (items: Src[]) => {
    const spans: Record<string, string[]> = {};

    items.forEach((src) => {
        if (src.right) {
            if (!spans[src.left]) spans[src.left] = [];
            if (!spans[src.left].includes(src.right)) spans[src.left].push(src.right);
        }
    });

    return spans;
};

export type LangResult = ParseResult<any> & { validation?: ValidateResult<any> | null; spans: Record<string, string[][]> };

export const makeEditor = (
    selected: string,
    modules: Record<string, Module>,
    useTick: (evt: Evt) => number,
    shout: (evt: Evt) => void,
): EditorStoreI => {
    let selectionStatuses = recalcSelectionStatuses(modules[selected]);
    let language = defaultLang;

    // const parseResults: Record<string, LangResult> = {};
    // Object.entries(modules[selected].toplevels).forEach(([key, top]) => {
    //     parseResults[key] = doParse(language, top);
    // });

    const store = new EditorStore(modules[selected], language);

    return {
        // selected,
        useTopParseResults(top: string) {
            useTick(`top:${top}:parse-results`);
            return {
                ...store.state.parseResults[top],
                validation: store.state.validationResults[store.state.dependencies.components.pointers[top]],
                spans: {},
            };
            // return parseResults[top];
        },
        getTop(top: string) {
            return modules[selected].toplevels[top];
        },
        useDependencyGraph() {
            useTick(`module:${selected}:dependency-graph`);
            return store.state.dependencies;
        },
        useTopSource(top: string) {
            const [results, setResults] = useState(null as null | string);
            useEffect(() => {
                return store.compiler.listen('viewSource', { module: selected, top }, ({ source }) => setResults(source));
            }, [top]);
            return results;
        },
        useTopFailure(top: string) {
            const [results, setResults] = useState(null as null | FailureKind[]);
            useEffect(() => {
                return store.compiler.listen('failure', { module: selected, top }, (results) => setResults(results));
            }, [top]);
            return results;
        },
        useTopResults(top: string) {
            const [results, setResults] = useState(null as null | EvaluationResult[]);
            useEffect(() => {
                return store.compiler.listen('results', { module: selected, top }, ({ results }) => setResults(results));
            }, [top]);
            return results;
        },
        useParseResults() {
            useTick(`module:${selected}:parse-results`);
            return store.state.parseResults;
        },
        useModule() {
            useTick(`module:${selected}`);
            return modules[selected];
        },
        useSelection() {
            useTick(`module:${selected}:selection`);
            return modules[selected].selections;
        },
        update(action: Action) {
            const mod = modules[selected];
            const result = reduce(
                {
                    config: language.parser.config,
                    tops: { ...mod.toplevels },
                    roots: mod.roots,
                    history: mod.history,
                    selections: mod.selections,
                },
                action,
                false,
                genId,
            );
            mod.history = result.history;
            if (mod.history.length > 200) {
                mod.history = mod.history.slice(-200);
            }
            const changed = allIds(result.selections);
            Object.assign(changed, allIds(mod.selections));
            if (mod.selections !== result.selections) {
                mod.selections = result.selections;
                shout(`module:${selected}:selection`);
            }

            const old = selectionStatuses;
            selectionStatuses = recalcSelectionStatuses(mod);

            const changedTops: string[] = [];

            Object.entries(result.tops).forEach(([key, top]) => {
                if (!mod.toplevels[key]) {
                    mod.toplevels[key] = top;
                    return;
                }
                let nodesChanged = false;
                Object.keys(top.nodes).forEach((k) => {
                    if (mod.toplevels[key].nodes[k] !== top.nodes[k]) {
                        changed[k] = true;
                        nodesChanged = true;
                    }
                });
                mod.toplevels[key].nodes = top.nodes;
                if (mod.toplevels[key].root !== top.root) {
                    mod.toplevels[key].root = top.root;
                    shout(`top:${key}:root`);
                    shout(`top:${key}`);
                    nodesChanged = true;
                }
                if (top.children !== mod.toplevels[key].children) {
                    mod.toplevels[key].children = top.children;
                    shout(`top:${key}:children`);
                    shout(`top:${key}`);
                }

                if (nodesChanged) {
                    changedTops.push(key);
                }
            });

            if (changedTops.length) {
                const keys: Record<string, true> = {};
                store.updateTops(changedTops, changed, keys);
                shout(`module:${selected}:dependency-graph`);
                Object.keys(keys).forEach((k) => shout(`annotation:${k}`));
                shout(`module:${selected}:parse-results`);
                changedTops.forEach((key) => {
                    shout(`top:${key}:parse-results`);
                });
            }

            if (mod.roots !== result.roots) {
                mod.roots = result.roots;
                shout(`module:${mod.id}:roots`);
            }

            Object.keys(changed).forEach((k) => {
                shout(`node:${k}`);
            });

            mod.selections.forEach((sel) => {
                if (!sel.start.path) {
                    console.log('WHAT SEL');
                    debugger;
                }
                try {
                    validate({ sel, top: mod.toplevels[sel.start.path.root.top] });
                } catch (err) {
                    debugger;
                    validate({ sel, top: mod.toplevels[sel.start.path.root.top] });
                }
            });

            saveModule(mod);
        },
        useTop(top: string) {
            useTick(`top:${top}`);
            return {
                useAnnotations(key: string) {
                    const tick = useTick(`annotation:${key}`);
                    return useMemo(() => {
                        const hid = store.state.dependencies.components.pointers[top];
                        return store.state.validationResults[hid]?.annotations[top][key];
                    }, [tick, key]);
                },
                useNode(path: Path) {
                    const loc = lastChild(path);
                    useTick(`node:${loc}`);
                    const results = store.state.parseResults[top];
                    let meta = store.state.parseResults[top]?.ctx.meta[loc];
                    const refs = results?.internalReferences[loc];
                    if (refs) {
                        if (refs.usages.length === 0 && (results.kind.type !== 'definition' || !results.kind.provides.some((r) => r.loc === loc))) {
                            meta = { kind: 'unused' };
                        } else {
                            meta = { kind: 'used' };
                        }
                    }
                    return {
                        node: modules[selected].toplevels[top].nodes[loc],
                        sel: selectionStatuses[pathKey(path)],
                        meta,
                        spans: store.state.spans[top]?.[loc] ?? [], // STOPSHIP store.state.parseResults[top]?.spans[loc],
                    };
                },
                useRoot() {
                    useTick(`top:${top}:root`);
                    return modules[selected].toplevels[top].root;
                },
                get top() {
                    return modules[selected].toplevels[top];
                },
            };
        },
    };
};

export type Grouped = { id?: string; end?: string; children: (string | Grouped)[] };

export const partition = (better: string[][], children: string[]) => {
    const stack: Grouped[] = [{ children: [] }];

    for (let i = 0; i < children.length; i++) {
        const current = stack[stack.length - 1];
        const spans = better[i];
        const child = children[i];
        if (!spans.length) {
            current.children.push(child);
            while (stack[stack.length - 1].end === child) {
                stack.pop();
            }
            continue;
        }

        spans.forEach((id) => {
            const inner: Grouped = { end: id, children: [], id: `${child}:${id}` };
            stack[stack.length - 1].children.push(inner);
            stack.push(inner);
        });
        stack[stack.length - 1].children.push(child);
    }
    if (stack.length !== 1) {
        // So... this happens when the /end/ of a span isn't actually within the children, right?
        // or when things are out of order somehow?
        // I'll just ignore for the moment.
    }
    return stack[0];
};

export const srcKey = (src: Src) => (src.right ? `${src.left}:${src.right}` : src.left);
