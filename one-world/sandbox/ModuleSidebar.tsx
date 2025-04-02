import { css } from 'goober';
import React, { useState } from 'react';
import { EditIcon } from './icons';
import { ModuleTree, useStore, newModule } from './store/store';
import { zedlight } from './zedcolors';

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
