import equal from 'fast-deep-equal';
import { root } from '../../keyboard/root';
import { getSelectionStatuses } from '../../keyboard/selections';
import { genId } from '../../keyboard/ui/genId';
import { SelectionStatuses, mergeHighlights, Path, lastChild, pathKey } from '../../keyboard/utils';
import { validate } from '../../keyboard/validate';
import { Loc } from '../../shared/cnodes';
import { ParseResult } from '../../syntaxes/algw-s2-return';
import { Module } from '../types';
import { defaultLang } from './default-lang/default-lang';
import { Action, reduce } from './state';
import { saveModule } from './storage';
import { Evt, allIds } from './store';

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

export const makeEditor = (selected: string, modules: Record<string, Module>, useTick: (evt: Evt) => void, shout: (evt: Evt) => void) => {
    let selectionStatuses = recalcSelectionStatuses(modules[selected]);
    let language = defaultLang;

    const parseResults: Record<string, ParseResult<any>> = {};

    return {
        selected,
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
                Object.keys(top.nodes).forEach((k) => {
                    if (mod.toplevels[key].nodes[k] !== top.nodes[k]) {
                        changed[k] = true;
                    }
                });
                mod.toplevels[key].nodes = top.nodes;
                if (mod.toplevels[key].root !== top.root) {
                    mod.toplevels[key].root = top.root;
                    shout(`top:${key}:root`);
                    shout(`top:${key}`);
                }
                if (top.children !== mod.toplevels[key].children) {
                    mod.toplevels[key].children = top.children;
                    shout(`top:${key}:children`);
                    shout(`top:${key}`);
                }

                const node = root<Loc>({ top: mod.toplevels[key] });
                const result = language.parser.parse([], node);
                Object.entries(result.ctx.meta).forEach(([key, value]) => {
                    if (!parseResults[key]) changed[key] = true;
                    else if (!equal(value, parseResults[key].ctx.meta[key])) {
                        changed[key] = true;
                    }
                });
                // TODO: compare metas
                parseResults[key] = result;
                console.log('aprsed', result);
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

            Object.keys(result.tops).forEach((tid) => {
                const top = mod.toplevels[tid];
                // parser
            });

            saveModule(mod);
        },
        useTop(top: string) {
            useTick(`top:${top}`);
            return {
                useNode(path: Path) {
                    useTick(`node:${lastChild(path)}`);
                    return {
                        node: modules[selected].toplevels[top].nodes[lastChild(path)],
                        sel: selectionStatuses[pathKey(path)],
                        meta: parseResults[top]?.ctx.meta[lastChild(path)],
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
