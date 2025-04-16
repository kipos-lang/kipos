import { css } from 'goober';
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CirclePlusIcon, EditIcon, HDots } from './icons';
import { useStore, newModule, Store } from './store/store';
import { zedlight } from './zedcolors';
import { Resizebar } from './Resizebar';
import { Dragger, DraggerCtx, DragTreeCtx, DragTreeCtxT, DragTreeNode } from './DragTree';
import equal from 'fast-deep-equal';
import { useTestResults } from './store/editorHooks';

const ModuleTitle = ({
    node: { name },
    id,
    collapsed,
    setCollapsed,
}: {
    id: string;
    node: { name: string };
    collapsed: boolean | null;
    setCollapsed: (b: boolean) => void;
}) => {
    const store = useStore();
    const [editing, setEditing] = useState(null as null | string);
    const selected = store.useSelected(); // todo: useIsSelected
    const { useMouseDown, useIsDragging, checkClick } = useContext(DraggerCtx);
    const onMouseDown = useMouseDown(id);
    const isDragging = useIsDragging(id);

    const tr = useTestResults(id);
    const passCount = tr?.reduce((m, t) => m + t.results.reduce((a, b) => a + (b.result.type === 'pass' ? 1 : 0), 0), 0) ?? 0;
    const testCount = tr?.reduce((m, t) => m + t.results.length, 0) ?? 0;

    return (
        <div
            className={css({
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '4px',
                background: selected === id ? zedlight.syntax.attribute.color : undefined,
                color: selected === id ? 'white' : undefined,
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                '&:hover': {
                    background: selected === id ? zedlight.syntax.attribute.color : undefined,
                    color: selected === id ? 'white' : undefined,
                },
                '&:hover .icon': {
                    opacity: 1,
                },
            })}
            style={isDragging ? { background: '#96abf9' } : undefined}
            onClick={(evt) => {
                location.hash = '#' + id;
            }}
        >
            <div
                style={{ visibility: collapsed === null ? 'hidden' : 'visible', cursor: 'pointer', width: '1em' }}
                onClick={(evt) => {
                    evt.stopPropagation();
                    setCollapsed(!collapsed);
                }}
            >
                {collapsed ? '>' : 'v'}
            </div>
            {tr?.length ? (
                <div
                    style={{
                        backgroundColor: passCount < testCount ? 'red' : 'green',
                        width: 20,
                        height: 20,
                        textAlign: 'center',
                        borderRadius: 8,
                        fontSize: '80%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 8,
                    }}
                >
                    {passCount < testCount ? testCount - passCount : passCount}
                </div>
            ) : null}
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
                name
            )}
            <div style={{ flexBasis: 16, minWidth: 16, flexGrow: 1 }} />
            <div
                className={
                    'icon ' +
                    css({
                        opacity: 0,
                    })
                }
                onMouseDown={onMouseDown}
                onClick={(evt) => {
                    evt.stopPropagation();
                    if (checkClick()) return;
                    if (editing != null) {
                        if (!editing.trim() || editing === name) return setEditing(null);
                        store.updateModule({ id: id, name: editing });
                        setEditing(null);
                    } else {
                        setEditing(name);
                    }
                }}
            >
                <HDots />
            </div>
        </div>
    );
};

const useDragCtx = (store: Store): DragTreeCtxT<{ name: string }> => {
    return useMemo(
        () => ({
            useNode(id) {
                const [data, setData] = useState(() => {
                    const children = store.moduleChildren()[id];
                    if (id === 'root') return { children };
                    const name = store.module(id).name;
                    return { children, node: { name } };
                });
                const latest = useRef(data);
                latest.current = data;
                useEffect(() => {
                    return store.listen('modules', () => {
                        const children = store.moduleChildren()[id];
                        if (id === 'root') {
                            if (!equal(children, latest.current.children)) {
                                setData({ children });
                            }
                            return;
                        }
                        const name = store.module(id).name;
                        if (!equal(children, latest.current.children) || latest.current.node?.name !== name) {
                            setData({ children, node: { name } });
                        }
                    });
                }, [id]);
                return data;
            },
            Render: ModuleTitle,
            onDrop(dragged, dest, location) {
                // throw new Error('not yet');
                console.log({ dragged, dest, location });
                if (location !== 'inside') {
                    console.warn('nope, not happening');
                    return;
                }
                store.updateModule({ id: dragged, parent: dest });
            },
        }),
        [],
    );
};

export const ModuleSidebar = () => {
    const store = useStore();
    const dtctx = useDragCtx(store);

    return (
        <Resizebar id="modules" side="right">
            <div style={{ padding: 8, flex: 1, minWidth: 0, overflow: 'hidden', backgroundColor: zedlight['border.selected'] }}>
                <div style={{ textAlign: 'center', marginBottom: 8, fontWeight: 600 }}>
                    Modules
                    <span
                        onClick={() => {
                            const name = prompt('Name');
                            if (!name) return;
                            store.addModule(newModule(name));
                        }}
                    >
                        <CirclePlusIcon style={{ fontSize: 20, cursor: 'pointer', marginBottom: -4, marginLeft: 8 }} />
                    </span>
                </div>
                <Dragger dtctx={dtctx} />
            </div>
        </Resizebar>
    );
};
