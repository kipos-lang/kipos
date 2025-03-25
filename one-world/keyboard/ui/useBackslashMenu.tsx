import { useEffect } from 'react';
import { RichKind } from '../../shared/cnodes';
import { spanText, idText } from '../cursorSplit';
import { getCurrent } from '../selections';
import { NodeSelection, Top, getSpan } from '../utils';
import { Menu, Action } from './App';
import { selectionPos } from './selectionPos';

export const useBackslashMenu = (
    sel: NodeSelection,
    top: Top,
    refs: Record<string, HTMLElement>,
    setMenu: (m: Menu | null) => void,
    dispatch: (s: Action) => void,
) => {
    useEffect(() => {
        // if (state.sel.multi) return setMenu(null);
        const pos = selectionPos(sel.start, refs, top);
        if (!pos) return;
        const current = getCurrent(sel, top);
        if (current.type === 'text' && current.cursor.type === 'text') {
            const span = getSpan(current.node, current.cursor.end.index);
            const end = current.cursor.end;
            if (span.type === 'text') {
                const text = spanText(span);
                // idText(top.tmpText, current.cursor.end, span);
                if (text[current.cursor.end.cursor - 1] === '\\') {
                    return setMenu({
                        top: pos.top + pos.height,
                        left: pos.left,
                        selection: 0,
                        items: [
                            {
                                title: 'Image embed',
                                action() {
                                    // const spans = current.node.spans.slice()
                                    // spans[end.index] = {type: 'embed'}
                                    // setState((s) =>
                                    //     applyUpdate(s, {
                                    //         nodes: {
                                    //             [current.node.loc]: {
                                    //                 ...current.node,
                                    //                 spans
                                    //             },
                                    //         },
                                    //         selection: {
                                    //             start: selStart(pathWithChildren(current.path, s.top.nextLoc), { type: 'text', end: { index: 0, cursor: 0 } }),
                                    //         },
                                    //         nextLoc: s.top.nextLoc + 1,
                                    //     }),
                                    // );
                                },
                            },
                        ],
                    });
                }
            }
        }
        if (current.type !== 'id') return setMenu(null);
        // oh lol. the slash.
        // it's gotta be, a thing. gotta parse that out my good folks.
        const slash = idText(top.tmpText, current.cursor, current.node)[0] === '\\';
        if (!slash) return setMenu(null);

        const kinds: { title: string; kind: RichKind }[] = [
            { title: 'Rich Text', kind: { type: 'plain' } },
            { title: 'Rich Text: Bullet', kind: { type: 'list', ordered: false } },
            { title: 'Rich Text: Section', kind: { type: 'section' } },
            { title: 'Rich Text: Numbered', kind: { type: 'list', ordered: true } },
            { title: 'Rich Text: Checkboxes', kind: { type: 'checks', checked: {} } },
            { title: 'Rich Text: Radio', kind: { type: 'opts' } },
            { title: 'Rich Text: Quote', kind: { type: 'indent', quote: true } },
            { title: 'Rich Text: Indent', kind: { type: 'indent', quote: false } },
            { title: 'Rich Text: Info', kind: { type: 'callout', vibe: 'info' } },
            { title: 'Rich Text: Warning', kind: { type: 'callout', vibe: 'info' } },
            { title: 'Rich Text: Error', kind: { type: 'callout', vibe: 'info' } },
        ];

        setMenu({
            top: pos.top + pos.height,
            left: pos.left,
            selection: 0,
            items: kinds
                .map(({ title, kind }) => ({
                    title,
                    action() {
                        dispatch({
                            type: 'update',
                            update: [
                                {
                                    type: 'replace-self',
                                    path: sel.start.path,
                                    node: {
                                        type: 'list',
                                        kind,
                                        loc: false,
                                        children: [
                                            {
                                                type: 'text',
                                                loc: true,
                                                spans: [{ type: 'text', text: '', loc: false }],
                                            },
                                        ],
                                    },
                                    cursor: { type: 'text', end: { index: 0, cursor: 0 } },
                                },
                            ],
                        });
                    },
                }))
                .concat([
                    {
                        title: 'Attachment',
                        action() {
                            // doing a thing
                        },
                    },
                    {
                        title: 'Rich Table',
                        action() {
                            dispatch({
                                type: 'update',
                                update: [
                                    {
                                        type: 'replace-self',
                                        path: sel.start.path,
                                        cursor: { type: 'text', end: { index: 0, cursor: 0 } },
                                        node: {
                                            type: 'table',
                                            kind: { type: 'rich' },
                                            loc: false,
                                            rows: [
                                                [
                                                    { type: 'text', loc: true, spans: [{ type: 'text', text: '', loc: false }] },
                                                    { type: 'text', loc: false, spans: [{ type: 'text', text: '', loc: false }] },
                                                ],
                                            ],
                                        },
                                    },
                                ],
                            });
                        },
                    },
                ]),
        });
    }, [sel, top]);
};
