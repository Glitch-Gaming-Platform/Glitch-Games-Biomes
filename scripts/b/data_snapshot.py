import hashlib
import json
import os
import shutil
import subprocess
import tempfile
import time
from functools import update_wrapper
from pathlib import Path

import b
import click
from pip_install_voxeloo import (run_pip_install_requirements,
                                 run_pip_install_voxeloo)

SCRIPT_DIR = Path(os.path.dirname(os.path.realpath(__file__)))
REPO_DIR = SCRIPT_DIR / ".." / ".."

ERROR_COLOR = "bright_red"
WARNING_COLOR = "bright_yellow"
GOOD_COLOR = "bright_green"

ASSET_VERSIONS_PATH = REPO_DIR / "src" / "galois" / "js" / "interface" / "gen" / "asset_versions.json"
SNAPSHOT_BUCKETS_DIR_NAME = "buckets"
SNAPSHOT_BUCKETS_PATH = REPO_DIR / "public" / SNAPSHOT_BUCKETS_DIR_NAME
SNAPSHOT_BUCKETS_URL_PREFIX = f"/{SNAPSHOT_BUCKETS_DIR_NAME}/"
STATIC_BUCKET_PATH = SNAPSHOT_BUCKETS_PATH / "biomes-static"
BIKKIE_BUCKET_PATH = SNAPSHOT_BUCKETS_PATH / "biomes-bikkie"
BIKKIE_STATIC_PREFIX = f"{SNAPSHOT_BUCKETS_URL_PREFIX}biomes-bikkie/"
GALOIS_STATIC_PREFIX = f"{SNAPSHOT_BUCKETS_URL_PREFIX}biomes-static/"

GS_URL_BASE = "gs://biomes-static"

DATA_SNAPSHOT_FILENAME = "biomes_data_snapshot.tar.gz"
DATA_SNAPSHOT_GS_URL = f"{GS_URL_BASE}/{DATA_SNAPSHOT_FILENAME}"
DEFAULT_DATA_SNAPSHOT_DOWNLOAD_URL = (
    "https://github.com/ill-inc/biomes-game/releases/download/"
    "data-snapshot-2026-05-16/biomes_data_snapshot.tar.gz"
)
DATA_SNAPSHOT_DOWNLOAD_URL = os.environ.get(
    "BIOMES_DATA_SNAPSHOT_URL", DEFAULT_DATA_SNAPSHOT_DOWNLOAD_URL
)
DATA_SNAPSHOT_SHA256 = os.environ.get(
    "BIOMES_DATA_SNAPSHOT_SHA256",
    "ac211539b14b29d2a07a405f6b763583722666319d2aa9bf9ca056aad4180033",
)

SNAPSHOT_BACKUP_PATH = REPO_DIR / "snapshot_backup.json"

REDIS_BOOTSTRAP_HASH_KEY = "biomes_data_snapshot_hash"


@click.group()
def data_snapshot():
    """Commands for working with data snapshots."""
    pass


@data_snapshot.command()
@click.argument(
    "path",
    type=str,
)
@click.pass_context
def create_to_file(ctx, path: str):
    """Creates a data snapshot by pulling from prod. Needs gcloud auth."""

    if not path.endswith(".tar.gz"):
        raise RuntimeError(f"Path '{path}' does not end with '.tar.gz'.")

    # Ensure path doesn't already exist.
    if os.path.exists(path):
        raise RuntimeError(f"Path '{path}' already exists.")

    # Create a temporary directory to collect snapshot files in.
    with tempfile.TemporaryDirectory() as tmpdir:
        backup_file = Path(tmpdir) / "backup.json"
        buckets_dir = Path(tmpdir) / "buckets"

        # Pull the latest backup file.
        click.secho("Downloading the latest backup file...")
        ctx.invoke(b.fetch, destination=backup_file)

        # Download the bucket asset data.
        click.secho("Downloading static assets...")
        ctx.invoke(b.script, name="extract_assets", args=[buckets_dir])

        # Tar up the directory.
        click.secho("Creating tarball...")
        subprocess.run(["tar", "-czf", path, "-C", tmpdir, "."])

    click.secho(f"Created data snapshot at '{path}'.")


