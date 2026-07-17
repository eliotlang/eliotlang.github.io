---
title: Values and functions
nav_title: Values & functions
order: 3
part: Core language
summary: The def declaration, mandatory return types, arguments, currying, and how names resolve.
---

`def` is the declaration you'll write more than any other. It introduces a **named value** — a
constant, a function, the entry point, a helper. This chapter covers its shape and the small set of
rules that go with it.
{: .docs-lead}

## A def is a named value

The simplest `def` binds a name to a value:

```eliot
def greeting: String = "Hello World!"
```

Read it as: *the name `greeting`, of type `String`, is `"Hello World!"`.* There are three parts,
and two of them are non-negotiable.

- The **name** (`greeting`) — lowercase to start. Uppercase names are reserved for types and
  constructors, which you'll meet soon.
- The **return type** (`: String`) — **mandatory on every `def`**. Eliot never guesses the type of a
  top-level definition; you always write it.
- The **body** (`= "Hello World!"`) — the value itself. This part is *optional*; a `def` with no
  body is an **abstract declaration**, a promise that some other layer will supply the value. You'll
  see why that's useful in [Layers]({{ '/docs/layers/' | relative_url }}). In everyday code your
  defs have bodies.

## Adding arguments

A `def` with an argument list is what most languages call a function:

```eliot
def double(x: Int): Int = x + x

def label(name: String): String = name
```

Each argument is `name: Type`, and the return type still comes after the list. The argument list is
itself optional — `greeting` above simply has none, which is why it reads as a plain constant rather
than a function.

> **Return types can often be *calculated*.** For `double`, you could also let the compiler work out
> the exact result range from the body. We'll cover that in
> [Integers & ranges]({{ '/docs/integers-and-ranges/' | relative_url }}); for now, writing the type
> out is always fine.
{: .note}

## Everything is curried

This is the one idea about functions that shapes how Eliot code is written. A multi-argument
function is really a chain of single-argument functions. Given:

```eliot
def add(a: Int, b: Int): Int = a + b
```

the type of `add` is `Int => Int => Int` — "a function that takes an `Int` and returns *a function*
that takes an `Int` and returns an `Int`". The arrow `=>` is the **function type**, and it is
right-associative, so `Int => Int => Int` means `Int => (Int => Int)`.

The practical consequence is **partial application**: supplying some arguments now and the rest
later.

```eliot
def add(a: Int, b: Int): Int = a + b

def addFive: Int => Int = add(5)      // supply one argument; get back a function
```

`add(5)` is a perfectly good value of type `Int => Int`. You'll use this constantly once you meet
the dot operator and higher-order functions — passing `add(5)` where a one-argument function is
expected is cleaner than writing a lambda that just shuffles arguments.

## Calling functions

A call puts the arguments in parentheses **immediately** after the name — no space:

```eliot
double(21)
add(2, 3)
add(2)(3)        // the same call, made one argument at a time (currying)
```

That adjacency matters. `double(21)` is a call; `double (21)` (with a space) is two separate things
sitting next to each other. You rarely need the spaced form, but it exists for a reason we'll see
with infix operators.

## Abstract defs and privacy

Two modifiers round out the picture. A `def` with **no body** is abstract:

```eliot
def readLine: String       // no body: some platform layer provides the actual value
```

And `private` keeps a definition visible only within its own module:

```eliot
private def secretHelper: String = "internal"
```

The full shape of a `def`, with everything optional in brackets, is:

```eliot
[private] [fixity] def name[generics](args): ReturnType [= body]
```

You've now seen `name`, `args`, `ReturnType`, and `body`. The rest — generics and fixity (for
operators) — each get their own chapter. Next, we look at what goes on the *body* side
when a value takes more than one line: blocks.
