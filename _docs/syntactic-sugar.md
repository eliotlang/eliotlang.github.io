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

- **`uses` clauses**: each effect in a definition's `uses E1, E2: A` desugars to one hidden type
  parameter whose value is the *implementation* of that effect, and the result type itself is just
  `A` — which is why it is plain (`Unit`, not `IO[Unit]`). A `uses` clause on a parameter
  additionally makes it a thunk (`value uses *: T` becomes `Unit => T`; `f uses *: A => B` stays
  `A => B`, marked as code), which is how an argument arrives unrun.
- **Implementations**: a syntax-directed pass then writes the implementation into every effectful
  call — from the nearest `with`, from the enclosing function's own `uses` clause, or from the code
  parameter that gives it — so an operation like `printLine` becomes a direct call to a known method.
- **Blocks**: a `{ … }` block lowers to a tower of immediately-applied lambdas, which is where
  automatic effect sequencing comes from.
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
