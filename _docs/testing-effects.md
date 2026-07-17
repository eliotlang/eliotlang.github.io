---
title: Testing effects with a pure carrier
nav_title: Testing effects
order: 20
part: Effects
stub: true
summary: Running carrier-polymorphic business logic on a pure identity carrier, so effects can be tested with no I/O.
---

Because effectful logic stays polymorphic over its carrier until `main`, you can run the *same code*
on a pure carrier that performs no I/O at all — which is exactly what makes effects testable.
{: .docs-lead}

> **This chapter is still being written.** Here's what it will cover, and where to look in the
> meantime.
{: .note}

## What this chapter will cover

- Defining a pure **identity carrier** and its `Effect` instance:

  ```eliot
  import eliot.effect.Effect

  data Id[A](runId: A)

  implement Effect[Id] {
     def pure[A](a: A): Id[A] = Id(a)
     def flatMap[A, B](f: Function[A, Id[B]], fa: Id[A]): Id[B] = f(runId(fa))
     def map[A, B](f: Function[A, B], fa: Id[A]): Id[B] = Id(f(runId(fa)))
  }
  ```

- Discharging under `Id` (`runId(runAbort(logic))`) to run effect logic with **no I/O**, yielding a
  plain value you can assert on.
- Why keeping business logic carrier-polymorphic (`{Abort} String`, not `IO[…]`) is what lets the same
  function run in production *and* under the test carrier.

## In the meantime

- Examples: [`EffectsTestable.els`]({{ site.github_repo }}/blob/main/examples/src/EffectsTestable.els),
  [`EffectsState.els`]({{ site.github_repo }}/blob/main/examples/src/EffectsState.els),
  [`EffectsOrdering.els`]({{ site.github_repo }}/blob/main/examples/src/EffectsOrdering.els).
