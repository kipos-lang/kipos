import { zedlight } from './zedcolors';

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
    color: zedlight.syntax.primary.color,

    metaNode: {
        decl: { color: zedlight.syntax.constructor.color },
        ref: { color: zedlight.syntax.link_uri.color }, //'rgb(255 90 68)' },
        number: { color: zedlight.syntax.number.color },
        kwd: { color: zedlight.syntax.keyword.color },
        punct: { color: zedlight.syntax['punctuation.delimiter'].color },
        unparsed: { color: 'red' },
        text: { color: zedlight.syntax.string.color },
    },
    typeColors: {
        accent: zedlight.syntax.enum.color,
        accentLight: zedlight.syntax.enum.color,
        accentLightRgba: 'rgba(170, 170, 255, 0.3)',
        punct: zedlight.syntax['punctuation.delimiter'].color, // '#555',
        vbl: zedlight.syntax.link_uri.color, // '#afa',
        con: zedlight.syntax.property.color, // '#aaf',
        hl: zedlight.syntax.link_uri.color, // '#aaf', //'rgb(237 255 0)',
        hlColor: '#dcdcddff',
    },
};

export const currentTheme: typeof dark = light;
