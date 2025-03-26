import React, { useCallback, useContext, useEffect, useMemo } from 'react';
import { ModuleTree, SelStatus, useStore } from './store';
import { zedlight } from './zedcolors';
import { js } from '../keyboard/test-utils';
import { Node } from '../shared/cnodes';
import { closer, opener } from '../keyboard/ui/RenderNode';
import { interleave, interleaveF } from '../keyboard/interleave';
import { TextWithCursor } from '../keyboard/ui/cursor';
import { splitGraphemes } from '../splitGraphemes';
import { Cursor, Highlight, IdCursor, Path, pathWithChildren } from '../keyboard/utils';
import { pathKey } from '../../../../exploration/j3/one-world/keyboard/utils';

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
            <UseNodeCtx.Provider value={useNode}>
                <RenderNode parent={rootPath} id={root} />
            </UseNodeCtx.Provider>
        </div>
    );
};

const UseNodeCtx = React.createContext((path: Path): { node: Node; sel?: SelStatus } => {
    throw new Error('n');
});

const R = ({ node, self, sel }: { node: Node; self: Path; sel?: SelStatus }) => {
    switch (node.type) {
        case 'id':
            if (!sel) return <span>{node.text}</span>;
            return (
                <TextWithCursor
                    text={splitGraphemes(node.text)}
                    highlight={sel.highlight?.type === 'id' ? sel.highlight.spans : undefined}
                    cursors={(sel.cursors.filter((c) => c.type === 'id') as IdCursor[]).map((c) => c.end)}
                />
            );
        // return <span>{node.text}</span>;
        case 'list':
            if (typeof node.kind !== 'string') return 'UK';
            const children = node.children.map((id) => <RenderNode parent={self} id={id} key={id} />);
            if (node.kind === 'smooshed') {
                return <span>{children}</span>;
            }
            if (node.kind === 'spaced') {
                return (
                    <span>
                        {interleaveF(children, (k) => (
                            <span key={k}>&nbsp;</span>
                        ))}
                    </span>
                );
            }
            return (
                <span>
                    {opener[node.kind]}
                    {interleaveF(children, (k) => (
                        <span key={k}>, </span>
                    ))}
                    {closer[node.kind]}
                </span>
            );
    }
};

const RenderNode = ({ id, parent }: { id: string; parent: Path }) => {
    const self = useMemo(() => pathWithChildren(parent, id), [parent, id]);
    const { node, sel } = useContext(UseNodeCtx)(self);

    return (
        <>
            {/* <span style={{ fontSize: '50%' }}>{pathKey(self)}</span>
            {JSON.stringify(sel)} */}
            <R node={node} self={self} sel={sel} />
        </>
    );
};

const Editor = () => {
    const store = useStore();
    const editor = store.useEditor();

    useEffect(() => {
        const fn = (evt: KeyboardEvent) => {
            editor.update({
                type: 'key',
                key: evt.key,
                mods: { meta: evt.metaKey, ctrl: evt.ctrlKey, alt: evt.altKey, shift: evt.shiftKey },
                // visual,
                config: js, // parser.config,
            });
        };
        window.addEventListener('keydown', fn);
        return () => window.removeEventListener('keydown', fn);
    }, [editor]);

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
