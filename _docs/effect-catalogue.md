---
title: The effect catalogue
nav_title: Effect catalogue
order: 17
part: Effects
stub: true
summary: The shipped effects — Console, Log, Throw, Abort, State, Dep, and Inf — with their operations and how each is discharged.
---

Eliot ships a small set of built-in effects. Each is imported from `eliot.effect`, brings a few
operations, and has a matching way to discharge it. This chapter is the reference tour.
{: .docs-lead}

> **This chapter is still being written.** Here's what it will cover, and where to look in the
> meantime.
{: .note}

## What this chapter will cover

Each effect, its operations, and its discharge:

| Effect | Operations | Discharged by |
|---|---|---|
| `{Console}` | `printLine(s)`, `readLine` | run in `IO` |
| `{Log}` | `log(s)` | run in `IO` |
| `{Abort}` | `abort` (untyped short-circuit) | `runAbort`; infix `else` / `orElse` |
| `{Throw[E]}` | `raise(err)` | `runThrow`; infix `catch (e -> …)` |
| `{State[S]}` | `state`, `putState(s)`, `updateState(f)` | `runStateToPair`, `runStateToValue`, `runStateToFinalState` |
| `{Dep[X]}` | `dependency` (type-dispatched) | `provide(value)` |
| `{Inf}` | `forever(step)` | never discharged — may reach `main` |

- Why each operation reads the way it does, and the direct-style calls that use it.
- Which effects need which imports (all of them do — effects are never auto-imported).

## In the meantime

- Examples: [`Effects.els`]({{ site.github_repo }}/blob/main/examples/src/Effects.els),
  [`EffectsThrow.els`]({{ site.github_repo }}/blob/main/examples/src/EffectsThrow.els),
  [`EffectsAbort.els`]({{ site.github_repo }}/blob/main/examples/src/EffectsAbort.els),
  [`EffectsState.els`]({{ site.github_repo }}/blob/main/examples/src/EffectsState.els),
  [`EffectsMulti.els`]({{ site.github_repo }}/blob/main/examples/src/EffectsMulti.els),
  [`EffectsTwoDeps.els`]({{ site.github_repo }}/blob/main/examples/src/EffectsTwoDeps.els).
- The [API reference]({{ '/apidoc/' | relative_url }}) documents every effect module in
  `eliot.effect`.
