---
title: Combining and ordering effects
nav_title: Combining effects
order: 19
part: Effects
stub: true
summary: How several effects share one carrier, and how the order you discharge them decides how they interact.
---

A function can use several effects at once — the row is just their union. When effects *don't
commute*, the **order you discharge them in** decides how they interact, and Eliot makes that choice
explicit rather than baking it into a transformer stack.
{: .docs-lead}

> **This chapter is still being written.** Here's what it will cover, and where to look in the
> meantime.
{: .note}

## What this chapter will cover

- Multiple effects in one row (`{Dep[Database], Log, Console}`), sharing a single inferred carrier —
  no nesting, no transformer order in the signature.
- **Discharge order decides interaction**: discharging `Abort` before `State` keeps the final state
  (`Pair[Option[A], S]`); the other order discards it (`Option[Pair[A, S]]`). The same program, two
  outcomes, chosen at the boundary.
- Chaining dischargers for repeated effects — two `provide`s for two `Dep`s, two `catch`es for two
  `Throw`s.

> **Alpha status — the cross-lift matrix is partial.** `State` + `Abort` compose in either order, and
> every effect composes with the `Suspend`-riding ones (`Console`, `Log`). But some combinations
> (e.g. `State` + `Throw`) don't have a cross-lift instance yet and fail with a missing-instance
> error. When you hit that, switch to `Abort`, or add the instance in the platform layer.
{: .warn}

## In the meantime

- Examples: [`EffectsOrdering.els`]({{ site.github_repo }}/blob/main/examples/src/EffectsOrdering.els),
  [`EffectsMulti.els`]({{ site.github_repo }}/blob/main/examples/src/EffectsMulti.els),
  [`EffectsTwoDeps.els`]({{ site.github_repo }}/blob/main/examples/src/EffectsTwoDeps.els),
  [`EffectsTwoThrows.els`]({{ site.github_repo }}/blob/main/examples/src/EffectsTwoThrows.els).
