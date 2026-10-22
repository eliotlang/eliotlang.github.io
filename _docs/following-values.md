---
title: How the compiler follows a value
nav_title: Following a value
order: 16
part: Meta-information
summary: What the compiler derives with no help from you — through literals, arithmetic, your own functions, branches, strings and folds — and the places it cannot see.
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

Every meta in a program starts in one of two places.

**A literal.** An integer literal is known exactly: `7` has the range `7..7`. A string literal's
size is its number of characters: `"Eliot"` has the size `5..5`.

**The platform.** A value that comes from the outside world gets the meta the platform gives it. A
line read from the console has a size between 0 and 2,147,483,647 on the JVM, the longest string the
JVM can hold. Parsing a number with `parseInt` gives a range that is open at both ends, because a
string of digits can spell any number at all. The compiler *knows* that range. It is just not
narrow.

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
`255` and every arm fits, so the join does too. A `fold` over a `Bool` joins its two arms the same
way: `fold(bright, 200, 20)` is `20..200`.

## Strings

A `String`'s size is followed through the same machinery, counted in characters:

| Expression | Size |
|---|---|
| `"Eliot"` | `5..5` |
| `"Hi " ++ name` | the size of `name`, plus 3 |
| `length(s)` | an `Int` whose **range** is the size of `s` |
| `toUpperCase(s)` | up to three times the size of `s` (`ß` becomes `SS`) |
| `substring(…, s)`, `trim(s)` | at most the size of `s` |

The `length` row is where the two kinds of meta meet: a string's size becomes an integer's range. So
a precondition on an `Int` can be met by a string literal's length:

```eliot
def fitsDisplay(i: Interval[BigInteger]): Bool = rangeWithin[0, 16](i)
def column(position: Int) where fitsDisplay(range(position)): Int = position

column(length("Eliot"))   // the range is 5..5, taken from the string: fits
```

A character here is a Unicode code point, not a byte, so a size means the same thing on every target.

## Folds

Your code has no loops, but a fold over a collection runs its function any number of times. The
compiler follows the accumulator as *anything any number of iterations could leave*:

```eliot
letters.foldLeft(5, _ -> _ -> 7)        // 5..7: either untouched, or 7
letters.foldLeft(0, _ -> n -> n + 1)    // at least 0, with no upper limit
```

The counter is known, but it is not bounded, because how long `letters` is at runtime is not
something the compiler tracks. So `setDuty` rejects it.

## Where the compiler stops

Every demand ends one of three ways: the argument **fits**, it **does not fit**, or the compiler
**cannot prove** anything about it. The last one is reported as an error too, worded differently:

```text
error: Cannot prove what the parameter 'level' of 'Probe::setDuty' states: the argument's meta-information is not known here.
  |  A stated parameter demands provable meta-information — pass a value the compiler can pin, such as a literal.
```

These are the places today's compiler does not follow a value:

- **A value inside a `data` structure**, unless the field states its range. Put a `200` into an
  `Option` or into your own `data`, take it out again, and its range is not known. A field that
  states its range is always known, which is the subject of
  [Refined types of your own]({{ '/docs/refined-types/' | relative_url }}).
- **The elements of a `List`.** `list.foldLeft(0, e -> sum -> sum + e)` cannot know the elements'
  ranges.
- **A lambda's own parameter, at a demand inside the lambda.** `applyTo(x -> setDuty(x), 10)` cannot
  prove anything about `x`, although `applyTo(a -> a + 1, 10)` above derives its result. Following a
  value *through* a lambda works; demanding something *of* a lambda's parameter does not.
- **A comparison does not narrow.** Writing `min(x + 10, 100)` does not tell the compiler that the
  result is at most `100`: `min` picks one of its two arguments at runtime, so its result is the
  join of both. With `x` in `0..100` that is `10..110`, not `10..100`. Testing a value with `<` or
  `==` does not narrow it inside the branch either.

That last point has a consequence worth stating plainly: **today there is no way to turn a value read
at runtime into one that meets a precondition.** A number parsed from input is known to be unbounded,
and nothing narrows it. Preconditions today are for values whose bounds follow from the program's
own text, such as constants, configuration, lengths of literals and computed indices. They are not a
way of validating input.

> **"Cannot prove" is never "pass".** Wherever the compiler stops following a value, a demand on it
> fails to compile. A program is never accepted because the compiler did not look.
{: .note}

## Seeing what the compiler knows

In an editor running Eliot's language server, hovering an `Int` expression can show its range next to
its type, when the compiler pinned one bounded at both ends. That is the quickest way to answer
*"why does this not fit?"*: hover the argument, and see what the compiler thinks it is.

Next: [Preconditions]({{ '/docs/preconditions/' | relative_url }}), where you write a demand of your own.
