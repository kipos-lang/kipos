import React, { useMemo, useContext } from 'react';
import { Path, pathWithChildren } from '../../keyboard/utils';
import { Node } from '../../shared/cnodes';
import { UseNodeCtx } from '../App';
import { SelStatus } from '../store/store';
import { RenderText } from './RenderText';
import { RenderId } from './RenderId';
import { RenderList } from './RenderList';
import { RenderTable } from './RenderTable';
import { Meta } from '../store/language';
import { css } from 'goober';

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
    const { node, sel, meta, annotations } = useContext(UseNodeCtx)(self);

    const errors = annotations?.filter((e) => e.type === 'error');
    const warnings = annotations?.filter((e) => e.type === 'warning');

    const r = <R node={node} self={self} meta={meta} sel={sel} />;

    if (errors?.length) {
        return (
            <span
                className={css({
                    textDecoration: 'wavy red underline',
                })}
                title={JSON.stringify(errors.map((e) => e.message))}
            >
                {r}
            </span>
        );
    }

    if (warnings?.length) {
        return (
            <span
                className={css({
                    textDecoration: 'wavy orange underline',
                })}
                title={JSON.stringify(warnings.map((e) => e.message))}
            >
                {r}
            </span>
        );
    }

    return (
        <>
            {/* <span style={{ fontSize: '50%', border: '1px solid red' }}>
                {id.slice(-5)}:{node.type}
            </span> */}
            {/* {meta ? <span style={{ fontSize: '50%', border: '1px solid red' }}>{JSON.stringify(meta)}</span> : null} */}
            {errors?.length ? <span style={{ fontSize: '50%', border: '1px solid red' }}>{JSON.stringify(errors)}</span> : null}
            {r}
        </>
        // <span data-self={JSON.stringify(self)} data-id={id}>
        //     {/* <span style={{ fontSize: '50%' }}>{pathKey(self)}</span>
        //     {JSON.stringify(sel)} */}
        // {/* </span> */}
    );
};
