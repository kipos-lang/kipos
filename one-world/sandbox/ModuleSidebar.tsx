import { css } from 'goober';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { EditIcon } from './icons';
import { useStore, newModule } from './store/store';
import { zedlight } from './zedcolors';
import { Resizebar } from './Resizebar';
import { DragTreeCtx, DragTreeCtxT, DragTreeNode } from './DragTree';
import equal from 'fast-deep-equal';

const ModuleTitle = ({ node: { name }, id }: { id: string; node: { name: string } }) => {
    const store = useStore();
    const [editing, setEditing] = useState(null as null | string);
    const selected = store.useSelected(); // todo: useIsSelected

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
            onClick={(evt) => {
                location.hash = '#' + id;
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
                onClick={(evt) => {
                    evt.stopPropagation();
                    if (editing != null) {
                        if (!editing.trim() || editing === name) return setEditing(null);
                        store.updateeModule({ id: id, name: editing });
                        setEditing(null);
                    } else {
                        setEditing(name);
                    }
                }}
            >
                <EditIcon />
            </div>
        </div>
    );
};

// const ShowModuleTree = ({ tree, selected }: { selected: string; tree: ModuleTree }) => {
//     return (
//         <div>
//             {tree.node ? (
//             ) : null}
//             {tree.children.length ? (
//                 <div style={{ marginLeft: tree.node ? 16 : 0 }}>
//                     {tree.children.map((child, i) => (
//                         <ShowModuleTree key={child.node?.id ?? i} selected={selected} tree={child} />
//                     ))}
//                     <button
//                         onClick={() => {
//                             const name = prompt('Name');
//                             store.addModule(newModule(name ?? 'NewModule'));
//                         }}
//                         style={{ marginTop: 12 }}
//                     >
//                         Add module
//                     </button>
//                 </div>
//             ) : null}
//         </div>
//     );
// };

export const ModuleSidebar = () => {
    const store = useStore();

    const dtctx: DragTreeCtxT<{ name: string }> = useMemo(
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
        }),
        [],
    );

    return (
        <Resizebar id="modules" side="right">
            <div style={{ padding: 8, flex: 1, minWidth: 0, overflow: 'hidden', backgroundColor: zedlight['border.selected'] }}>
                <div style={{ textAlign: 'center', marginBottom: 8, fontWeight: 600 }}>Modules</div>
                <DragTreeCtx.Provider value={dtctx}>
                    <DragTreeNode id="root" />
                </DragTreeCtx.Provider>
            </div>
        </Resizebar>
    );
};
