---
title: Everyday types
nav_title: Everyday types
order: 8
part: Core language
summary: Option, Pair, Either, String, and Unit — the prelude types you'll reach for constantly, and their fold eliminators.
---

Beyond `Int`, a handful of prelude types show up in almost every program: `Option`, `Pair`,
`Either`, `String`, and `Unit`. All are auto-imported, and each comes with a `fold` eliminator for
consuming it. This chapter is a quick tour.
{: .docs-lead}

## Types without constructors

If you open the standard library looking for `data Option[A] = None | Some(value: A)`, you won't find
it. What it declares is this:

```eliot
type Option[A]

def none[A]: Option[A]
def some[A](value: A): Option[A]
def foldOption[A, B](ifNone uses *: B, ifSome uses *: A => B, o: Option[A]): B
```

`Option` is an **abstract type**: the standard library says that it exists and what you can do with
it, but not how it's represented. That's deliberate. The standard library is platform-independent —
the same code is meant to run on the JVM and on a microcontroller — and committing to a `data`
declaration would mean committing to one representation everywhere. Instead, each platform supplies
its own: it may declare a `data` type, or it may map the type onto something native it already has.

So the standard library gives you **functions** in place of constructors — `some` and `none` to build
an `Option`, `foldOption` to take one apart — and they work on every platform. The same goes for
`Pair` and `Either`.

> A platform's representation may well have constructors you *can* name: on the JVM, `Option` happens
> to be `data Option[A] = None | Some(value: A)`, so `Some(x)` and `match` on it compile there. Don't
> rely on that. Code written against `Some`/`None` is written against the JVM's choice of
> representation, not against `Option`, and won't port to a platform that chose differently.
{: .warn}

Your own `data` types are a different matter: you chose their representation, so you build them with
their constructors and take them apart with `match`, as the
[data chapter]({{ '/docs/data-and-matching/' | relative_url }}) showed.

## Option: a value that might be absent

`Option[A]` is the standard "maybe there's a value" type. Build one with `some(x)` or `none`, and
consume one with `foldOption`, supplying a value for the absent case and a function for the present
case:

```eliot
def greeting(name: Option[String]): String = name.foldOption("hello, stranger", n -> n)

def main uses Console: Unit = {
  printLine(greeting(some("Ada")))
  printLine(greeting(none))
}
```

This prints `Ada`, then `hello, stranger`. Like most of the library, `foldOption` takes its subject
**last**, which is what lets it read as `name.foldOption(…)`. Both arms are code (`uses *`), so only
the one that applies is ever run.

When all you want is the value or a fallback, `orElse` says it directly:

```eliot
def displayName(name: Option[String]): String = name orElse "anonymous"
```

There's more in the same vein — `isSome`, `isNone`, `mapOption`, `someIf` — all of them built on
`some`, `none` and `foldOption`, which is exactly why they work on every platform.

## Pair: two values at once

`Pair[A, B]` bundles two independently-typed values. You build one with `pair(a, b)` and read the
parts back with `first` and `second`:

```eliot
def dimensions: Pair[Int, Int] = pair(640, 480)

def main uses Console: Unit = {
  printLine(show(dimensions.first))
  printLine(show(dimensions.second))
}
```

This prints `640`, then `480`. There's a `foldPair` too, which hands both components to a curried
two-argument function — `dimensions.foldPair(w -> h -> w * h)` — but `.first`/`.second` is usually
clearer. Pairs are also how several effect dischargers hand back more than one result, as you'll see
later.

> **There are no tuples** — `Pair` is the two-value bundle, and there is no `(a, b)` tuple syntax.
> For three values, nest pairs or (better) declare a `data` record with named fields, which reads far
> better than `Pair[A, Pair[B, C]]`.
{: .note}

## Either: a result or an error

`Either[E, A]` holds one of two things — by convention an error on the left, a success on the right.
Consume it with `foldEither`, giving a function for each side:

```eliot
def message(result: Either[String, Int]): String =
  result.foldEither(err -> err, n -> show(n))
```

You rarely build an `Either` by hand. It's what the `Throw[E]` effect discharges into: running a
`{Throw[E]}` computation with `runThrow` yields an `Either[E, A]` holding either the error it raised
or the result it returned, and `orRaise` turns one back into the effect. We'll get there in
[Discharging effects]({{ '/docs/discharging-effects/' | relative_url }}).

## String and Unit

`String` is the text type. String literals use double quotes with the usual backslash escapes:

```eliot
def greeting: String = "Hello,\n\"World\""
```

Strings compare with `==` (from the `Eq` ability), so `name == "yes"` is a `Bool`. A few things Eliot
deliberately does *not* have: no string interpolation, no `char` type, and no floating-point
literals. When you need to assemble text, build the pieces and print them, or `show` the values.

`Unit` is the "no interesting value" type — one type, one value, `unit`. It's what an effectful action
returns when it's performed for its effect rather than its result, which is why `main` is
`uses Console: Unit` and why a `printLine` yields `Unit`.

## The pattern to notice

Every one of these types follows the same shape: an abstract type, some way to build it, and a
`foldX` eliminator that consumes it by handling each case. Once you've internalized `foldOption` /
`foldEither` / `foldPair`, new types in the library and in your own code will feel familiar — they
all work the same way, because [without recursion]({{ '/docs/totality/' | relative_url }}) the
eliminator *is* how you take a value apart.

Next: naming your own operators, and how precedence works.
