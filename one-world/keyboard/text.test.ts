// let's test some operations

import { applyNormalUpdate, applySel, applyUpdate, testCtree } from './applyUpdate';
import { check } from './check.test';
import { handleDelete } from './handleDelete';
import { handleKey } from './handleKey';
import { handleNav } from './handleNav';
import { selUpdate } from './update/updaters';
import { SelStart } from './handleShiftNav';
import { handleWrap } from './handleWrap';
import {
    asTop,
    bullet,
    checks,
    controlc,
    id,
    idc,
    lisp,
    list,
    listc,
    rich,
    round,
    smoosh,
    tembed,
    TestState,
    text,
    textc,
    tspan,
} from './test-utils';
import { keyUpdate } from './ui/keyUpdate';

// beforeAll(() => testCtree(true));
// afterAll(() => testCtree(false));

test('text before', () => {
    let state = asTop(text([], true), listc('before'));
    state = applyUpdate(state, handleKey(state, 'A', lisp)!);
    check(state, smoosh([id('A', true), text([])]), idc(1));
});

test('text after', () => {
    let state = asTop(text([], true), listc('after'));
    state = applyUpdate(state, handleKey(state, 'A', lisp)!);
    check(state, smoosh([text([]), id('A', true)]), idc(1));
});

test('text inside type', () => {
    let state = asTop(text([], true), listc('inside'));
    state = applyUpdate(state, handleKey(state, 'A', lisp)!);
    check(state, text([tspan('A', undefined, true)]), {
        type: 'text',
        end: { index: 0, cursor: 1 },
    });
});

test('before embed', () => {
    let state = asTop(text([tembed(id(''), u, true)]), textc('', 0));
    state = applyUpdate(state, handleKey(state, 'A', lisp)!);
    check(state, text([tspan('A'), tembed(id(''))], true), {
        type: 'text',
        end: { index: 0, cursor: 1 },
    });
});

test('id to text', () => {
    let state = asTop(id('', true), idc(0));
    state = applyUpdate(state, handleKey(state, '"', lisp)!);
    check(state, text([tspan('', u, true)]), textc(0, 0));
});

test('text inside leavee', () => {
    let state = asTop(text([], true), listc('inside'));
    state = applyUpdate(state, handleKey(state, '"', lisp)!);
    check(state, text([], true), listc('after'));
});

const u = undefined;

test('text inside list', () => {
    let state = asTop(round([], true), listc('inside'));
    state = applyUpdate(state, handleKey(state, '"', lisp)!);
    check(state, round([text([tspan('', u, true)])]), textc('2', 0));
});

test('text wrap in empty', () => {
    let state = asTop(text([], true), listc('inside'));
    state = applyUpdate(state, handleWrap(state, '(')!);
    check(state, text([tspan('(', undefined, true)]), textc(0, 1));
});

test('text after id', () => {
    let state = asTop(id('hi', true), idc(2));
    state = applyUpdate(state, handleKey(state, '"', lisp)!);
    check(state, smoosh([id('hi'), text([], true)]), listc('inside'));
});

test('text insert', () => {
    let state = asTop(text([tspan('hi')], true), textc(0, 2));
    state = applyUpdate(state, handleKey(state, 'l', lisp)!);
    check(state, text([tspan('hil')], true), textc(0, 3));
});

test('text insert - commit text changes', () => {
    let state = asTop(text([tspan('hi')], true), textc(0, 2));
    state = applyUpdate(state, handleKey(state, 'l', lisp)!);
    state = applySel(state, handleNav('ArrowRight', state));
    check(state, text([tspan('hil')], true), listc('after'));
});

// MARK: nav text

test('text nav', () => {
    let state = asTop(text([tspan('hi')], true), textc(0, 2));
    state = applySel(state, handleNav('ArrowLeft', state)!);
    check(state, text([tspan('hi')], true), textc(0, 1));
});

test('text nav right', () => {
    let state = asTop(text([tspan('hi')], true), textc(0, 0));
    state = applySel(state, handleNav('ArrowRight', state)!);
    check(state, text([tspan('hi')], true), textc(0, 1));
});

test('text nav past end', () => {
    let state = asTop(text([tspan('hi')], true), textc(0, 2));
    state = applySel(state, handleNav('ArrowRight', state)!);
    check(state, text([tspan('hi')], true), listc('after'));
});

test('text nav past end - rich', () => {
    let state = asTop(
        list({ type: 'plain' })([
            //
            text([tspan('hi')], true),
            text([tspan('yo')]),
        ]),
        textc(0, 2),
    );
    state = applySel(state, handleNav('ArrowRight', state));
    check(
        state,
        list({ type: 'plain' })([
            //
            text([tspan('hi')]),
            text([tspan('yo')], true),
        ]),
        textc(0, 0),
    );
});

