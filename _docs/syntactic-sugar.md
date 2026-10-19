---
title: Syntactic sugar, end to end
nav_title: Syntactic sugar
order: 25
part: In the large
stub: true
summary: The desugarings that make Eliot read the way it does — uses clauses, blocks, the dot, if..else, lambdas, and integer literals.
---

Much of what makes Eliot pleasant to read is *sugar* — surface forms that desugar to a smaller core.
Seeing the desugarings in one place demystifies the language and explains several of its rules at
once.
{: .docs-lead}

> **This chapter is still being written.** Here's what it will cover, and where to look in the
> meantime.
{: .note}

## What this chapter will cover

- **`uses` clauses**: each effect in a definition's `uses E1, E2: A` desugars to one hidden
  parameter holding the *implementation* of that effect (a *handle*), plus a type parameter for its
  type, and the result type itself is just `A` — which is why it is plain (`Unit`, not `IO[Unit]`).
  An `effect` desugars to an ability whose every operation takes that handle first, and a named
  `implement` to a `data` (its parameters are the fields) with that ability's instance. A `uses`
  clause on a parameter makes it a block (`value uses *: T` becomes `Unit => T`; one listing effects
  takes a handle per listed effect; `f uses *: A => B` stays `A => B`, marked as code), which is how
  an argument arrives unrun. The `uses *` a definition then writes in its own clause desugars to
  nothing at all: the parser checks it is there exactly when a parameter has one, and drops it.
- **Implementations**: `with` becomes a `let` of the implementation's handle around its subject, and
  every effectful call gets its handles as ordinary arguments — the type checker picks, for each one,
  the nearest handle in scope whose type matches — so an operation like `printLine` becomes a direct
  call to a known method. A handle that holds nothing is erased before code generation.
- **Blocks**: a `{ … }` block lowers to a tower of immediately-applied lambdas; since evaluation is
  strict, its lines run in the order written.
- **Direct style**: there is no monadic rewrite. Evaluation is strict and an effect operation is an
  ordinary call, so effectful code runs in the order it is written; the only thing the compiler adds
  is the thunk for a parameter with a `uses` clause, which is why evaluation order is readable from
  signatures.
- **The dot operator**: `a.f(b)` is `f(b, a)`, via the infix `.` defined `below apply`.
- **`if..else`**: `if(cond, v)` is `fold(cond, v, abort)`, and `else` discharges the `Abort` — control
  flow built from a plain eliminator and an effect.
- **Lambdas and arrows**: `->` is for lambdas and `case` arms; the function *type* is `=>`.
- **Integer literals**: a literal `n` is rewritten to `integerLiteral[n] : Int` with singleton range
  `[n, n]`, which is why literal ranges are exact.

## In the meantime

- Each desugaring is introduced in context in the chapter that needs it — this chapter will gather
  them into one reference.
