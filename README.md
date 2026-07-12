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

Requires **Ruby 3.x** (Ruby 2.7 is EOL and won't run the toolchain). With a
healthy Ruby + Bundler:

```sh
bundle install
bundle exec jekyll serve            # → http://localhost:4000
```

The `github-pages` gem in the `Gemfile` mirrors the versions GitHub uses to
build the site remotely.

### If your default Ruby is a broken / too-old rbenv

Run Jekyll standalone under the system Ruby 3.3 in an isolated gem dir.
`JEKYLL_NO_BUNDLER_REQUIRE=1` tells Jekyll to ignore the `github-pages` Gemfile
locally (the site has no plugins, so the output is identical):

```sh
# one-time install
GEM_HOME=$HOME/.local/share/gem-eliot /usr/bin/gem3.3 install jekyll webrick

# build & serve
GD=$HOME/.local/share/gem-eliot
env GEM_HOME="$GD" JEKYLL_NO_BUNDLER_REQUIRE=1 /usr/bin/ruby3.3 "$GD/bin/jekyll" \
  serve --host 127.0.0.1 --port 4000     # → http://127.0.0.1:4000
# stop with: fuser -k 4000/tcp
```

## Status

Eliot is pre-release (alpha, in active development). The site says so plainly:
primary calls to action point at the examples and the source, and the "Build"
section shows how to build and run from source on the JVM today.
