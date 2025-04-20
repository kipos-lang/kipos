import React, { useState } from 'react';
import { zedcolors } from './colors';
import { zedlight } from '../../one-world/sandbox/zedcolors';

const square = (name: string, color: string, hover: (color: string | null) => void) => (
    <React.Fragment key={name}>
        <div style={{ color, fontFamily: 'Jet Brains' }}>{name}</div>
        <div
            style={{
                background: color,
                width: 20,
                height: 20,
                border: '1px solid black',
            }}
            onMouseOver={() => hover(color)}
            onMouseOut={() => hover(null)}
        />
    </React.Fragment>
);
export const ShowColors = () => {
    const bg = '#dcdcddff';
    const [hover, setHover] = useState(null as null | string);
    // zedcolors.bg = {color: bg}
    return (
        <div style={{ background: hover ?? bg, padding: 32, display: 'grid', gridTemplateColumns: 'max-content max-content' }}>
            {square('bg', bg, setHover)}
            <strong style={{ gridColumn: '1/3' }}>Syntax</strong>
            {Object.keys(zedlight.syntax).map((name) => square(name, zedlight.syntax[name as 'attribute'].color, setHover))}
            <strong style={{ gridColumn: '1/3' }}>General</strong>
            {Object.keys(zedlight).map((name) =>
                typeof zedlight[name as keyof typeof zedlight] === 'string' ? square(name, zedlight[name as 'border'], setHover) : null,
            )}
        </div>
    );
};
