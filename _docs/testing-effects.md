---
title: Testing effects
nav_title: Testing effects
order: 22
part: Effects
summary: Running effectful business logic with no I/O — discharging control effects into plain values, and faking Console or your own effects with a named implementation and with.
---

Code that declares an effect row never says how its effects are performed — whoever runs it decides.
In production that is the platform, at `main`. In a test it is you. That is what makes effects
testable, and it is why the effect system pays for itself.
{: .docs-lead}

## Control effects: discharge, then assert on data

Business logic written against the control effects — `Abort`, `Throw`, `State`, `Writer`, `Dep` —
needs no fake at all. Discharge the effect and the result is a **plain value**:

```eliot
def allowed: {Abort} String = "granted"
def denied: {Abort} String = abort

def testAllowed: Option[String] = runAbort(allowed)     // Some("granted")
def testDenied: Option[String] = runAbort(denied)       // None
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
// pair("first", "second") — the returned old value, and the final state
```

Note what you did *not* do: change `swap` for testability, inject anything, or mock anything. The
signature `{State[String]} String` was already the testable form. And because a discharger returns
an ordinary value, a test like this can be written anywhere — in a pure function, or in the middle of
an effectful one.

## Interpretation effects: bind a fake with `with`

`Console`, `Log`, `FileSystem` and your own effects have no pure meaning to discharge into; the
platform performs them. To test code that uses them, give the code a different implementation. The
production code stays exactly as it is:

```eliot
def greeting(name: String): {Console} Unit = printLine("Hello, " ++ name ++ "!")
```

The test declares a **named implementation** — a fake — and binds it with
[`with`]({{ '/docs/implementations/' | relative_url }}#choosing-a-different-implementation-with):

```eliot
implement recordingConsole: Console {
   def printLine(s: String): {Writer[String]} Unit = tell(s ++ ";")
   def readLine: Option[String] = None
}

def transcript: String = runWriterToLog(greeting("Bob") with recordingConsole)
// "Hello, Bob!;"
```

The fake records each printed line through the `Writer` effect, and `runWriterToLog` discharges that
into the plain `String` a test asserts on. Nothing printed, nothing was mocked at runtime, and
`greeting` never learned that a test exists.

The fake is **one declaration**. It needs no type of its own, no registration, and no place in the
effect's module: a named implementation is never searched for, so it cannot clash with the
platform's default. And it **cannot cheat** — user code cannot declare platform natives, so a fake
reaches the outside world only through effects its own clauses declare, which are checked like any
others.

Interpretation is **per effect**: `program with fakeConsole with fakeFileSystem` replaces two
effects and leaves everything else at its default.

### Your own effects

An effect your application defines is tested the same way. It ships no default at all until you
write one, so the test's implementation is simply the first:

```eliot
effect Terminal {
   def write(line: String): Unit
   def read: String
}

def greet: {Terminal} Unit = {
   val name = read
   write("Hello, " ++ name ++ "!")
}

implement session: Terminal {
   def write(line: String): {Writer[String]} Unit = tell(line ++ ";")
   def read: String = "Bob"
}

def greetTranscript: String = runWriterToLog(greet with session)
// "Hello, Bob!;"
```

## A tiny test framework

Put the `with` on a parameter's type and the fake disappears from the tests altogether — the helper
binds whatever computation its caller writes in that slot:

```eliot
def transcriptOf(program: {Console} Unit with recordingConsole): String = runWriterToLog(program)

data TestResult(name: String, failure: Option[String])

def expect(name: String, expected: String, actual: String): TestResult =
   if(expected == actual, TestResult(name, None))
   else TestResult(name, Some("expected '" ++ expected ++ "' but was '" ++ actual ++ "'"))

def greetTest: TestResult = expect("greet", "Hello, Bob!;", transcriptOf(greeting("Bob")))
```

A test is now one line, and the code under test is a plain call.

## Storing test cases

A framework that wants tests as first-class values — collect them, name them, run them in a loop —
stores each test body as a computation in a `data` field. Give the field a row:

```eliot
data AssertionError(message: String)

data TestCase(name: String, body: {Throw[AssertionError]} Unit)

def assertTrue(condition: Bool, reason: String): {Throw[AssertionError]} Unit =
   if(condition, unit) else raise(AssertionError(reason))

def alwaysFails: TestCase = TestCase("always fails", assertTrue(false, "nope"))
```

Building a `TestCase` does not run its body; reading the field does. A runner is then just a
discharger around the read:

```eliot
def outcome(tc: TestCase): Either[AssertionError, Unit] = runThrow(body(tc))

def report(tc: TestCase): String =
   foldEither(err -> name(tc) ++ ": FAIL " ++ message(err), _ -> name(tc) ++ ": PASS", outcome(tc))
```

`Right(unit)` is a pass; `Left(err)` carries the failure message.

> **A row cannot be closed.** A field's row lists what the stored computation may perform; it
> cannot additionally forbid everything else. So "this test performs no I/O" is not something a
> field type can promise — keep that discipline in how you structure the code under test.
{: .note}

## Structuring code for tests

The practical consequence is a familiar one, now enforced by signatures: keep decisions in functions
whose rows a test can discharge or fake, and keep the edges thin. Because every effect a function
uses is in its row, you can see from a signature exactly what a test has to supply — and the
compiler will tell you if you missed one.

Next part: programming in the large, starting with
[Modules & imports]({{ '/docs/modules/' | relative_url }}).
