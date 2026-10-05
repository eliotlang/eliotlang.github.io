---
title: When effects run
nav_title: When effects run
order: 17
part: Effects
summary: Every argument is evaluated before the call, and a row on a parameter puts a lambda around it; every call uses the implementations in scope where it is written.
---

Direct style hides the plumbing, not the semantics. Every effectful call raises two questions: **when
does it run**, and **which implementation does it use** — the platform's console, a test's fake, the
`catch` around it. Both are answered by declarations you can see.
{: .docs-lead}

## The rules

*When an effect runs:*

1. Every argument is evaluated before the call.
2. A row on a parameter puts an implicit lambda around its argument.

*Which implementation it uses:*

{:start="3"}
3. A row lists the implementations code receives from whoever runs it.
4. `with` puts an implementation in scope for the expression it is applied to.
5. Every call uses the implementations in scope where it is written.
6. A call with no implementation in scope is a compile error.

The two groups are independent: the first two rules never mention implementations, and the last four
never mention timing. The rest of this chapter shows each rule at work.

## Rule 1 — every argument is evaluated before the call

Eliot is strict, exactly like Java, Python or C:

```eliot
def choose[A](left: A, right: A, flag: Bool): A = fold(flag, left, right)

def main: {Console} Unit = choose(printLine("left ran"), printLine("right ran"), true)
```

```text
left ran
right ran
```

Both arguments ran, even though `choose` uses only one of them: by the time `choose` starts, its
arguments are values. A generic parameter `A` is no different from a `String`, so you never have to
know how generic a function is to know whether your argument runs.

## Rule 2 — a row on a parameter puts an implicit lambda around its argument

A parameter that must not run its argument up front — the untaken branch of a conditional, a fallback
that should only apply on failure, a step a loop repeats — declares a **row** on its type:

```eliot
def pick[A](left: {} A, right: {} A, flag: Bool): A = fold(flag, left, right)

def main: {Console} Unit = pick(printLine("left ran"), printLine("right ran"), true)
```

```text
left ran
```

`{} A` reads *"a computation producing an `A`"*. The call site looks the same as `choose`'s, but each
argument is wrapped as if you had written a lambda around it. Rule 1 still applies — it evaluates the
*lambda*, which runs nothing. The function runs the computation each time it uses the parameter, which
may be never or many times:

```eliot
def twice(action: {} Unit): Unit = {
   action
   action
}

def main: {Console} Unit = twice(printLine("hello"))
```

```text
hello
hello
```

> **A row accepts a plain value too.** A pure expression is a computation that happens to perform
> nothing, so it fits a `{} A` slot: `pick("just a string", readLine orElse "", flag)` type-checks.
{: .note}

