---
title: How the compiler follows a value
nav_title: Following a value
order: 16
part: Meta-information
summary: What the compiler derives with no help from you — through literals, arithmetic, your own functions, branches, data, strings, lists and folds — and the places it cannot see.
---

You never have to tell the compiler what a value's range is: it follows the value from where it is
made to where it is used. This chapter is a tour of what it follows, and of the places it cannot
see. Knowing both is what lets you predict whether a precondition will hold.
{: .docs-lead}

The examples use one function from the previous chapter, which demands a value that fits a byte:

```eliot
def setDuty(level: Int {closed(0, 255)}): Int = level
```

Each `setDuty(…)` call below either compiles, because the compiler can show its argument fits
`0..255`, or is an error. The [next chapter]({{ '/docs/preconditions/' | relative_url }}) covers
how to write such a demand. Here we only care about what the compiler knows.

## Where a meta starts

Every meta in a program starts in one of three places.

**A literal.** An integer literal is known exactly: `7` has the range `7..7`. A string literal's
length is its number of characters: `"Eliot"` has the length `5..5`.

**The platform.** A value that comes from the outside world gets the meta the platform gives it. A
line read from the console has a length between 0 and 2,147,483,647 on the JVM, the longest string
the JVM can hold. Parsing a number with `parseInt` gives a range that is open at both ends, because a
string of digits can spell any number at all. The compiler *knows* that range. It is just not
narrow.

**You.** A function may state what its result is known to be, when you know more than the compiler
can work out. That is the subject of [Refining a result]({{ '/docs/refining/' | relative_url }}).

Everything else is derived from those, one step at a time.

## Arithmetic

`+`, `-` and `*` compute ranges the way you would by hand, from the operands' ranges:

```eliot
def percentToDuty(percent: Int): Int = percent * 2 + 55

setDuty(percentToDuty(100))   // 255..255: fits
setDuty(percentToDuty(50))    // 155..155: fits
```

With an operand known only to lie in `0..100`, the result covers every possibility:
`percent * 2 + 55` is `55..255`.

**A range grows; it never wraps around.** `200 + 100` is `300..300`, not `44`. There is no overflow
to think about, because there is no fixed width to overflow. The backend picks storage wide enough
for whatever range the compiler derived.

**The compiler tracks values, not the relationships between them.** If `x` lies in `0..100`, then
`x - x` lies in `-100..100` as far as the compiler can tell, although you know it is always `0`. Each
operand is followed on its own, and the compiler does not notice that both are the same `x`. Usually
this costs nothing. When a bound comes out wider than you expected, look for a value used twice.

## Through your own functions

The compiler follows a call into the function it calls, with the metas of that call's arguments:

```eliot
def double(x: Int): Int = x + x

setDuty(double(60))    // 120..120: fits
setDuty(double(200))   // 400..400: does not fit
```

`double`'s signature says nothing about ranges, and it does not need to. A function has no range of
its own: **each call has its own**, worked out from what that call passes. The same holds for
function values and lambdas:

```eliot
def applyTo(f: Int => Int, x: Int): Int = f(x)

setDuty(applyTo(a -> a + 1, 10))   // 11..11: fits
```

## Branches join

When the compiler cannot know which way a branch goes, the result covers every way it could go. A
`match` is the clearest case:

```eliot
data Brightness = Dim | Bright | Blinding

def dutyOf(b: Brightness): Int = b match {
   case Dim      -> 20
   case Bright   -> 200
   case Blinding -> 400
}
```

For a brightness chosen at runtime, `dutyOf` is `20..400`: the **join** of its arms, the narrowest
range covering all three. That does not fit `0..255`, because one arm does not. Cap `Blinding` at
`255` and every arm fits, so the join does too. When the brightness is known, only its arm counts:
`dutyOf(Dim)` is `20..20`, and fits.

An `if … else` joins the same way: `if(bright) 200 else 20` is `20..200`.

## Through data

A value keeps what is known about it when you put it into a `data` value and take it out again,
whether that is an `Option`, a `Pair` or a type of your own:

```eliot
def orZero(o: Option[Int]): Int = o match {
   case Some(x) -> x
   case None    -> 0
}

setDuty(orZero(Some(200)))         // 200..200: fits
setDuty(orZero(Some(300)))         // 300..300: does not fit
setDuty(first(Pair(17, "seven")))  // 17..17: fits
```

The compiler also remembers which constructor made a value, so `orZero(Some(200))` does not join in
the `None` arm's `0`: no `None` can reach it.

