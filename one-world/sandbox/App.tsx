import React, { useEffect } from 'react';
import { ModuleTree, useStore } from './store';
import { zedlight } from './zedcolors';
import { js } from '../keyboard/test-utils';

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

const Top = ({ id }: { id: string }) => {
    const store = useStore();
    const editor = store.useEditor();
    const top = editor.useTop(id);

    const isSelected = editor.module.selections.some((s) => s.start.path.root.top === id || s.end?.path.root.top === id);

    useEffect(() => {
        const fn = (evt: KeyboardEvent) => {
            // top.update({
            //     type: 'key',
            //     key: evt.key,
            //     mods: { meta: evt.metaKey, ctrl: evt.ctrlKey, alt: evt.altKey, shift: evt.shiftKey },
            //     // visual,
            //     config: js, // parser.config,
            // });
        };
    }, [editor, id]);

    return <div>A top thanks</div>;
};

const Editor = () => {
    const store = useStore();
    const editor = store.useEditor();

    return (
        <div style={{ flex: 1, background: zedlight.background }}>
            Editor here
            {editor.module.roots.map((id) => (
                <Top id={id} key={id} />
            ))}
        </div>
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
