import React, { createContext, useCallback, useMemo, useState } from 'react';
import { js } from '../keyboard/test-utils';
import { Top } from './Top';
import { useStore } from './store/store';
import { zedlight } from './zedcolors';
import { moveA } from '../keyboard/keyActionToUpdate';
import { argify, atomify } from '../keyboard/selections';
import { HiddenInput } from '../keyboard/ui/HiddenInput';
import { css } from 'goober';
import { lastChild, Path } from '../keyboard/utils';
import { Visual } from '../keyboard/ui/keyUpdate';
import { posDown, posUp } from '../keyboard/ui/selectionPos';
import { genId } from '../keyboard/ui/genId';
import { Import, Toplevel } from './types';
import { DebugSidebar } from './DebugSidebar';
import { useDependencyGraph, useModule, useSelectedTop, useSelection } from './store/editorHooks';
import { useProvideDrag, useProvideHover, useUpdate } from './useProvideDrag';

// const useMake

const alphabet = 'abcdefghjklmnopqrstuvwxyz';

const ImportSource = ({ value, update }: { value: Import['source']; update: (v: Import['source']) => void }) => {
    const store = useStore();
    let [tmp, setTmp] = useState('');
    let body;
    switch (value.type) {
        case 'local':
            body = <div>AUTOCOMPLETE LOCAL MODULES</div>;
            break;
        case 'project':
            const mc = store.moduleChildren();
            body = (
                <div>
                    {mc['root'].map((id) => (
                        <div key={id}>
                            <button
                                onClick={() =>
                                    update({
                                        type: 'project',
                                        module: id,
                                    })
                                }
                            >
                                {store.module(id).name}
                            </button>
                        </div>
                    ))}
                </div>
            );
            break;
        case 'vendor':
            body = (
                <div>
                    Vendor src:
                    <input value={tmp} onChange={(evt) => setTmp(evt.target.value)} />
                </div>
            );
            break;
    }

    return (
        <div>
            <div>
                {['project', 'local', 'vendor'].map((name) => (
                    <button
                        key={name}
                        disabled={name === value.type}
                        onClick={() => {
                            update(
                                name === 'project'
                                    ? { type: 'project', module: '' }
                                    : name === 'local'
                                      ? { type: 'local', toplevel: '' }
                                      : { type: 'vendor', src: '' },
                            );
                        }}
                    >
                        {name}
                    </button>
                ))}
            </div>
            {body}
        </div>
    );
};

const ImportPlugins = ({ source, value, update }: { source: Import['source']; value: Import['plugins']; update: (v: Import['plugins']) => void }) => {
    return 'plugisn';
};

const ImportMacros = ({ source, value, update }: { source: Import['source']; value: Import['macros']; update: (v: Import['macros']) => void }) => {
    return 'hi';
};

const ImportItems = ({ source, value, update }: { source: Import['source']; value: Import['items']; update: (v: Import['items']) => void }) => {
    const store = useStore();
    let options: Import['items'] | null = null;
    if (source.type === 'project') {
        const mod = store.module(source.module);
        if (mod) {
            options = [];
            const es = store.estore(source.module);
            Object.values(es.state.parseResults).forEach((res) => {
                if (res.kind.type === 'definition') {
                    res.kind.provides.forEach((prov) => {
                        options!.push({ name: prov.name, kind: prov.kind });
                    });
                }
            });
        } else {
            options = [
                { name: 'one', kind: 'value' },
                { name: 'two', kind: 'value' },
            ];
        }
    }
    if (!options) {
        return <div>Unable to determine available exports</div>;
    }
    return (
        <div>
            {options.map((option, i) => (
                <div key={i}>
                    <input
                        type="checkbox"
                        onChange={(evt) => {
                            if (evt.target.checked) {
                                update(
                                    value.concat([
                                        {
                                            name: option.name,
                                            kind: option.kind,
                                        },
                                    ]),
                                );
                            } else {
                                update(value.filter((v) => v.name !== option.name || v.kind !== option.kind));
                            }
                        }}
                        checked={value.find((f) => f.name === option.name && f.kind === option.kind) != null}
                    />{' '}
                    {option.name} : {option.kind}
                </div>
            ))}
        </div>
    );
};

