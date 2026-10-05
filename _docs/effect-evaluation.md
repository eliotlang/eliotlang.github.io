---
title: When effects run
nav_title: When effects run
order: 17
part: Effects
summary: An argument runs before the call unless its parameter declares a row; a row-typed parameter receives the computation unrun; and an effect is always provided where it is written, wherever it ends up running.
---

Direct style hides the plumbing, not the semantics. Two questions follow naturally from the last
chapter: given an effectful expression, **when does it run** — and **whose implementation of the
effect does it use**? Both answers are written in declarations you can see, and they are
independent of each other.
{: .docs-lead}

There are three rules. The first two are about *when*; the third is about *who*. Together they make
evaluation order and effect handling something you *read* off a signature rather than something you
*learn per function*.

## Rule 1 — arguments run before the call

Eliot is strict. Every argument is evaluated once, left to right, before the function is entered —
exactly as in Java, Python or C:

```eliot
def choose[A](left: A, right: A, flag: Bool): A = fold(flag, left, right)

def main: {Console} Unit = choose(printLine("left ran"), printLine("right ran"), true)
```

```text
left ran
right ran
```

Both arguments ran, even though `choose` uses only one of them. Nothing in `choose`'s body can change
that: by the time `choose` starts, its arguments are plain values.

The rule has no exception for generic code — a parameter typed `A` receives a value like any other —
so you never have to know how generic a function is to know whether your argument runs. It holds for a
function-typed parameter too: the argument `s -> printLine(s)` evaluates to a function, which performs
nothing by itself; the lambda's *body* runs each time the callee applies it.

## Rule 2 — a row on a parameter passes the argument unrun

Some functions genuinely need to *not* run an argument up front: the untaken branch of a conditional,
a fallback that should only apply on failure, a step a loop repeats. Those parameters declare an
**effect row** on their own type:

```eliot
def pick[A](left: {} A, right: {} A, flag: Bool): A = fold(flag, left, right)

def main: {Console} Unit = pick(printLine("left ran"), printLine("right ran"), true)
```

```text
left ran
```

`{} A` in a parameter position reads *"a computation producing an `A`"*. The argument arrives
**unrun**, and the function decides whether, when and how many times it runs:

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

The declaration is the whole difference between `choose` and `pick` — the call sites are identical.
A row is the **only** way to delay an argument, so rule 1 is never suspended behind your back: if a
parameter has no row, its argument has already run.

> **A row accepts a plain value too.** A pure expression is a computation that happens to perform
> nothing, so it fits a `{} A` slot: `pick("just a string", readLine orElse "", flag)` type-checks.
> A row parameter says *"may be delayed"*; it never forces the caller to produce an effect.
{: .note}

