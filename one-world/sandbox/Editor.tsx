import React, { createContext, useCallback, useMemo } from 'react';
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
import { Toplevel } from './types';
import { DebugSidebar } from './DebugSidebar';
import { useDependencyGraph, useModule, useSelectedTop, useSelection } from './store/editorHooks';
import { useProvideDrag, useProvideHover, useUpdate } from './useProvideDrag';
import { CirclePlusIcon } from './icons';

const alphabet = 'abcdefghjklmnopqrstuvwxyz';

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
            const hid = deps?.components.pointers[id] ?? id;
            if (deps?.components.entries[hid]?.length === 1) {
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

    if (!module.imports || (module.imports.length && typeof module.imports[0] !== 'string')) module.imports = [];

    return (
        <>
            <div style={{ flex: 1, padding: 32, overflow: 'auto' }}>
                <KeyHandler refs={refs} />
                <Hover>
                    <Drag>
                        <div
                            className={css({
                                paddingBottom: '1px',
                                boxShadow: `0 1px 4px ${zedlight['info.background']}`,
                                background: zedlight['info.background'],
                                borderRadius: '4px',
                            })}
                        >
                            <div
                                className={css({
                                    padding: '8px 16px',
                                })}
                            >
                                Imports
                                <span
                                    onClick={() => {
                                        store.update(module.id, { type: 'new-import' });
                                    }}
                                >
                                    <CirclePlusIcon style={{ fontSize: 20, cursor: 'pointer', marginBottom: -4, marginLeft: 8 }} />
                                </span>
                            </div>
                            {module.imports.map(
                                (id, i): React.ReactNode => (
                                    <Top id={id} key={id} name={names[i]} />
                                ),
                            )}
                        </div>
                    </Drag>
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
                <div style={{ height: 300 }} />
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
            const top = store.module(store.selected).toplevels[tid];
            return posUp(sel, top, refs, genId);
        },
        down(sel) {
            const top = store.module(store.selected).toplevels[tid];
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
