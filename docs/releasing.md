# Release process

StampHelper uses signed commits, signed annotated tags, GitHub Releases, and a GitHub Packages npm source distribution.

## Prepare

1. Update `package.json` and `CHANGELOG.md` with the same semantic version.
2. Run:

   ```bash
   npm ci
   npm run lint
   npm audit
   npm test
   npm run pack:inspect
   npm run release:verify -- vX.Y.Z
   ```

3. Inspect the npm file list and the staged Pages directory for secrets, source maps, temporary files, or private data.
4. Build the Pages ZIP from the exact contents of `dist/cloudflare-pages/` and generate `SHA256SUMS.txt`.

## Sign and push

```bash
git commit -S -m "Release vX.Y.Z"
git verify-commit HEAD
git tag -s vX.Y.Z -m "StampHelper vX.Y.Z"
git verify-tag vX.Y.Z
git push origin main
git push origin vX.Y.Z
```

The authentication key used for transport and the signing key used for commits/tags should be separate. Never commit either key or a machine-specific key path.

## Publish

Create a GitHub Release from the signed tag and attach:

- `stamphelper-cloudflare-pages-vX.Y.Z.zip`;
- `SHA256SUMS.txt`.

Publishing the release triggers `.github/workflows/publish-package.yml`, which verifies the tag/version match, reruns the quality gate, and publishes `@feierbuqiu/stamphelper@X.Y.Z` with the repository's `GITHUB_TOKEN`.

GitHub npm packages are initially private for personal accounts even when linked to a public repository. A maintainer must set the package visibility to public in Package settings after the first publication. GitHub's npm registry still requires authenticated clients to download public packages.

## Verify

- GitHub reports the release commit and annotated tag as verified.
- `origin/main`, the local `HEAD`, and the release target commit are identical.
- CI and the package workflow complete successfully.
- The release ZIP checksum matches the uploaded asset.
- The package page shows the intended version and repository link.
- A production smoke test confirms the Worker MIME type and background-thread solver.
