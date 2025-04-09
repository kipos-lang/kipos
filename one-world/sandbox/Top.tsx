import { css } from 'goober';
import React, { useMemo, useCallback, createContext, useEffect, useRef, useState } from 'react';
import { genId } from '../keyboard/ui/genId';
import { Path, lastChild, pathWithChildren } from '../keyboard/utils';
import { RecNode, Node, fromRec } from '../shared/cnodes';
import { DragCtx, noopDrag, useEditor } from './Editor';
import { RenderNode } from './render/RenderNode';
import { AnnotationText, EvaluationResult, FailureKind, LocatedTestResult, Meta } from './store/language';
import { useStore, UseNode } from './store/store';
import { currentTheme } from './themes';
import { TopGrab } from './TopGrab';
import { zedlight } from './zedcolors';
import { Toplevel } from './types';
import equal from 'fast-deep-equal';
import { selectEnd, selectStart } from '../keyboard/handleNav';

export const GetTopCtx = createContext<() => Toplevel>(() => {
    throw new Error('no');
});

export const TestResultsCtx = createContext<(id: string) => LocatedTestResult | null>(() => {
    return null;
});

export const Top = React.memo(function Top({ id, name }: { id: string; name: string }) {
    const store = useStore();
    const editor = store.useEditor();
    const top = editor.useTop(id);

    const getTop = useCallback(() => editor.getTop(id), [id]);

    const isSelected = editor.useIsSelectedTop(id);

    const root = top.useRoot();
    const rootPath = useMemo(
        () => ({
            root: { ids: [], top: id },
            children: [],
        }),
        [id],
    );

    const parseResult = editor.useTopParseResults(id);

    const results = editor.useTopResults(id);
    const onTestLoc = useTestTracker(results);
    const nonLocTestResults = results; // results?.filter((r) => r.type !== 'test-result' || !r.loc);

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
                    color: '#8c8d93',
                    position: 'relative',
                })}
                style={isSelected ? { boxShadow: '0px 1px 3px ' + zedlight.syntax.attribute.color } : {}}
                onMouseDown={(evt) => {
                    evt.stopPropagation();
                    const box = evt.currentTarget.getBoundingClientRect();
                    const top = evt.clientY < box.top + box.height / 2;
                    const sel = top ? selectStart(pathWithChildren(rootPath, root), getTop()) : selectEnd(pathWithChildren(rootPath, root), getTop());
                    if (sel) {
                        editor.update({ type: 'selections', selections: [{ start: sel }] });
                    }
                }}
            >
                <TopFailure id={id} />
                <TopGrab name={name} id={id} />
                <div style={{ flexBasis: 12 }} />
                <GetTopCtx.Provider value={getTop}>
                    <UseNodeCtx.Provider value={useNode}>
                        <TestResultsCtx.Provider value={onTestLoc}>
                            <RenderNode parent={rootPath} id={root} />
                        </TestResultsCtx.Provider>
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
                    {parseResult?.kind?.type !== 'test'
                        ? Object.entries(parseResult?.validation?.annotations[id] ?? {}).map(([key, items]) => (
                              <div key={key}>
                                  {items.map((item, i) =>
                                      item.type === 'type' && item.primary ? (
                                          <div key={i}>
                                              <RenderStaticNode root={item.annotation} />
                                          </div>
                                      ) : null,
                                  )}
                              </div>
                          ))
                        : null}
                </div>
            </div>
            {nonLocTestResults?.length ? <TopReults results={nonLocTestResults} id={id} isSelected={isSelected} /> : null}
        </div>
    );
});

const renderMessage = (message: string | AnnotationText[]) =>
    typeof message === 'string'
        ? message
        : message.map((item, i) => (typeof item === 'string' ? item : <RenderStaticNode key={i} root={item.renderable} />));