const ImportForm = ({ value, update }: { value: Import; update: (v: Import) => void }) => {
    return (
        <div>
            <strong>Source</strong>
            <ImportSource value={value.source} update={(source) => update({ ...value, source })} />
            MACROS PLUGINS ITEMS
            <ImportPlugins source={value.source} value={value.plugins} update={(plugins) => update({ ...value, plugins })} />
            <ImportMacros source={value.source} value={value.macros} update={(macros) => update({ ...value, macros })} />
            <ImportItems source={value.source} value={value.items} update={(items) => update({ ...value, items })} />
        </div>
    );
};

const NewImport = ({ onSave }: { onSave: (v: Import) => void }) => {
    const [value, setValue] = useState({ source: { type: 'project', module: '' }, macros: [], plugins: [], items: [] } as Import);

    return (
        <div>
            <ImportForm value={value} update={setValue} />
            <button onClick={() => onSave(value)}>Add</button>
        </div>
    );
};

export const ModuleImports = () => {
    const store = useStore();
    const module = useModule();
    if (!Array.isArray(module.imports)) module.imports = [];

    return (
        <div>
            IMPORT
            {module.imports.map((im, i) => (
                <div key={i}>{JSON.stringify(im)}</div>
            ))}
            <NewImport
                onSave={(im) => {
                    store.updateModule({ id: module.id, imports: module.imports.concat([im]) });
                }}
            />
        </div>
    );
};

export const Editor = () => {
    const store = useStore();

    const refs = useMemo((): Record<string, HTMLElement> => ({}), []);

    const Drag = useProvideDrag(refs);
    const Hover = useProvideHover();
    const module = useModule();

    const deps = useDependencyGraph();
    const names = useMemo(() => {
        const nums: Record<string, { at: number; count: number }> = {};
        let at = 1;
        return module.roots.map((id) => {
            const hid = deps.components.pointers[id];
            if (deps.components.entries[hid]?.length === 1) {
                return at++ + '';
            }
            if (!nums[hid]) {
                nums[hid] = { at: at++, count: 0 };
            } else {
                nums[hid].count++;
            }
            return `${nums[hid].at}${alphabet[nums[hid].count] ?? `+${nums[hid].count}`}`;
        });
    }, [deps, module.roots]);

    return (
        <>
            <div style={{ flex: 1, padding: 32, overflow: 'auto' }}>
                <KeyHandler refs={refs} />
                <ModuleImports />
                <Hover>
                    <Drag>
                        {module.roots.map(
                            (id, i): React.ReactNode => (
                                <Top id={id} key={id} name={names[i]} />
                            ),
                        )}
                    </Drag>
                </Hover>
                <button
                    className={css({ marginBlock: '12px' })}
                    onClick={() => {
                        store.update(module.id, { type: 'new-tl', after: module.roots[module.roots.length - 1] });
                    }}
                >
                    Add Toplevel
                </button>
            </div>
            <DebugSidebar />
        </>
    );
};

const KeyHandler = ({ refs }: { refs: Record<string, HTMLElement> }) => {
    const store = useStore();
    const update = useUpdate();
    const tid = useSelectedTop();
    const sel = useSelection();

    const visual: Visual = {
        up(sel) {
            const top = store.module(store.selected()).toplevels[tid];
            return posUp(sel, top, refs, genId);
        },
        down(sel) {
            const top = store.module(store.selected()).toplevels[tid];
            return posDown(sel, top, refs, genId);
        },
        spans: [], //cspans.current,
    };

    const onKeyDown = useCallback(
        (evt: React.KeyboardEvent<Element>) => {
            if (evt.key === 'z' && evt.metaKey) {
                evt.preventDefault();
                update({ type: evt.shiftKey ? 'redo' : 'undo' });
                return;
            }
            if (evt.key === 'Tab') {
                evt.preventDefault();
            }
            update({
                type: 'key',
                key: evt.key,
                mods: { meta: evt.metaKey, ctrl: evt.ctrlKey, alt: evt.altKey, shift: evt.shiftKey },
                visual,
            });
        },
        [update, sel],
    );

    return (
        <HiddenInput
            onKeyDown={onKeyDown}
            getDataToCopy={() => {
                throw new Error('no copy yet');
            }}
            onDelete={() => {
                console.error('on delete');
            }}
            onInput={(text) => {
                // Not sure why I would need this
                // over the onKeyDown
            }}
            onPaste={(data) => {
                console.error(`paste I guess`, data);
            }}
            sel={sel}
        />
    );
};
