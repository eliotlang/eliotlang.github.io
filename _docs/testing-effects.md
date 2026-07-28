---
title: Testing effects with a pure carrier
nav_title: Testing effects
order: 22
part: Effects
summary: Running carrier-polymorphic business logic on the pure identity carrier, so effect logic can be tested with no I/O — and storing test cases with pinned rows.
---

Because effectful logic stays polymorphic over its carrier until the boundary, you can run the *same
code* on a carrier that performs no I/O at all. That is what makes effects testable — and it is why
the effect system pays for itself.
{: .docs-lead}

## The trick: discharge everything, assert on data

Business logic written against effects never says how they run:

```eliot
def allowed: {Abort} String = "granted"
def denied: {Abort} String = abort
```

In production this code runs on the platform's carrier, wherever its caller ends up. In a test,
discharge the effect and the result is a **plain value** — no I/O happened, nothing was mocked, and
there is nothing asynchronous to await:

```eliot
def testAllowed: Option[String] = runAbort(allowed)     // some("granted")
def testDenied: Option[String] = runAbort(denied)       // none
```

Both are ordinary pure functions — compare them with `==`, print them, feed them to a test runner.
The same works for every control effect: `runThrow` materialises failures as an `Either`,
`runStateToPair` runs stateful logic from a chosen initial state:

```eliot
def swap(next: String): {State[String]} String = {
   val old = state
   putState(next)
   old
}

def testSwap: Pair[String, String] = runStateToPair("first", swap("second"))
// Pair("first", "second") — the returned old value, and the final state
```

Note what you did *not* do: change `swap` for testability, inject a fake, or mention a carrier. The
signature `{State[String]} String` was already the testable form.

## Why the pure run is trustworthy

Those results run on the **identity carrier**, `eliot.lang.Id` — a carrier that just holds a value.
The compiler picks it when a fully-discharged computation reaches a pure boundary, which is why the
tests above mention no carrier at all.

Two properties make `Id` the *safe* test bed, not merely a convenient one:

- **`Id` cannot perform I/O.** It deliberately has no `Suspend` implementation, so `Console` and
  `Log` have no meaning on it. Code that tries to print under a pure test does not compile —
  a test cannot silently touch the outside world.
- **`Id` cannot diverge.** The control effects that *can* run on it — `Abort`, `Throw`, `State`,
  `Dep`, `Writer` — are total, and `Inf` is not among them, so a pure test cannot hang.

Those are consequences of the [carrier model]({{ '/docs/carriers/' | relative_url }}), not special
test-mode behaviour. And a carrier is no magic — it is a `data` type with an `Effect`
implementation. The whole of `Id` is essentially this, worth seeing once and then never writing
again:

```eliot
data Id[A](runId: A)

implement Effect[Id] {
   def pure[A](a: A): Id[A] = Id(a)
   def flatMap[A, B](f: Function[A, Id[B]], fa: Id[A]): Id[B] = f(runId(fa))
   def map[A, B](f: Function[A, B], fa: Id[A]): Id[B] = Id(f(runId(fa)))
}
```

## Storing test cases: pinned rows

A test *framework* wants tests as first-class values — collect them, name them, run them in a loop.
That is a stored effectful computation, which is exactly what
[pinned rows]({{ '/docs/carriers/' | relative_url }}#pinned-rows-a-row-that-is-a-type) are for:

```eliot
import eliot.lang.Id

data AssertionError(message: String)

data TestCase(name: String, body: {Throw[AssertionError] | Id} Unit)

def assertTrue(condition: Bool, reason: String): {Throw[AssertionError]} Unit =
   if(condition, unit) else raise(AssertionError(reason))

def alwaysFails: TestCase = TestCase("always fails", assertTrue(false, "nope"))
```

The pinned field type says everything about what a test may do: raise an `AssertionError`, and
nothing else — no I/O, no divergence, by construction. A runner is then just dischargers, one per
layer:

```eliot
def outcome(tc: TestCase): Either[AssertionError, Unit] = runId(runThrow(body(tc)))

def report(tc: TestCase): String = foldEither(err -> message(err), _ -> "PASS", outcome(tc))
```

`Right(unit)` is a pass; `Left(err)` carries the failure message. Everything in this chapter —
carrier-polymorphic logic, pure discharge, `Id`'s guarantees, pinned storage — composes into those
two lines.

> **A test body is a computation.** Every `TestCase` field value has to be one: `TestCase("noop",
> unit)` does not type-check, because a pinned row is a type and a plain `Unit` is not one of its
> values. In practice a test body is an assertion, which already is a computation; for a genuine
> no-op, write `pure(unit)` with `import eliot.carrier.Effect`.
{: .note}

## What about `Console`?

Platform effects have no pure meaning, so they cannot be run on `Id` and cannot be stored. The
practical consequence shapes how you structure code: keep the decisions in `{Abort}`/`{Throw}`/
`{State}` functions that a test can run directly, and let `{Console}` sit in a thin outer layer that
only prints what those functions returned. That separation is the one testing discipline the effect
system asks of you — and the type checker is what enforces it.

Next part: programming in the large, starting with
[Modules & imports]({{ '/docs/modules/' | relative_url }}).
