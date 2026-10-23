---
title: "Meta-information: what the compiler knows"
nav_title: What the compiler knows
order: 15
part: Meta-information
summary: Why Eliot tracks facts about values that their types leave out — an integer's range, a string's length, a list's size — and what that buys you, at zero runtime cost.
---

A type tells the compiler what *kind* of value something is: an integer, a string. **Meta-information**
tells it what is *known* about one particular value: that this integer is between 0 and 255, that this
string is at most 16 characters long. Eliot works it out for you, checks it where it matters, lets you
say more where you know more, and none of it exists at runtime.
{: .docs-lead}

This part of the guide introduces an idea most programmers have not met in a language before, so it
starts slowly. This chapter is the *why*: the problem meta-information solves, what it is, and how to
think about it. The chapters after it show what the compiler follows, how to demand a fact, how to
state a fact the compiler cannot work out, how to build refined types and kinds of meta-information
of your own, and finally what is under the hood.

## A problem every embedded programmer knows

A microcontroller dims an LED through a PWM register that takes a duty cycle from 0 to 255. You
write a function for it, `setDuty(level)`. What type should `level` have?

- **A fixed-width type** — `uint8_t` in C. The type now says how the value is *stored*, which
  happens to be 8 bits. `setDuty(300)` still compiles: the 300 is silently cut down to 44, and the
  LED is dim when you asked for bright. And every computation you feed it has to be thought about in
  bits: does `percent * 2 + 55` fit, or does it wrap around?
- **A wide type and a runtime check** — an `int`, and an `if` at the top of `setDuty` that throws on
  a bad value. The mistake is caught, but *at runtime*: perhaps on a device already in the field,
  and every call pays for the check, even the thousand calls that pass a constant.
- **A dedicated type** — a `DutyCycle` class whose constructor checks the range. Safer, but it is the
  runtime check again, moved into a constructor, plus a type to convert to and from at every boundary.

Each choice trades a silent wrong value, a runtime cost, or bookkeeping. And each one answers
the question in the *type* — the one place that cannot say "this particular value is 128".

## Often, the answer is already in the program

Look at two calls:

```eliot
setDuty(128)
setDuty(percent * 2 + 55)    // where percent is somewhere between 0 and 100
```

Nobody needs to run the first to see that 128 fits. The second takes a moment of arithmetic: twice
something between 0 and 100 is between 0 and 200, plus 55 is between 55 and 255. That fits too. The
answer was in the program text all along. Nothing had to run.

Eliot's compiler does that arithmetic for you, for every value in the program.

## Meta-information

Alongside each value's type, the compiler keeps a compile-time summary of what is known about that
value. That summary is its **meta-information**, or **meta** for short. Which summary a type gets is
part of its declaration. These are the ones in the standard library today:

```eliot
type Int {range: Interval[BigInteger]}
type String {length: Interval[BigInteger]}
type List[A] {size: Interval[BigInteger], item: Reach[MetaOf[A]]}
```

The braces after the type's name declare its **meta slots**: what the compiler tracks about every
value of the type, and as what. Read the first line as *"an `Int` is an integer, and about every `Int`
the compiler knows a `range`: an interval of whole numbers it is guaranteed to lie in."* A `String`
gets a `length`: the interval its length, in characters, lies in. A `List` gets two: its `size`, how
many items it has, and its `item`, what is known about every one of those items.

Here is what the compiler knows about a few expressions:

| Expression | Type | Meta |
|---|---|---|
| `7` | `Int` | range `7..7` |
| `7 + 3` | `Int` | range `10..10` |
| `percent * 2 + 55`, with `percent` in `0..100` | `Int` | range `55..255` |
| `"Eliot"` | `String` | length `5..5` |
| `"Hi " ++ name`, with `name` 0 to 16 characters long | `String` | length `3..19` |
| `append(append(empty, 3), 7)` | `List[Int]` | size `2..2`, every item in `3..7` |

Three things meta-information is **not**:

- **It is not part of the type.** An `Int` known to be `0..7` and an `Int` known to be `0..255` have
  the same type, `Int`. You never write `Int[0, 255]`, and a function that takes an `Int` takes every
  `Int`. Generics, abilities and type errors work exactly as they would without it.
- **It is not stored at runtime.** A meta costs no bytes and no instructions. It exists only inside the
  compiler, and is gone by the time code is generated.
- **It is not something you have to write.** The compiler derives almost all of it. You write a meta
  down where you want to *demand* something of it, and where you know something the compiler cannot
  work out. Both are optional.

## A shadow run of your program

Here is a useful way to picture it. Besides checking types, the compiler runs a second, simplified
copy of your program at compile time. In that copy, every value is replaced by what is known about
it:

