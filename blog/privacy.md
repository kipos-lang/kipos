
Tile ideas:
- Why does your compiler pretend packages don't exist


I get it. It would be nice if all code could just be in a single file. but it can't, it has to be in multiple files, for (VCS) reasons, and (other bad reasons).
So we have to have multiple files, even multiple folders. But do we really need anything more than that??


Languages to consider:
- koka
- roc
- elm
- erlang
- julia
- python
- go
- rust
- c++
- c
- c#
- ocaml
- haskell
- lean4
- node
- swift
- objc
- scala
- PHP
- Ruby
- R
- Kotlin
- Dart
- Perl
- Lua
- F#



My thought is that, in order for a good /library dependency & upgrading/ story,
we want a concept of toplevels that are "exported from a library", which
forms the whole and complete surface area of the library; which is also
separate from the concept of "exported from an individual module".

Such that you can be held accountable for /tests of things that are exported
from the library/ to catch breaking changes, but be allowed to have
tests of internal modules that change from version to version.

Sooo let's talk about the "levels of privacy" that are offered by different languages.

A note on naming:
A "definition" is like a "function" or a "type" or a "class".
A "module" is the thing that contains definitions (and may expose them or not)
A "library" is a kind of thing that is versioned and shared


Coming from javascript, I am frustrated by the necessity of informal
conventions like "this thing is exported, but only for tests, it shouldn't
be consumed by non-test things".
In go there's the annoying thing of "things prefixed by _ shouldn't be
used outside of the file they're defined in".


Let's make the table:


Language
         Priv Module | Priv Decl | Lib Priv
Node     N | Y
Go       N | Y
Rust     Y | Y
Java     N | Y
Swift    Y | Y
OCaml    N | Y
ODune    Y | Y
Python   N | N
C#       N | Y
C        N | Y
PHP      N | N





Node:
- all files are modules (1 level of nesting)
- all modules are public (importable from other modules)
- definitions are private by default, can be exported
- modules can re-export imports

Go: (note: go uses the term "package" for module, and "module" for library)
- all folders are modules (? by convention?)
- files declare what module they are part of
- no sub or super- modules
- all modules are public (importable by folder namespace)
- definitions are public/private based on naming (first letter capital)
- (by convention) major versions (after v1) of a library are suffixed with the version `go.com/hello/v2`

Rust:
- all files are modules
- namespace maps to directory (+in-file nesting) structure
- no distinction between submodules (within a file) and submodules (in a subfolder named after the parent module)
- definitions (and submodules) are private by default, exported with `pub` prefix
- modules can re-export imports
- toplevel module is public, and controls visiblity of all other modules
- no (definition-side) distinction between "public (accessible outside of the library)" and "public (accessible from other modules in the library)" ... that distinction is made "higher up the module hierarchy"

Java:
- all ~folders are modules (?)
- all modules are public (importable from other modules)
- modules have an explicit namespace
- all definitions are classes
- definitions are private by default, exported with `public` prefix
- no acknowledgement of "libraries"

Swift:
- a module is defined in code, an generally consists of a folder full of swift files
  - files are sub-modules, but the default visibility of things is "all submodules in this module"
  - fixed nesting (package > module > file), only ever 3 deep
- there's no namespacing
- modules are private by default; must be made public in the `Package.swift`
- if you depend on a package, you get access to all their exposed modules as unqualified names that you can `import`.
- `import XYZ` dumps everything that's visible into your namespace.
- definitions are "internal" by default (module-global), but can be marked
  - package: (if you import the module from another module in the same package, this item will be visible)
  - public: (visible to anyone who imports this module)
    - open (visible and subclassable)
  - file-private: (only visible to things in the same file)
  - private: (only visible within the defining class)

OCaml:
- if you have a .mli, definitions are private by default. otherwise they're default public
- all files are modules
- all modules are public
- all modules are in the same namespace and are available (no import needed) from all other modules
- submodules exist (within a file), and can be exported or not
- first-class modules, and module functions that take modules as arguments...

OCaml + Dune:
Because OCaml has submodules, dune is able to produce a much nicer access-control landscape via some clever preprocessing.
- a folder is a module
- each file is a submodule, public by default
- you can create a `mylib.ml` file to limit access to submodules, or create toplevel items that are available directly.
- with a dunefile you declare which other modules you want to have "available" to all the files in the folder.
- only the toplevel module in a library is public; so you can limit access to private internal modules by not exposing them.

Python:
- all files are modules (folders are kindof modules too)
- all modules are public (importable from all other modules)
- all definitions are public (no way to make them private)
- no acknowledgement of libraries

C#
- ok so C# essentially only has 1 module.
- files can be in the "global namespace" within explicit local namespaces, or can have a "file-scoped namespace" for the whole file, but that precludes nested namespaces
- namespaces are *not* used for access control; can't mark a namespace as private, or mark a class as only visible within the namespace.
- you can mark classes as "internal" (only visible within the library) or "public" (visible outside the library)
- additionally, members of a class have access control options (public, internal, private, protected, protected internal, protected private)

C
- files are modules
- one level of nesting (no submodules or packages)
- all files are public (accessible from all other files)
- items are private by default; exposed by declaring them in a header file

PHP (module is called a "namespace")
- modules consist of one or more files (declared at the top)
- all declarations are public
- all modules are public

Elm
- all files are modules
- all modules are public
- declarations are private by default, and are exported via a `exposing` pragma at the top of the file

Haskell
- all files are modules
- all modules are public
- declarations are private by default, exported via the `module` line at the top of the file

Koka
- all files are modules
- all modules are public
- declarations are private by default, marked with `pub` to make public

Kotlin? idk

Scala (modules are called "packages")
- multi-file modules (files declare their module namespace)
- all modules are public (can't have private modules)
- all definitions are public by default, but can be made private (only accessible within the module)

Roc!





Here's the thing that Rust can't do. It can't have a module with methods that are exposed /within/ the library, but not exposed outside of the library.
So that you can have really tight control over the public "surface area" of your library. This makes static versioning.

What should I call a versioning system defined by "type safety" and "test coverage".
static; validated; verified; tested

"Validated Versioning"


5. C++
6. PHP
7. Ruby
11. Kotlin
12. TypeScript
13. Go
14. Rust
15. Scala
16. Dart
17. Perl
18. MATLAB



-----

Go:
- folders are modules, no concept of file or sub-file modules
- lowercase things are module-private, uppercase are module-public
- the toplevel module is the interface of the library

Node:
- files are modules, no concept of sub-file modules, no concept of more-than-file modules
- within a file everything is private by default, but anything can be /export/ed
- a library has an "entrypoint" file, which is the interface of the library
- BUT you can import any file within a library
