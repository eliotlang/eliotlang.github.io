---
title: Effects in direct style
nav_title: Effects, direct style
order: 16
part: Effects
stub: true
summary: What effect rows are, how direct style works, the used-must-be-declared rule, and why main is the one place IO is pinned.
---

Eliot's algebraic effects let you say what a function *may do* — print, fail, read state — as an
unordered set in its type, while writing the code in ordinary direct style. This is the part of the
language that feels most different, and most freeing.
{: .docs-lead}

> **This chapter is still being written.** Here's what it will cover, and where to look in the
> meantime.
{: .note}

## What this chapter will cover

- **Effect rows**: a set in braces before the return type, wrapping the *plain* value type —
  `{Console} Unit`, `{Console, State[String]} Unit`. Note the value type is `Unit`, never
  `IO[Unit]`, inside a row.
- **Direct style**: an effectful call yields its plain value (`readLine : String` in a `{Console}`
  body), and the compiler inserts the `flatMap`/`map`/`pure` sequencing through blocks, arguments, and
  dot chains. You never hand-write monadic plumbing:

  ```eliot
  import eliot.effect.Console

  def echo: {Console} Unit = printLine(readLine)

  def main: IO[Unit] = echo
  ```

- **used ⊆ declared**: a body may perform only the effects its signature declares; declaring an unused
  one is fine, performing an undeclared one is an error.
- **`main` is where `IO` is pinned**: keep business logic carrier-polymorphic (`{Console} Unit`) and
  commit it to `IO` only at `main`, which is what makes it testable and portable.

## In the meantime

- Examples: [`Effects.els`]({{ site.github_repo }}/blob/main/examples/src/Effects.els),
  [`EffectsMulti.els`]({{ site.github_repo }}/blob/main/examples/src/EffectsMulti.els),
  and [`Blocks.els`]({{ site.github_repo }}/blob/main/examples/src/Blocks.els).
- The landing page's [effects section]({{ '/#effects' | relative_url }}) has a worked multi-effect
  example.