| Where the real program… | …the shadow run |
|---|---|
| holds the number `3` | holds the range `3..3` |
| adds `3` and `4` | adds `3..3` and `4..4`, getting `7..7` |
| adds a number from `0..100` to itself | gets `0..200` |
| takes one of two branches, chosen at runtime | cannot know which, so covers both: `20..200` |
| puts a `200` into a `data` value and takes it out again | gets `200..200` back |
| calls your function | runs your function, on the metas of the arguments |

Specialists call this *abstract interpretation*. You don't need the term; *shadow run* is enough to
predict what the compiler knows.

Most languages could not do this for a whole program, and Eliot can for two reasons you have already
met:

- **No recursion, no loops in your code.** Eliot code is [total by default]({{ '/docs/totality/' |
  relative_url }}): every call chain is finite. So the shadow run always finishes, and the compiler
  never has to give up because it might run forever. The loops that do exist live inside platform
  primitives (a `foldLeft`, `forever`), and each of them says what it does to metas.
- **The whole program is compiled from `main`.** The shadow run starts at `main`, where everything is
  a literal or something the platform hands in, and follows each call with that call's own
  arguments. So **a function does not have one range; each call has its own.** If
  `def double(x: Int): Int = x + x`, then `double(60)` is `120..120` and `double(5)` is `10..10`,
  with no annotation on `double` at all.

## What it buys you

**One integer type.** There is no `Int8`, `UInt16` or `Int64` to pick between. Every integer is an
`Int`, and arithmetic never wraps around: a range simply grows to cover the result. The backend
chooses how to store each value from what it knows about it, so a value known to fit a byte can be
a byte, while your code says `Int` everywhere. [Integers and ranges]({{ '/docs/integers-and-ranges/' |
relative_url }}) showed this side.

**Preconditions proven at compile time.** A function can demand that its argument provably fits:

```eliot
def setDuty(level: Int {closed(0, 255)}): Int = level
```

`setDuty(300)` is now a compile error, reported at the call. `setDuty(128)` compiles, and costs nothing
at runtime: no check is generated, because there is nothing left to check. A runtime check is a
question asked of every value; a precondition is a question the compiler has already answered.

**Contracts that travel through libraries.** The standard library says what its primitives do to
metas: `++` adds the lengths of two strings, `length` turns a string's length into an `Int`'s range,
`toUpperCase` may make a string up to three times longer (because `ß` becomes `SS`). So a
precondition about a 16-character display can be met by a string your program builds, and the
compiler checks it through every function on the way.

**Your knowledge, where the compiler's runs out.** The compiler does arithmetic; it does not reason
about what a condition means. After `if(n > 0) n`, it still thinks the result is whatever `n` was.
You know it is positive, so you can say so, with a brace on the function's result:

```eliot
def requirePositive(n: Int) uses Abort: Int {atLeast(1)} = if(n > 0) n
```

That is how a number read at runtime becomes one a precondition accepts.
[Refining a result]({{ '/docs/refining/' | relative_url }}) shows how, and what it costs: the
compiler takes your word for it.

**Facts of your own.** Range, length and size are only the kinds the standard library declares. A
program can declare a kind of its own on its own `data` types, such as whether a temperature is
above freezing, and the compiler follows it and checks it exactly like a range.

> **It never guesses.** When the compiler cannot work out a meta precisely enough, a demand on it
> fails to compile. It is never silently assumed to hold. The
> [next chapter]({{ '/docs/following-values/' | relative_url }}) is honest about where that happens today.
{: .note}

## The words this part uses

- **Meta-information**, or **meta**: what the compiler knows about a value, beyond its type.
- **Slot**: one named piece of a type's meta, like `range` or `length`.
- **Derived**: a meta the compiler computes from code. Almost every meta is derived.
- **Stated**: a meta written down in braces after a function's result. A platform primitive must state
  its result's meta, because it has no Eliot body to derive one from. Any other function *may*, which
  **refines** its result: the stated meta replaces the derived one.
- **Demand**: a requirement on a meta, a `where` or a brace on a parameter or a field, checked at
  every call.
- **Domain**: a kind of meta-information, such as a range, and the rules for combining it.

## What comes next

1. [How the compiler follows a value]({{ '/docs/following-values/' | relative_url }}): what it derives
   through arithmetic, functions, branches, data, strings and lists, and where it stops.
2. [Preconditions]({{ '/docs/preconditions/' | relative_url }}): demanding a fact with `where` and
   parameter braces, and reading the errors.
3. [Refining a result]({{ '/docs/refining/' | relative_url }}): stating what you know about what a
   function returns, and why the compiler trusts it.
4. [Refined types of your own]({{ '/docs/refined-types/' | relative_url }}): named bounds, predicates,
   and `data` whose fields carry a guarantee.
5. [Meta-information of your own]({{ '/docs/custom-metas/' | relative_url }}): a new kind of fact,
   declared on your own `data` type.
6. [Under the hood]({{ '/docs/meta-domains/' | relative_url }}): how a type gets meta-information, the
   `Meta` ability, and how a platform states what its primitives do.
