---
title: Syntactic sugar, end to end
nav_title: Syntactic sugar
order: 23
part: In the large
stub: true
summary: The desugarings that make Eliot read the way it does — effect rows, blocks, the dot, if..else, lambdas, and integer literals.
---

Much of what makes Eliot pleasant to read is *sugar* — surface forms that desugar to a smaller core.
Seeing the desugarings in one place demystifies the language and explains several of its rules at
once.
{: .docs-lead}

> **This chapter is still being written.** Here's what it will cover, and where to look in the
> meantime.
{: .note}

## What this chapter will cover

- **Effect rows**: `{E1, E2} A` desugars to one shared inferable carrier —
  `[auto F[_] ~ E1 & E2] F[A]` — which is why the value type inside a row is plain (`Unit`, not
  `IO[Unit]`), and why several `{…}` occurrences in one signature collapse onto the same carrier.
- **Blocks**: a `{ … }` block lowers to a tower of immediately-applied lambdas, which is where
  automatic effect sequencing comes from.
- **The dot operator**: `a.f(b)` is `f(b, a)`, via the infix `.` defined `below apply`.
- **`if..else`**: `if(cond, v)` is `fold(cond, v, abort)`, and `else` discharges the `Abort` — control
  flow built from a plain eliminator and an effect.
- **Lambdas and arrows**: `->` is for lambdas and `case` arms; the function *type* is `=>`.
- **Integer literals**: a literal `n` is rewritten to `integerLiteral[n] : Int` with singleton range
  `[n, n]`, which is why literal ranges are exact.

## In the meantime

- Each desugaring is introduced in context in the chapter that needs it — this chapter will gather
  them into one reference.
