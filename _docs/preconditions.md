---
title: Preconditions and guarded returns
nav_title: Preconditions
order: 14
part: Generics & types
stub: true
summary: Proving a value fits a bound with where, and rejecting bad instantiations with a custom message via guarded returns.
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
  def asByte(x: Int): Int where withinByte(range(x)) = x
  ```

  `asByte(100)` compiles (100 provably fits `[-128, 127]`); a call with an out-of-range or
  unknown-range argument is a compile error, not a runtime check.

- **Guarded returns** — rejecting bad *type* instantiations with your own message, written inline as
  `if(cond, T) else raise("message")`, so misuse fails the build with a readable error instead of
  being documented as "don't call this with…".
- **Use-site verification** — how a latent problem in a generic surfaces as a hard error at the
  concrete call site, and how to read those messages.

## In the meantime

- Example:
  [`WherePrecondition.els`]({{ site.github_repo }}/blob/main/examples/src/WherePrecondition.els).
- Background: [Integers & ranges]({{ '/docs/integers-and-ranges/' | relative_url }}) introduces the
  `range` accessor these preconditions reason about.
