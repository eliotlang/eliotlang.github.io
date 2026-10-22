---
title: Testing effects
nav_title: Testing effects
order: 26
part: Effects
summary: Running effectful business logic with no I/O — discharging control effects into plain values, faking Console or your own effects with a named implementation and with, and building a small test framework from the same pieces.
---

Code that declares its effects in a `uses` clause never says which implementation it uses — its
caller hands it one. In production that is the platform, at `main`. In a test it is you. That is
what makes effects testable, and it is where the effect system pays for itself.
{: .docs-lead}

There are two kinds of effect, and two matching ways to test. Control effects are *discharged* into
plain values; interpretation effects are handed a *fake implementation*. Neither touches the code
under test.

## Control effects: discharge, then assert on data

Business logic written against the control effects — `Abort`, `Throw`, `State`, `Writer`, `Dep` —
needs no fake at all. Discharge the effect and the result is a **plain value**:

```eliot
def access(granted: Bool) uses Abort: String = if(granted) "granted"

def testAllowed: Option[String] = runAbort(access(true))     // some("granted")
def testDenied: Option[String] = runAbort(access(false))     // none
```

Both are ordinary pure functions — compare them with `==`, print them, feed them to a test runner.
The same works for every control effect: `runThrow` materialises failures as an `Either`,
`runStateToPair` runs stateful logic from a chosen initial state:

```eliot
def swap(next: String) uses State[String]: String = {
   val old = state
   putState(next)
   old
}

def testSwap: Pair[String, String] = runStateToPair("first", swap("second"))
// pair("first", "second") — the returned old value, and the final state
```

Note what you did *not* do: change `swap` for testability, inject anything, or mock anything. The
signature `uses State[String]: String` was already the testable form. And because a discharger
returns an ordinary value, a test like this can be written anywhere — in a pure function, or in the
middle of an effectful one.

## Interpretation effects: hand over a fake with `with`

`Console`, `Log`, `FileSystem` and your own effects have no pure meaning to discharge into; the
platform performs them. To test code that uses them, hand the code a different implementation. The
production code stays exactly as it is:

```eliot
def greeting(name: String) uses Console: Unit = printLine("Hello, " ++ name ++ "!")
```

The test declares an **implementation** — a fake — and hands it over with
[`with`]({{ '/docs/implementations/' | relative_url }}#handing-one-over-with):

```eliot
implement recordingConsole: Console {
   def printLine(s: String) uses Writer[String]: Unit = tell(s ++ ";")
   def readLine: Option[String] = none
}

def transcript: String = runWriterToLog(greeting("Bob") with recordingConsole)
// "Hello, Bob!;"
```

The fake records each printed line through the `Writer` effect, and `runWriterToLog` discharges that
into the plain `String` a test asserts on. Nothing was printed, nothing was mocked at runtime, and
`greeting` never learned that a test exists.

The fake is **one declaration**. It needs no type of its own, no registration, and no place in the
effect's module: an implementation is never searched for, so it cannot clash with the platform's
`standardConsole`. Its `Writer` is taken where the `with` is written — inside `runWriterToLog` — so
it never shows up in `greeting`'s clause. And it **cannot cheat**: user code cannot declare platform
natives, so a fake reaches the outside world only through effects its own clauses declare, which are
checked like any others.

Interpretation is **per effect**: `program with fakeConsole with fakeFileSystem` replaces two
effects and leaves every other one as the caller had it.

### Your own effects

An effect your application defines is tested the same way. A fake that needs configuring takes
parameters, which the `with` supplies:

```eliot
effect Terminal {
   def write(line: String): Unit
   def read: String
}

def greet uses Terminal: Unit = {
   val name = read
   write("Hello, " ++ name ++ "!")
}

implement scripted(answer: String): Terminal {
   def write(line: String) uses Writer[String]: Unit = tell(line ++ ";")
   def read: String = answer
}

def greetsBob: String = runWriterToLog(greet with scripted("Bob"))     // "Hello, Bob!;"
def greetsAda: String = runWriterToLog(greet with scripted("Ada"))     // "Hello, Ada!;"
```

## A tiny test framework

Write the `with` inside a helper, around its run of a code parameter, and the fake disappears from
the tests altogether — the helper hands it to whatever code its caller writes in that slot:

```eliot
def transcriptOf(program uses *, Console: Unit) uses *: String = runWriterToLog(program with recordingConsole)

data TestResult(name: String, failure: Option[String])

def expect(name: String, expected: String, actual: String): TestResult =
   if(expected == actual, TestResult(name, none))
   else TestResult(name, some("expected '" ++ expected ++ "' but was '" ++ actual ++ "'"))

def greetTest: TestResult = expect("greet", "Hello, Bob!;", transcriptOf(greeting("Bob")))
```

A test is now one line, and the code under test is a plain call.

## Test cases as values

A framework wants its tests as first-class values — collect them, name them, report them. A test's
*body* is code, though, and [code is run or passed on, never stored]({{ '/docs/effect-evaluation/' | relative_url }}#rule-3--a-parameter-without-uses-is-a-value).
So the framework runs each body right where it is written, inside a handler, and keeps **what it
came to** — an ordinary value like the `TestResult` above:

```eliot
data AssertionError(message: String)

def assertTrue(condition: Bool, reason: String) uses Throw[AssertionError]: Unit =
   if(condition, unit) else raise(AssertionError(reason))

def test(name: String, body uses Throw[AssertionError]: Unit): TestResult =
   TestResult(name, runThrow(body).foldEither(err -> some(message(err)), _ -> none))

def alwaysFails: TestResult = test("always fails", assertTrue(false, "nope"))
```

`test` gives its body `Throw[AssertionError]` and discharges it, so a failing assertion ends that one
test and nothing else. The results are plain data, ready to be put in a list and reported:

```eliot
def report(result: TestResult): String =
   result.failure.foldOption(name(result) ++ ": PASS", reason -> name(result) ++ ": FAIL " ++ reason)
```

Notice that `body`'s clause has no `*`. That makes it
[**closed**]({{ '/docs/effect-evaluation/' | relative_url }}#closing-a-parameter): a test body may
assert and nothing else — it cannot reach the console, the file system or anything else around it,
so a test written with `test` provably performs no I/O. A body that tries is rejected at the call
that does it. A framework that *wants* its tests to use the effects around them opens the clause
instead, `body uses *, Throw[AssertionError]: Unit`. The `eliot.test` framework's `in` is written
exactly that way, and its `mocked` is `transcriptOf` grown up: its slot lists every effect it fakes,
and it runs the body `with mockConsole with mockLog with mockFileSystem …`, so a case written
`"greet" should "greet the name it reads" in mocked { … }` needs no fixture at all.

## Structuring code for tests

The practical consequence is a familiar one, now enforced by signatures: keep decisions in functions
whose effects a test can discharge or fake, and keep the edges thin. Because every effect a function
uses is in its `uses` clause, you can see from a signature exactly what a test has to supply — and
the compiler will tell you if you missed one.

> **In one sentence.** Discharge a control effect and assert on the value; hand an interpretation
> effect a fake implementation with `with` and assert on what it recorded; the code under test
> changes in neither case.
{: .tip}

Next part: programming in the large, starting with
[Modules & imports]({{ '/docs/modules/' | relative_url }}).
