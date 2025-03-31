import { zedcolors } from './colors';

export const dark = {
    background: 'black',
    color: 'tan',
    metaNode: {
        decl: { color: '#c879df' },
        ref: { color: 'rgb(103 234 255)' }, //'rgb(255 90 68)' },
        number: { color: '#e6ff00' },
        kwd: { color: '#2852c7' },
        punct: { color: 'gray' },
        unparsed: { color: 'red' },
        text: { color: 'yellow' },
    },
    typeColors: {
        accent: '#aaf',
        accentLight: '#aaf',
        accentLightRgba: 'rgba(170, 170, 255, 0.3)',
        punct: '#555',
        vbl: '#afa',
        con: '#aaf',
        hl: '#aaf', //'rgb(237 255 0)',
        hlColor: 'black',
    },
};

// 548

export const light = {
    // background: '#dcdcddff',
    background: '#efefef',
    color: zedcolors.primary.color,

    metaNode: {
        decl: { color: zedcolors.constructor.color },
        ref: { color: zedcolors.link_uri.color }, //'rgb(255 90 68)' },
        number: { color: zedcolors.number.color },
        kwd: { color: zedcolors.keyword.color },
        punct: { color: zedcolors['punctuation.delimiter'].color },
        unparsed: { color: 'red' },
        text: { color: zedcolors.string.color },
    },
    typeColors: {
        accent: zedcolors.enum.color,
        accentLight: zedcolors.enum.color,
        accentLightRgba: 'rgba(170, 170, 255, 0.3)',
        punct: zedcolors['punctuation.delimiter'].color, // '#555',
        vbl: zedcolors.link_uri.color, // '#afa',
        con: zedcolors.property.color, // '#aaf',
        hl: zedcolors.link_uri.color, // '#aaf', //'rgb(237 255 0)',
        hlColor: '#dcdcddff',
    },
};

export const currentTheme: typeof dark = light;