@data_snapshot.command()
@click.argument(
    "path",
    type=str,
)
def upload_from_file(path: str):
    """Uploads specified file to GCS as the new current data snapshot. Needs gcloud auth."""

    # Check that path exists.
    if not os.path.exists(path):
        raise RuntimeError(f"Path '{path}' does not exist.")

    click.secho(
        f"Uploading data snapshot from file '{path}' to '{DATA_SNAPSHOT_GS_URL}'..."
    )
    subprocess.run(["gsutil", "cp", path, DATA_SNAPSHOT_GS_URL])

    click.secho("Done uploading data snapshot.")


def hash_file(path: str):
    """Returns the MD5 hash of the file at path."""
    with open(path, "rb") as f:
        return hashlib.md5(f.read()).hexdigest()


def sha256_file(path: str):
    """Returns the SHA-256 hash of the file at path."""
    hasher = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


@data_snapshot.command()
@click.pass_context
def push(ctx):
    """Creates new data snapshot and uploads it to GCS as new current. Needs gcloud auth."""

    # Create temporary directory work within.
    with tempfile.TemporaryDirectory() as tmpdir:
        path = str(Path(tmpdir) / DATA_SNAPSHOT_FILENAME)

        ctx.invoke(create_to_file, path=path)
        ctx.invoke(upload_from_file, path=path)


@data_snapshot.command()
@click.argument(
    "path",
    type=str,
)
def install_from_file(path: str):
    """Install a data snapshot from a file."""
    click.secho(f"Installing data snapshot from file '{path}'...")

    # Ensure the file exists.
    if not os.path.exists(path):
        raise RuntimeError(f"File '{path}' does not exist.")

    # Create a temporary directory to unpack into.
    with tempfile.TemporaryDirectory() as tmpdir:
        # Unpack the file.
        subprocess.run(["tar", "-xzf", path, "-C", tmpdir])

        # Install the snapshot files.
        shutil.move(Path(tmpdir) / "backup.json", SNAPSHOT_BACKUP_PATH)
        # Ensure that the snapshot buckets directory exists.
        SNAPSHOT_BUCKETS_PATH.mkdir(exist_ok=True, parents=True)
        # Move the contents of "buckets" into the snapshot buckets directory.
        for file in (Path(tmpdir) / "buckets").iterdir():
            # First remove the directory if it already exists.
            dir = SNAPSHOT_BUCKETS_PATH / file.name
            if (dir).exists():
                shutil.rmtree(dir)
            shutil.move(file, dir)

    click.secho(f"Done installing data snapshot.")


@data_snapshot.command()
def uninstall():
    """Removes all installed data snapshot files from your repository."""
    # Remove SNAPSHOT_BACKUP_PATH.
    if SNAPSHOT_BACKUP_PATH.exists():
        SNAPSHOT_BACKUP_PATH.unlink()

    # Remove the specific buckets directory.
    if STATIC_BUCKET_PATH.exists():
        shutil.rmtree(STATIC_BUCKET_PATH)

    if BIKKIE_BUCKET_PATH.exists():
        shutil.rmtree(BIKKIE_BUCKET_PATH)


def is_installed():
    return (
        SNAPSHOT_BACKUP_PATH.exists()
        and STATIC_BUCKET_PATH.exists()
        and BIKKIE_BUCKET_PATH.exists()
    )


@data_snapshot.command()
@click.argument(
    "path",
    type=str,
)
def download_to_file(path: str):
    """Download the latest data snapshot to a file."""
    click.secho(
        f"Downloading latest data snapshot from '{DATA_SNAPSHOT_DOWNLOAD_URL}' to '{path}'..."
    )

    # Ensure the output file does not already exist.
    if os.path.exists(path):
        raise RuntimeError(f"File '{path}' already exists.")

    # Download the file. Use curl to get a progress bar and fail on bad HTTP status.
    subprocess.run(
        [
            "curl",
            "--fail",
            "--location",
            "--show-error",
            "--progress-bar",
            DATA_SNAPSHOT_DOWNLOAD_URL,
            "--output",
            path,
        ],
        check=True,
    )

    if DATA_SNAPSHOT_SHA256:
        actual_sha256 = sha256_file(path)
        if actual_sha256 != DATA_SNAPSHOT_SHA256:
            raise RuntimeError(
                "Downloaded data snapshot failed SHA-256 verification: "
                f"expected {DATA_SNAPSHOT_SHA256}, got {actual_sha256}."
            )

    click.secho(f"Data snapshot downloaded to {path}.")


