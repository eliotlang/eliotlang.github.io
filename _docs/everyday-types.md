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

## Option: a value that might be absent

`Option[A]` is the standard "maybe there's a value" type:

```eliot
data Option[A] = None | Some(value: A)
```

Build one with `Some(x)` or `None` (there's also `some(x)` as a plain function, handy for partial
application). Consume one with `foldOption`, supplying a value for the absent case and a function for
the present case:

```eliot
def greeting(name: Option[String]): String = foldOption(name, "hello, stranger", n -> n)

def main: {Console} Unit = {
  printLine(greeting(Some("Ada")))
  printLine(greeting(None))
}
```

This prints `Ada`, then `hello, stranger`. The signature of the eliminator is worth reading once:

```eliot
def foldOption[A, B](o: Option[A], ifNone: B, ifSome: Function[A, B]): B
```

`ifNone` is a plain value; `ifSome` is a function applied to the contained value when it's present.
You could also `match` on `None`/`Some` directly — `foldOption` is just the packaged version.

## Pair: two values at once

`Pair[A, B]` bundles two independently-typed values:

```eliot
data Pair[A, B](first: A, second: B)
```

You build one with `Pair(a, b)` and read the parts back with the `.first` and `.second` accessors:

```eliot
def dimensions: Pair[Int, Int] = Pair(640, 480)

def main: {Console} Unit = {
  printLine(show(dimensions.first))
  printLine(show(dimensions.second))
}
```

This prints `640`, then `480`. There's a `foldPair(p, f)` too, which hands both components to a
curried two-argument function — but `.first`/`.second` is usually clearer. Pairs are also how several
effect dischargers hand back more than one result, as you'll see later.

> **There are no tuples** — `Pair` is the two-value bundle, and there is no `(a, b)` tuple syntax.
> For three values, nest pairs or (better) declare a `data` record with named fields, which reads far
> better than `Pair[A, Pair[B, C]]`.
{: .note}

## Either: a result or an error

`Either[E, A]` holds one of two things — by convention an error on the `Left`, a success on the
`Right`:

```eliot
data Either[E, A] = Left(error: E) | Right(value: A)
```

Consume it with `foldEither`, giving a function for each side:

```eliot
def message(result: Either[String, Int]): String =
  foldEither(result, err -> err, n -> show(n))
```

`Either` is more than a convenience type: it's what the `Throw[E]` effect discharges into. Running a
`{Throw[E]}` computation with `runThrow` yields an `Either[E, A]` — `Left` if it raised, `Right` if it
succeeded. We'll get there in [Discharging effects]({{ '/docs/discharging-effects/' | relative_url }}).

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
`{Console} Unit` and why a `printLine` yields `Unit`.

## The pattern to notice

Every one of these types follows the same shape: a `data` declaration (often a sum type), and a
`foldX` eliminator that consumes it by handling each case. Once you've internalized `foldOption` /
`foldEither` / `foldPair`, new types in the library and in your own code will feel familiar — they
all work the same way, because [without recursion]({{ '/docs/totality/' | relative_url }}) the
eliminator *is* how you take a value apart.

Next: naming your own operators, and how precedence works.
