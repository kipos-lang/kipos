import React from 'react';
import { interleaveF } from '../../keyboard/interleave';
import { lightColor } from '../../keyboard/ui/colors';
import { Cursor } from '../../keyboard/ui/cursor';
import { opener, closer } from '../../keyboard/ui/RenderNode';
import { Path, ListWhere } from '../../keyboard/utils';
import { Node } from '../../shared/cnodes';
import { useDrag } from '../Editor';
import { RenderNode } from './RenderNode';
import { SelStatus } from '../store/store';

export const RenderList = ({ node, sel, self }: { node: Node & { type: 'list' }; sel?: SelStatus; self: Path }) => {
    const has = (where: ListWhere) => sel?.cursors.some((c) => c.type === 'list' && c.where === where);

    const hl = sel?.highlight?.type === 'full' || (sel?.highlight?.type === 'list' && sel.highlight.opener && sel.highlight.closer);
    const style = hl ? { borderRadius: '2px', backgroundColor: lightColor, outline: `2px solid ${lightColor}` } : undefined;

    const drag = useDrag();

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
        return (
            <span ref={drag.ref(node.loc)} style={style}>
                {children}
            </span>
        );
    }
    if (node.kind === 'spaced') {
        return (
            <span ref={drag.ref(node.loc)} style={style}>
                {interleaveF(children, (k) => (
                    <span key={k}>&nbsp;</span>
                ))}
            </span>
        );
    }
    return (
        <span ref={drag.ref(node.loc)} style={style}>
            {has('before') ? <Cursor /> : null}
            {opener[node.kind]}
            {has('inside') ? <Cursor /> : null}
            {node.forceMultiline ? children : interleaveF(children, (k) => <span key={k}>, </span>)}
            {closer[node.kind]}
            {has('after') ? <Cursor /> : null}
        </span>
    );
};
