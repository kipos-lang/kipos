import { zedlight } from '../zedcolors';

export const metaStyles = {
    attribute: { fontStyle: 'italic', fontFamily: 'Lora', color: zedlight.syntax.property.color, fontWeight: 'bold' },
    decl: { color: zedlight.syntax.constructor.color },
    constructor: { color: zedlight.syntax.constructor.color },
    bop: { color: zedlight.syntax.constructor.color },
    ref: { color: zedlight.syntax.link_uri.color }, //'rgb(255 90 68)' },
    number: { color: zedlight.syntax.number.color },
    unused: { color: '#aaa', fontStyle: 'italic' },
    kwd: { color: zedlight.syntax.keyword.color },
    punct: { color: zedlight.syntax['punctuation.delimiter'].color },
    unparsed: { color: 'red' },
    comment: { color: 'green' },
    text: { color: zedlight.syntax.string.color },
};
