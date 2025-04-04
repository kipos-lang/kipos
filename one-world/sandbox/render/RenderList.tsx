import React, { ReactElement } from 'react';
import { interleaveF } from '../../keyboard/interleave';
import { lightColor } from '../../keyboard/ui/colors';
import { Cursor } from '../../keyboard/ui/cursor';
import { opener, closer } from '../../keyboard/ui/RenderNode';
import { Path, ListWhere } from '../../keyboard/utils';
import { Node } from '../../shared/cnodes';
import { useDrag } from '../Editor';
import { RenderNode, Wrap } from './RenderNode';
import { SelStatus } from '../store/store';
import { Meta } from '../store/language';
import { metaStyles } from './metaStyles';
import { Grouped, partition } from '../store/makeEditor';

export const RenderList = ({
    node,
    sel,
    self,
    meta,
    spans,
}: {
    spans?: string[][];
    meta?: Meta;
    node: Node & { type: 'list' };
    sel?: SelStatus;
    self: Path;
}) => {
    const has = (where: ListWhere) => sel?.cursors.some((c) => c.type === 'list' && c.where === where);

    const hl = sel?.highlight?.type === 'full' || (sel?.highlight?.type === 'list' && sel.highlight.opener && sel.highlight.closer);
    let style: undefined | React.CSSProperties = hl
        ? { borderRadius: '2px', backgroundColor: lightColor, outline: `2px solid ${lightColor}` }
        : undefined;
    if (meta?.kind && metaStyles[meta.kind as 'ref']) {
        style = { ...style, ...metaStyles[meta.kind as 'ref'] };
    }

    const drag = useDrag();

    if (typeof node.kind !== 'string') return 'DIFFERENT KIDN';

    if (node.kind === 'spaced' || node.kind === 'smooshed') {
        const parted = spans && spans.length === node.children.length ? partition(spans, node.children) : undefined;
        if (parted) {
            return <RenderGrouped grouped={parted} parent={self} spaced={node.kind === 'spaced'} />;
        }
    }

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

const ungroup = (group: Grouped): string[] => group.children.flatMap((child) => (typeof child === 'string' ? child : ungroup(child)));

export const RenderGrouped = ({ grouped, spaced, parent }: { parent: Path; grouped: Grouped; spaced: boolean }): ReactElement => {
    let children: ReactElement[] = grouped.children.map((item, i) =>
        typeof item === 'string' ? (
            <RenderNode key={item} parent={parent} id={item} />
        ) : (
            <RenderGrouped key={i} parent={parent} grouped={item} spaced={spaced} />
        ),
    );
    if (spaced) {
        children = interleaveF(children, (i) => <span key={'int-' + i}>&nbsp;</span>);
    }

    // const multi = ungroup(grouped).some((id) => ctx.multis[id]);
    if (!grouped.end) {
        return (
            <span
            // style={
            //     multi
            //         ? {}
            //         : {
            //               display: 'inline-flex',
            //               alignItems: 'flex-start',
            //           }
            // }
            >
                {children}
            </span>
        );
    }
    return (
        <Wrap id={grouped.id!} parent={parent}>
            {children as any}
        </Wrap>
    );
};
