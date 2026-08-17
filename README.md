# subhash.net

Source for [subhash.net](https://subhash.net), a Hugo site for independent technical writing by Subhash Dasyam.

## Publishing model

Git is the source of truth. New posts are written as Markdown page bundles under `content/posts/`. A production build creates HTML, a raw Markdown version of each post, RSS, JSON Feed, a search index, a sitemap, and `llms.txt` from the same source.

The complete pre-cleanup site is preserved by the `pre-fresh-start-2026-07-28` Git tag. It is not part of the active Hugo content tree.

## Create a post

```sh
hugo new content posts/my-post/index.md
```

Complete the title, description, tags, and article body. Keep `draft: true` until the post is ready. Every published post should contain original work and a clear explanation of what was tested, observed, or inferred.

Do not copy an article that remains published on another domain. If an article is intentionally moved later, handle its redirect and canonical URL as a separate migration.

## Build and validate

The project currently uses Hugo `0.165.0` extended.

```sh
hugo --gc --minify
node scripts/validate-site.mjs public
```

Pull requests run the same production build and validation before they can be merged. Pushes to `main` continue to deploy through GitHub Pages until the separate Cloudflare hosting change is ready.