A `data` field with a row holds a computation the same way
([storing a computation]({{ '/docs/implementations/' | relative_url }}#storing-a-computation-in-a-data-field)).

## Rule 3 — a row lists the implementations code receives from whoever runs it

An effect declares operations; an **implementation** is the code that performs them. A row works like
a list of hidden parameters, one implementation per effect, filled in by whoever runs the code:

- `def greet: {Console} Unit` — whoever calls `greet` gives it a `Console` implementation. `main` is run
  by the platform, so `main` receives the platform's.
- `catch[E, A](computation: {Throw[E]} A, onError: E => {} A): A` — whoever runs `computation` gives it
  a `Throw[E]` implementation, and that is `catch` itself: its handler, the place a `raise` exits to.
  That is all a [discharger]({{ '/docs/discharging-effects/' | relative_url }}) is.
- `pick`'s `left: {} A` — the row is empty, so the computation receives nothing from `pick`.

## Rule 4 — `with` puts an implementation in scope for the expression it is applied to

An implementation can also be named and chosen by hand, which is how a test replaces the platform's
console with a fake ([Implementations and `with`]({{ '/docs/implementations/' | relative_url }})):

```eliot
def greeting(name: String): {Console} Unit = printLine("Hello, " ++ name ++ "!")

implement recordingConsole: Console {
   def printLine(s: String): {Writer[String]} Unit = tell(s ++ ";")
   def readLine: Option[String] = None
}

def transcript: String = runWriterToLog(greeting("Bob") with recordingConsole)
```

`transcript` is `"Hello, Bob!;"` — nothing was printed.

## Rule 5 — every call uses the implementations in scope where it is written

Scope works the way it does for a variable: what the enclosing function receives (rule 3), what an
enclosing parameter's computation receives (rule 3), and what an enclosing `with` adds (rule 4) — the
nearest one wins. What counts is where the call is **written**, never where it ends up running:

```eliot
def recorded: String = runWriterToLog(twice(printLine("x")) with recordingConsole)
```

`recorded` is `"x;x;"`. The `printLine("x")` runs inside `twice`, twice — but it is written inside the
`with`, so both lines go to the recording console. `twice`'s row is empty, so it gives its argument
nothing and cannot change which console that argument uses.

Calling your own effectful function is a call like any other: `greeting("Bob")` above passes `greeting`
the `Console` in scope where the call is written, which is how a single choice — the platform's at
`main`, or a test's `with` — reaches every `printLine` below it. A lambda is code you write too, so its
calls use the implementations in scope where the lambda is written, however often it is applied:

```eliot
import eliot.collection.List

def names: List[String] = append(append(empty, "Ada"), "Grace")

def main: {Console} Unit = names.foreach(n -> printLine(n))
```

## Rule 6 — a call with no implementation in scope is a compile error

```eliot
def leaky: Unit = printLine("oops")
```

```text
error: This value performs the effect 'Console' but does not declare it;
       add it to its { ... } effect set.
```

`leaky` has no row, so it receives no `Console`, and nothing else puts one in scope. The fix is to get
one there: declare `{Console}` so that `leaky`'s caller gives it one (rule 3), bind one with `with`
(rule 4), or make the call inside a discharger's computation (rule 3 again). This is why effects float
up to callers: to call something that needs an implementation, you need one in scope yourself.

## Reading the rules off the standard library

```eliot
def fold[A](condition: Bool, whenTrue: {} A, whenFalse: {} A): A
def if[T](condition: Bool, value: {Abort} T): {Abort} T
def else[A](computation: {Abort} A, fallback: {} A): A
def foreach[A](action: A => {} Unit, list: List[A]): Unit
```

- `fold`'s arms are wrapped (rule 2), so **only the selected branch runs** — which is what makes
  `if..else` behave like the conditional you expect, since `if(c, v)` is just `fold(c, v, abort)`. The
  arms receive nothing from `fold`, so their calls use your implementations (rule 5).
- `if`'s `value` receives its `Abort` from `if`, and `if`'s own row says `if` receives it from its
  caller — so it is your `Abort`, passed straight through.
- `else`'s `computation` receives its `Abort` from `else`, which handles it; `else`'s own row has no
  `Abort`, so the abort ends there. Its `fallback` is wrapped too, so it costs nothing when the
  computation succeeds.
- `foreach`'s `action` is a lambda, applied once per element, and its calls use your implementations
  (rule 5).

## A dot chain carries values

The [dot operator]({{ '/docs/dot-operator/' | relative_url }}) is an ordinary definition:

```eliot
def .[A, B](a: A, f: A => {} B): B = f(a)
```

Its subject `a: A` has no row, so by rule 1 whatever the subject performs runs **before** the dot. That
is usually what you want — `readLine.foldOption("", s -> s)` reads a line, then folds it — but it means
a discharger cannot take its computation through the dot:

```eliot
def bad: Pair[String, String] = swap("second").runStateToPair("first")
```

```text
error: This value performs the effect 'State' but does not declare it;
       add it to its { ... } effect set.
```

`swap("second")` is evaluated in `bad` itself, before `runStateToPair` is called (rule 1), and `bad`
has no `State` implementation in scope (rule 6). Written as an argument instead, the call sits inside
`runStateToPair`'s computation, which receives one (rule 3):

> **Hand dischargers their computation as an argument.** Write
> `runStateToPair("first", swap("second"))`, `runThrow(parse(raw))`, `runAbort(lookup(key))`. The
> **infix** dischargers are unaffected — in `x catch (err -> …)` and `host else "localhost"`, the
> left operand already *is* the discharger's parameter.
{: .warn}

Everything else dot-chains as before: `names.foreach(…)`, `outcome.second`, `option.foldOption(…)`.

## In practice

Most days none of this comes up: arguments run where you wrote them, your caller gives you what your
row lists, and the standard library's delaying combinators are already declared correctly. The rules
matter when you **write a combinator of your own** that must not run an argument — declare the row —
and when you **discharge an effect** — hand the discharger its computation as an argument.

Next: the effects that ship with the language —
[the effect catalogue]({{ '/docs/effect-catalogue/' | relative_url }}).
