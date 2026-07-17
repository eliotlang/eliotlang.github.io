---
title: Total by default
nav_title: Total by default
order: 15
part: Generics & types
stub: true
summary: Why user code cannot recurse or loop, and how to express repetition through eliminators and forever.
---

Eliot user code is **total by default**: it cannot recurse or loop. Every program is finite and
analyzable by construction — exactly what you want on hardware with no operating system to catch a
runaway.
{: .docs-lead}

> **This chapter is still being written.** Here's what it will cover, and where to look in the
> meantime.
{: .note}

## What this chapter will cover

- The **no-recursion rule**: any cycle among value bodies is rejected
  (*"Value 'X' is defined recursively."*), lambdas can't see themselves, and there is no `fix`.
- Expressing branching and iteration through the **eliminator family** — `fold`, `foldOption`,
  `foldEither`, `foldPair`, `match`, and container folds — instead of hand-written loops.
- **Recursive *types* are fine** in the covariant position (`data Tree(value: Int, left: Tree, right:
  Tree)`); it's recursive *values* that are forbidden. Negative recursion is rejected by strict
  positivity.
- **Unbounded loops** — the one controlled exception — live behind the `{Inf}` effect's
  `forever(step)`, used for server and firmware event loops, and covered in the Effects part.

## In the meantime

- Every `foldX` you've already met is the total substitute for a loop — see
  [Everyday types]({{ '/docs/everyday-types/' | relative_url }}).
- The `{Inf}` effect appears in the
  [effect catalogue]({{ '/docs/effect-catalogue/' | relative_url }}).