## Strings

A `String`'s length is followed through the same machinery, counted in characters:

| Expression | Length |
|---|---|
| `"Eliot"` | `5..5` |
| `"Hi " ++ name` | the length of `name`, plus 3 |
| `length(s)` | an `Int` whose **range** is the length of `s` |
| `toUpperCase(s)` | up to three times the length of `s` (`ß` becomes `SS`) |
| `substring(…, s)`, `trim(s)` | at most the length of `s` |

The `length` row is where two kinds of meta meet: a string's length becomes an integer's range. So
a precondition on an `Int` can be met by a string literal's length:

```eliot
def fitsDisplay(i: Interval[BigInteger]): Bool = rangeWithin[0, 16](i)
def column(position: Int) where fitsDisplay(range(position)): Int = position

column(length("Eliot"))   // the range is 5..5, taken from the string: fits
```

A character here is a Unicode code point, not a byte, so a length means the same thing on every
target.

## Lists

A `List` carries two facts: its **size**, how many items it has, and its **items**, what is known
about every one of them. `empty`, `append` and `prepend` keep both exact:

```eliot
def readings: List[Int] = append(append(empty, 3), 7)   // size 2..2, every item in 3..7
```

A fold hands its function each item with the items' meta, so what comes out of the items is
bounded by them:

```eliot
readings.foldLeft(0, item -> last -> item)   // 0..7: either untouched, or an item
```

## Folds and loops

Your code has no loops, but a fold over a collection runs its function any number of times, as far
as the compiler is concerned. It follows the accumulator as *anything any number of iterations could
leave*:

```eliot
letters.foldLeft(5, _ -> _ -> 7)        // 5..7: either untouched, or 7
letters.foldLeft(0, _ -> n -> n + 1)    // at least 0, with no upper limit
```

The counter is known, but it is not bounded: the compiler does not use the list's size to count
the iterations. That is also why `readings.size`, which the standard library computes with exactly
such a fold, comes out as *at least 0*, although the list's own `size` is `2..2`. A `where` can read
that exact size directly (see [Preconditions]({{ '/docs/preconditions/' | relative_url }})), and a
function that knows the count can say so ([Refining a result]({{ '/docs/refining/' | relative_url }})).

## Where the compiler stops

Every demand ends one of three ways: the argument **fits**, it **does not fit**, or the compiler
**cannot prove** anything about it. The last one is reported as an error too, worded differently:

```text
error: Cannot prove what the parameter 'level' of 'Probe::setDuty' states: the argument's meta-information is not known here.
  |  A stated parameter demands provable meta-information — pass a value the compiler can pin, such as a literal.
```

These are the places today's compiler does not follow a value:

- **A lambda's own parameter, at a demand inside the lambda.** `applyTo(x -> setDuty(x), 10)` cannot
  prove anything about `x`, although `applyTo(a -> a + 1, 10)` above derives its result. Following a
  value *through* a lambda works; demanding something *of* a lambda's parameter does not.
- **A `data` type that contains itself through another type**, such as
  `data Rose(kids: Option[Rose], value: Int)`. A type that holds itself directly, like a tree's
  `Node(left: Tree, value: Int, right: Tree)`, is followed: what you read from it is the join over
  all of its nodes.
- **A comparison does not narrow.** Writing `min(x + 10, 100)` does not tell the compiler that the
  result is at most `100`: `min` picks one of its two arguments at runtime, so its result is the
  join of both. With `x` in `0..100` that is `10..110`, not `10..100`. Testing a value with `<` or
  `==` does not narrow it inside the branch either: after `if(n > 0) n`, the result is whatever `n`
  was.

The last point matters most for input. A number parsed from a line of text is known to be
unbounded, and no comparison narrows it. What does is **you**: a function that checks the number can
state what its result is, and the compiler takes that statement in place of what it derived. That is
how a value read at runtime becomes one that meets a precondition, and it is the subject of
[Refining a result]({{ '/docs/refining/' | relative_url }}).

> **"Cannot prove" is never "pass".** Wherever the compiler stops following a value, a demand on it
> fails to compile. A program is never accepted because the compiler did not look.
{: .note}

## Seeing what the compiler knows

In an editor running Eliot's language server, hovering an `Int` expression can show its range next to
its type, when the compiler pinned one bounded at both ends. That is the quickest way to answer
*"why does this not fit?"*: hover the argument, and see what the compiler thinks it is.

Next: [Preconditions]({{ '/docs/preconditions/' | relative_url }}), where you write a demand of your own.
