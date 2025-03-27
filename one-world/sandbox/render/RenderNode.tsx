import React, { useMemo, useContext } from 'react';
import { Path, pathWithChildren } from '../../keyboard/utils';
import { Node } from '../../shared/cnodes';
import { UseNodeCtx } from '../App';
import { SelStatus } from '../store/store';
import { RenderText } from './RenderText';
import { RenderId } from './RenderId';
import { RenderList } from './RenderList';
import { RenderTable } from './RenderTable';

const R = ({ node, self, sel }: { node: Node; self: Path; sel?: SelStatus }) => {
    switch (node.type) {
        case 'id':
            return <RenderId node={node} sel={sel} self={self} />;
        case 'text':
            return <RenderText node={node} sel={sel} self={self} />;
        case 'list':
            return <RenderList node={node} sel={sel} self={self} />;
        case 'table':
            return <RenderTable node={node} sel={sel} self={self} />;
    }
};

export const RenderNode = ({ id, parent }: { id: string; parent: Path }) => {
    const self = useMemo(() => pathWithChildren(parent, id), [parent, id]);
    const { node, sel } = useContext(UseNodeCtx)(self);

    return (
        <>
            {/* <span style={{ fontSize: '50%', border: '1px solid red' }}>
                {id.slice(-5)}:{node.type}
            </span> */}

            {/* {sel ? <span style={{ fontSize: '50%', border: '1px solid red' }}>{JSON.stringify(sel)}</span> : null} */}
            <R node={node} self={self} sel={sel} />
        </>
        // <span data-self={JSON.stringify(self)} data-id={id}>
        //     {/* <span style={{ fontSize: '50%' }}>{pathKey(self)}</span>
        //     {JSON.stringify(sel)} */}
        // {/* </span> */}
    );
};
