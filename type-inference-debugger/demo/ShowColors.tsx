import React, { useState } from 'react';
import { zedcolors } from './colors';

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
            {Object.keys(zedcolors).map((name) => square(name, zedcolors[name as 'attribute'].color, setHover))}
        </div>
    );
};
