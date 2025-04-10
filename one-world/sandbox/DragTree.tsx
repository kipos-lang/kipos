//

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from './store/store';
import { useLatest } from '../useLatest';
import { zedlight } from './zedcolors';

// This is for configuring the data getting & Render component
export type DragTreeCtxT<T> = {
    useNode(id: string): { children: string[]; node?: T };
    Render: React.ComponentType<{ node: T; id: string }>;
    onDrop(dragged: string, dest: string, dropLocation: DropLocation): void;
};

export type DropLocation = 'inside' | 'after' | 'before';

export const DragTreeCtx = createContext<DragTreeCtxT<any>>({
    useNode(id) {
        throw new Error('no');
    },
    Render: () => {
        throw new Error('no');
    },
    onDrop() {
        throw new Error('no');
    },
});

export type DraggerCtxT = {
    // useHandlers: (id: string) => {
    //     onMouseMove(evt: React.MouseEvent): void;
    //     onMouseDown(evt: React.MouseEvent): void;
    // };
    useMouseDown: (id: string) => (evt: React.MouseEvent) => void;
    // used to check if click should be ignored
    checkClick(): boolean;
    ref(id: string): (node: HTMLElement | null) => void;
    useIsDragging: (id: string) => boolean;
};

export const DraggerCtx = createContext<DraggerCtxT>({
    useIsDragging: () => false,
    useMouseDown: () => () => {
        throw new Error('nope');
    },
    checkClick: () => false,
    ref: () => () => {},
});

const dist = (one: { x: number; y: number }, two: { x: number; y: number }) => {
    const dx = one.x - two.x;
    const dy = one.y - two.y;
    return Math.sqrt(dx * dx + dy + dy);
};

const MIN_DRAG = 10;
export const Dragger = ({ dtctx, root = 'root' }: { root?: string; dtctx: DragTreeCtxT<any> }) => {
    const [dragging, setDragging] = useState(
        null as null | {
            which: string;
            pos: { x: number; y: number };
            target?: { dest: string; location: DropLocation; x: number; y: number; w: number; h: number };
            active: boolean;
        },
    );
    const listeners: Record<string, (d: boolean) => void> = useMemo(() => ({}), []);
    const latest = useLatest(dragging);

    const refs: Record<string, HTMLElement> = useMemo(() => ({}), []);

    useEffect(() => {
        if (!dragging) return;
        const move = (evt: MouseEvent) => {
            const dragging = latest.current;
            if (!dragging) return;
            if (!dragging.active) {
                const d = dist(dragging.pos, { x: evt.clientX, y: evt.clientY });
                if (d < MIN_DRAG) return;
                setDragging({ ...dragging, active: true });
                return;
            }
            const got = Object.keys(refs).find((id) => {
                const box = refs[id].getBoundingClientRect();
                return (
                    box.left + (id === 'root' ? 0 : 50) <= evt.clientX &&
                    box.right >= evt.clientX &&
                    box.top <= evt.clientY &&
                    box.bottom >= evt.clientY
                );
            });
            if (!got) {
                if (dragging.target) return setDragging({ ...dragging, target: undefined });
                return;
            }
            const box = refs[got].getBoundingClientRect();
            return setDragging({
                ...dragging,
                target: {
                    dest: got,
                    location: 'inside',
                    x: box.left,
                    y: box.top,
                    w: box.width,
                    h: box.height,
                },
            });
        };
        const up = () => {
            setDragging(null);
        };
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);

        return () => {
            document.removeEventListener('mousemove', move);
            document.removeEventListener('mouseup', up);
        };
    }, [dragging != null]);

    const target = dragging?.active ? dragging.which : null;

    let last = useRef(target);
    useEffect(() => {
        if (!target) {
            listeners[last.current!]?.(false);
            last.current = target;
            return;
        }
        listeners[target]?.(true);
        last.current = target;
        return () => listeners[target]?.(false);
    }, [target]);

    const dctx = useMemo((): DraggerCtxT => {
        return {
            useMouseDown(id: string) {
                return useCallback(
                    (evt) => {
                        console.log('mdd', id, evt);
                        setDragging({ which: id, pos: { x: evt.clientX, y: evt.clientY }, active: false });
                    },
                    [id],
                );
            },
            checkClick() {
                // idk
                return false;
            },
            ref(id) {
                return useCallback(
                    (node) => {
                        if (!node) delete refs[id];
                        else refs[id] = node;
                    },
                    [id],
                );
            },
            useIsDragging(id: string) {
                const [isDragging, setIsDragginer] = useState(dragging?.which === id && dragging.active);
                useEffect(() => {
                    listeners[id] = setIsDragginer;
                    return () => {
                        if (listeners[id] === setIsDragginer) delete listeners[id];
                    };
                }, [id]);
                return isDragging;
            },
        };
    }, []);
    return (
        <>
            <DraggerCtx.Provider value={dctx}>
                <DragTreeCtx.Provider value={dtctx}>
                    <DragTreeNode id={root} />
                </DragTreeCtx.Provider>
            </DraggerCtx.Provider>
            {dragging?.target ? (
                <div
                    style={{
                        position: 'absolute',
                        top: dragging.target.y,
                        left: dragging.target.x,
                        width: dragging.target.w,
                        height: dragging.target.h,
                        // backgroundColor: 'red',
                        border: '3px solid ' + zedlight.syntax.attribute.color,
                        boxSizing: 'border-box',
                        // opacity: 0.1,
                        pointerEvents: 'none',
                    }}
                />
            ) : null}
        </>
    );
};

export const useDragTree = () => {
    // onMouseMove
    // onMouseDown
};

// I think I need a .ctx for managing ... the drag & drop parts, too.

// children?
// ok maybe I want a context?
export const DragTreeNode = React.memo(function DragTreeNode({ id }: { id: string }) {
    const { useNode, Render } = useContext(DragTreeCtx);
    const { children, node } = useNode(id);
    const dragger = useContext(DraggerCtx);
    const dr = dragger.ref(id);
    return (
        <div>
            {node ? (
                <div ref={children.length ? undefined : dr}>
                    <Render node={node} id={id} />
                </div>
            ) : null}
            {children.length ? (
                <div style={{ marginLeft: 8 }} ref={dr}>
                    {children.map((id) => (
                        <DragTreeNode key={id} id={id} />
                    ))}
                </div>
            ) : null}
        </div>
    );
});
