import React, { useContext, useCallback, useRef, useEffect, useMemo, useState } from 'react';
import { SelStart } from '../keyboard/handleShiftNav';
import { Action } from './store/state';
import { useStore } from './store/store';

// type ECtx = {
//     // drag
//     // errors: Record<string, string>;
//     // refs: Record<string, HTMLElement>; // -1 gets you 'cursor' b/c why not
//     // config: DisplayConfig;
//     // styles: Record<string, Style>;
//     // placeholders: Record<string, string>;
//     // selectionStatuses: SelectionStatuses;
//     // dispatch: (up: KeyAction[]) => void;
//     // msel: null | string[];
//     // mhover: null | string[];
//     drag: DragCtxT;
// };
type DragCtxT = {
    dragging: boolean;
    refs: Record<string, HTMLElement>;
    ref(loc: string): (node: HTMLElement) => void;
    start(sel: SelStart, meta?: boolean): void;
    move(sel: SelStart, ctrl?: boolean, alt?: boolean): void;
};

export const noopDrag: DragCtxT = { dragging: false, ref: () => () => {}, start() {}, move() {}, refs: {} };

export const DragCtx = React.createContext(null as null | DragCtxT);
export const useDrag = () => {
    const ctx = useContext(DragCtx);
    if (!ctx) throw new Error(`not in drag context`);
    return ctx;
};

export const useUpdate = () => {
    const store = useStore();
    return useCallback(
        (action: Action) => {
            return store.update(store.selected, action);
        },
        [store.selected],
    );
};
type HoverCtxT = { onHover(key?: string): boolean; setHover(key: string, on: boolean, persistent: boolean): void; clearHover(): void };
const HoverCtx = React.createContext<HoverCtxT>({ onHover: () => false, setHover() {}, clearHover() {} });

export const useHover = (key?: string, persistent = false) => {
    const hover = useContext(HoverCtx);
    const isHovered = hover.onHover(key);
    return {
        isHovered,
        setHover: useCallback((yes: boolean) => (key ? hover.setHover(key, yes, persistent) : null), [key]),
        clearHover: hover.clearHover,
    };
};

export const useProvideHover = () => {
    const hover = useMakeHover();
    return useCallback(
        ({ children }: { children: React.ReactNode }): React.ReactNode => <HoverCtx.Provider value={hover}>{children}</HoverCtx.Provider>,
        [hover],
    );
};
const useMakeHover = () => {
    const store = useStore();
    const selected = store.useSelected();
    const cleanup = useRef(() => {});
    useEffect(() => {
        return () => cleanup.current();
    }, []);
    return useMemo((): HoverCtxT => {
        const listeners: Record<string, (v: boolean) => void> = {};
        let hover: null | { key: string; persistent: boolean } = null;
        let lastClear = Date.now();
        const MIN = 500;

        let t: Timer | null = null;

        const mv = () => {
            clearTimeout(t!);
        };
        document.addEventListener('mousemove', mv);

        const unlisten = store.listen(`module:${selected}:selection`, () => {
            clearTimeout(t!);
            lastClear = Date.now();
            listeners[hover?.key!]?.(false);
            hover = null;
        });
        cleanup.current = () => {
            document.removeEventListener('mousemove', mv);
            unlisten();
        };

        return {
            onHover(key?: string) {
                const [isHovered, setHovered] = useState(false);
                useEffect(() => {
                    if (!key) return;
                    listeners[key] = setHovered;
                    return () => {
                        if (listeners[key] === setHovered) delete listeners[key];
                    };
                }, [key]);
                return isHovered;
            },
            setHover(key: string, on: boolean, persistent: boolean) {
                if (on) {
                    if (hover?.key === key) {
                        clearTimeout(t!);
                        t = setTimeout(() => {
                            listeners[hover?.key!]?.(true);
                        }, 400);
                        return;
                    }
                    if (hover?.persistent && !persistent) return; // ignore
                    listeners[hover?.key!]?.(false);
                    if (!persistent && !hover && Date.now() - lastClear < MIN) {
                        console.log('too soon');
                        hover = null;
                        return;
                    }
                    hover = { key, persistent };
                    clearTimeout(t!);
                    if (persistent) {
                        listeners[hover?.key!]?.(true);
                    } else {
                        t = setTimeout(() => {
                            listeners[hover?.key!]?.(true);
                        }, 400);
                    }
                } else {
                    if (hover?.key !== key) return;
                    // lastClear = Date.now();
                    listeners[hover?.key!]?.(false);
                    hover = null;
                }
            },
            clearHover() {
                lastClear = Date.now();
                listeners[hover?.key!]?.(false);
                hover = null;
            },
        };
    }, [selected]);
};

export const useProvideDrag = (refs: Record<string, HTMLElement>) => {
    const drag = useMakeDrag(refs);
    return useCallback(
        ({ children }: { children: React.ReactNode }): React.ReactNode => <DragCtx.Provider value={drag}>{children}</DragCtx.Provider>,
        [drag],
    );
};

export const useMakeDrag = (refs: Record<string, HTMLElement>): DragCtxT => {
    const update = useUpdate();
    return useMemo(() => {
        const up = (evt: MouseEvent) => {
            document.removeEventListener('mouseup', up);
            drag.dragging = false;
        };

        const drag: DragCtxT = {
            dragging: false,
            refs,
            ref(loc) {
                return (node) => (refs[loc] = node);
            },
            start(sel: SelStart, meta = false) {
                if (meta) {
                    update({ type: 'add-sel', sel: { start: sel } });
                    // cstate.current.selections.map((s): undefined | Update => undefined).concat([{ nodes: [], selection: { start: sel } }]),
                    // [undefined, { nodes: [], selection: { start: sel } }]
                } else {
                    drag.dragging = true;
                    update({ type: 'selections', selections: [{ start: sel }] });
                    document.addEventListener('mouseup', up);
                }
            },
            move(sel: SelStart, ctrl = false, alt = false) {
                update({ type: 'drag-sel', sel, ctrl, alt });
            },
        };
        return drag;
    }, [update, refs]);
};
