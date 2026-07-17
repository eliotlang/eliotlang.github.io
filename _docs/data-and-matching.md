---
title: Data types and pattern matching
nav_title: Data & matching
order: 6
part: Core language
summary: Declaring records and sum types with data, and taking them apart exhaustively with match.
---

`data` declares your own concrete types — records with fields, and sum types with several
alternatives. `match` takes them apart. Together they are how you model everything from an optional
value to a syntax tree.
{: .docs-lead}

## Records: one constructor with fields

The simplest `data` is a record — a single constructor carrying named fields:

```eliot
data Database(url: String)

data Point(x: Int, y: Int)
```

A single `data` declaration introduces **three** things at once:

- a **type constructor** — `Point`, used where a type is expected (`def origin: Point = …`);
- a **value constructor** — `Point(0, 0)`, used to build a value;
- one **accessor per field** — `x` and `y`, used to read them back.

Accessors are **subject-last** functions, which means you can read a field two equivalent ways:

```eliot
def originX(p: Point): Int = x(p)     // as a plain function call…
def originX2(p: Point): Int = p.x     // …or with the dot operator (same thing)
```

Both spellings mean the same call. The dot form is the idiomatic one, and there's a whole chapter on
why — for now, read `p.x` as "the `x` of `p`".

## Sum types: several alternatives

Separate constructors with `|` to get a sum type — a value that is *one of* several shapes:

```eliot
data Maybe[A] = Nothing | Just(value: A)
```

`Maybe[A]` is either `Nothing` (a constructor with no fields) or `Just(value: A)` (a constructor
carrying one field). The `[A]` makes it **generic** — `Maybe[String]`, `Maybe[Int]`, and so on.
(Generics get their own chapter; here it's just "`Maybe` of some type `A`".)

Constructors are always **Uppercase**. That's not a style convention — it's how the compiler tells a
constructor apart from a variable, which matters a great deal in `match`.

## Taking data apart with `match`

You inspect a `data` value by matching on its constructors:

```eliot
import eliot.effect.Console

data Maybe[A] = Nothing | Just(value: A)

def describe(m: Maybe[String]): String = m match {
  case Nothing -> "empty"
  case Just(v) -> v
}

def main: IO[Unit] = printLine(describe(Just("hello")))
```

This prints `hello`. Each `case` is a **pattern** followed by `->` and a result. The patterns you can
write are:

- an **Uppercase constructor** — `Nothing`, `Just(v)` — optionally with nested sub-patterns for its
  fields;
- a **lowercase variable** — `v` — which binds to whatever is there;
- the **wildcard** `_` — matches anything and binds nothing.

Patterns nest, so you can reach into structure in one step:

```eliot
def firstName(m: Maybe[Point]): Int = m match {
  case Nothing        -> 0
  case Just(Point(x, _)) -> x      // destructure the Point inside the Just
}
```

## Two rules the compiler enforces

- **Matches must be exhaustive.** If you leave out a constructor, it's a compile error, not a runtime
  surprise. Add every case, or a `_` to catch the rest.
- **Every `data` is matchable automatically.** There is no `derive` keyword and nothing to opt into —
  declaring the type is enough.

## The pitfall to remember

Because a lowercase name in a pattern is a **binder**, this does *not* do what it looks like:

```eliot
def oops(m: Maybe[String]): String = m match {
  case nothing -> "always this"   // `nothing` binds ANY value — the second case is dead
  case Just(v) -> v
}
```

`nothing` (lowercase) matches *everything* and binds it to the name `nothing`, so the `Just` case can
never be reached. The fix is the Uppercase constructor `Nothing`. When a match behaves strangely,
check your capitalization first.

> **There are no literal patterns.** You cannot write `case 0 -> …` or `case "yes" -> …`. To branch
> on a specific number or string, compare it with `==` and use `if..else`, or match on a `data` type
> that encodes the cases you care about.
{: .warn}

## Recursive types are fine

Although Eliot forbids recursive *values*, recursive *types* are allowed (in the covariant position),
so tree-shaped data is natural:

```eliot
data Tree(value: Int, left: Tree, right: Tree)
```

You just can't write a recursive function to walk it — traversal goes through eliminators and the
container operations, which is the subject of
[Total by default]({{ '/docs/totality/' | relative_url }}).

Next: the number type that isn't a number type — `Int` and its ranges.
