---
title: Testing effects with a pure carrier
nav_title: Testing effects
order: 20
part: Effects
summary: Running carrier-polymorphic business logic on the pure identity carrier Id, so effect logic can be tested with no I/O — and storing test cases with pinned rows.
---

Because effectful logic stays polymorphic over its carrier until the boundary, you can run the
*same code* on a pure carrier that performs no I/O at all — which is exactly what makes effects
testable.
{: .docs-lead}

## The trick: discharge everything, assert on data

Business logic written against effects never says how they run:

```eliot
import eliot.effect.Abort

def allowed: {Abort} String = "granted"
def denied: {Abort} String = abort
```

In production this code runs on the platform's carrier, wherever its caller ends up. In a test,
discharge the effect and the result is a **plain value** — no I/O happened, nothing was mocked,
and there is nothing asynchronous to await:

```eliot
def testAllowed: Option[String] = runAbort(allowed)     // Some("granted")
def testDenied: Option[String] = runAbort(denied)       // None
```

Both are ordinary pure functions — compare them with `==`, print them, feed them to a test runner.
The same works for every control effect: `runThrow` materialises failures as an `Either`,
`runStateToPair` runs stateful logic from a chosen initial state:

```eliot
import eliot.effect.State

def swap(next: String): {State[String]} String = {
   val old = state
   putState(next)
   old
}

def testSwap: Pair[String, String] = runStateToPair(swap("second"), "first")
// Pair("first", "second") — the returned old value, and the final state
```

Note what you did *not* do: change `swap` for testability, inject a fake, or mention a carrier.
The signature `{State[String]} String` was already the testable form.

## `Id`, the carrier underneath

Where do those pure results run? On the **identity carrier** — `eliot.lang.Id`, a value that just
holds a value. When a fully-discharged computation sits at a pure boundary the compiler defaults
its leftover carrier to `Id` and unwraps it invisibly, which is why the tests above mention no
carrier at all; when you hold an explicitly `Id`-pinned value, the unwrap is `runId`.

Two properties make `Id` the *safe* test bed, not just a convenient one:

- `Id` deliberately has **no `Suspend`** — the platform effects (`Console`, `Log`) cannot run on
  it, so code under pure test provably performs no I/O. If it tries, it fails to compile.
- The control effects that *can* run on it (`Abort`, `Throw`, `State`, `Dep`) are total — a pure
  test cannot hang.

And a carrier is no magic: it is a `data` type with an `Effect` implementation. The whole of `Id`
is essentially this — worth seeing once, then never writing again:

```eliot
data Id[A](runId: A)

implement Effect[Id] {
   def pure[A](a: A): Id[A] = Id(a)
   def flatMap[A, B](f: Function[A, Id[B]], fa: Id[A]): Id[B] = f(runId(fa))
   def map[A, B](f: Function[A, B], fa: Id[A]): Id[B] = Id(f(runId(fa)))
}
```

## Storing test cases: pinned rows

A test *framework* wants tests as first-class values — collect them, name them, run them in a
loop. That is a stored effectful computation, which is exactly what
[pinned rows]({{ '/docs/effects/' | relative_url }}#storing-effectful-values-data-and-pinned-rows)
are for:

```eliot
import eliot.effect.Throw
import eliot.lang.Id

data AssertionError(message: String)

data TestCase(name: String, body: {Throw[AssertionError] | Id} Unit)

def assertTrue(condition: Bool, reason: String): {Throw[AssertionError]} Unit =
   if(condition, unit) else raise(AssertionError(reason))
```

A test body is direct-style assertion code; the pinned field type says everything about what a
test may do: raise an `AssertionError`, and nothing else — no I/O, no divergence, by construction.
A runner is then just dischargers in a loop body:

```eliot
def outcome(tc: TestCase): Either[AssertionError, Unit] = runId(runThrow(body(tc)))
```

`Right(unit)` is a pass; `Left(err)` carries the failure message. Everything in this chapter —
carrier-polymorphic logic, pure discharge, `Id`'s guarantees, pinned storage — composes into that
one line.

Next part: programming in the large, starting with
[Modules & imports]({{ '/docs/modules/' | relative_url }}).
