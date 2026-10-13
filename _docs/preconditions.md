---
title: Preconditions and guarded returns
nav_title: Preconditions
order: 14
part: Generics & types
stub: true
summary: Proving a value fits a bound with where, and rejecting bad instantiations with guarded returns.
---

A `where` precondition lets a function *demand* a provable fact about its arguments — that a value
fits a byte, say — checked at every call site, with zero runtime cost.
{: .docs-lead}

> **This chapter is still being written.** Here's what it will cover, and where to look in the
> meantime.
{: .note}

## What this chapter will cover

- **`where` refinements** — a precondition the compiler must prove at each call site:

  ```eliot
  def withinByte(i: Interval[BigInteger]): Bool = rangeWithin[0, 127](i)

  def asByte(x: Int): Int where withinByte(range(x)) = x
  ```

  `asByte(100)` compiles (100 provably fits `[0, 127]`); a call with an out-of-range or
  unknown-range argument is a compile error, not a runtime check.

- **Guarded returns** — rejecting bad *type* instantiations inline, as a return type
  `if(cond, T)`, so misuse fails the build instead of being documented as "don't call this with…".
  The error cannot carry your own message yet: compile-time evaluation has `Abort` but no `Throw`.
- **Use-site verification** — how a latent problem in a generic surfaces as a hard error at the
  concrete call site, and how to read those messages.

## In the meantime

- Example:
  [`WherePrecondition.els`]({{ site.github_repo }}/blob/master/examples/src/WherePrecondition.els).
- Background: [Integers & ranges]({{ '/docs/integers-and-ranges/' | relative_url }}) introduces the
  `range` accessor these preconditions reason about.
