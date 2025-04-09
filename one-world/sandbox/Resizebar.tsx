import { css } from 'goober';
import React, { useState, useEffect } from 'react';
import { zedlight } from './zedcolors';

export const Resizebar = ({ id, children, initial, side }: { id: string; children: React.ReactNode; initial?: number; side: 'left' | 'right' }) => {
    const [width, setWidth] = useLocalStorage<number | null>(`resize-${id}`, () => initial ?? null);
    const [resizing, setResizing] = useState(null as null | { width: number; parent: HTMLElement });
    useEffect(() => {
        if (!resizing) return;
        const f = (evt: MouseEvent) => {
            const box = resizing.parent.getBoundingClientRect();
            setResizing({ ...resizing, width: side === 'right' ? evt.clientX - box.left : box.right - evt.clientX });
        };
        const up = (evt: MouseEvent) => {
            setResizing((r) => {
                if (r) setWidth(r.width);
                return null;
            });
        };
        document.addEventListener('mousemove', f);
        document.addEventListener('mouseup', up);
        return () => {
            document.removeEventListener('mousemove', f);
            document.removeEventListener('mouseup', up);
        };
    }, [resizing != null]);
    return (
        <div style={{ display: 'flex', flexDirection: 'row', width: resizing?.width ?? width ?? undefined }}>
            {side === 'right' ? children : null}
            <div
                style={{
                    backgroundColor: resizing ? zedlight['border.focused'] : undefined,
                }}
                className={css({
                    alignSelf: 'stretch',
                    width: '2px',
                    minWidth: '2px',
                    flexShrink: 0,
                    cursor: 'ew-resize',
                    backgroundColor: zedlight.border,
                    '&:hover': {
                        backgroundColor: zedlight['border.focused'],
                    },
                })}
                onMouseDown={(evt) =>
                    setResizing({
                        width: evt.currentTarget.parentElement!.getBoundingClientRect().width,
                        parent: evt.currentTarget.parentElement!,
                    })
                }
                onDoubleClick={() => setWidth(null)}
            />
            {side === 'left' ? children : null}
        </div>
    );
};

export const useLocalStorage = <T,>(key: string, initial: () => T) => {
    const [state, setState] = React.useState<T>(localStorage[key] ? JSON.parse(localStorage[key]) : initial());
    React.useEffect(() => {
        localStorage[key] = JSON.stringify(state);
    }, [state]);
    return [state, setState] as const;
};