test('text nav between spans', () => {
    let state = asTop(text([tspan('hi'), tspan('lo')], true), textc(0, 2));
    state = applySel(state, handleNav('ArrowRight', state)!);
    check(state, text([tspan('hi'), tspan('lo')], true), textc(1, 1));
});

test('text nav between span and embed', () => {
    let state = asTop(text([tspan('hi'), tembed(id('lo'))], true), textc(0, 2));
    state = applySel(state, handleNav('ArrowRight', state)!);
    check(state, text([tspan('hi'), tembed(id('lo', true))]), idc(0));
});

test('back into text', () => {
    let state = asTop(smoosh([text([tspan('hi')]), id('ho', true)]), idc(0));
    state = applySel(state, handleNav('ArrowLeft', state)!);
    check(state, smoosh([text([tspan('hi')], true), id('ho')]), textc(0, 2));
});

test('back into text inside', () => {
    let state = asTop(smoosh([text([]), id('ho', true)]), idc(0));
    state = applySel(state, handleNav('ArrowLeft', state)!);
    check(state, smoosh([text([], true), id('ho')]), listc('inside'));
});

test('back into text embed', () => {
    let state = asTop(smoosh([text([tembed(id('hi'))]), id('ho', true)]), idc(0));
    state = applySel(state, handleNav('ArrowLeft', state)!);
    check(state, smoosh([text([tembed(id('hi'))], true), id('ho')]), textc(0, 1));
});

// MARK: right list

test('nav right text (list) / after', () => {
    let state = asTop(smoosh([text([tembed(id('hi'))], true), id('ho')]), listc('after'));
    state = applySel(state, handleNav('ArrowRight', state)!);
    check(state, smoosh([text([tembed(id('hi'))]), id('ho', true)]), idc(1));
});

test('nav right text (list) / before', () => {
    let state = asTop(text([tspan('hi')], true), listc('before'));
    state = applySel(state, handleNav('ArrowRight', state)!);
    check(state, text([tspan('hi')], true), textc(0, 0));
});

test('nav right text (list) / before - embed', () => {
    let state = asTop(text([tspan('hi')], true), listc('before'));
    state = applySel(state, handleNav('ArrowRight', state)!);
    check(state, text([tspan('hi')], true), textc(0, 0));
});

test('nav right text (list) / inside', () => {
    let state = asTop(text([], true), listc('inside'));
    state = applySel(state, handleNav('ArrowRight', state)!);
    check(state, text([], true), listc('after'));
});

test('nav right text (list) / before / empty', () => {
    let state = asTop(text([], true), listc('before'));
    state = applySel(state, handleNav('ArrowRight', state)!);
    check(state, text([], true), listc('inside'));
});

// MARK: left list

test('nav left text (list) / before', () => {
    let state = asTop(smoosh([id('hi'), text([], true)]), listc('before'));
    state = applySel(state, handleNav('ArrowLeft', state)!);
    check(state, smoosh([id('hi', true), text([])]), idc(1));
});

test('nav left text (list) / after - empty', () => {
    let state = asTop(smoosh([id('hi'), text([], true)]), listc('after'));
    state = applySel(state, handleNav('ArrowLeft', state)!);
    check(state, smoosh([id('hi'), text([], true)]), listc('inside'));
});

test('nav left text (list) / after', () => {
    let state = asTop(text([tspan('ho')], true), listc('after'));
    state = applySel(state, handleNav('ArrowLeft', state)!);
    check(state, text([tspan('ho')], true), textc(0, 2));
});

test('nav left text (text) ', () => {
    let state = asTop(text([tspan('hi'), tspan('ho')], true), textc(1, 0));
    state = applySel(state, handleNav('ArrowLeft', state)!);
    check(state, text([tspan('hi'), tspan('ho')], true), textc(0, 1));
});

test('nav left text (text) ', () => {
    let state = asTop(text([tembed(id('hi')), tspan('ho')], true), textc(1, 0));
    state = applySel(state, handleNav('ArrowLeft', state)!);
    check(state, text([tembed(id('hi', true)), tspan('ho')]), idc(2));
});

test('nav left text (text) first ', () => {
    let state = asTop(text([tspan('ho')], true), textc(0, 0));
    state = applySel(state, handleNav('ArrowLeft', state)!);
    check(state, text([tspan('ho')], true), listc('before'));
});

test('text code at end', () => {
    let state = asTop(text([tspan('a`b')], true), textc(0, 3));
    state = applyUpdate(state, handleKey(state, '`', lisp)!);
    check(state, text([tspan('a'), tspan('b', { format: 'code' }), tspan('')], true), textc(2, 0));
});

