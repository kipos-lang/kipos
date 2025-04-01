import React, { useMemo, useContext } from 'react';
import { Path, pathWithChildren } from '../../keyboard/utils';
import { Node } from '../../shared/cnodes';
import { RenderStaticNode, UseNodeCtx } from '../App';
import { SelStatus, useStore } from '../store/store';
import { RenderText } from './RenderText';
import { RenderId } from './RenderId';
import { RenderList } from './RenderList';
import { RenderTable } from './RenderTable';
import { Meta } from '../store/language';
import { css } from 'goober';
import { useHover } from '../Editor';
import { ShowText } from '../../../type-inference-debugger/demo/ShowText';

const R = ({ node, self, sel, meta }: { meta?: Meta; node: Node; self: Path; sel?: SelStatus }) => {
    switch (node.type) {
        case 'id':
            return <RenderId node={node} meta={meta} sel={sel} self={self} />;
        case 'text':
            return <RenderText node={node} sel={sel} meta={meta} self={self} />;
        case 'list':
            return <RenderList meta={meta} node={node} sel={sel} self={self} />;
        case 'table':
            return <RenderTable node={node} meta={meta} sel={sel} self={self} />;
    }
};

export const RenderNode = ({ id, parent }: { id: string; parent: Path }) => {
    const self = useMemo(() => pathWithChildren(parent, id), [parent, id]);
    const { node, sel, meta } = useContext(UseNodeCtx)(self);
    const top = useStore().useEditor().useTop(parent.root.top);
    const annotations = top.useAnnotations(id);

    const errors = annotations?.filter((e) => e.type === 'error');
    const warnings = annotations?.filter((e) => e.type === 'warning');
    const hover = useHover(self, !!annotations?.length);

    const r = <R node={node} self={self} meta={meta} sel={sel} />;
    const overlay = hover.isHovered ? (
        <span style={{ position: 'relative' }}>
            <div
                style={{
                    width: 400,
                    position: 'absolute',
                    pointerEvents: 'none',
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
                            ann.message.map((item) => (typeof item === 'string' ? item : <RenderStaticNode root={item.renderable} />))
                        )}
                    </div>
                ))}
            </div>
        </span>
    ) : null;

    if (errors?.length) {
        return (
            <span
                onMouseOver={(evt) => {
                    evt.stopPropagation();
                    hover.setHover(self);
                }}
                className={css({
                    textDecoration: 'wavy red underline',
                })}
                style={{ background: hover.isHovered ? 'red' : undefined }}
                title={JSON.stringify(errors.map((e) => e.message))}
            >
                {r}
                {overlay}
            </span>
        );
    }

    if (warnings?.length) {
        return (
            <span
                onMouseOver={(evt) => {
                    evt.stopPropagation();
                    hover.setHover(self);
                }}
                style={{ background: hover.isHovered ? 'red' : undefined }}
                className={css({
                    textDecoration: 'wavy orange underline',
                })}
                title={JSON.stringify(warnings.map((e) => e.message))}
            >
                {r}
                {overlay}
            </span>
        );
    }

    return (
        <span
            onMouseOver={(evt) => {
                evt.stopPropagation();
                hover.setHover(self);
            }}
            style={{ background: hover.isHovered ? 'red' : undefined }}
        >
            {/* <span style={{ fontSize: '50%', border: '1px solid red' }}>
                {id.slice(-5)}:{node.type}
            </span> */}
            {/* {meta ? <span style={{ fontSize: '50%', border: '1px solid red' }}>{JSON.stringify(meta)}</span> : null} */}
            {r}
            {overlay}
        </span>
        // <span data-self={JSON.stringify(self)} data-id={id}>
        //     {/* <span style={{ fontSize: '50%' }}>{pathKey(self)}</span>
        //     {JSON.stringify(sel)} */}
        // {/* </span> */}
    );
};
