import React, { useCallback, useMemo } from 'react';
import { Path, selStart } from '../keyboard/utils';
import { Node } from '../shared/cnodes';
import { ModuleTree, SelStatus, useStore } from './store';
import { RenderNode } from './RenderNode';
import { Editor } from './Editor';

export const App = () => {
    const store = useStore();
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'row',
                height: '100vh',
            }}
        >
            <ModuleSidebar />
            <Editor />
            <DebugSidebar />
        </div>
    );
};

export const Top = ({ id }: { id: string }) => {
    const store = useStore();
    const editor = store.useEditor();
    const top = editor.useTop(id);

    const isSelected = editor.module.selections.some((s) => s.start.path.root.top === id || s.end?.path.root.top === id);
    const root = top.useRoot();
    const rootPath = useMemo(
        () => ({
            root: { ids: [], top: id },
            children: [],
        }),
        [id],
    );

    const useNode = useCallback((path: Path) => top.useNode(path), [top]);
    return (
        <div>
            <button
                onClick={() => {
                    editor.update({ type: 'rm-tl', id });
                }}
            >
                &times;
            </button>
            {/* <span style={{ fontSize: '50%', border: '1px solid red' }}>{id.slice(-5)}</span> */}
            <UseNodeCtx.Provider value={useNode}>
                <RenderNode parent={rootPath} id={root} />
            </UseNodeCtx.Provider>
        </div>
    );
};

export const UseNodeCtx = React.createContext((path: Path): { node: Node; sel?: SelStatus } => {
    throw new Error('n');
});

export const cursorPositionInSpanForEvt = (evt: React.MouseEvent, target: HTMLSpanElement, text: string[]) => {
    const range = new Range();
    let best = null as null | [number, number];
    for (let i = 0; i <= text.length; i++) {
        const at = text.slice(0, i).join('').length;
        range.setStart(target.firstChild!, at);
        range.setEnd(target.firstChild!, at);
        const box = range.getBoundingClientRect();
        if (evt.clientY < box.top || evt.clientY > box.bottom) continue;
        const dst = Math.abs(box.left - evt.clientX);
        if (!best || dst < best[0]) best = [dst, i];
    }
    return best ? best[1] : null;
};

export const Showsel = () => {
    const store = useStore();
    const editor = store.useEditor();
    const sel = editor.useSelection();

    return (
        <>
            {sel.map((sel, i) => (
                <div key={i}>
                    <div>{sel.start.path.children.map((p) => p.slice(-5)).join('; ')}</div>
                    {JSON.stringify(sel.start.cursor)}
                    <div>{sel.end?.path.children.map((p) => p.slice(-5)).join('; ')}</div>
                    {JSON.stringify(sel.end?.cursor)}
                </div>
            ))}
        </>
    );
};

const DebugSidebar = () => {
    return <div>Debug sidebarrr</div>;
};

const ShowModuleTree = ({ tree }: { tree: ModuleTree }) => {
    return (
        <div>
            {tree.node ? (
                <div
                    style={{
                        cursor: 'pointer',
                        padding: 8,
                    }}
                >
                    {tree.node.name}
                </div>
            ) : null}
            {tree.children.length ? (
                <div style={{ marginLeft: 16 }}>
                    {tree.children.map((child, i) => (
                        <ShowModuleTree key={child.node?.id ?? i} tree={child} />
                    ))}
                </div>
            ) : null}
        </div>
    );
};

export const ModuleSidebar = () => {
    const store = useStore();
    const tree = store.moduleTree;
    return (
        <div style={{ padding: 8 }}>
            <div>Modules</div>
            <ShowModuleTree tree={tree} />
        </div>
    );
};
