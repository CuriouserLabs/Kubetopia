<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# When upgrading Next.js: check the postcss override

`package.json` has an `overrides` entry forcing `postcss` to `^8.5.10`. It exists
only because `next@16.2.10` hard-pins `postcss` at the exact version `8.4.31`,
which is vulnerable to GHSA-qx2v-qp2m-jg93 (XSS via unescaped `</style>` in CSS
stringify output). An exact pin can't be moved by a Dependabot version-update PR,
so the override is the only way to patch it.

As of Next 16.3.0 (preview at time of writing) the pin moves to `8.5.10`, making
the override redundant. **On every Next upgrade, check:**

```bash
node -p "require('./node_modules/next/package.json').dependencies.postcss"
```

If that prints `8.5.10` or higher, delete the `overrides` block from
`package.json`, run `npm install`, and verify `npm ls postcss --all` still shows
a patched version everywhere.

Don't leave the override in place indefinitely: `^8.5.10` does not match `9.x`,
so once anything in the tree legitimately needs postcss 9, the override will
silently force it back to 8.x and produce a broken tree.
