---
title: Discharging effects
nav_title: Discharging effects
order: 18
part: Effects
stub: true
summary: Turning effectful code into a runnable value at the boundary with catch, else, runAbort, runState, provide, and runThrow.
---

An effect declared in a signature has to be *discharged* somewhere — handled, given meaning, and
removed from the type. Discharge combinators are how effectful code becomes a runnable program, and
they read like plain English.
{: .docs-lead}

> **This chapter is still being written.** Here's what it will cover, and where to look in the
> meantime.
{: .note}

## What this chapter will cover

- The friendly infix dischargers: `catch (e -> …)` recovers a `Throw[E]`, `else` / `orElse` supplies a
  fallback for `Abort`:

  ```eliot
  parseBad catch (err -> err)
  safe else "<absent>"
  ```

- The `run…` dischargers: `runAbort`, `runThrow` (→ `Either`), and the `State` family
  `runStateToPair` / `runStateToValue` / `runStateToFinalState`.
- **`provide`** for injecting a `Dep[X]` dependency at the discharge site.
- The **wrap-the-computation rule**: pass the effectful expression *directly* to the discharger; do not
  bind it to a `val` first and discharge the binder.
- **Discharge-aware accounting**: a fully-discharged effect is not "performed", so you don't declare
  it — which is why an `if..else` needs no `{Abort}` in the enclosing signature.

## In the meantime

- Examples: [`EffectsThrow.els`]({{ site.github_repo }}/blob/main/examples/src/EffectsThrow.els),
  [`EffectsAbort.els`]({{ site.github_repo }}/blob/main/examples/src/EffectsAbort.els),
  [`EffectsState.els`]({{ site.github_repo }}/blob/main/examples/src/EffectsState.els),
  [`DischargeDemo.els`]({{ site.github_repo }}/blob/main/examples/src/DischargeDemo.els),
  [`HandleWith.els`]({{ site.github_repo }}/blob/main/examples/src/HandleWith.els).
