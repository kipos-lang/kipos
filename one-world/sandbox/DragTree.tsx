//

import React, { createContext, useContext } from 'react';

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

export type DraggerCtx = {
    useHandlers: (id: string) => {
        onMouseMove(evt: React.MouseEvent): void;
        onMouseDown(evt: React.MouseEvent): void;
        // used to check if click should be ignored
        checkClick(): boolean;
    };
};

export const useDragTree = () => {
    // onMouseMove
    // onMouseDown
};

// I think I need a .ctx for managing ... the drag & drop parts, too.

// children?
// ok maybe I want a context?
export const DragTreeNode = ({ id }: { id: string }) => {
    const { useNode, Render } = useContext(DragTreeCtx);
    const { children, node } = useNode(id);
    return (
        <div>
            {node ? <Render node={node} id={id} /> : null}
            {children.length ? (
                <div style={{ marginLeft: 8 }}>
                    {children.map((id) => (
                        <DragTreeNode key={id} id={id} />
                    ))}
                </div>
            ) : null}
        </div>
    );
};