@data_snapshot.command()
@click.pass_context
def pull(ctx):
    """If out of date, downloads and installs the latest snapshot data."""

    # Check to see if we already have the latest snapshot, by comparing the contents of DATA_SNAPSHOT_HASH_DOWNLOAD_URL with the contents of SNAPSHOT_HASH_PATH.
    if is_installed():
        click.secho(f"Snapshot is already installed, nothing to do.")
        return

    # Create a temporary data to download to.
    with tempfile.TemporaryDirectory() as tmpdir:
        path = str(Path(tmpdir) / DATA_SNAPSHOT_FILENAME)

        # Download the snapshot.
        ctx.invoke(download_to_file, path=path)

        # Install the snapshot.
        ctx.invoke(install_from_file, path=path)

    click.secho(f"Installed snapshot data is up-to-date.")


@data_snapshot.command()
@click.pass_context
def populate_redis(ctx):
    """Populate a running redis-server with the installed snapshot data."""
    if not redis_server_started():
        raise RuntimeError("Expected redis-server to be started already.")

    # If we've previously bootstrapped, check with the user before proceeding
    # to clear and overwrite.
    if redis_cli(f"exists {REDIS_BOOTSTRAP_HASH_KEY}").strip() == "1":
        click.secho(
            "Your Redis DB has been bootstrapped with older data, proceeding will reset it with new data."
        )

    # SNAPSHOT_REDIS_FORCE_RESET_V1:
    # Snapshot hash alone only proves the base backup was installed at some
    # point. It does not prove Redis is free of older local-dev/Harthmere overlay
    # entities. Use BIOMES_FORCE_SNAPSHOT_REDIS_RESET=1 with
    # BIOMES_SNAPSHOT_REDIS_RESET_YES=1 for a clean snapshot rebootstrap.
    # Clear out the local redis database before proceeding to bootstrap it.
    assume_yes = os.environ.get("BIOMES_SNAPSHOT_REDIS_RESET_YES", "").lower() in (
        "1",
        "true",
        "yes",
        "y",
    )
    if not assume_yes and not click.confirm("Clearing data on your local redis-server. Proceed?"):
        return
    if assume_yes:
        click.secho("Clearing data on local redis-server because BIOMES_SNAPSHOT_REDIS_RESET_YES=1.")
    redis_cli("flushall")

    click.secho(
        f"Populating redis with data from backup file '{SNAPSHOT_BACKUP_PATH}'...."
    )
    ctx.invoke(b.script, name="bootstrap_redis", args=[SNAPSHOT_BACKUP_PATH])

    # Remember the hash of the backup that we bootstrapped redis with.
    hash = hash_file(SNAPSHOT_BACKUP_PATH)
    redis_cli(f"set {REDIS_BOOTSTRAP_HASH_KEY} {hash}")
    redis_cli("save")

    click.secho("Done populating redis.")


@data_snapshot.command()
@click.pass_context
def ensure_redis_populated(ctx):
    """Populate a running redis-server with the installed snapshot data."""
    if not redis_server_started():
        raise RuntimeError("Expected redis-server to be started already.")

    # Ensure that SNAPSHOT_HASH_PATH exists, since it marks if installation
    # has been performed.
    if not is_installed():
        raise RuntimeError("No data snapshot has been installed.")

    # Compare the current hash of the data snapshot that we bootstrapped redis with to the hash of the installed snapshot data.
    installed_hash = hash_file(SNAPSHOT_BACKUP_PATH)
    bootstrapped_hash = redis_cli(f"get {REDIS_BOOTSTRAP_HASH_KEY}")
    if installed_hash.strip() == bootstrapped_hash.strip():
        click.secho(
            "Redis is already populated with the installed snapshot data."
        )
        return

    ctx.invoke(populate_redis)


