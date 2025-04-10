import React from 'react';
import { selStart } from '../keyboard/utils';
import { SelStatus, useStore } from './store/store';
import { Editor } from './Editor';
import { ModuleSidebar } from './ModuleSidebar';
import { ShowColors } from '../../type-inference-debugger/demo/ShowColors';
import { useSelection } from './store/editorHooks';

export const App = () => {
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'row',
                height: '100vh',
                alignItems: 'stretch',
            }}
        >
            <ModuleSidebar />
            <Editor />
            {/* <ShowColors /> */}
        </div>
    );
};

export const cursorPositionInSpanForEvt = (evt: React.MouseEvent, target: HTMLSpanElement, text: string[]) => {
    const range = new Range();
    let best = null as null | [number, number];
    for (let i = 0; i <= text.length; i++) {
        const at = text.slice(0, i).join('').length;
        range.setStart(target.firstChild!, at);
        range.setEnd(target.firstChild!, at);
        const box = range.getBoundingClientRect();
        if (evt.clientY < box.top || evt.clientY > box.bottom) continue;
        const dst = Math.abs(box.left - evt.clientX);
        if (!best || dst < best[0]) best = [dst, i];
    }
    return best ? best[1] : null;
};

export const Showsel = () => {
    const store = useStore();
    const editor = store.useEditor();
    const sel = useSelection();

    return (
        <>
            {sel.map((sel, i) => (
                <div key={i}>
                    <div>{sel.start.path.children.map((p) => p.slice(-5)).join('; ')}</div>
                    {JSON.stringify(sel.start.cursor)}
                    <div>{sel.end?.path.children.map((p) => p.slice(-5)).join('; ')}</div>
                    {JSON.stringify(sel.end?.cursor)}
                </div>
            ))}
        </>
    );
};
