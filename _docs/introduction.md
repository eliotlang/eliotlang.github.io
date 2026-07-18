---
title: Introduction
nav_title: Introduction
order: 1
part: Getting started
summary: What Eliot is, what makes it different, and what's stable enough to build on today.
---

Eliot is a functional, generic programming language for microcontrollers. It is designed
around one uncompromising goal: **correct, minimal, portable programs that fit on hardware with bytes
of RAM to spare** — with the proofs living in the compiler, not in boilerplate you write.
{: .docs-lead}

This guide teaches Eliot from the ground up. It assumes you can read code and have seen a
typed language before, but it does *not* assume you know Haskell, Scala, or effect systems.
Every idea is introduced with a small program you can compile and run.

## What makes Eliot different

A handful of design decisions shape everything else in the language. It is worth meeting them
up front — each one gets its own chapter later.

- **Write once, run on any target.** A program is written for *Eliot*, not for a specific chip.
  The same source compiles to whatever the backend targets — the JVM today, a bare-metal
  microcontroller next — with no per-board dialects, conditional compilation, or hand-rewriting.
  A platform-neutral core is merged with a thin *layer* that describes the hardware, so the code
  you write stays identical across every device.

- **One integer type, with ranges.** There is no `Int8`/`Int16`/`Int32` zoo. There is just
  `Int`, and a value's *range* rides along as meta-information the compiler tracks. Arithmetic
  grows the range instead of overflowing, and a `where` precondition can *prove* a value fits a
  byte — checked at every call site, at zero runtime cost.

- **Effects live in the signature.** What a function may do — print, fail, read state, use a
  dependency — is an unordered set written in its type: `{Console, State[String], Throw[E]}`.
  The compiler enforces that a function performs only the effects it declares, yet you write the
  code in ordinary **direct style**, with no monad transformers or hand-written `flatMap`.

- **Total by default.** User code cannot loop or recurse. Every repetition goes through an
  eliminator (`fold`, `match`) or a controlled `forever`. Programs are finite and analyzable by
  construction — which is exactly what you want when the target has no operating system to fall
  back on.

- **Small by construction.** Generics and abilities resolve by whole-program monomorphization and
  dead-code elimination. The compiler emits exactly the machinery your program uses — nothing
  general-purpose you didn't ask for.

## What you get from all this

The payoff is a language that reads like a modern, high-level functional language but compiles to
something small and predictable. You describe *what* is true — this value fits a byte, this
function may only touch the console, these two effects compose in this order — and the compiler
turns those facts into a program with no runtime overhead paying for them.

## What's stable today

Eliot is **pre-release (alpha, in active development)**. Being honest about that matters, so here
is the state of play:

- The compiler **builds and runs your programs on the JVM today**. Everything in the "Core
  language", "Generics & types", and "Effects" parts of this guide compiles and runs right now.
- The **native microcontroller backend** — the reason the language exists — is still in active
  development. You can follow along on the JVM in the meantime; the language you learn is the same.
- A few advanced corners are still settling (for example, some effect combinations). Where that
  affects what you can write today, the guide says so plainly.

Chapters marked *soon* in the sidebar are outlined but not yet written — they show where the guide
is heading.

> The compiler, the standard library, and every example in this guide live in the
> [Eliot repository]({{ site.github_repo }}). If a program here looks interesting, you can find
> it under `examples/src/` and run it yourself.
{: .note}

Ready? The next chapter gets Eliot building on your machine and runs your first program.