export const TopFailure = ({ id }: { id: string }) => {
    const editor = useEditor();
    const compileFailure = editor.useTopFailure(id);
    const parseResults = editor.useTopParseResults(id);
    const failure: (FailureKind | { type: 'parse' | 'validation'; message: string | AnnotationText[] })[] = [...(compileFailure ?? [])];
    if (!parseResults.result) {
        failure.push({ type: 'parse', message: 'failed to parse' });
    }
    if (!parseResults.validation) {
        failure.push({ type: 'validation', message: 'failed to validate' });
    }
    Object.values(parseResults.validation?.annotations[id] ?? {}).forEach((anns) => {
        anns.forEach((ann) => {
            if (ann.type === 'error') {
                failure.push({ type: 'validation', message: ann.message });
            }
        });
    });

    // const validation = editor.use
    if (!failure.length) return null;

    return (
        <div
            className={css({
                width: '300px',
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
            {failure.map((fail, i) => {
                switch (fail.type) {
                    case 'compilation':
                        return <div key={i}>C: {fail.message}</div>;
                    case 'dependencies':
                        return <div key={i}>Missing {fail.deps.length} deps</div>;
                    case 'evaluation':
                        return <div key={i}>E: {fail.message}</div>;
                    case 'parse':
                        return <div key={i}>P: {renderMessage(fail.message)}</div>;
                    case 'validation':
                        return <div key={i}>V: {renderMessage(fail.message)}</div>;
                }
            })}
        </div>
    );
};

export const TopReults = ({ id, results, isSelected }: { results: EvaluationResult[]; id: string; isSelected: boolean }) => {
    return (
        <div
            className={css({
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '12px',
                margin: '12px',
                borderRadius: '4px',
                boxShadow: '0px 1px 3px #ccc',
                fontFamily: 'Jet Brains',
            })}
            style={isSelected ? { boxShadow: '0px 1px 3px ' + zedlight.syntax.attribute.color } : {}}
        >
            {results.map((res, i) =>
                res.type === 'plain' ? (
                    <pre key={i} style={{ display: 'block', margin: 0, padding: 0 }}>
                        {res.data}
                    </pre>
                ) : (
                    <pre key={i} style={{ display: 'block', margin: 0, padding: 0 }}>
                        {JSON.stringify(res)}
                    </pre>
                ),
            )}
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
        <span>
            <DragCtx.Provider value={noopDrag}>
                <UseNodeCtx.Provider
                    value={(path: Path) => {
                        return { node: map[lastChild(path)], meta: meta[lastChild(path)] };
                    }}
                >
                    <RenderNode id={id} parent={{ children: [], root: { ids: [], top: '' } }} />
                </UseNodeCtx.Provider>
            </DragCtx.Provider>
        </span>
    );
};

export const UseNodeCtx = React.createContext<UseNode>((path) => {
    throw new Error('n');
});

export const useTestTracker = (results: null | EvaluationResult[]) => {
    // NOTE: only one result per loc allowed at the moment
    const state = useMemo(
        () => ({ listeners: {} as Record<string, (tr: LocatedTestResult | null) => void>, byLoc: {} as Record<string, LocatedTestResult> }),
        [],
    );
    useEffect(() => {
        const byLoc: Record<string, LocatedTestResult> = {};
        let notify: Record<string, true> = {};
        results?.forEach((res) => {
            if (res.type === 'test-result' && res.loc != null) {
                if (!equal(state.byLoc[res.loc], res)) {
                    notify[res.loc] = true;
                }
                byLoc[res.loc] = res;
            }
        });
        Object.keys(state.byLoc).forEach((k) => {
            if (!byLoc[k]) {
                notify[k] = true;
            }
        });
        state.byLoc = byLoc;
        Object.keys(notify).forEach((k) => {
            if (state.listeners[k]) {
                console.log('results change, notify', k);
                state.listeners[k](byLoc[k]);
            }
        });
    }, [results]);

    const onTestLoc = useCallback((loc: string) => {
        const [got, setGot] = useState(state.byLoc[loc] as null | LocatedTestResult);
        useEffect(() => {
            state.listeners[loc] = setGot;
            return () => {
                if (state.listeners[loc] === setGot) {
                    delete state.listeners[loc];
                }
            };
        }, [loc, setGot]);
        return got;
    }, []);

    return onTestLoc;
};
