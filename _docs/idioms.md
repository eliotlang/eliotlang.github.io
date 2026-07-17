---
title: Idioms and gotchas
nav_title: Idioms & gotchas
order: 24
part: In the large
stub: true
summary: A cheatsheet of idiomatic Eliot style and the sharp edges to watch for, gathered in one place.
---

A condensed cheatsheet: how idiomatic Eliot reads, and the handful of sharp edges that trip up
newcomers. Keep this open while you write your first programs.
{: .docs-lead}

> **This chapter is still being written.** Here's what it will cover, and where to look in the
> meantime.
{: .note}

## Idioms this chapter will cover

- **One-liners stay expressions; everything else is a block.** Reach for a block the moment there's
  an intermediate value worth naming or more than one effectful step.
- **Let the dot carry the flow**, and design every function **subject-last** so it chains.
- **Direct style, always** — never hand-write `flatMap` in application code.
- **Eta-reduce** lambdas that only apply a function: `pair -> pair.first` is just `first`.
- **Guard partial functions at the type level** so misuse fails at compile time with your message.

## Gotchas this chapter will cover

- `f(x)` (call) versus `f (x)` (separate operand) — adjacency decides.
- Juxtaposition binds tighter than `.` and every infix operator: `printLine msg.content` is wrong;
  parenthesize.
- Effect rows wrap the plain type: `{Console} Unit`, never `{Console} IO[Unit]`.
- `a-1` lexes as `a` then `-1`; write `a - 1`.
- A lowercase name in a `case` is a binder, not a constructor; there are no literal patterns.
- `fold` and eliminator arms are strict for pure values.
- Import every effect; never re-import the auto-imported `eliot.lang` prelude.
- Two infix operators with no declared precedence relation can't share an expression.
- No recursion — restructure around folds, `match`, or `forever`.

## In the meantime

- The relevant core-language chapters each cover their own gotchas in context; this chapter will be
  the single-page summary. The compiler's `eliot-code` skill is the exhaustive style reference.
