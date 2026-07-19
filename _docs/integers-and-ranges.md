---
title: Integers and ranges
nav_title: Integers & ranges
order: 7
part: Core language
summary: One Int type whose value range the compiler tracks, arithmetic that grows ranges instead of overflowing, and the range accessor.
---

Most languages give you a zoo of integer types — `Int8`, `UInt16`, `Int32` — and make you pick.
Eliot gives you exactly one: `Int`. What would be the *width* elsewhere is, in Eliot, a **range** the
compiler tracks for each value.
{: .docs-lead}

## One type, a tracked range

The declaration of `Int` says it all:

```eliot
type Int {range: Interval[BigInteger]}
```

`Int` is a single type, and every `Int` value carries a `range` — the interval of values it might
hold — as *meta-information the compiler tracks*, not as a type parameter you write. The range lives
in the compiler's refinement channel and costs **nothing at runtime**; it's a fact the compiler
knows, not a tag the program carries around.

A literal's range is a single point. The literal `7` has range `[7, 7]` — it is known to be exactly
`7`. That precision is the starting point everything else builds on.

## Arithmetic grows the range

Because the compiler knows each operand's range, it knows the result's range too — and arithmetic
**combines** ranges rather than wrapping around a fixed width. Here is the whole of `Arithmetic.els`:

```eliot
def main: {Console} Unit = printLine(show(2 + 3 * 4))
```

This prints `14`. Two things are on display:

- **`*` binds tighter than `+` and `-`**, so `2 + 3 * 4` is `2 + (3 * 4)`, just like ordinary maths.
- **`show`** renders a value to its `String` form. It's the standard way to turn an `Int` (or
  anything else) into text for printing — reach for `show`, not a type-specific converter.

`+`, `-`, `*`, and `show` are all in the auto-imported prelude, so no import is needed for arithmetic
— only `Console`, because we print.

> **You do not import arithmetic.** `+`/`-`/`*` are ordinary prelude functions (defined over the
> `Numeric` ability), so any file can do maths with no import beyond what it prints or reads with.
{: .note}

Ranges flow through longer computations too. From `Ranges.els`:

```eliot
def count: Int = 7

def total: Int = count + count + count

def main: {Console} Unit = printLine(show(total))
```

`total` computes `21`. The compiler tracks that `count` is `7`, so it knows `count + count + count`
lands in the range around `21` — the result *grows to fit* instead of silently overflowing. On a
32-bit machine that's convenient; on a microcontroller where every byte is counted, it's the whole
point.

## The `a - 1` gotcha

There is one lexical trap. A `-` glued directly to digits is read as a **negative literal**, not
subtraction:

```eliot
a - 1      // subtraction — note the spaces
a-1        // NOT subtraction: lexes as `a` followed by the literal `-1`
```

Always put spaces around binary `-`. (Addition and multiplication don't have this issue, but spacing
all your operators is the habit to build.)

## Reading a value's range

The range isn't only for the compiler's eyes — you can name it. The `range` accessor gives you a
value's range as an `Interval`:

```eliot
range(count)      // the Interval the compiler tracks for `count`
```

This becomes powerful in [Preconditions & guarded returns]({{ '/docs/preconditions/' | relative_url }}),
where a `where` clause can *require* — and the compiler can *prove* — that a value's range fits some
bound, like a single byte, checked at every call site with zero runtime cost. That's how Eliot
recovers the safety of fixed-width types without the fixed-width types.

## Intervals as ordinary values

`Interval` is also a normal runtime type you can compute with directly — it closes under arithmetic,
combining endpoint by endpoint. From `Intervals.els`:

```eliot
def a: Interval[Int] = Interval(0, 1)
def b: Interval[Int] = Interval(1, 2)

def sum: Interval[Int] = a + b     // [1, 3]
def diff: Interval[Int] = a - b    // [-2, 0]
def prod: Interval[Int] = a * b    // [0, 2]
```

You build one with `Interval(start, end)` and read the endpoints back with `.start` and `.end`. The
same interval arithmetic the compiler uses to track integer ranges is available to you as a plain
value.

Next: the rest of the everyday toolkit — `Option`, `Pair`, `Either`, `String`, and `Unit`.
