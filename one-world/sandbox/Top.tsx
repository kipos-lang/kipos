import { css } from 'goober';
import React, { useMemo, useCallback } from 'react';
import { genId } from '../keyboard/ui/genId';
import { Path, lastChild } from '../keyboard/utils';
import { RecNode, Node, fromRec } from '../shared/cnodes';
import { DragCtx, noopDrag } from './Editor';
import { RenderNode } from './render/RenderNode';
import { Meta } from './store/language';
import { useStore, UseNode } from './store/store';
import { currentTheme } from './themes';

export const Top = React.memo(({ id }: { id: string }) => {
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
                    boxShadow: `0px 1px 2px ${currentTheme.typeColors.hlColor}`,
                    paddingInline: '4px',
                    borderRadius: '3px',
                })}
            >
                {Object.entries(parseResult?.validation?.annotations ?? {}).map(([key, items]) => (
                    <div key={key}>
                        {items.map((item, i) =>
                            item.type === 'type' && item.primary ? (
                                <div key={i}>
                                    <RenderStaticNode root={item.annotation} />
                                </div>
                            ) : null,
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
});

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
