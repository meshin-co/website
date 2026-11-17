# Change a dependency

Use this when you add, remove or upgrade anything in `site/package.json`, and when a CI job dies at `npm ci` with
`Missing: <package> from lock file`. The runner installs with Node 22 and the npm that ships with it. `site/package.json`
pins `"packageManager": "npm@10.9.4"` and `site/.nvmrc` pins Node 22, but that pin binds corepack only. A plain
`npm install` on a machine with a newer npm writes a lockfile the runner refuses, and nothing local notices, because the
npm that verifies a lockfile is the npm that wrote it. It broke every CI job on 2026-10-24 and again on 2026-11-12.

## 1. Run every dependency command under the pinned pair

Put Node 22 first on `PATH` (with nvm, `nvm use 22`) and run npm through npx, from `site/`:

    npx --yes npm@10.9.4 install <package>
    npx --yes npm@10.9.4 uninstall <package>

Never a bare `npm install`, `npm uninstall` or `npm update`, and never delete the lockfile to rebuild it.

## 2. Keep the diff to the dependency you changed

Start from the lockfile the branch inherited from `main` and let the pinned npm edit it. Dropping one package from `main`'s
lockfile changed 2 added and 218 removed lines (`git diff --numstat main 8028d5b -- site/package-lock.json`). The rebuilt
lockfile the runner refused differs from `main`'s by 224 added and 2696 removed (the same command with `07f520b`), and
the small diff is the one that shows what happened. If your diff is large, restore `main`'s lockfile with
`git checkout origin/main -- site/package-lock.json` and apply each dependency change of the branch again, one at a time.

## 3. Prove the lockfile under the pinned pair before you push

Copy the two files to an empty directory and have the pinned npm read them without installing anything:

    d=$(mktemp -d) && cp package.json package-lock.json "$d" && (cd "$d" && npx --yes npm@10.9.4 ci --dry-run --ignore-scripts)

It must exit 0, and it takes seconds. A refused lockfile exits 1 and prints `Missing: <package> from lock file`, 14 lines
for each of the lockfiles that broke CI. Measured on 2026-11-12, the lockfiles of `30e74c8` and `07f520b` exit 1 under
Node 22.22.2 with npm 10.9.4 and exit 0 under Node 26.8.1 with npm 11.19.0, and the lockfile of `main` exits 0 under both.
A pass under your own npm proves nothing.

## 4. If CI still says `Missing: ... from lock file`

You ran npm outside the pinned pair or edited the lockfile by hand. Go back to step 2 and redo the change; never patch the
file. No gate runs step 3 for you yet, and why is the row `G95` of `docs/plan/reference/known-gaps.md`.
