import React, { useCallback, useMemo, useState } from 'react';
import { Path, selStart } from '../keyboard/utils';
import { Node } from '../shared/cnodes';
import { ModuleTree, newModule, SelStatus, useStore } from './store/store';
import { RenderNode } from './render/RenderNode';
import { Editor } from './Editor';
import { lightColor, lightColorA } from '../keyboard/ui/colors';
import { EditIcon } from './icons';
import { css } from 'goober';
import { Meta } from './store/language';

export const App = () => {
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
    // const module = editor.useModule()
    const top = editor.useTop(id);

    // const isSelected = module.selections.some((s) => s.start.path.root.top === id || s.end?.path.root.top === id);
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
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start' }}>
            <button
                onClick={() => {
                    editor.update({ type: 'rm-tl', id });
                }}
                className={css({
                    background: 'transparent',
                    '&:hover': {
                        color: 'red',
                    },
                    lineHeight: '18px',
                    border: 'none',
                    color: 'black',
                    cursor: 'pointer',
                })}
            >
                &times;
            </button>
            <div style={{ flexBasis: 12 }} />
            {/* <span style={{ fontSize: '50%', border: '1px solid red' }}>{id.slice(-5)}</span> */}
            <UseNodeCtx.Provider value={useNode}>
                <RenderNode parent={rootPath} id={root} />
            </UseNodeCtx.Provider>
            {/* {isSelected ? JSON.stringify(editor.module.selections) : null} */}
        </div>
    );
};

export const UseNodeCtx = React.createContext((path: Path): { node: Node; sel?: SelStatus; meta?: Meta } => {
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

const ShowModuleTree = ({ tree, selected }: { selected: string; tree: ModuleTree }) => {
    const store = useStore();
    const [editing, setEditing] = useState(null as null | string);
    return (
        <div>
            {tree.node ? (
                <div
                    className={css({
                        cursor: 'pointer',
                        padding: '8px',
                        background: selected === tree.node.id ? lightColor : undefined,
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        '&:hover': {
                            background: lightColorA(0.5),
                        },
                    })}
                    onClick={(evt) => {
                        location.hash = '#' + tree.node!.id;
                        // store.select(tree.node!.id)
                    }}
                >
                    {editing != null ? (
                        <input
                            value={editing}
                            onChange={(evt) => setEditing(evt.target.value)}
                            onKeyDown={(evt) => {
                                if (evt.key === 'Escape') {
                                    setEditing(null);
                                    evt.preventDefault();
                                }
                            }}
                            onClick={(evt) => {
                                evt.stopPropagation();
                            }}
                        />
                    ) : (
                        tree.node.name
                    )}
                    <div style={{ flexBasis: 16, minWidth: 16, flexGrow: 1 }} />
                    <div
                        onClick={(evt) => {
                            evt.stopPropagation();
                            if (editing != null) {
                                if (!editing.trim() || editing === tree.node!.name) return setEditing(null);
                                store.updateeModule({ id: tree.node!.id, name: editing });
                                setEditing(null);
                            } else {
                                setEditing(tree.node!.name);
                            }
                        }}
                    >
                        <EditIcon />
                    </div>
                </div>
            ) : null}
            {tree.children.length ? (
                <div style={{ marginLeft: 16 }}>
                    {tree.children.map((child, i) => (
                        <ShowModuleTree key={child.node?.id ?? i} selected={selected} tree={child} />
                    ))}
                    <button
                        onClick={() => {
                            const name = prompt('Name');
                            store.addModule(newModule(name ?? 'NewModule'));
                        }}
                        style={{ marginTop: 12 }}
                    >
                        Add module
                    </button>
                </div>
            ) : null}
        </div>
    );
};

export const ModuleSidebar = () => {
    const store = useStore();
    const selected = store.useSelected();
    const tree = store.useModuleTree();
    return (
        <div style={{ padding: 8 }}>
            <div>Modules</div>
            <ShowModuleTree selected={selected} tree={tree} />
        </div>
    );
};
