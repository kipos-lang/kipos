import React, { useMemo, useContext, useState, useRef, useEffect } from 'react';
import { Path, pathWithChildren } from '../../keyboard/utils';
import { Node } from '../../shared/cnodes';
import { RenderStaticNode, TestResultsCtx, UseNodeCtx } from '../Top';
import { SelStatus, useStore } from '../store/store';
import { RenderText } from './RenderText';
import { RenderId } from './RenderId';
import { RenderList } from './RenderList';
import { RenderTable } from './RenderTable';
import { LocatedTestResult, Meta } from '../store/language';
import { css } from 'goober';
import { BadgeCheck, CancelIcon, CheckIcon, MinusIcon, NeqIcon } from '../icons';
import { useUpdate, useHover } from '../Editor';
import { pathWith } from '../../keyboard/ctdt-test-utils';
import { zedlight } from '../zedcolors';
import { useAnnotations } from '../store/editorHooks';

const R = React.memo(function R({ node, self, sel, meta, spans }: { spans?: string[][]; meta?: Meta; node: Node; self: Path; sel?: SelStatus }) {
    switch (node.type) {
        case 'id':
            return <RenderId node={node} meta={meta} sel={sel} self={self} />;
        case 'text':
            return <RenderText node={node} sel={sel} meta={meta} self={self} />;
        case 'list':
            return <RenderList meta={meta} node={node} sel={sel} self={self} spans={spans} />;
        case 'table':
            return <RenderTable node={node} meta={meta} sel={sel} self={self} />;
    }
});

export function Wrap({ parent, id, children }: { children: React.ReactNode; parent: Path; id: string }) {
    const annotations = useAnnotations(parent.root.top, id);
    const testResult = useContext(TestResultsCtx)(id);

    const errors = annotations?.filter((e) => e.type === 'error');
    const warnings = annotations?.filter((e) => e.type === 'warning');
    const hasOverlay = annotations?.length;
    const { isHovered: hover, setHover, clearHover } = useHover(hasOverlay ? id : undefined);

    const overlay = (
        <span style={{ position: 'relative' }}>
            {hover ? (
                <div
                    style={{
                        width: 400,
                        position: 'absolute',
                        // opacity: 0.8,
                        pointerEvents: 'none',
                        display: 'inline-block',
                        // top: '100%',
                        left: 0,
                        // top: '100%',
                        bottom: '100%',
                        marginBottom: 8,
                        // marginTop: 8,
                        zIndex: 100,
                        backgroundColor: 'white',
                        boxShadow: '1px 1px 4px #aaa',
                        padding: '8px 16px',
                    }}
                >
                    {annotations?.map((ann, i) => (
                        <div key={i}>
                            {ann.type === 'type' ? (
                                <RenderStaticNode root={ann.annotation} />
                            ) : (
                                ann.message.map((item, i) => (typeof item === 'string' ? item : <RenderStaticNode key={i} root={item.renderable} />))
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div style={{ position: 'absolute' }} />
            )}
        </span>
    );

    return (
        <span
            onMouseMove={
                hasOverlay
                    ? (evt) => {
                          evt.stopPropagation();
                          setHover(true);
                      }
                    : undefined
            }
            onMouseOut={
                hasOverlay
                    ? (evt) => {
                          evt.stopPropagation();
                          setHover(false);
                      }
                    : undefined
            }
            style={hover ? { background: '#faa', borderRadius: 3, position: 'relative' } : { position: 'relative' }}
            className={css({
                textDecoration: errors?.length ? 'wavy red underline' : warnings?.length ? 'wavy orange underline' : undefined,
            })}
        >
            {/* <span style={{ fontSize: '50%', border: '1px solid red' }}>
                {id.slice(-5)}:{node.type}
            </span> */}
            {/* {meta ? <span style={{ fontSize: '50%', border: '1px solid red' }}>{JSON.stringify(meta)}</span> : null} */}
            {/* {annotations ? <span style={{ fontSize: '50%', border: '1px solid red' }}>{JSON.stringify(annotations)}</span> : null} */}
            {overlay}
            {testResult ? <ShowTestResult id={id} result={testResult} parent={parent} /> : null}
            {children}
        </span>
        // <span data-self={JSON.stringify(self)} data-id={id}>
        //     {/* <span style={{ fontSize: '50%' }}>{pathKey(self)}</span>
        //     {JSON.stringify(sel)} */}
        // {/* </span> */}
    );
}

const icons: { [K in LocatedTestResult['result']['type']]: React.ReactNode } = {
    fail: <CancelIcon style={{ color: 'red' }} />,
    error: <MinusIcon style={{ color: 'red' }} />,
    // mismatch: <span style={{ color: 'red' }}>!=</span>,
    mismatch: <NeqIcon style={{ color: 'red' }} />,
    pass: <BadgeCheck style={{ color: 'green' }} />,
};

const ShowFullTestResult = ({ result, parent }: { parent: Path; result: LocatedTestResult }) => {
    const update = useUpdate();

    switch (result.result.type) {
        case 'mismatch': {
            const { actual, expected } = result.result;
            if (actual) {
                return (
                    <div
                        style={{ color: 'black' }}
                        onMouseDown={(evt) => {
                            evt.stopPropagation();
                        }}
                        onClick={(evt) => {
                            evt.stopPropagation();
                        }}
                    >
                        <div style={{ fontWeight: 'bold' }}>Actual</div>
                        <RenderStaticNode root={actual} />
                        {expected ? (
                            <>
                                <div style={{ fontWeight: 'bold' }}>Expected</div>
                                <RenderStaticNode root={expected} />
                            </>
                        ) : null}
                        <button
                            style={{ display: 'block', whiteSpace: 'nowrap', marginTop: 8 }}
                            onClick={() => {
                                update({
                                    type: 'paste',
                                    replace: pathWithChildren(parent, result.loc!),
                                    data: { type: 'json', data: [{ tree: actual.node, single: true }] },
                                });
                            }}
                        >
                            Update snapshot
                        </button>
                    </div>
                );
            }
        }
    }
    return JSON.stringify(result.result);
};

const ShowTestResult = ({ result, id, parent }: { parent: Path; id: string; result: LocatedTestResult }) => {
    const { isHovered, setHover } = useHover(id + ':test-result', true);
    const icon = icons[result.result.type];
    return (
        <span style={{ position: 'relative' }}>
            <span
                onMouseDown={(evt) => {
                    evt.stopPropagation();
                    setHover(true);
                }}
                className={css({
                    marginRight: '8px',
                })}
            >
                {icon}
            </span>
            {isHovered ? (
                <div
                    className={css({
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        zIndex: 200,
                        padding: '4px 8px',
                        borderRadius: '4px',
                        background: 'white',
                        boxShadow: '0 1px 4px ' + zedlight.syntax.constructor.color,
                    })}
                >
                    <ShowFullTestResult result={result} parent={parent} />
                </div>
            ) : null}
        </span>
    );
};

export const RenderNode = React.memo(function RenderNode({ id, parent }: { id: string; parent: Path }) {
    const self = useMemo(() => pathWithChildren(parent, id), [parent, id]);
    const { node, sel, meta, spans } = useContext(UseNodeCtx)(self);

    return (
        <Wrap id={id} parent={parent}>
            <R node={node} self={self} meta={meta} sel={sel} spans={spans} />
        </Wrap>
    );
});
