---
title: Carriers and pinned rows
nav_title: Carriers & pinned rows
order: 20
part: Effects
summary: The model beneath effect rows — what a carrier is, how a pinned row turns a computation into an ordinary type, and how to store one in a data field.
---

Everything so far worked without knowing what happens underneath. This chapter opens the box. The
model is small, and knowing it turns several rules you have met — why a stored row must be pinned,
why discharge order matters, why a handler returns `G[A]` — from decree into consequence.
{: .docs-lead}

## Every computation runs on a carrier

An effect row says *what* a computation may do. Something still has to say *how*. That something is
the **carrier**: the concrete type that gives the effects meaning.

Each effect is an [ability]({{ '/docs/abilities/' | relative_url }}) *over a carrier*. `Console` is
`ability Console[F[_]]` with `printLine(s): F[Unit]` — an interface parameterised by the carrier
`F`. On the JVM, `main`'s carrier is the platform's `IO`, whose `Console` instance really writes to
the terminal. In a test, the same code can run on a carrier that performs nothing at all.

You never name a carrier in application code, and there is a good reason for that: **the carrier is
chosen at the boundary, not at the definition.** A `{Console, Throw[String]} Config` function is
written once and runs on whichever carrier its eventual caller ends up on. That is what makes the
same logic portable across targets and testable without mocks.

The pure control effects each come with a canonical carrier **layer** — `Throw[E]` with a layer that
produces `Either[E, A]`, `State[S]` with a state-threading layer — and layers stack over a base
carrier. Discharging peels one layer.

## Two row forms, two answers to "which carrier?"

- An **open row** — `{Throw[E]} A` — leaves the carrier to the caller. Each call site supplies one,
  invisibly. This is what you write on functions, and it is why they compose.
- A **pinned row** — `{Throw[E] | Id} A` — *is* a carrier, spelled in effect vocabulary: the
  canonical stack of the listed effects' layers over the named base. It is a concrete type like any
  other, and it is the only place in the language where a type contains a computation.

The base after `|` is either the concrete `Id` or a generic carrier the caller picks (`G`).
(A platform base like the JVM's `IO` exists, and the tooling will show it to you, but application
code has no reason to name it.) Everything else about the two forms is the same syntax.

## Pinned rows: a row that is a type

The moment you want to **store** an effectful computation, the open form stops working:

```eliot
data TestCase(name: String, body: {Throw[AssertionError]} Unit)
```

```text
error: A stored effect row must be pinned to a base carrier, e.g. `{Throw[Error] | Id} String`.
```

The reason is worth understanding rather than memorising. A row on a *function* can leave the
carrier open because every caller supplies one. A value sitting in a `data` field has no caller to
ask — it must already be one concrete type. So you commit, by naming a base:

```eliot
import eliot.lang.Id

data AssertionError(message: String)

data TestCase(name: String, body: {Throw[AssertionError] | Id} Unit)
```

`Id` is the *identity* base — "nothing else". A `{Throw[AssertionError] | Id} Unit` is a stored
computation that may raise an `AssertionError` and do **nothing else whatsoever**: it provably
cannot print, read, or loop forever. That guarantee is in the field's type, checked at every
construction site.

Building one is ordinary direct-style code, and consuming one uses the ordinary dischargers:

```eliot
def assertTrue(condition: Bool, reason: String): {Throw[AssertionError]} Unit =
   if(condition, unit) else raise(AssertionError(reason))

def failing: TestCase = TestCase("always fails", assertTrue(false, "nope"))

def outcome(tc: TestCase): Either[AssertionError, Unit] = runId(runThrow(body(tc)))
```

`runThrow` peels the `Throw` layer; `runId` unwraps the identity base, which is the one place you
write that step by hand — because here *you* chose the base, so only you know when it is done.

> **A pinned slot wants a computation, not a value.** `TestCase("nothing", unit)` is a type error:
> a pinned row is a *type*, and a plain `Unit` is not one of its values. This is the opposite of a
> `{Effect} A` parameter, which accepts either. If you genuinely need a do-nothing computation,
> `pure(unit)` (from `eliot.carrier.Effect`) is the honest spelling — but usually the field is
> holding real work, and real work is already a computation.
{: .warn}

## Order matters once you pin

The entries of a pinned row are the layer stack, **leftmost outermost**, and dischargers peel from
the outside in. So the written order *is* the discharge order, and for effects that don't commute it
decides real behaviour:

```eliot
{Throw[E], State[S] | Id} A   // discharge Throw first: a raise discards the pending state
{State[S], Throw[E] | Id} A   // discharge State first: the state survives even a raise
```

These are two different types, and the choice is visible in the source. Open rows stay unordered —
order only exists once you pin. The next chapter,
[Combining and ordering effects]({{ '/docs/combining-effects/' | relative_url }}), is entirely about
what that choice buys you.

## What cannot be pinned

The platform effects — `Console`, `Log` — have no canonical pure layer, so there is no stack to
build and `{Console | Id} Unit` does not compile. That is not an oversight: it is the same
guarantee, seen from the other side. A stored `| Id` computation cannot do I/O *because* I/O has no
representation that a pure base can hold. Handle platform effects before the value is stored.

## Writing against a generic carrier

Library code that consumes an effectful computation pins over a *generic* base — "a computation that
may raise, over whatever else it does":

```eliot
import eliot.carrier.Effect

def orZero[G[_] ~ Effect](computation: {Throw[String] | G} Int): G[Int] =
   computation catch (_ -> 0)
```

Read the signature as: take a computation that may raise, on some carrier `G` that can sequence
(`~ Effect`); return a computation on that same `G` that no longer raises. Callers get the
`Throw[String]` subtracted from their row with nothing to annotate.

> **One boundary rule.** When a computation arrives through a carrier-typed *parameter*, your result
> must stay on that carrier — return `G[Int]`, never a bare `Int`. The carrier belongs to your
> caller; only they know where their pure boundary is, so only they can take it there.
{: .note}

That single constraint is the whole cost of writing effect-generic code, and note what is *not*
there: no carrier type is ever named, no monad transformer is stacked by hand, and the body is the
same direct-style `catch` you would write in application code.

## The spelling the tooling speaks

Because a carrier stack and a pinned row are the same thing, the compiler shows you the row. Hover
an effectful value in the IDE and you get `{Throw[String] | IO} String`; a diagnostic about a
mismatched computation reads the same way:

```text
error: No ability implementation found for ability 'State'
       with type arguments [String, {Throw[String], State[String] | Id}]
```

The type you read is the type you could have written. Carrier machinery names never appear in
messages meant for you.

Next: what happens when several effects meet —
[Combining and ordering effects]({{ '/docs/combining-effects/' | relative_url }}).
