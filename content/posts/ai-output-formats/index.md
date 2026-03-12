---
title: "Serving Content for Both Humans and AI"
date: 2026-03-12
tags: ["ai", "hugo", "web"]
summary: "How this site serves the same content as HTML for humans, raw Markdown for AI bots, and a structured llms.txt index."
---

## The Problem

Most websites are built for human readers. But increasingly, AI systems — search engines, LLMs, research tools — need to read web content too. HTML is noisy for machines: navigation, styling, scripts, ads. What they really want is the clean content.

## The Solution: Multiple Output Formats

Hugo has a built-in feature called [Custom Output Formats](https://gohugo.io/templates/output-formats/) that lets you render the same content in multiple formats simultaneously. This site uses it to serve:

### HTML (for humans)

The default. You're reading it right now. Styled with the Blowfish theme, dark mode, table of contents, the works.

### Raw Markdown (for AI)

Every post is also available as raw Markdown by appending `index.md` to the URL:

```
https://subhash.net/posts/hello-world/          → HTML
https://subhash.net/posts/hello-world/index.md   → Markdown
```

This gives AI systems clean, structured text without any HTML noise. The Markdown includes frontmatter with title, date, and tags.

### llms.txt (site index for LLMs)

Following the emerging [llms.txt standard](https://llmstxt.org/), this site publishes a machine-readable index at:

```
https://subhash.net/llms.txt
```

It lists all posts with summaries and links to both the HTML and Markdown versions. LLM crawlers can read this single file to understand the entire site.

### JSON Feed (programmatic access)

A JSON feed is available at:

```
https://subhash.net/index.json
```

It follows the [JSON Feed](https://jsonfeed.org/) spec and includes titles, dates, summaries, tags, and full text content for each post.

## How It Works in Hugo

The key is defining custom output formats in `hugo.toml`:

```toml
[mediaTypes]
  [mediaTypes."text/llms"]
    suffixes = ["txt"]
  [mediaTypes."text/markdown"]
    suffixes = ["md"]

[outputFormats]
  [outputFormats.llms]
    mediaType = "text/llms"
    baseName = "llms"
    isPlainText = true
  [outputFormats.markdown]
    mediaType = "text/markdown"
    baseName = "index"
    isPlainText = true

[outputs]
  home = ["HTML", "RSS", "JSON", "llms"]
  page = ["HTML", "markdown"]
```

Then you create a template for each format. The Markdown template simply outputs the raw content with frontmatter. The llms.txt template iterates over all posts and builds the index.

Zero content duplication. One Markdown source file, multiple output formats.

## Why Bother?

1. **Better AI search results** — clean content means better indexing
2. **Future-proofing** — as AI agents browse the web, they'll prefer structured content
3. **Standards compliance** — llms.txt is gaining traction as a standard
4. **It's free** — Hugo does this at build time with no runtime cost
