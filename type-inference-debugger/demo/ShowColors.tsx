import React from 'react';
import { zedcolors } from './colors';

const square = (name: string, color: string) => (
    <React.Fragment key={name}>
        <div style={{ color, fontFamily: 'Jet Brains' }}>{name}</div>
        <div
            style={{
                background: color,
                width: 20,
                height: 20,
                border: '1px solid black',
            }}
        />
    </React.Fragment>
);
export const ShowColors = () => {
    const bg = '#dcdcddff';
    // zedcolors.bg = {color: bg}
    return (
        <div style={{ background: bg, padding: 32, display: 'grid', gridTemplateColumns: 'max-content max-content' }}>
            {square('bg', bg)}
            {Object.keys(zedcolors).map((name) => square(name, zedcolors[name as 'attribute'].color))}
        </div>
    );
};
