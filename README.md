# eliotlang.github.io

The website for **Eliot** — the *Embedded Language for the Internet of Things*.
A functional, generic programming language for microcontrollers. The compiler
lives at [robertbraeutigam/eliot](https://github.com/robertbraeutigam/eliot).

This is a [GitHub Pages](https://pages.github.com/) site built with Jekyll.

## Structure

```
_config.yml              Site configuration
_layouts/default.html    Page shell (head, nav, footer)
_includes/               nav.html, footer.html
index.html               The landing page (all sections)
assets/css/eliot.css     Brand stylesheet (design tokens + sections)
assets/js/site.js        Example tabs + copy buttons (no dependencies)
assets/img/              Brand SVGs (wordmark, mark, favicon)
```

The visual design follows the **Eliot Design System** (colors, type,
spacing, effects) maintained in Claude Design. All code samples on the page are
real Eliot programs taken from the compiler's `examples/src/*.els` suite.

## Local development

```sh
bundle install
bundle exec jekyll serve
# open http://localhost:4000
```

## Status

Eliot is pre-release (alpha, in active development). The site says so plainly:
primary calls to action point at the examples and the source, and the "Build"
section shows how to build and run from source on the JVM today.