A `data` field holds an unrun computation the same way, by giving the field a row: building the value
does not run it, reading the field does
([storing a computation]({{ '/docs/implementations/' | relative_url }}#storing-a-computation-in-a-data-field)).

## Rule 3 — an effect is provided where it is written

Rules 1 and 2 say *when* an effect runs. They say nothing about *whose* implementation it runs on — and
that is deliberate, because that answer never depends on when or where the code eventually runs. Every
effectful call takes its implementation from the code around the place **you wrote it**:

- a [`with`]({{ '/docs/implementations/' | relative_url }}#choosing-a-different-implementation-with)
  around it, or a parameter it is written in whose row provides that effect (see below) — whichever
  is nearer;
- otherwise, the row of the function you wrote it in — which means that function's **caller** provides
  it, and so on up to `main`, where the platform does.

Handing your code to someone else to run does not change this:

```eliot
implement recordingConsole: Console {
   def printLine(s: String): {Writer[String]} Unit = tell(s ++ ";")
   def readLine: Option[String] = None
}

def recorded: String = runWriterToLog(twice(printLine("x")) with recordingConsole)
```

`recorded` is `"x;x;"`. The `printLine("x")` runs inside `twice`, twice, but it was *written* inside
the `with`, so both lines go to the recording console. `twice` cannot see or replace the console its
argument uses: its parameter's row is empty, so it provides nothing.

### Every row says who provides

That gives each row in a signature a single reading: **a row lists effects that someone other than the
code itself provides.** Which someone depends only on where the row stands:

- **On a function's result**, `def greet: {Console} Unit`, the row is a requirement on the **caller**:
  whoever calls `greet` provides a `Console` — by declaring it in turn, by binding one with `with`, or
  by handling it.
- **On a parameter**, `computation: {Throw[E]} A`, an entry the function's own result row does not
  list is one **the function** provides for that argument. That is all a
  [discharger]({{ '/docs/discharging-effects/' | relative_url }}) is: `catch` provides `Throw[E]` to its
  computation by installing the handler a `raise` exits to. An entry the function's result row *does*
  list is simply passed on to its own caller — `if(condition, value: {Abort} T): {Abort} T` hands
  `value`'s `Abort` up.
- **`{}`** names nothing: a computation that gets nothing from the function it is handed to, so every
  effect in it stays provided by you.

The same goes for lambdas. A lambda's body is code you wrote, so its effects are provided where the
lambda is written, however many times the callee applies it.

## Reading the rules off the standard library

Every function in the standard library that delays an argument declares it, so the signatures tell you
what runs, and who handles what:

```eliot
def fold[A](condition: Bool, whenTrue: {} A, whenFalse: {} A): A
def if[T](condition: Bool, value: {Abort} T): {Abort} T
def else[A](computation: {Abort} A, fallback: {} A): A
def foreach[A](action: A => {} Unit, list: List[A]): Unit
```

- `fold`'s two arms are delayed, so **only the selected branch runs** — which is what makes `if..else`
  behave like the conditional you expect, since `if(c, v)` is just `fold(c, v, abort)`. Both arms are
  `{}`, so `fold` provides nothing: whatever the selected arm performs is yours.
- `if` lists `Abort` in its own result row, so `value`'s `Abort` is passed on to `if`'s caller.
- `else`'s `computation` names `Abort`, which `else` itself does not declare — so `else` provides it,
  and handles it. Its `fallback` is delayed too, so it costs nothing when the computation succeeds.
- `foreach`'s `action` is a function, so `foreach` decides how often its body runs — once per element —
  while the lambda's effects are provided where you wrote it. `foreach` is effectful exactly when the
  callback is:

```eliot
import eliot.collection.List

def names: List[String] = append(append(empty, "Ada"), "Grace")

def main: {Console} Unit = names.foreach(n -> printLine(n))
```

A function whose parameters carry no rows — `printLine`, `append`, your own `def area(r: Rect)` —
receives each argument already run, once. That is the common case, and it needs no annotation.

## A dot chain carries values

Rule 1 has one consequence worth seeing once, because it hides behind an operator rather than a
function call. The [dot operator]({{ '/docs/dot-operator/' | relative_url }}) is an ordinary
definition:

```eliot
def .[A, B](a: A, f: A => {} B): B = f(a)
```

Its *subject* `a: A` declares no row, so the subject is an ordinary argument: whatever it performs runs
**before** the dot. That is usually what you want — `readLine.foldOption("", s -> s)` reads a line,
then folds it — but it means a discharger cannot take its computation through the dot:

```eliot
def bad: Pair[String, String] = swap("second").runStateToPair("first")
```

```text
error: This value performs the effect 'State' but does not declare it;
       add it to its { ... } effect set.
```

`swap("second")` ran in `bad` itself, before `runStateToPair` was called, so the `State` it performs is
`bad`'s to provide — and `bad` declares nothing. The fix is to put the computation where the discharger
receives it unrun:

> **Hand dischargers their computation as an argument.** Write
> `runStateToPair("first", swap("second"))`, `runThrow(parse(raw))`, `runAbort(lookup(key))`. The
> **infix** dischargers are unaffected — in `x catch (err -> …)` and `host else "localhost"`, the
> left operand already *is* the discharger's parameter.
{: .warn}

Everything else dot-chains as before: `names.foreach(…)`, `outcome.second`, `option.foldOption(…)`.

## The rules on one page

| The parameter's type | When your argument runs | Who provides its effects |
|---|---|---|
| no row: `String`, `A`, `Rect` | before the call, once | you |
| a function: `A => {} B` | the lambda is a value; its body runs each time the callee applies it | you |
| an empty row: `{} A` | when the callee runs it — maybe never, maybe many times | you |
| a row naming effects: `{Throw[E]} A` | when the callee runs it | the callee, for each effect its own result row does not list; you, for the rest |

Two questions, two answers, both read off the declaration, and nothing inferred. The alternative —
which Eliot did try — is to let the compiler decide per call site whether an argument runs, from how
generic the callee happens to be. That costs you the ability to read evaluation order from a signature
at all: the same argument at the same slot could run, or not, depending on what a *sibling* argument's
type turned out to be.

## In practice

Most days none of this comes up: you write direct-style code, arguments run where you wrote them, your
caller provides what your row declares, and the standard library's delaying combinators are already
declared correctly. The rules matter when you **write a combinator of your own** that must not run an
argument — declare the row — and when you **discharge an effect** — hand the discharger its
computation as an argument.

Next: the effects that ship with the language —
[the effect catalogue]({{ '/docs/effect-catalogue/' | relative_url }}).
