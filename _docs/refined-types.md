---
title: Refined types of your own
nav_title: Your own refined types
order: 18
part: Meta-information
summary: Building your own vocabulary on meta-information — named bounds, named predicates, and data types whose fields carry a guarantee every construction proves.
---

You cannot add a new kind of meta-information in an ordinary program; the
[next chapter]({{ '/docs/meta-domains/' | relative_url }}) explains why. But you can build a
vocabulary of your own on the kinds that exist: named bounds, named predicates, and `data` types
whose fields carry a guarantee. Those are your own **refined types**: a type plus a fact about its
values, which the compiler keeps true.
{: .docs-lead}

## Name your bounds

`closed(0, 255)` says what it means once. Written in ten signatures, it is better given a name. A
bound is an ordinary definition returning an `Interval`:

```eliot
def between[Lo: BigInteger, Hi: BigInteger]: Interval[BigInteger] = closed(Lo, Hi)

def byte: Interval[BigInteger] = between[0, 255]

def setDuty(level: Int {byte}): Int = level
```

`between` takes its numbers in brackets for the same reason `rangeWithin` does: an interval's ends
are compile-time numbers, and a number in brackets is one. In the body of an ordinary definition, a
number in parentheses is a runtime `Int`, and the two do not mix. With `between` defined once, you
never think about it again: `{byte}`, `{between[0, 100]}`.

## Name your predicates

A `where` predicate is a function from intervals to `Bool`, so it can be named for what it means
in your domain:

```eliot
def fitsDisplay(i: Interval[BigInteger]): Bool = rangeWithin[0, 16](i)

def banner(text: String) where fitsDisplay(size(text)): String = text
def column(position: Int) where fitsDisplay(range(position)): Int = position
```

One predicate serves a string's size and an integer's range alike, since both are intervals. A
signature then reads as the requirement it is: *"the text fits the display"*.

## A type that carries a guarantee

A brace after a **`data` field's** type states what every value in that field satisfies:

```eliot
data Percent(value: Int {between[0, 100]})
```

That one line gives you two things.

**Every construction proves it.** Building a `Percent` is a call to its constructor, and a field is
the constructor's parameter, so the brace is checked like any parameter brace:

```eliot
Percent(40)    // compiles
Percent(140)   // does not compile
```

```text
error: The argument's meta-information Int$Meta(Interval(Bounded(140), Bounded(140))) does not fit Int$Meta(Interval(Bounded(0), Bounded(100))), which the parameter 'value' of 'Probe::Percent' states.
```

**Every read knows it.** Reading the field, through `p.value` or a `match` arm, gives a value known
to lie in `0..100`, *wherever the `Percent` came from*: a parameter, a list, another module. So code
that takes a `Percent` can rely on it without knowing who made it:

```eliot
def toDuty(p: Percent): Int = p.value * 2 + 55    // 55..255, for every Percent there is
```

This is what a range type is in languages that have one, such as Ada's
`subtype Percent is Integer range 0 .. 100`, with one difference: the check happens entirely at
compile time. A running program never checks that a `Percent` is in range, because no program that
could build one out of range compiles.

Fields of any type with meta-information can carry one: `data Label(text: String {closed(0, 16)})`
is a string that fits the display.

## Keeping the guarantee

Since every construction is checked, a function returning a `Percent` must build one the compiler
can prove. Some operations keep the guarantee by their arithmetic alone:

```eliot
def inverse(p: Percent): Percent = Percent(100 - p.value)   // 100 - 0..100 is 0..100: compiles
```

Others do not, and the compiler says so:

```eliot
def brighter(p: Percent): Percent = Percent(p.value + 10)   // 10..110: does not compile
```

That is the guarantee doing its job: `brighter(Percent(95))` would be `105` percent. In most
languages the fix would be to cap the result, with `min(p.value + 10, 100)`. Today that does not
help: as the chapter on [following a value]({{ '/docs/following-values/' | relative_url }}#where-the-compiler-stops)
explains, a comparison does not narrow a range, so `min`'s result is still `10..110`. For now,
build refined values from values the compiler can bound, such as constants, other refined values
and arithmetic over them:

```eliot
data Brightness = Dim | Bright | Blinding

def preset(b: Brightness): Percent = b match {
   case Dim      -> Percent(10)
   case Bright   -> Percent(80)
   case Blinding -> Percent(100)
}
```

## Putting it together

Here is a small LED controller, written with the vocabulary of this chapter. It compiles, and every
duty cycle it sets is proven to fit the register, with no check at runtime:

```eliot
def between[Lo: BigInteger, Hi: BigInteger]: Interval[BigInteger] = closed(Lo, Hi)
def byte: Interval[BigInteger] = between[0, 255]

data Percent(value: Int {between[0, 100]})
data Brightness = Dim | Bright | Blinding

def preset(b: Brightness): Percent = b match {
   case Dim      -> Percent(10)
   case Bright   -> Percent(80)
   case Blinding -> Percent(100)
}

def inverse(p: Percent): Percent = Percent(100 - p.value)

def setDuty(level: Int {byte}) uses Console: Unit = printLine("duty " ++ show(level))

def dim(p: Percent) uses Console: Unit = setDuty(p.value * 2 + 55)

def main uses Console: Unit = {
   dim(Percent(0))
   dim(preset(Blinding))
   dim(inverse(Percent(30)))
}
```

It prints `duty 55`, `duty 255` and `duty 195`. Change `* 2 + 55` to `* 3`, and `dim` no longer
compiles, because three times `0..100` does not fit a byte.

A few habits make this work well:

- **Put the guarantee where the value is made.** A refined field is checked once, at construction,
  and relied on everywhere after. That is cheaper to think about than a brace on every function
  the value passes through.
- **Use a refined `data` for values that travel**, through lists, options and modules, where a
  plain `Int` would lose its range. Use a parameter brace for the last step, where the value is
  consumed.
- **Keep the arithmetic plain.** Each operand's range is followed on its own, so an expression that
  uses the same value twice comes out wider than you might expect.

A constructor with a braced field, like a function with a braced parameter, cannot be passed as a
value: `list.map(Percent)` is refused. Call it with its argument.

Next: [Under the hood]({{ '/docs/meta-domains/' | relative_url }}), where a type gets its
meta-information, and how you would add a new kind.