@data_snapshot.command()
@click.option(
    "--pip-install/--no-pip-install",
    help="Whether or not `pip install ./voxeloo` will get called before commands that need it.",
    default=True,
)
@click.option(
    "--visual-lite/--full-stack",
    help=(
        "Run only the services needed for browser visual smoke tests "
        "(shim, logic, sync, web). Skips bikkie, sidefx, and oob for faster startup."
    ),
    default=False,
)
@click.option(
    "--git-lfs-pull/--no-git-lfs-pull",
    help=(
        "Whether to refresh Git LFS assets before booting. Defaults to on for "
        "full stack runs and off for visual-lite runs."
    ),
    default=None,
)
@click.option(
    "--asset-check/--no-asset-check",
    help=(
        "Whether to scan for missing static assets before booting. Defaults to "
        "on for full stack runs and off for visual-lite runs."
    ),
    default=None,
)
@click.option(
    "--ts-deps-check/--no-ts-deps-check",
    help=(
        "Whether to regenerate TypeScript dependencies before booting. Defaults "
        "to on for full stack runs and off for visual-lite runs."
    ),
    default=None,
)
@click.option(
    "--reuse-running-redis/--managed-redis",
    help=(
        "Use an already-running Redis server instead of starting and stopping "
        "one for this command."
    ),
    default=False,
)
@click.option(
    "--keep-redis/--stop-redis",
    help=(
        "Leave the managed Redis server running after this command exits so "
        "subsequent visual-lite runs can reuse the loaded snapshot."
    ),
    default=False,
)
@click.pass_context
def run(
    ctx,
    pip_install: bool,
    visual_lite: bool,
    git_lfs_pull: bool | None,
    asset_check: bool | None,
    ts_deps_check: bool | None,
    reuse_running_redis: bool,
    keep_redis: bool,
):
    """Run with from data snapshot."""
    ctx.ensure_object(dict)

    if pip_install:
        run_pip_install_requirements()
        run_pip_install_voxeloo()

    if git_lfs_pull is None:
        git_lfs_pull = not visual_lite
    if asset_check is None:
        asset_check = not visual_lite
    if ts_deps_check is None:
        ts_deps_check = not visual_lite

    if git_lfs_pull:
        subprocess.run(["git", "lfs", "pull"], cwd=REPO_DIR, check=True)
    else:
        click.secho(
            "Skipping git lfs pull for this data snapshot run.",
            fg=WARNING_COLOR,
        )

    # Make sure our data snapshot exists and is up-to-date.
    ctx.invoke(pull)
    # Ensure all assets have been downloaded.
    skip_asset_check_env = os.environ.get("SKIP_MISSING_ASSET_CHECK", "").lower() in (
        "1",
        "true",
        "yes",
        "y",
    )
    if not asset_check:
        click.secho(
            "Skipping missing asset check for this data snapshot run.",
            fg=WARNING_COLOR,
        )
    elif skip_asset_check_env:
        print("Skipping missing asset check because SKIP_MISSING_ASSET_CHECK is set.")
    else:
        ctx.invoke(check_for_missing_assets, error_on_missing=True)

    with RedisServer(
        reuse_running=reuse_running_redis,
        keep_after_exit=keep_redis,
    ):
        # Make sure our Redis server is populated with the data snapshot.
        if os.environ.get("BIOMES_FORCE_SNAPSHOT_REDIS_RESET", "").lower() in (
            "1",
            "true",
            "yes",
            "y",
        ):
            click.secho(
                "Forcing Redis reset from installed snapshot because BIOMES_FORCE_SNAPSHOT_REDIS_RESET=1."
            )
            ctx.invoke(populate_redis)
        else:
            ctx.invoke(ensure_redis_populated)

        # Snapshot data lives in Redis. Force Glitch/local services to read the
        # imported snapshot from Redis-backed Bikkie/world APIs.
        _configure_snapshot_runtime_environment()
        if not ts_deps_check:
            # b.run's decorator always builds generated TS deps unless this
            # marker is present. Visual smoke repeats prefer fast hot-starts;
            # pass --ts-deps-check when generated files may be stale.
            ctx.obj["BAZEL_DID_BUILD"] = True
            click.secho(
                "Skipping TypeScript dependency generation for this data snapshot run.",
                fg=WARNING_COLOR,
            )
        if visual_lite:
            _snapshot_setdefault_env(
                "HARTHMERE_VISUAL_LITE_REPLICA_FILTER",
                "1",
            )

        # Actually run a local Biomes server.
        targets = ["shim", "logic", "sync", "web"] if visual_lite else ["web"]
        if visual_lite:
            click.secho(
                "Starting data snapshot visual-lite stack: shim, logic, sync, web.",
                fg=WARNING_COLOR,
            )
        ctx.invoke(
            b.run,
            target=targets,
            only=visual_lite,
            redis=True,
            storage="memory",
            assets="local",
            # Snapshot boot should not force /at or homestone to the terrain center.
            # The snapshot world/start positions are the authority; centerOfTerrain
            # drops local players into the middle of nowhere after Redis resets.
            home_override=False,
            open_admin_access=True,
            bikkie_static_prefix=BIKKIE_STATIC_PREFIX,
            galois_static_prefix=GALOIS_STATIC_PREFIX,
            local_gcs=True,
            watch_ts_deps=not visual_lite,
        )


