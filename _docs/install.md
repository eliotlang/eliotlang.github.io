---
title: Install and your first program
nav_title: Install & first program
order: 2
part: Getting started
summary: Download the eliotw wrapper, describe your project in one small file, and build and run the classic HelloWorld.
---

There's nothing to install. An Eliot project carries a small wrapper script, `eliotw`, that fetches
the right build tool, compiler and standard library the first time you build. In this chapter you'll
set up a project, run the classic one-liner, and learn the anatomy of a runnable program.
{: .docs-lead}

## What you need

- **Java 21** or later. Eliot compiles to the JVM today, and the build tool runs on it too.
- **`git`**, plus **`curl`** (or `wget`) and **`unzip`**. Almost every Linux and macOS machine already
  has these.
- A POSIX shell. On Windows, use WSL or Git Bash.

## A project in three files

Make a directory for your project and download the wrapper into it:

```
mkdir hello && cd hello
curl -fsSLo eliotw https://raw.githubusercontent.com/eliotlang/eliot-build/v0/eliotw
chmod +x eliotw
```

The wrapper is the same file in every Eliot project. Commit it with your code, and anyone who clones
the project can build it.

Next, describe the project in a file called `eliot.pkg`, next to the wrapper:

```
launcher v0.6

package hello {
  at .
  dep github.com/eliotlang/eliot//jvm v0.7
  compiler run -m HelloWorld
}
```

Line by line:

- **`launcher v0.6`** is the version of the build tool `eliotw` downloads.
- **`package hello { … }`** declares a package. Its name is what you pass to `./eliotw`.
- **`at .`** puts the package in the project directory, so its sources go in `src/`.
- **`dep …//jvm v0.7`** depends on Eliot's JVM platform at version `v0.7`. That brings in the
  standard library and the compiler too.
- **`compiler run -m HelloWorld`** is what a build does: compile the module `HelloWorld`, then run it.

## Hello, World

Here is the whole program. Save it as `src/HelloWorld.els`:

```eliot
def main uses Console: Unit = printLine("Hello World!")
```

Build it and run it:

```
./eliotw hello
```

The first build downloads the build tool, the compiler and the standard library, so it takes a little
while. Later builds use the cached copies. While it compiles you'll see progress lines, and then:

```
Hello World!
```

That `./eliotw hello` command is the one you'll use throughout this guide. The build also leaves an
executable jar in `target/`, which you can run without the build tool:

```
java -jar target/HelloWorld.jar
```

## Anatomy of the program

Two lines, and every part is worth naming.

```eliot
def main uses Console: Unit = printLine("Hello World!")
```

- **`printLine`** comes from the `Console` *effect*. Core names (the `eliot.lang` basics like
  `Int`, `String`, `Unit`, and the whole `eliot.effect` vocabulary) are always in scope. Everything
  else is imported explicitly. We'll cover imports properly in
  [Modules & imports]({{ '/docs/modules/' | relative_url }}).

- **`def main`** declares the program's entry point. `def` introduces a *named value*, the closest
  thing Eliot has to a "function" or a top-level binding. We'll unpack `def` in the next chapter.

- **`uses Console`** declares that `main` *uses the console* along the way. A function lists the
  effects it uses in a `uses` clause like this one, before the colon.

- **`: Unit`** is the return type, and it is **mandatory** on every `def`. `main` yields `Unit` (the
  "no interesting value" type, with a single value).

- **`= printLine("Hello World!")`** is the body. `printLine` takes a `String` and performs the
  `Console` effect to write it.

> **Why `uses Console` and not just "print something"?** In Eliot, performing input/output is an
> *effect*, declared right in the signature. `main` is the one place where the platform finally runs the
> effects it declares. Everywhere else, effectful code stays abstract over how it runs, which is what
> makes it testable and portable. This is the heart of the
> [Effects]({{ '/docs/effects/' | relative_url }}) part. For now, read `uses Console: Unit` as "prints
> things, returns nothing interesting".
{: .note}

## One file is one module

Every `.els` file is a **module**, and its name comes from its path under `src/`:
`src/HelloWorld.els` is the module `HelloWorld`, and `src/app/Greeter.els` would be `app.Greeter`.
Declarations inside a file may appear in any order. `def main` could sit above or below its imports,
and helper definitions can come before or after the ones that use them.

## Running the other examples

Every program in this guide is one of the
[compiler's examples]({{ site.github_repo }}/tree/master/examples/src). To try one, save it under
`src/` and point the `compiler` line at its module:

```
  compiler run -m Effects
```

Then build as before. Some programs read from standard input, so pipe something in:

```
echo "hello effects" | ./eliotw hello
```

With the toolchain working, you're ready to learn the language itself. Next: `def`, the one
declaration you'll write more than any other.