test('text code mid', () => {
    let state = asTop(text([tspan('a`bc')], true), textc(0, 3));
    state = applyUpdate(state, handleKey(state, '`', lisp)!);
    check(state, text([tspan('a'), tspan('b', { format: 'code' }), tspan('c')], true), textc(2, 0));
});

test('text closeeee', () => {
    let state = asTop(text([tspan('ho')], true), textc(0, 2));
    state = applyUpdate(state, handleKey(state, '"', lisp)!);
    check(state, text([tspan('ho')], true), listc('after'));
});

// TODO: join adjacent spanssss that have the same style pls

test('embed', () => {
    let state = asTop(text([tspan('hi$')], true), textc(0, 3));
    state = applyUpdate(state, handleKey(state, '{', lisp)!);
    check(state, text([tspan('hi'), tembed(id('', true))]), idc(0));
});

test('embed at span star', () => {
    let state = asTop(text([tspan('a$ho')], true), textc(0, 2));
    state = applyUpdate(state, handleKey(state, '{', lisp)!);
    check(state, text([tspan('a'), tembed(id('', true)), tspan('ho')]), idc(0));
});

test('right out of embed', () => {
    let state = asTop(text([tspan('a'), tembed(id('ho')), tspan('b')], true), textc(1, 1));
    state = applyNormalUpdate(state, selUpdate(handleNav('ArrowRight', state)));
    check(state, text([tspan('a'), tembed(id('ho')), tspan('b')], true), textc(2, 1));
});

test('right out of embed', () => {
    let state = asTop(text([tspan('a'), tembed(id('ho'))], true), textc(1, 1));
    state = applyNormalUpdate(state, selUpdate(handleNav('ArrowRight', state)));
    check(state, text([tspan('a'), tembed(id('ho'))], true), listc('after'));
});

test('left into embed', () => {
    let state = asTop(text([tspan('a'), tembed(id('ho')), tspan('b')], true), textc(1, 1));
    state = applyNormalUpdate(state, selUpdate(handleNav('ArrowLeft', state)));
    check(state, text([tspan('a'), tembed(id('ho', true)), tspan('b')]), idc(2));
});

test('del an embed', () => {
    let state = asTop(text([tspan('a'), tembed(id('ho'))], true), textc(1, 1));
    state = applyUpdate(state, handleDelete(state));
    check(state, text([tspan('a', u, true)]), textc('1', 1));
});

test('del in an embed', () => {
    let state = asTop(text([tspan('a'), tembed(id('', true))]), idc(0));
    state = applyUpdate(state, handleDelete(state));
    check(state, text([tspan('a')], true), textc(0, 1));
});

test('del in an embed', () => {
    let state = asTop(text([tembed(id('', true)), tspan('a')]), idc(0));
    state = applyUpdate(state, handleDelete(state));
    check(state, text([tspan('a')], true), textc(0, 0));
});

// MARK: rich n stuff

test('enter in non rich', () => {
    let state = asTop(text([tspan('hello')], true), textc(0, 3));
    state = applyUpdate(state, keyUpdate(state, '\n', {}));
    check(state, text([tspan('hel\nlo')], true), textc(0, 4));
});

test('enter in rich', () => {
    let state = asTop(rich([text([tspan('hello')], true)]), textc(0, 3));
    state = applyUpdate(state, keyUpdate(state, '\n', {}));
    check(state, rich([text([tspan('hel')]), text([tspan('lo')], true)]), textc(0, 0));
});

test('shift-enter in rich', () => {
    let state = asTop(rich([text([tspan('hello')], true)]), textc(0, 3));
    state = applyUpdate(state, keyUpdate(state, '\n', { shift: true }));
    check(state, rich([text([tspan('hel\nlo')], true)]), textc(0, 4));
});

test('enter after sub rich', () => {
    let state = asTop(rich([checks([text([tspan('hello')])], true)]), listc('after'));
    state = applyUpdate(state, keyUpdate(state, ',', {}));
    check(state, rich([checks([text([tspan('hello')])]), text([tspan('')], true)]), textc(0, 0));
});

test('select a controlll', () => {
    let state = asTop(checks([text([tspan('hello')], true), text([])]), textc(0, 5));
    state = applyUpdate(state, keyUpdate(state, 'Tab', {}));
    check(state, checks([text([tspan('hello')]), text([])], true), controlc(1));
});

test('select a controlll and back', () => {
    let state = asTop(checks([text([tspan('hello')]), text([], true)]), listc('inside'));
    state = applyUpdate(state, keyUpdate(state, 'Tab', { shift: true }));
    check(state, checks([text([tspan('hello')]), text([])], true), controlc(1));
    state = applyUpdate(state, keyUpdate(state, 'Tab', { shift: true }));
    check(state, checks([text([tspan('hello')], true), text([])]), textc(0, 5));
});