def redis_cli(command: str, db=0):
    args = ["redis-cli", "-n", str(db)]
    p = subprocess.Popen(args, stdout=subprocess.PIPE, stdin=subprocess.PIPE)
    return p.communicate(command.encode(), timeout=60)[0].decode()


def redis_server_started():
    ping = subprocess.Popen(["redis-cli", "ping"], stdout=subprocess.PIPE)
    return ping.communicate()[0] == b"PONG\n"


MAX_REDIS_STARTUP_TIME = 120
class RedisServer(object):
    def __init__(
        self,
        reuse_running: bool = False,
        keep_after_exit: bool = False,
    ):
        self.reuse_running = reuse_running
        self.keep_after_exit = keep_after_exit
        self.process = None
        self.using_external_server = False

    def __enter__(self):
        if self.reuse_running and redis_server_started():
            self.using_external_server = True
            click.secho(
                "Reusing already-running redis-server.",
                fg=WARNING_COLOR,
            )
            return None

        click.secho("Starting redis-server...", fg=WARNING_COLOR)
        self.process = subprocess.Popen(
            "redis-server",
            start_new_session=self.keep_after_exit,
        )
        # Wait for server to start.
        start_time = time.time()
        last_message_time = start_time
        while True:
            if redis_server_started():
                break
            time.sleep(1)
            now = time.time()
            if now - last_message_time > 5:
                last_message_time = now
                click.secho("Starting redis-server...", fg=WARNING_COLOR)
            if now - start_time > MAX_REDIS_STARTUP_TIME:
                self.process.terminate()
                raise RuntimeError("redis-server failed to start.")
        click.secho("redis-server started", fg=GOOD_COLOR)

        return self.process

    def __exit__(self, *args):
        if self.using_external_server:
            click.secho("Leaving reused redis-server running.")
            return
        if self.keep_after_exit:
            click.secho("Leaving redis-server running for reuse.")
            return
        if self.process is None:
            return

        click.secho("Killing redis-server...")
        self.process.kill()
        try:
            self.process.wait(timeout=15)
        except subprocess.TimeoutExpired:
            click.secho(
                "redis-server timed out while shutting down, terminating."
            )
            self.process.terminate()

        click.secho("redis-server shutdown.")


# SNAPSHOT_RUNTIME_BRIDGE_V1:
# SNAPSHOT_RUNTIME_BRIDGE_REPAIR_V2:
# Glitch local runtime defaults collapse modes to memory/shim for standalone
# Harthmere. Data-snapshot runs must use Redis because the snapshot backup is
# loaded into Redis before services start. This block intentionally lives after
# RedisServer so it does not break the RedisServer context manager protocol.
def _snapshot_setdefault_env(name: str, value: str):
    if os.environ.get(name) in (None, ""):
        os.environ[name] = value


