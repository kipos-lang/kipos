import { test, expect } from 'bun:test';
import { js, lex } from './lexer';
import { fromMap, fromRec } from '../shared/cnodes';
import { shape } from '../shared/shape';

test('eat white', () => {
    const res = lex(js, '(1, 2)');
    const rec = fromMap(res.roots[0], res.nodes, (l) => ({ id: '', idx: l }));
    expect(shape(rec)).toEqual('(id(1/0) id(2/0))');
});

test('table', () => {
    const res = lex(js, '(:1;2:)');
    const rec = fromMap(res.roots[0], res.nodes, (l) => ({ id: '', idx: l }));
    expect(shape(rec)).toEqual('(:id(1/0);id(2/0):)');
});

test('table rows', () => {
    const res = lex(js, '(:1:3;2:)');
    const rec = fromMap(res.roots[0], res.nodes, (l) => ({ id: '', idx: l }));
    expect(shape(rec)).toEqual('(:id(1/0),id(3/0);id(2/0):)');
});

test('eat white 2', () => {
    const res = lex(js, '(1, 2      3)');
    const rec = fromMap(res.roots[0], res.nodes, (l) => ({ id: '', idx: l }));
    expect(shape(rec)).toEqual('(id(1/0) list[spaced](id(2/0) id(3/0)))');
});

test('lex', () => {
    const res = lex(js, 'hello+folks');
    const rec = fromMap(res.roots[0], res.nodes, (l) => ({ id: '', idx: l }));
    expect(shape(rec)).toEqual('list[smooshed](id(hello/0) id(+/3) id(folks/0))');
});

test('lex2', () => {
    const res = lex(js, '(one+two and,three,four)');
    const rec = fromMap(res.roots[0], res.nodes, (l) => ({ id: '', idx: l }));
    expect(shape(rec)).toEqual('(list[spaced](list[smooshed](id(one/0) id(+/3) id(two/0)) id(and/0)) id(three/0) id(four/0))');
});

test('string', () => {
    const res = lex(js, '"A string"');
    const rec = fromMap(res.roots[0], res.nodes, (l) => ({ id: '', idx: l }));
    expect(shape(rec)).toEqual('text(A string)');
});

test('string', () => {
    const res = lex(js, '"A string ${with embed} and such"');
    const rec = fromMap(res.roots[0], res.nodes, (l) => ({ id: '', idx: l }));
    expect(shape(rec)).toEqual('text(A string |${list[spaced](id(with/0) id(embed/0))}| and such)');
});
