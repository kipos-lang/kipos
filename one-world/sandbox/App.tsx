import React, { useCallback, useMemo, useState } from 'react';
import { lastChild, Path, selStart } from '../keyboard/utils';
import { fromRec, Node, RecNode } from '../shared/cnodes';
import { ModuleTree, newModule, SelStatus, UseNode, useStore } from './store/store';
import { RenderNode } from './render/RenderNode';
import { DragCtx, Editor, noopDrag } from './Editor';
import { EditIcon } from './icons';
import { css } from 'goober';
import { Meta } from './store/language';
import { zedlight } from './zedcolors';
import { currentTheme } from './themes';
import { genId } from '../keyboard/ui/genId';
import { srcKey } from './store/makeEditor';

export const App = () => {
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'row',
                height: '100vh',
                alignItems: 'stretch',
            }}
        >
            <ModuleSidebar />
            <Editor />
        </div>
    );
};

export const Top = ({ id }: { id: string }) => {
    const store = useStore();
    const editor = store.useEditor();
    const top = editor.useTop(id);

    const root = top.useRoot();
    const rootPath = useMemo(
        () => ({
            root: { ids: [], top: id },
            children: [],
        }),
        [id],
    );

    const parseResult = editor.useTopParseResults(id);

    const useNode = useCallback<UseNode>((path) => top.useNode(path), [top]);
    return (
        <div
            className={css({
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'flex-start',
                padding: '12px',
                margin: '12px',
                borderRadius: '4px',
                boxShadow: '0px 1px 3px #ccc',
                fontFamily: 'Jet Brains',
            })}
        >
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
            <UseNodeCtx.Provider value={useNode}>
                <RenderNode parent={rootPath} id={root} />
            </UseNodeCtx.Provider>
            <div
                className={css({
                    marginLeft: '24px',
                    // border: `1px solid ${currentTheme.typeColors.hlColor}`,
                    boxShadow: `0px 1px 2px ${currentTheme.typeColors.hlColor}`,
                    paddingInline: '4px',
                    borderRadius: '3px',
                })}
            >
                {parseResult?.validation?.annotations.map((item, i) => (
                    <div key={i}>
                        {item.type === 'type' && item.primary ? (
                            <div key={i}>
                                <RenderStaticNode root={item.annotation} />
                            </div>
                        ) : null}
                    </div>
                ))}
            </div>
        </div>
    );
};

export const RenderStaticNode = ({ root }: { root: { node: RecNode; meta: Record<string, Meta> } }) => {
    const { map, id, meta } = useMemo(() => {
        const map: Record<string, Node> = {};
        const meta: Record<string, Meta> = {};
        const id = fromRec(root.node, map, (l) => {
            const n = genId();
            meta[n] = root.meta[l];
            return n;
        });
        return { map, id, meta };
    }, [root]);
    return (
        <div>
            <DragCtx.Provider value={noopDrag}>
                <UseNodeCtx.Provider
                    value={(path: Path) => {
                        return { node: map[lastChild(path)], meta: meta[lastChild(path)] };
                    }}
                >
                    <RenderNode id={id} parent={{ children: [], root: { ids: [], top: '' } }} />
                </UseNodeCtx.Provider>
            </DragCtx.Provider>
        </div>
    );
};

export const UseNodeCtx = React.createContext<UseNode>((path) => {
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
                        borderRadius: '4px',
                        background: selected === tree.node.id ? zedlight.syntax.attribute.color : undefined,
                        color: selected === tree.node.id ? 'white' : undefined,
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        '&:hover': {
                            background: selected === tree.node.id ? zedlight.syntax.attribute.color : undefined,
                            color: selected === tree.node.id ? 'white' : undefined,
                        },
                        '&:hover .icon': {
                            opacity: 1,
                        },
                    })}
                    onClick={(evt) => {
                        location.hash = '#' + tree.node!.id;
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
                        className={
                            'icon ' +
                            css({
                                opacity: 0,
                            })
                        }
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
                <div style={{ marginLeft: tree.node ? 16 : 0 }}>
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
        <div style={{ padding: 8, backgroundColor: zedlight['border.selected'] }}>
            <div style={{ textAlign: 'center', marginBottom: 8, fontWeight: 600 }}>Modules</div>
            <ShowModuleTree selected={selected} tree={tree} />
        </div>
    );
};