def _configure_snapshot_runtime_environment():
    # GLITCH_REMOVE_STATIC_BIOMES_GG_V193:
    # Data-snapshot boots are local/offline Glitch runs. They must never build
    # or serve browser URLs that point at the legacy static CDN.
    _snapshot_setdefault_env("GLITCH_LOCAL_ASSETS", "1")
    _snapshot_setdefault_env("NEXT_PUBLIC_GLITCH_LOCAL_ASSETS", "1")
    _snapshot_setdefault_env("GLITCH_DISABLE_GCP", "1")
    _snapshot_setdefault_env("NEXT_PUBLIC_GLITCH_DISABLE_GCP", "1")
    _snapshot_setdefault_env("LOCAL_GCS", "1")
    _snapshot_setdefault_env("GCS_LOCAL_DISK", "1")
    _snapshot_setdefault_env("BIKKIE_STATIC_PREFIX", BIKKIE_STATIC_PREFIX)
    _snapshot_setdefault_env("GALOIS_STATIC_PREFIX", GALOIS_STATIC_PREFIX)

    _snapshot_setdefault_env("GLITCH_BISCUIT_MODE", "redis2")
    _snapshot_setdefault_env("GLITCH_WORLD_API_MODE", "hfc-hybrid")
    _snapshot_setdefault_env("GLITCH_CHAT_API_MODE", "redis")
    _snapshot_setdefault_env("GLITCH_FIREHOSE_MODE", "redis")
    _snapshot_setdefault_env("GLITCH_BIKKIE_CACHE_MODE", "redis")
    # Snapshot browser tests compile a large Next game route and then keep the
    # runtime hot while moving through several areas. The generic web default is
    # 6000 MB, and the previous 8192 MB visual-lite default still OOMed during
    # multi-NPC sweeps after repeated /at route compiles and local mesh builds.
    _snapshot_setdefault_env(
        "B_WEB_RAM",
        os.environ.get("HARTHMERE_SNAPSHOT_WEB_RAM_MB", "16384"),
    )
    if os.environ.get("BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN") == "1":
        _snapshot_setdefault_env("NEXT_PUBLIC_BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN", "1")
    _snapshot_setdefault_env(
        "NEXT_PUBLIC_BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X",
        os.environ.get("BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X", "512"),
    )
    _snapshot_setdefault_env(
        "NEXT_PUBLIC_BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_Z",
        os.environ.get("BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_Z", "0"),
    )

    # SNAPSHOT_MERGE_RUNTIME_GATE_V1:
    # Let the browser/client renderer know that this is a merged snapshot run.
    # In this mode, Harthmere runtime visuals must be hidden unless explicitly
    # enabled as the shifted extra town or forced legacy local-dev town.
    _snapshot_setdefault_env("BIOMES_SNAPSHOT_MERGE_MODE", "1")
    _snapshot_setdefault_env("NEXT_PUBLIC_BIOMES_SNAPSHOT_MERGE_MODE", "1")

    # SNAPSHOT_RICH_NPC_APPEARANCE_V69:
    # Restore upstream snapshot NPC clothing/faces by allowing the web service
    # to generate /api/assets/player_mesh.glb locally/lazily during snapshot runs.
    _snapshot_setdefault_env("GLITCH_ENABLE_SNAPSHOT_ASSET_SERVER", "1")
    _snapshot_setdefault_env("BIOMES_SNAPSHOT_RICH_NPC_APPEARANCE", "1")
    _snapshot_setdefault_env("NEXT_PUBLIC_BIOMES_SNAPSHOT_RICH_NPC_APPEARANCE", "1")
    if os.environ.get("BIOMES_FORCE_LOCAL_DEV_TOWN") == "1":
        _snapshot_setdefault_env("NEXT_PUBLIC_BIOMES_FORCE_LOCAL_DEV_TOWN", "1")


def fetch_asset_versions():
    with open(ASSET_VERSIONS_PATH, 'r') as file:
        asset_versions = json.load(file)["paths"]

    return [(name, asset_versions[name]) for name in asset_versions]

# Verify that the assets referenced in asset_versions.json have been downloaded.
# Returns True if there are missing assets.
@data_snapshot.command()
@click.option(
    "--error-on-missing/--no-error-on-missing",
    help="Whether or not to throw an error when an asset is missing.",
    default=True,
)
@click.pass_context
def check_for_missing_assets(ctx, error_on_missing=True) -> bool:
    asset_versions = fetch_asset_versions()
    assets_missing = False;
    for (name, asset_path) in asset_versions:
        relative_asset_path = f"{STATIC_BUCKET_PATH}/{asset_path}"
        if not os.path.isfile(relative_asset_path):
            click.secho(f"Asset not found: {name}", fg=WARNING_COLOR)
            assets_missing = True

    if assets_missing and error_on_missing:
        raise Exception("Missing assets\nConsider running:\n$ git pull\n$ ./b data-snapshot uninstall\n$ ./b data-snapshot install\nto fetch the most up-to-date assets.")
    elif not assets_missing:
        click.secho("Assets are up-to-date", fg=GOOD_COLOR)
    return assets_missing
