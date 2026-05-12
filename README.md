cd ~/Development/biomes-game
nvm use
source .venv/bin/activate

python - <<'PY'
from pathlib import Path
from textwrap import dedent

readme = r'''
# Glitch Games: Biomes

This repository is a Glitch-maintained restoration of the open-source Biomes game codebase.

The original public Biomes data snapshot endpoint is no longer available:

https://static.biomes.gg/biomes_data_snapshot.tar.gz

Because of that, a normal upstream setup can fail during local development when it tries to download the original `biomes_data_snapshot.tar.gz`.

This fork adds a local development workflow that reconstructs enough of the snapshot structure from the available repository assets and Git LFS files to get the project building and running locally.

---

## What this repo is

This repo is:

- A fork/restoration of the open-source Biomes codebase.
- Prepared for local development after the original public snapshot server went offline.
- Intended for development, research, experimentation, and Glitch platform integration.
- Able to generate local static asset data from the checked-in `src/galois/data` files.
- Able to create a fake local data snapshot so the project can install a snapshot without the original production archive.

---

## What this repo is not

This repo is not:

- Connected to the original Biomes production backend.
- A full recovery of the original production world.
- A full recovery of the original production Bikkie tray.
- A full recovery of every historical item, NPC, wearable, sound, mesh, or live-service asset.
- A drop-in replacement for the original production Biomes infrastructure.

The goal is practical local development, not historical production restoration.

---

## Current local snapshot approach

The upstream project expected a data snapshot archive with this shape:

~~~text
biomes_data_snapshot.tar.gz
├── backup.json
└── buckets/
    ├── biomes-static/
    └── biomes-bikkie/
~~~

Since the original archive is unavailable, this fork creates a local replacement snapshot.

The local fake snapshot is built from:

- Git LFS assets under `src/galois/data`
- Generated static assets under `public/buckets/biomes-static`
- A fake local `backup.json`
- Test Bikkie biscuits generated from the repo's test helpers
- A patched snapshot flow that can skip the missing-asset validator for local development

This gets the repo past the dead public snapshot server and into a usable local development state.

---

## Prerequisites

Recommended development environment:

- macOS
- Homebrew
- Git
- Git LFS
- Node.js 20
- nvm
- Yarn
- Python 3.10
- Redis
- Google Cloud CLI only if testing old upstream GCP-authenticated paths

Install the common tools:

~~~bash
brew install git-lfs redis python@3.10 nvm
brew install --cask google-cloud-sdk
git lfs install
~~~

Start Redis:

~~~bash
brew services start redis
~~~

Check Redis:

~~~bash
redis-cli ping
~~~

Expected output:

~~~text
PONG
~~~

---

## Clone the repo

Clone this fork:

~~~bash
cd ~/Development
git clone git@github.com:Glitch-Gaming-Platform/Glitch-Games-Biomes.git
cd Glitch-Games-Biomes
~~~

Pull Git LFS assets:

~~~bash
git lfs pull
~~~

Verify LFS assets are present:

~~~bash
find src/galois/data -type f | head -20
find src/galois/data -type f -size -1k | head -20
~~~

The first command should show real files. The second command should not show a large number of tiny LFS pointer files. If many expected assets are only a few bytes, run `git lfs pull` again.

---

## Node setup

This repo uses Node 20.

Use nvm:

~~~bash
nvm use
~~~

If Node 20 is not installed:

~~~bash
nvm install 20
nvm use 20
~~~

Verify:

~~~bash
node -v
yarn -v
~~~

---

## Python setup

Create and activate a Python virtual environment:

~~~bash
python3.10 -m venv .venv
source .venv/bin/activate
python --version
~~~

Install Python dependencies:

~~~bash
python -m pip install --upgrade pip setuptools wheel
python -m pip install -r requirements.txt
~~~

This fork updates `typing_extensions` because the original pin was too old for newer `watchfiles`, `anyio`, and `exceptiongroup` combinations.

Verify the important imports:

~~~bash
python - <<'PY'
import typing_extensions
from typing_extensions import TypeVar
import watchfiles
import anyio
import exceptiongroup

print("typing_extensions:", typing_extensions.__file__)
print("TypeVar import OK")
print("watchfiles import OK")
PY
~~~

---

## Install JavaScript dependencies

Install packages:

~~~bash
yarn install --frozen-lockfile
~~~

If the lockfile is stale during active development, use:

~~~bash
yarn install
~~~

Prefer `--frozen-lockfile` for reproducible setup.

---

## Build TypeScript dependencies

The upstream Dockerfile expects `src/gen` to already exist before building the server.

Generate TypeScript/Bazel dependencies:

~~~bash
./b ts-deps build
~~~

Verify:

~~~bash
test -d src/gen && echo "src/gen exists"
~~~

---

## Generate local static assets

The original Biomes project expected static assets from the unavailable snapshot server. This fork can regenerate a large set of local static assets from `src/galois/data`.

Run:

~~~bash
./b script extract_assets public/buckets
~~~

This should generate files under:

~~~text
public/buckets/biomes-static
~~~

Verify:

~~~bash
du -sh public/buckets/biomes-static
find public/buckets/biomes-static -type f | head -50
~~~

A successful local generation is usually around 100MB or more. For example:

~~~text
148M public/buckets/biomes-static
~~~

During generation, you may see messages like:

~~~text
WARNING: uploadToBucket called with local disk enabled.
Published asset_data/... to remote asset storage...
~~~

For this local setup, those messages mean the project is writing into the local bucket directory, not the original production bucket.

---

## Create a fake local snapshot

After static assets exist, create a local fake snapshot:

~~~bash
./b script create_local_fake_snapshot /tmp/fake-biomes-snapshot
~~~

Verify the generated snapshot folder:

~~~bash
find /tmp/fake-biomes-snapshot -maxdepth 3 -type d | head -50
find /tmp/fake-biomes-snapshot -maxdepth 3 -type f | head -50
~~~

Package it:

~~~bash
rm -f /tmp/biomes_data_snapshot.tar.gz
tar -czf /tmp/biomes_data_snapshot.tar.gz -C /tmp/fake-biomes-snapshot .
~~~

Verify the archive:

~~~bash
file /tmp/biomes_data_snapshot.tar.gz
tar -tzf /tmp/biomes_data_snapshot.tar.gz | head -50
~~~

You should see:

~~~text
./
./buckets/
./backup.json
./buckets/biomes-static/
./buckets/biomes-bikkie/
~~~

---

## Install the local snapshot

Remove any old installed snapshot:

~~~bash
./b data-snapshot uninstall
~~~

Install the local fake snapshot:

~~~bash
./b data-snapshot install-from-file /tmp/biomes_data_snapshot.tar.gz
~~~

Verify:

~~~bash
ls -lh snapshot_backup.json
du -sh public/buckets/biomes-static
du -sh public/buckets/biomes-bikkie
~~~

Expected:

- `snapshot_backup.json` exists
- `public/buckets/biomes-static` exists and has generated assets
- `public/buckets/biomes-bikkie` may be empty in this local fake setup

---

## Run the local snapshot flow

Use:

~~~bash
SKIP_PROD_LOAD=true ./b data-snapshot run --no-pip-install
~~~

This fork supports skipping production loading paths for local development.

The upstream missing-asset validator may report many missing assets because this fake snapshot does not restore the full production asset set. That is expected for the local restoration path.

The important point is that the project is no longer blocked by the dead public snapshot URL.

---

## Common issue: original snapshot URL returns HTML or fails TLS

If you try to download:

~~~bash
curl -L -o /tmp/biomes_data_snapshot.tar.gz https://static.biomes.gg/biomes_data_snapshot.tar.gz
~~~

You may get an HTML login page, TLS errors, or an invalid archive.

Symptoms:

~~~text
tar: Error opening archive: Unrecognized archive format
~~~

Or:

~~~text
HTML document text
~~~

That means the downloaded file is not the snapshot. Use the local fake snapshot workflow instead.

---

## Common issue: Google Cloud auth errors

Some old upstream scripts try to access Google Cloud resources, Secret Manager, or production Bikkie data.

You may see errors like:

~~~text
Could not load gcloud config
Unknown Employee Account
Permission denied on resource project zones-cloud
~~~

For local development, avoid production-loading paths and use:

~~~bash
SKIP_PROD_LOAD=true
~~~

The local fake snapshot path is designed to avoid needing the original production GCP access.

---

## Common issue: zsh says command not found for comments

Some terminals may treat pasted comment lines as commands.

For example:

~~~text
zsh: command not found: #
~~~

That is not a project error. It means a pasted line beginning with `#` was executed instead of treated as a comment.

To avoid that, copy commands without comment lines.

---

## Common issue: Git LFS pull fails in an empty repo

If you clone a brand-new empty GitHub repo and run:

~~~bash
git lfs pull
~~~

It may fail because there are no commits and no LFS pointer files yet.

Push the forked code first, then clone fresh and run:

~~~bash
git lfs pull
~~~

---

## Useful development commands

Check repo state:

~~~bash
git status --short
git branch --show-current
git remote -v
~~~

Check Node:

~~~bash
nvm use
node -v
yarn -v
~~~

Check Python:

~~~bash
source .venv/bin/activate
python --version
python -m pip --version
~~~

Check generated assets:

~~~bash
du -sh public/buckets/biomes-static
find public/buckets/biomes-static -type f | head -50
~~~

Check snapshot archive:

~~~bash
tar -tzf /tmp/biomes_data_snapshot.tar.gz | head -50
~~~

---

## Build server

Generate dependencies first:

~~~bash
./b ts-deps build
~~~

Then build the server:

~~~bash
./b --no-check-ts-deps build server
~~~

The upstream Dockerfile also expects generated files to exist before server build.

---

## Docker notes

The upstream Dockerfile copies these paths early because they change slowly:

~~~text
public/
src/galois/data/
~~~

It also expects:

~~~text
src/gen
~~~

to already exist.

Before Docker builds, run:

~~~bash
./b ts-deps build
~~~

Then confirm:

~~~bash
test -d src/gen && echo "src/gen exists"
~~~

The Docker image includes:

- Ubuntu 22.04
- Bazel 6.0.0
- Node 20
- Yarn
- Python
- Git LFS
- Google Cloud SDK
- Docker credential helper for GCR

The original Dockerfile still contains some upstream cloud assumptions. For fully local development, prefer the local setup steps first.

---

## Known limitations

This restoration currently has these limitations:

- The full original production snapshot is not included.
- The fake Bikkie backup is generated from test biscuits.
- Some assets may still be missing.
- Some old upstream scripts still assume access to original GCP resources.
- Some production services are not available.
- Some gameplay systems may need further restoration work.
- The local snapshot is enough to unblock development, but it is not the original Biomes live-service state.

---

## Recommended fresh setup order

For a brand-new machine, use this order:

~~~bash
cd ~/Development
git clone git@github.com:Glitch-Gaming-Platform/Glitch-Games-Biomes.git
cd Glitch-Games-Biomes
git lfs pull
nvm install 20
nvm use
python3.10 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip setuptools wheel
python -m pip install -r requirements.txt
yarn install --frozen-lockfile
./b ts-deps build
./b script extract_assets public/buckets
./b script create_local_fake_snapshot /tmp/fake-biomes-snapshot
rm -f /tmp/biomes_data_snapshot.tar.gz
tar -czf /tmp/biomes_data_snapshot.tar.gz -C /tmp/fake-biomes-snapshot .
./b data-snapshot uninstall
./b data-snapshot install-from-file /tmp/biomes_data_snapshot.tar.gz
SKIP_PROD_LOAD=true ./b data-snapshot run --no-pip-install
~~~

---

## Upstream

Original upstream project:

https://github.com/ill-inc/biomes-game

This fork keeps the upstream remote as:

~~~bash
upstream https://github.com/ill-inc/biomes-game.git
~~~

The Glitch fork remote should be:

~~~bash
origin git@github.com:Glitch-Gaming-Platform/Glitch-Games-Biomes.git
~~~
'''

Path("README.md").write_text(dedent(readme).lstrip(), encoding="utf-8")
print("README.md updated")
PY

git status --short
git add README.md
git commit -m "Document local Biomes setup"
git push
