---
title: Combining and ordering effects
nav_title: Combining effects
order: 19
part: Effects
summary: How several effects combine in one uses clause, and how the order you discharge them in decides how they interact.
---

A function can use several effects at once — its `uses` clause just lists them all. When two effects
*interact*, the **order you discharge them in** decides what happens, and Eliot makes that choice
explicit at the place you write it rather than baking it into a type.
{: .docs-lead}

## A `uses` clause is a set

Using several effects together needs no ceremony — declare the union, call things:

```eliot
data Database(url: String)

def run uses Dep[Database], Log, Console: Unit = {
   log(dependency.url)
   printLine(readLine orElse "(no input)")
}
```

There is no nesting and no transformer order in that signature: each effect is received from the
caller independently, the block runs its steps in order, and the set is unordered
(`uses Log, Dep[Database], Console` says the same). The same effect can even appear twice at
different types — `uses Throw[NetError], Throw[ParseError]`, `uses Dep[Database], Dep[Topic]` — and
each use finds its own handler.

Discharge still happens one effect at a time, each discharger handling one effect while the rest
keep floating:

```eliot
def main uses Console, Log: Unit = provide(Database("jdbc://app-db"), run)
```

## When order doesn't matter — and when it does

For most combinations the discharge order is irrelevant: recover a `Throw` before or after providing
a `Dep`, same result. The interesting case is effects that *interact* — classically `State` with a
failure effect. Consider one program that modifies state and then aborts:

```eliot
def reject(value: String) uses Abort: String = abort

def modifyThenAbort uses State[String], Abort: String = {
   putState("modified")
   reject("modified")
}
```

Does the abort roll back the state? **The flat `uses` clause deliberately doesn't say.** You decide
at the boundary, by the order you nest the dischargers:

```eliot
// Abort inside, State outside: the state SURVIVES the abort.
def stateSurvives: Pair[Option[String], String] =
   runStateToPair("initial", runAbort(modifyThenAbort))

// State inside, Abort outside: the abort DISCARDS the state.
def stateDiscarded: Option[Pair[String, String]] =
   runAbort(runStateToPair("initial", modifyThenAbort))
```

Same program, two boundaries, two answers — and the result *types* tell the story. In the first you
always get a final state next to a maybe-missing value; in the second, failure takes the whole pair
with it. Neither is "the right" semantics; Eliot just refuses to pick one behind your back.

Note that this is a property of the *program you write at the boundary*, not of a stack you declared
somewhere. `modifyThenAbort` was written once and serves both.

## Why nesting decides

A discharger installs a handler around its argument for the duration of the call: `runAbort`
installs the place an `abort` exits to, `runStateToPair` installs the cell the state lives in. An
`abort` leaves everything installed *inside* its handler and nothing outside it.

- In `runStateToPair("initial", runAbort(…))` the cell is outside the abort's handler, so the cell —
  with `"modified"` in it — is still there when the abort lands.
- In `runAbort(runStateToPair("initial", …))` the cell is inside, so the abort takes it down with
  everything else.

The same holds for every pair of effects: `Throw` with `State`, `Abort` with `Writer`, and so on.
There is no table of supported combinations — any nesting of any dischargers compiles, and its
meaning is read straight off the nesting.

> **In one sentence.** A clause is an unordered set; dischargers are applied one at a time; and
> where two effects interact, the nesting of their dischargers is the only place the interaction is
> decided — written by you, read by anyone.
{: .tip}

Next: exactly *when* an effect runs, read off the signature —
[Values and code]({{ '/docs/effect-evaluation/' | relative_url }}).
