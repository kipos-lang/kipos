# Unreasonably Good Version Control

Undo/redo is great, but it's also kindof useless?

Here's the current state of "I want to rewind things" in VSCode:

- [very near term, single file] undo/redo, you can revert the last few (dozen) changes you made, sequentially
- [medium-long term, whole project] git, you can (stash/reset/checkout) to jump back to a recent manual checkpoint, if you happened to make a checkpoint that corresponds to the code you're looking for.

undo/redo:
- per file
- sequential
- destructive
- automatic save
- only your changes (easy to reason about)
- in most cases only used for *very short-term* changes (last few seconds), can be used to go back a few minutes, but gets very unwieldy.
- fragile / ephemeral (closing & reopening a file will often discard the undo history)

Sometimes I will undo several minutes of work in a file, then "copy the function as it was into a different file" and then redo everything. However, if you accidentally type a character while you're deep in the undo history, all of the "redos" are forever lost to you. (yes I know emacs has an undo tree, which addresses this specific issue).

git:
- whole repo (ish)
  - modern editors provide the affordance of indicating where in a file you have uncommitted changes, and allow you to selectively "reset" changes on a chunk-by-chunk basis. This is very handy.
  - you can also "view this file as it looks on [a different branch / commit]"
- nonsequential
- nondestructive (as long as you stash or commit any working changes before you go exploring)
- manual save
- can have changes from multiple sources
- in general used for medium to long-term (generally minutes or hours between commits, not seconds)
- durable

This leaves a lot of gaps.

Very frequently what I want is to scrub through the history of *a single function*. Depending on the time scale (and whether I've restarted my editor recently), undo/redo or git *might* help me, but it's clunky at best.

## Partial solution #1
Just undo a ton, and never close files.

## Partial solution #2
In-editor "partial checkout" and inline-blame popovers.

## A real solution

- automatic git commits (debounced, but on the order of every few seconds)
- undo/redo is persisted per-file, and limited to the last few hundred changes
- editor UI allows you to scrub through history at 3 levels: project, file, or function.

- also... everything is a CRDT? So merges are automatic.
