import { css } from 'goober';
import React, { useMemo, useCallback, createContext } from 'react';
import { genId } from '../keyboard/ui/genId';
import { Path, lastChild } from '../keyboard/utils';
import { RecNode, Node, fromRec } from '../shared/cnodes';
import { DragCtx, noopDrag, useEditor } from './Editor';
import { RenderNode } from './render/RenderNode';
import { FailureKind, Meta } from './store/language';
import { useStore, UseNode } from './store/store';
import { currentTheme } from './themes';
import { TopGrab } from './TopGrab';
import { zedlight } from './zedcolors';
import { Toplevel } from './types';

export const GetTopCtx = createContext<() => Toplevel>(() => {
    throw new Error('no');
});

export const Top = React.memo(({ id, name }: { id: string; name: string }) => {
    const store = useStore();
    const editor = store.useEditor();
    const top = editor.useTop(id);

    const getTop = useCallback(() => editor.getTop(id), [id]);

    const sel = editor.useSelection();
    const isSelected = sel[0].start.path.root.top === id;

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
        <div>
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
                    position: 'relative',
                })}
                style={isSelected ? { boxShadow: '0px 1px 3px ' + zedlight.syntax.attribute.color } : {}}
            >
                <TopFailure id={id} />
                <TopGrab name={name} id={id} />
                <div style={{ flexBasis: 12 }} />
                <GetTopCtx.Provider value={getTop}>
                    <UseNodeCtx.Provider value={useNode}>
                        <RenderNode parent={rootPath} id={root} />
                    </UseNodeCtx.Provider>
                </GetTopCtx.Provider>
                <div
                    className={css({
                        marginLeft: '24px',
                        boxShadow: `0px 1px 2px ${currentTheme.typeColors.hlColor}`,
                        paddingInline: '4px',
                        borderRadius: '3px',
                    })}
                >
                    {Object.entries(parseResult?.validation?.annotations[id] ?? {}).map(([key, items]) => (
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
            <TopReults id={id} isSelected={isSelected} />
        </div>
    );
});

export const TopFailure = ({ id }: { id: string }) => {
    const editor = useEditor();
    const compileFailure = editor.useTopFailure(id);
    const parseResults = editor.useTopParseResults(id);
    const failure: (FailureKind | { type: 'parse' | 'validation'; message: string })[] = [...(compileFailure ?? [])];
    if (!parseResults.result) {
        failure.push({ type: 'parse', message: 'failed to parse' });
    }
    if (!parseResults.validation) {
        failure.push({ type: 'validation', message: 'failed to validate' });
    }
    Object.values(parseResults.validation?.annotations[id] ?? {}).forEach((anns) => {
        anns.forEach((ann) => {
            if (ann.type === 'error') {
                failure.push({ type: 'validation', message: JSON.stringify(ann.message) });
            }
        });
    });

    // const validation = editor.use
    if (!failure.length) return null;

    return (
        <div
            className={css({
                width: '200px',
                background: '#fee',
                boxShadow: '0px 0px 2px red',
                position: 'absolute',
                top: '5px',
                right: '5px',
                borderRadius: '4px',
                zIndex: 400,
                fontSize: '60%',
                overflow: 'auto',
                padding: '4px',
            })}
        >
            {JSON.stringify(failure)}
        </div>
    );
};

export const TopReults = ({ id, isSelected }: { id: string; isSelected: boolean }) => {
    const editor = useEditor();
    const results = editor.useTopResults(id);
    if (results == null) return null;

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
            style={isSelected ? { boxShadow: '0px 1px 3px ' + zedlight.syntax.attribute.color } : {}}
        >
            {results.map((res, i) => (res.type === 'plain' ? <pre>{res.data}</pre> : <pre>{JSON.stringify(res)}</pre>))}
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
