
## Basic multi-top setup

- I can require you to click a toplevel to get selection there
- and require you to click a button to make a new toplevel
- not the nicest, but usable.


##

- [x] define types
- [x] figure out storage and retrieval.
  - localstorage?
  - localforage?
  - some leveldb abomination?
  - honestly probably localstorage until it doesnt work anymore
    and then localforage...
  - alTHOUGH, I could also say its serverside ...
    yeah ok once localStorage doesn't cut it, we implement
    serverside goodness.

The Big Dealio

What's the data?
- a module, is a list of ... toplevels? ok yeah we'll not deal with nesting toplevels at the moment?
  or maybe we can, might as well make it possible.
- So a module has, like a name or something. and a parent. and an ID obvs.

Tables:
module
- id
- name
- parent (might be `root`) // wait do we do ordering? hm. no just alphabetical.
- languageConfiguration
- toplevels
- roots[]

toplevel
- id
- children
- root
- nodes
(maybe plugin stuff)

languageConfiguration
- id
- parser
- type-inference?
- compiler?
  - includes some indication of compilation target (js, wasm, glsl, etc.)
- interpreter?

Q: what if type inference was expected to produce everything needed for compilation,
including, if necessary, the original parse tree?

##

- [x] Bring over ... cst editing stuff?
- [x] Bring over test files... and things they depend on.
- [x] yasss so good. all tests passing.
- [ ] bring over the hindley stuff.
  - [x] the reader/lexer
  - [x] the parser-dsl
  - the algw maybeeeeeeeee
- [x] directoyr cleanup
  - [x] move stuff from web/ and src/ into better places
- [ ] make a web UI dealio
  - gonna have to handle multiple toplevels, my lads.
    - that'll take a bit of doing, to be sure.
      - hopefully just to the first level of things that produce KeyActions
- [ ] make a file-based mode ... for good testing and such

oh nooooes, zed doesn't support coverage reporting.

...


# Question: do I want ... do mess with multiple package publishing stuff?

... I do, at some point, want to be able to publish a cli tool on npm
... and probably the web tool as well, on npm
... but these are end-user packages, and can just be bundled to a single js file.

Do I want to mess with shipping smaller packages? I certainly don't think so.
not at the moment.

BUT at present, the toplevel directory is pretty messy.


# Here's the basic idea of what I want to build

I'm thinking; put the CRDT stuff on hold for a minute; the tests should keep for now.

We make a little editor thing that doesn't try to do the hash-based addressing stuff.
Just modules.
A module has things in it.

A module has a selected language configuration.
A module can import other modules, and the imported modules get evaluated with the same language configuration as the current one.
Also ... like maybe tests are run as well? To ensure that the module you're importing is sane.

left pane: modules, in a tree probably
right pane: auxiliary stuff, like a
- keyboard input help pane (for help with the structured editor)
- undo/redo stack, visual clipboard
- parsing debugger (CST/AST view)
- type inference debugger (yay)
- execution debugger (classic stepping debugger probably)
- maybe a place to {pin} tests, or example outputs, or something?
middle pane:
- the module you're editing.

should also be able to do a "find all usages" of a given thing, and edit all of those at once ... somehow.

A LANGUAGE CONFIGURATION IS:
- a parser
- a type checker (optional)
- an interpreter (optional)
- a compiler (optional?)

Ok and these things are separately configurable, on a per-module basis, because they shouldn't impact
compatibility with other modules
- maybe a set of editor plugins
- a set of macros to be using, which are .. imported probably? yeah they have to be defined in other modules.

Annnnnnd I think we're breaking with the j3 repo.
Let's get going on kipos
