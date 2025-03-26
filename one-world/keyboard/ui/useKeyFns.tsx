import React, { useState, useMemo } from 'react';
import { RecNodeT, NodeID } from '../../shared/cnodes';
import { shape } from '../../shared/shape';
import { ParseResult } from '../../syntaxes/dsl';
import { useLatest } from '../../useLatest';
import { Src } from '../handleShiftNav';
import { TestParser } from '../test-utils';
import { handleCopyMulti, CopiedValues } from '../update/multi-change';
import { AppState, Action, Menu, showKey } from './App';
import { Visual } from './keyUpdate';
import { posUp, posDown } from './selectionPos';

export const useKeyFns = (
    state: AppState,
    parsed: ParseResult<any>,
    dispatch: (s: Action) => void,
    parser: TestParser<any>,
    menu: Menu | null,
    setMenu: (m: Menu | null) => void,
) => {
    const cstate = useLatest(state);
    const spans: Src[] = parsed.result ? parser.spans(parsed.result) : [];
    const cspans = useLatest(spans);
    const [lastKey, setLastKey] = useState(null as null | string);
    const refs: Record<number, HTMLElement> = useMemo(() => ({}), []);
    const cmenu = useLatest(menu);

    const visual: Visual = {
        up(sel) {
            return posUp(sel, cstate.current.top, refs);
        },
        down(sel) {
            return posDown(sel, cstate.current.top, refs);
        },
        spans: cspans.current,
    };

    const onKeyDown = (evt: React.KeyboardEvent) => {
        if (evt.metaKey && (evt.key === 'r' || evt.key === 'l')) return;
        if (evt.metaKey && (evt.key === 'v' || evt.key === 'c' || evt.key === 'x')) return;

        if (evt.key === 'Dead') {
            return;
        }
        if (evt.key === 'z' && evt.metaKey) {
            evt.preventDefault();
            evt.stopPropagation();
            console.log('undo');
            return dispatch({ type: evt.shiftKey ? 'redo' : 'undo' });
        }
        if (cmenu.current) {
            const menu = cmenu.current;
            if (evt.key === 'Escape') {
                setMenu(null);
                evt.preventDefault();
                return;
            }
            if (evt.key === 'ArrowUp') {
                setMenu({
                    ...menu,
                    selection: menu.selection <= 0 ? menu.items.length - 1 : menu.selection - 1,
                });
                evt.preventDefault();
                return;
            }
            if (evt.key === 'ArrowDown') {
                setMenu({
                    ...menu,
                    selection: menu.selection >= menu.items.length - 1 ? 0 : menu.selection + 1,
                });
                evt.preventDefault();
                return;
            }
            if (evt.key === 'Enter') {
                const item = menu.items[menu.selection];
                if (item) {
                    item.action();
                    setMenu(null);
                    evt.preventDefault();
                    return;
                }
            }
        }

        setLastKey(showKey(evt));

        dispatch({
            type: 'key',
            key: evt.key,
            mods: { meta: evt.metaKey, ctrl: evt.ctrlKey, alt: evt.altKey, shift: evt.shiftKey },
            visual,
            config: parser.config,
        });

        evt.preventDefault();
        evt.stopPropagation();
    };

    return {
        keyFns: {
            onKeyDown,
            getDataToCopy() {
                const state = cstate.current;
                const copied = state.selections.map((sel) => handleCopyMulti({ top: state.top, sel, nextLoc: state.nextLoc })).filter(Boolean) as {
                    tree: RecNodeT<NodeID>;
                }[];
                if (!copied.length) return null;
                console.log(
                    copied,
                    copied.map((m) => shape(m.tree)),
                );
                return { json: copied, display: 'lol thanks' };
            },
            onPaste(data: { type: 'json'; data: CopiedValues[] } | { type: 'plain'; text: string }) {
                console.log('pasting I guess', data);
                dispatch({ type: 'paste', data });
            },
            onInput(text: string) {
                //
            },
            onDelete() {
                dispatch({
                    type: 'key',
                    key: 'Backspace',
                    mods: {},
                    visual,
                    config: parser.config,
                });
            },
        },
        lastKey,
        refs,
    };
};
