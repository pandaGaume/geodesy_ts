# Releasing @spacexr/geodesy

Releases are published to npm by the `release` GitHub Actions workflow when a `v*` tag is pushed. The workflow uses npm trusted publishing (OIDC) and attaches provenance, so no npm token is stored in the repository.

## One-time setup

npm trusted publishing is configured per package, so the package must exist on the registry before a trusted publisher can be attached to it.

1. Make sure the `@spacexr` scope exists on npmjs.com and that your npm account can publish to it.
2. Perform the very first publication manually from a clean `main` checkout:

    ```bash
    npm ci
    npm run check
    npm login
    npm publish --access public
    ```

    `prepublishOnly` runs `npm run check` again. Provenance is only available from CI, so this first manual publication has none.

3. On npmjs.com, open the package settings of `@spacexr/geodesy`, add a trusted publisher of type GitHub Actions with:
    - organization or user: `pandaGaume`
    - repository: `geodesy_ts`
    - workflow filename: `release.yml`
4. Optionally, in the same settings page, require two-factor authentication and disallow tokens so that only the workflow can publish.

If the first version was published manually, still push its `v0.1.0` tag so the GitHub release exists. The workflow will fail at `npm publish` because the version already exists; that failure is expected for this single tag only.

## Regular release

1. Move the `[Unreleased]` entries of `CHANGELOG.md` under a new version heading.
2. Bump the version without creating a tag yet, then commit:

    ```bash
    npm version patch --no-git-tag-version
    git commit -am "chore(release): v0.1.1"
    ```

3. Create an annotated tag and push the commit and the tag separately. `git push --follow-tags` ignores lightweight tags.

    ```bash
    git tag -a v0.1.1 -m "v0.1.1"
    git push origin main
    git push origin v0.1.1
    ```

4. Watch the `release` workflow. It verifies that the tag equals `v` plus the `package.json` version, runs `npm run check`, publishes with provenance and creates the GitHub release.

## Consumers in this organization

`3d-tiles-core` bootstraps this package from `node/vendor/spacexr-geodesy-<version>.tgz`. Once a version is available on npm, replace the vendored archive with the registry version in `3d-tiles-core/node/package.json` and refresh its lockfile.
