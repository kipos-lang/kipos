import React, { useCallback, useContext, useEffect, useMemo } from 'react';
import { interleaveF } from '../keyboard/interleave';
import { js } from '../keyboard/test-utils';
import { Cursor, TextWithCursor } from '../keyboard/ui/cursor';
import { closer, opener } from '../keyboard/ui/RenderNode';
import { IdCursor, ListWhere, Path, pathWithChildren } from '../keyboard/utils';
import { Node } from '../shared/cnodes';
import { splitGraphemes } from '../splitGraphemes';
import { ModuleTree, SelStatus, useStore } from './store';
import { zedlight } from './zedcolors';

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
    const has = (where: ListWhere) => sel?.cursors.some((c) => c.type === 'list' && c.where === where);
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
        case 'text':
            return (
                <span>
                    {has('before') ? <Cursor /> : null}"{has('inside') ? <Cursor /> : null}
                    {node.spans.map((span, i) => {
                        const sc = sel?.cursors.filter((c) => c.type === 'text' && c.end.index === i);
                        if (span.type === 'text') {
                            if (sc?.length) {
                                const hl = sel?.highlight?.type === 'text' ? sel.highlight.spans[i] : undefined;
                                return (
                                    <TextWithCursor
                                        key={i}
                                        text={splitGraphemes(span.text)}
                                        highlight={hl}
                                        cursors={sc.map((s) => (s.type === 'text' ? s.end.cursor : 0))}
                                    />
                                );
                            }
                            return span.text;
                        }
                        if (span.type === 'embed') {
                            return <RenderNode key={i} parent={self} id={span.item} />;
                        }
                        return 'SPAN' + span.type;
                    })}
                    "{has('after') ? <Cursor /> : null}
                </span>
            );
        // return <span>{node.text}</span>;
        case 'list':
            if (typeof node.kind !== 'string') return 'UK';
            const children = node.children.map((id) =>
                node.forceMultiline ? (
                    <span
                        style={{
                            display: 'block',
                            paddingLeft: 32,
                        }}
                        key={id}
                    >
                        <RenderNode parent={self} id={id} key={id} />
                        {node.kind === 'smooshed' || node.kind === 'spaced' ? null : ', '}
                    </span>
                ) : (
                    <RenderNode parent={self} id={id} key={id} />
                ),
            );
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
                    {has('before') ? <Cursor /> : null}
                    {opener[node.kind]}
                    {has('inside') ? <Cursor /> : null}
                    {node.forceMultiline ? children : interleaveF(children, (k) => <span key={k}>, </span>)}
                    {closer[node.kind]}
                    {has('after') ? <Cursor /> : null}
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
