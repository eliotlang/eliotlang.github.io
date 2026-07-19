---
title: Combining and ordering effects
nav_title: Combining effects
order: 19
part: Effects
summary: How several effects share one carrier, and how the order you discharge them decides how they interact.
---

A function can use several effects at once — the row is just their union. When effects *don't
commute*, the **order you discharge them in** decides how they interact, and Eliot makes that choice
explicit rather than baking it into a transformer stack.
{: .docs-lead}

## A row is a union

Using several effects together needs no ceremony — declare the union, call things:

```eliot
import eliot.effect.Log
import eliot.effect.Dep
import eliot.effect.Console

data Database(url: String)

def run: {Dep[Database], Log, Console} Unit = {
   log(dependency.url)
   printLine(readLine)
}
```

There is no nesting and no transformer order in that signature — the three effects share one
underlying carrier, the block sequences the steps, and the set is unordered
(`{Log, Dep[Database], Console}` is the same type). The same effect can even appear twice at
different types — `{Throw[NetError], Throw[ParseError]}`, `{Dep[Database], Dep[Topic]}` — and each
use finds its own instance.

Discharge still happens one effect at a time, each discharger peeling one layer while the rest
keep floating:

```eliot
def main: {Console, Log} Unit = provide(Database("jdbc://app-db"), run)
```

## When order doesn't matter — and when it does

For most combinations the discharge order is irrelevant: recover a `Throw` before or after
providing a `Dep`, same result. The interesting case is effects that *interact* — classically
`State` with a failure effect. Consider one program that modifies state and then aborts:

```eliot
import eliot.effect.State
import eliot.effect.Abort

def reject(value: String): {Abort} String = abort

def modifyThenAbort: {State[String], Abort} String = {
   putState("modified")
   reject("modified")
}
```

Does the abort roll back the state? **The flat row deliberately doesn't say.** You decide at the
boundary, by discharge order:

```eliot
// Abort inside, State outside: the state SURVIVES the abort.
def stateSurvives: Pair[Option[String], String] =
   runStateToPair(runAbort(modifyThenAbort), "initial")

// State inside, Abort outside: the abort DISCARDS the state.
def stateDiscarded: Option[Pair[String, String]] =
   runAbort(runStateToPair(modifyThenAbort, "initial"))
```

Same program, two boundaries, two answers — and the result *types* tell the story: in the first,
you always get a final state next to a maybe-missing value; in the second, failure takes the whole
pair with it. Neither is "the right" semantics; Eliot just refuses to pick one behind your back.

## Pinning writes the order down

The [pinned row]({{ '/docs/effects/' | relative_url }}#under-the-hood-carriers) is the same choice
made in a *type*: entries are the stack, leftmost outermost, discharged first — so the two
boundaries above correspond to two different pinned spellings:

```eliot
{Abort, State[String] | Id} String   // discharge Abort first — the state survives
{State[String], Abort | Id} String   // discharge State first — a failure discards it
```

An *open* row keeps the interaction question open (that's a feature — `modifyThenAbort` serves
both boundaries); a *pinned* row answers it, which is exactly why a stored row must be pinned: a
value sitting in a `data` field can't defer the question to a caller.

> **Alpha status — the cross-lift matrix is partial.** `State` + `Abort` compose in either
> discharge order, and every effect composes with the `Suspend`-riding ones (`Console`, `Log`).
> But some pairs (e.g. `State` + `Throw`) don't have a cross-lift instance yet and fail with a
> missing-instance error. When you hit that, switch to `Abort`, or add the `implement` in the
> platform layer.
{: .warn}

Next: running effectful logic with no I/O at all —
[Testing effects]({{ '/docs/testing-effects/' | relative_url }}).