test('toggle a control', () => {
    let state = asTop(checks([text([])], true), controlc(0));
    state = applyUpdate(state, keyUpdate(state, ' ', {}));
    check(state, checks([text([])], true), controlc(0));
});

test('bullets', () => {
    let state = asTop(rich([text([tspan('-')], true)]), textc(0, 1));
    state = applyUpdate(state, keyUpdate(state, ' ', {}));
    check(state, rich([bullet([text([tspan('')], true)])]), textc(0, 0));
});

test('numbers', () => {
    let state = asTop(rich([text([tspan('1.')], true)]), textc(0, 2));
    state = applyUpdate(state, keyUpdate(state, ' ', {}));
    check(state, rich([list({ type: 'list', ordered: true })([text([tspan('')], true)])]), textc(0, 0));
});

test('checks', () => {
    let state = asTop(rich([text([tspan('[ ]')], true)]), textc(0, 3));
    state = applyUpdate(state, keyUpdate(state, ' ', {}));
    check(state, rich([list({ type: 'checks', checked: {} })([text([tspan('')], true)])]), textc(0, 0));
});

test('opts', () => {
    let state = asTop(rich([text([tspan('( )')], true)]), textc(0, 3));
    state = applyUpdate(state, keyUpdate(state, ' ', {}));
    check(state, rich([list({ type: 'opts' })([text([tspan('')], true)])]), textc(0, 0));
});

test('header', () => {
    let state = asTop(rich([text([tspan('##')], true)]), textc(0, 2));
    state = applyUpdate(state, keyUpdate(state, ' ', {}));
    check(state, rich([list({ type: 'section', level: 2 })([text([tspan('')], true)])]), textc(0, 0));
});

test('" in a rich', () => {
    let state = asTop(rich([text([tspan('')], true)]), textc(0, 0));
    state = applyUpdate(state, keyUpdate(state, '"', {}));
    check(state, rich([text([tspan('"')], true)]), textc(0, 1));
});

test('del in rich', () => {
    let state = asTop(rich([text([tspan('')], true)]), textc(0, 0));
    state = applyUpdate(state, keyUpdate(state, 'Backspace', {}));
    check(state, id('', true), idc(0));
});

test('remove list item', () => {
    let state = asTop(bullet([text([tspan('one')]), text([tspan('')], true)]), textc(0, 0));
    state = applyUpdate(state, keyUpdate(state, 'Backspace', {}));
    check(state, bullet([text([tspan('one')], true)]), textc(0, 3));
});

test('remove list item', () => {
    let state = asTop(rich([bullet([text([tspan('one')]), text([tspan('')], true)])]), textc(0, 0));
    state = applyUpdate(state, keyUpdate(state, '\n', {}));
    check(state, rich([bullet([text([tspan('one')])]), text([tspan('')], true)]), textc(0, 0));
});

test('delete previous', () => {
    let state = asTop(bullet([text([tspan('one')]), text([tspan('two')], true)]), textc(0, 0));
    state = applyUpdate(state, keyUpdate(state, 'Backspace', {}));
    check(state, bullet([text([tspan('onetwo', u, true)])]), textc('2', 3));
});

test('delete at start', () => {
    let state = asTop(bullet([text([tspan('one')], true), text([tspan('two')])]), textc(0, 0));
    state = applyUpdate(state, keyUpdate(state, 'Backspace', {}));
    check(state, bullet([text([tspan('one')]), text([tspan('two')])], true), listc('before'));
});

test('alt-left in text', () => {
    let state = asTop(text([tspan('one two three', undefined, true)]), textc('', 8));
    state = applyUpdate(state, keyUpdate(state, 'ArrowLeft', { alt: true }));
    check(state, text([tspan('one two three', undefined, true)]), textc('1', 4));
});

test('shift-alt-left in text', () => {
    let state = asTop(text([tspan('one two three', undefined, true)]), textc('', 8));
    state = applyUpdate(state, keyUpdate(state, 'ArrowLeft', { alt: true, shift: true }));
    check(state, text([tspan('one two three', undefined, true)]), textc('1', 8), textc('1', 4));
});

test('getting out of an embed', () => {
    let state = asTop(text([tspan('hi'), tembed(round([id('a')], true)), tspan('ho')]), listc('after'));
    state = applyUpdate(state, keyUpdate(state, '}', {}));
    check(state, text([tspan('hi'), tembed(round([id('a')])), tspan('ho')], true), textc(1, 1));
});

// TODO delete rich in table
