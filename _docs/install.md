---
title: Install and your first program
nav_title: Install & first program
order: 2
part: Getting started
summary: Clone the compiler, build the classic HelloWorld, and learn the shape of a runnable Eliot program.
---

Eliot compiles and runs on the JVM today. In this chapter you'll build the compiler from source,
run the classic one-liner, and learn the anatomy of a runnable program.
{: .docs-lead}

## Getting the compiler

Everything lives in one repository. You need a JVM (the build ships its own version pin) and
`git`. Clone it:

```
git clone https://github.com/robertbraeutigam/eliot
cd eliot
```

The build tool is [Mill](https://mill-build.org/), and the repo includes a `./mill` launcher, so
there's nothing else to install.

## Hello, World

Here is the whole program — it lives at `examples/src/HelloWorld.els`:

```eliot
import eliot.effect.Console

def main: {Console} Unit = printLine("Hello World!")
```

Build a runnable jar from it and run it:

```
./mill examples.run jvm exe-jar examples/src/ -m HelloWorld
java -jar target/HelloWorld.jar
```

You should see:

```
Hello World!
```

That `./mill examples.run jvm exe-jar examples/src/ -m HelloWorld` line is the command you'll use
throughout this guide, just changing the module name after `-m`. It reads: *compile the sources in
`examples/src/`, and produce an executable jar for the module named `HelloWorld`.*

## Anatomy of the program

Two lines, and every part is worth naming.

```eliot
import eliot.effect.Console

def main: {Console} Unit = printLine("Hello World!")
```

- **`import eliot.effect.Console`** brings in the `Console` effect — the capability to read and
  print lines. `printLine` comes from it. Almost everything in Eliot must be imported; only a
  handful of core names (like `Int`, `String`, `Unit`) are available without one. We'll cover
  imports properly in [Modules & imports]({{ '/docs/modules/' | relative_url }}).

- **`def main`** declares the program's entry point. `def` introduces a *named value* — the closest
  thing Eliot has to a "function" or a top-level binding. We'll unpack `def` in the very next
  chapter.

- **`: {Console} Unit`** is the return type, and it is **mandatory** on every `def`. `main` yields
  `Unit` (the "no interesting value" type, with a single value) — and the `{Console}` in braces
  declares that it *may use the console* along the way.

- **`= printLine("Hello World!")`** is the body. `printLine` takes a `String` and performs the
  `Console` effect to write it.

> **Why `{Console} Unit` and not just "print something"?** In Eliot, performing input/output is an
> *effect*, declared right in the type — and `main` is the one place where the platform finally
> runs the effects it declares. Everywhere else, effectful code stays abstract over how it runs —
> which is what makes it testable and portable. This is the heart of the
> [Effects]({{ '/docs/effects/' | relative_url }}) part; for now, just read `{Console} Unit` as
> "prints things, returns nothing interesting".
{: .note}

## One file is one module

Every `.els` file is a **module**, and its name comes from its path. Declarations inside a file may
appear in any order — `def main` could sit above or below its imports, and helper definitions can
come before or after the ones that use them. There is no top-to-bottom ordering requirement.

## Running the other examples

The compiler ships dozens of small programs under `examples/src/`, one per feature. Every example in
this guide is one of them, so whenever you want to poke at something, run it the same way:

```
./mill examples.run jvm exe-jar examples/src/ -m Effects
echo "hello effects" | java -jar target/Effects.jar
```

(Some programs read from standard input — that's what the `echo … |` pipe is for.)

With the toolchain working, you're ready to learn the language itself. Next: `def`, the one
declaration you'll write more than any other.
