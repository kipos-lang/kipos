import equal from 'fast-deep-equal';
import { root } from '../../keyboard/root';
import { getSelectionStatuses } from '../../keyboard/selections';
import { genId } from '../../keyboard/ui/genId';
import { SelectionStatuses, mergeHighlights, Path, lastChild, pathKey } from '../../keyboard/utils';
import { validate } from '../../keyboard/validate';
import { Loc } from '../../shared/cnodes';
import { ParseResult } from '../../syntaxes/algw-s2-return';
import { Module, Toplevel } from '../types';
import { defaultLang } from './default-lang/default-lang';
import { Action, reduce } from './state';
import { saveModule } from './storage';
import { EditorStore, Evt, allIds } from './store';
import { Event, Src } from '../../syntaxes/dsl3';
import { Language, ValidateResult } from './language';
import { Type } from '../../syntaxes/algw-s2-types';
import { useMemo } from 'react';

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

export type LangResult = ParseResult<any> & { trace: Event[]; validation?: ValidateResult<Type> | null; spans: Record<string, string[][]> };

export const makeEditor = (
    selected: string,
    modules: Record<string, Module>,
    useTick: (evt: Evt) => number,
    shout: (evt: Evt) => void,
): EditorStore => {
    let selectionStatuses = recalcSelectionStatuses(modules[selected]);
    let language = defaultLang;

    const parseResults: Record<string, LangResult> = {};

    Object.entries(modules[selected].toplevels).forEach(([key, top]) => {
        parseResults[key] = doParse(language, top);
    });

    return {
        // selected,
        useTopParseResults(top: string) {
            useTick(`top:${top}:parse-results`);
            return parseResults[top];
        },
        useParseResults() {
            useTick(`module:${selected}:parse-results`);
            return parseResults;
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
                    const result = doParse(language, mod.toplevels[key]);
                    Object.entries(result.ctx.meta).forEach(([loc, value]) => {
                        if (!parseResults[key]) changed[loc] = true;
                        else if (!equal(value, parseResults[key].ctx.meta[loc])) {
                            changed[loc] = true;
                        }
                    });
                    if (result.validation) {
                        const keys: Record<string, true> = {};

                        Object.entries(result.validation.annotations).forEach(([k, ann]) => {
                            if (!parseResults[key] || !equal(ann, parseResults[key].validation?.annotations[k])) {
                                keys[k] = true;
                            }
                        });
                        Object.keys(keys).forEach((k) => shout(`annotation:${k}`));

                        Object.entries(result.spans).forEach(([loc, spans]) => {
                            if (!parseResults[key] || !parseResults[key].spans[loc]) changed[key] = true;
                            else if (!equal(spans, parseResults[key].spans[loc])) {
                                changed[key] = true;
                            }
                        });

                        // const spans = findSpans(result.validation.annotations)
                        // Object.entries(result.validation?.annotations ?? {}).forEach(([key, value]) => {
                        //     if (!parseResults[key] || !parseResults[key].validation?.annotations) changed[key] = true;
                        //     else if (!equal(value, parseResults[key].validation.annotations[key])) {
                        //         changed[key] = true;
                        //     }
                        // });
                    }
                    parseResults[key] = result;
                    shout(`module:${selected}:parse-results`);
                    shout(`top:${key}:parse-results`);
                }
            });

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
                        return parseResults[top]?.validation?.annotations[key];
                    }, [tick]);
                },
                useNode(path: Path) {
                    useTick(`node:${lastChild(path)}`);
                    return {
                        node: modules[selected].toplevels[top].nodes[lastChild(path)],
                        sel: selectionStatuses[pathKey(path)],
                        meta: parseResults[top]?.ctx.meta[lastChild(path)],
                        spans: parseResults[top].spans[lastChild(path)],
                        // annotations: parseResults[top]?.validation?.annotations[lastChild(path)],
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

const doParse = (language: Language<any, any, any, any>, top: Toplevel): LangResult => {
    const node = root<Loc>({ top });
    const trace: Event[] = [];
    const TRACE = false;
    const result = language.parser.parse(
        [],
        node,
        TRACE
            ? (evt) => {
                  trace.push(evt);
              }
            : undefined,
    );
    let validation = null;
    if (result.result && language.validate) {
        validation = language.validate(result.result);
    }
    const spans: Record<string, string[][]> = {};
    if (validation) {
        const simpleSpans = findSpans(Object.values(validation.annotations).flatMap((a) => a.map((a) => a.src)));
        Object.entries(top.nodes).forEach(([key, node]) => {
            if (node.type === 'list') {
                spans[key] = node.children.map((child) => {
                    if (!simpleSpans[child]) return [];
                    return simpleSpans[child]
                        .map((id) => ({ id, idx: node.children.indexOf(id) }))
                        .sort((a, b) => b.idx - a.idx)
                        .map((s) => s.id);
                });
            }
        });
    }
    return { ...result, trace, validation, spans };
};

type Grouped = { id?: string; end?: string; children: (string | Grouped)[] };

export const partition = (better: string[][], children: string[]) => {
    // const groups: Grouped = {children: []}
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
        console.log(stack);
        console.error('didnt clen up all stacks');
    }
    return stack[0];
};

export const srcKey = (src: Src) => (src.right ? `${src.left}:${src.right}` : src.left);
