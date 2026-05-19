# syntax=docker/dockerfile:1.7
FROM --platform=linux/amd64 docker.io/curlimages/curl:latest AS linkerd
ARG LINKERD_AWAIT_VERSION=v0.2.7
RUN curl -sSLo /tmp/linkerd-await https://github.com/linkerd/linkerd-await/releases/download/release%2F${LINKERD_AWAIT_VERSION}/linkerd-await-${LINKERD_AWAIT_VERSION}-amd64 \
    && chmod 755 /tmp/linkerd-await

FROM --platform=linux/amd64 ubuntu:22.04 AS jemalloc
ARG DEBIAN_FRONTEND=noninteractive
RUN --mount=type=cache,id=glitch-apt-cache-jammy,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,id=glitch-apt-lists-jammy,target=/var/lib/apt/lists,sharing=locked \
    apt-get update --fix-missing \
    && apt-get -y install --no-install-recommends build-essential ca-certificates wget bzip2 \
    && wget -O - https://github.com/jemalloc/jemalloc/releases/download/5.3.0/jemalloc-5.3.0.tar.bz2 | tar -xj \
    && cd jemalloc-5.3.0 \
    && ./configure \
    && make \
    && make install

FROM --platform=linux/amd64 ubuntu:22.04 AS app

RUN groupadd --gid 1001 nodejs && useradd --uid 1001 --gid 1001 -m nextjs
WORKDIR /app

ENV WORKDIR=/app \
    NEXT_TELEMETRY_DISABLED=1 \
    GOOGLE_CLOUD_PROJECT=zones-cloud \
    IS_SERVER=true \
    NODE_ENV=production \
    NODE_OPTIONS="--openssl-legacy-provider --enable-source-maps" \
    PORT=3000 \
    WEB_PORT=3000 \
    GLITCH_TITLE_ID=42de534c-600f-4228-af9e-b69faef94cce \
    GLITCH_API_BASE_URL=https://api.glitch.fun/api \
    SKIP_PROD_LOAD=true \
    SKIP_MISSING_ASSET_CHECK=true \
    BIOMES_FORCE_LOCAL_DEV_TOWN=1 \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    BIOMES_VENV_DIR=/opt/biomes-venv \
    PATH=/opt/biomes-venv/bin:/app/node_modules/.bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

COPY --from=linkerd /tmp/linkerd-await /usr/bin/linkerd-await
COPY --from=jemalloc /usr/local/lib/libjemalloc.so.2 /usr/local/lib/

ARG DEBIAN_FRONTEND=noninteractive
RUN --mount=type=cache,id=glitch-apt-cache-jammy,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,id=glitch-apt-lists-jammy,target=/var/lib/apt/lists,sharing=locked \
    apt-get update --fix-missing \
    && apt-get -y install --no-install-recommends \
      bash \
      ca-certificates \
      curl \
      git \
      openssh-client \
      git-lfs \
      python3 \
      python3-pip \
      python3-venv \
      wget \
      gnupg \
      build-essential \
      pkg-config \
      rsync \
      redis-server \
      redis-tools \
      procps \
      tini \
      unzip \
      default-jre-headless \
    && ln -sf /usr/bin/python3 /usr/bin/python \
    && git lfs install --system --skip-smudge

ARG NODE_VERSION=20.0.0
ARG NODE_PACKAGE=node-v${NODE_VERSION}-linux-x64
ARG NODE_INSTALL_DIR=/usr/local
ARG NODE_HOME=${NODE_INSTALL_DIR}/${NODE_PACKAGE}
RUN curl -fsSL https://nodejs.org/dist/v${NODE_VERSION}/${NODE_PACKAGE}.tar.xz | tar -xvJC ${NODE_INSTALL_DIR}
ENV PATH=${NODE_HOME}/bin:/opt/biomes-venv/bin:/app/node_modules/.bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

RUN corepack enable \
    && corepack prepare yarn@1.22.22 --activate \
    && npm install -g @bazel/bazelisk

RUN set -eux; \
    git config --system url."https://github.com/".insteadOf "ssh://git@github.com/"; \
    git config --system url."https://github.com/".insteadOf "ssh://git@github.com:"; \
    git config --system url."https://github.com/".insteadOf "git@github.com:"; \
    git config --global url."https://github.com/".insteadOf "ssh://git@github.com/"; \
    git config --global url."https://github.com/".insteadOf "ssh://git@github.com:"; \
    git config --global url."https://github.com/".insteadOf "git@github.com:"; \
    git config --global --add safe.directory /app

COPY package.json yarn.lock ./

RUN set -eux; \
    for f in package.json yarn.lock; do \
      if [ -f "$f" ]; then \
        sed -i \
          -e 's#git+ssh://git@github.com/#git+https://github.com/#g' \
          -e 's#git+ssh://git@github.com:#git+https://github.com/#g' \
          -e 's#ssh://git@github.com/#https://github.com/#g' \
          -e 's#ssh://git@github.com:#https://github.com/#g' \
          -e 's#git@github.com:#https://github.com/#g' \
          "$f"; \
      fi; \
    done; \
    ! grep -R -n -E 'ssh://git@github.com|git@github.com:' package.json yarn.lock

RUN node <<'NODE'
const fs = require('fs');
const bad = ['hu' + 'sky', 'node-git-' + 'hooks', 'git-' + 'hooks', '.hu' + 'sky', '.git' + 'hooks', 'core.' + 'hooksPath'];
const re = new RegExp(bad.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
for (const section of ['scripts', 'dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
  if (!pkg[section]) continue;
  for (const key of Object.keys(pkg[section])) {
    const value = typeof pkg[section][key] === 'string' ? pkg[section][key] : JSON.stringify(pkg[section][key]);
    if (re.test(`${key} ${value}`)) delete pkg[section][key];
  }
  if (Object.keys(pkg[section]).length === 0) delete pkg[section];
}
for (const key of Object.keys(pkg)) if (re.test(key)) delete pkg[key];
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
let lock = fs.existsSync('yarn.lock') ? fs.readFileSync('yarn.lock', 'utf8') : '';
if (lock) {
  lock = lock.split(/\n(?=\S)/).filter((block) => !re.test(block.split('\n', 1)[0])).join('\n');
  fs.writeFileSync('yarn.lock', lock.replace(/\s+$/, '') + '\n');
}
for (const file of ['package.json', 'yarn.lock']) {
  if (fs.existsSync(file) && re.test(fs.readFileSync(file, 'utf8'))) {
    throw new Error(`${file} still contains removed hook tooling text before yarn install`);
  }
}
NODE

RUN --mount=type=cache,id=glitch-yarn-cache-v1,target=/usr/local/share/.cache/yarn/v6,sharing=locked \
    set -eux; \
    yarn config set cache-folder /usr/local/share/.cache/yarn/v6; \
    yarn config set ignore-scripts true; \
    YARN_IGNORE_SCRIPTS=1 npm_config_ignore_scripts=true yarn install --ignore-scripts --frozen-lockfile --non-interactive --production=false; \
    yarn config delete ignore-scripts

COPY requirements.txt ./
RUN --mount=type=cache,id=glitch-pip-cache-py310,target=/root/.cache/pip,sharing=locked \
    set -eux; \
    rm -rf /opt/biomes-venv .venv; \
    python3 -m venv /opt/biomes-venv; \
    /opt/biomes-venv/bin/python -m pip install --upgrade pip setuptools wheel; \
    /opt/biomes-venv/bin/python -m pip install -r requirements.txt; \
    sha256sum requirements.txt | awk '{print $1}' > /opt/biomes-venv/.glitch-requirements.sha256

# This is the important part: copy the local repo files into the image.
# No production asset download. No LFS hydration in Docker.
COPY . .

# COPY . . can overwrite the already-sanitized package files with the host copy.
# Re-sanitize here before any ./b command can trigger dependency checks.
RUN set -eux; \
    for f in package.json yarn.lock package-lock.json; do \
      if [ -f "$f" ]; then \
        sed -i \
          -e 's#git+ssh://git@github.com/#git+https://github.com/#g' \
          -e 's#git+ssh://git@github.com:#git+https://github.com/#g' \
          -e 's#ssh://git@github.com/#https://github.com/#g' \
          -e 's#ssh://git@github.com:#https://github.com/#g' \
          -e 's#git@github.com:#https://github.com/#g' \
          "$f"; \
      fi; \
    done; \
    ! grep -R -n -E 'ssh://git@github.com|git@github.com:' package.json yarn.lock package-lock.json 2>/dev/null; \
    rm -rf .git .harthmere-backups tmp .next dist .venv; \
    ln -sfn /opt/biomes-venv .venv; \
    test -x /app/.venv/bin/python3; \
    test -x /app/.venv/bin/python

RUN node <<'NODE'
const fs = require('fs');
const bad = ['hu' + 'sky', 'node-git-' + 'hooks', 'git-' + 'hooks', '.hu' + 'sky', '.git' + 'hooks', 'core.' + 'hooksPath'];
const re = new RegExp(bad.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
for (const section of ['scripts', 'dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
  if (!pkg[section]) continue;
  for (const key of Object.keys(pkg[section])) {
    const value = typeof pkg[section][key] === 'string' ? pkg[section][key] : JSON.stringify(pkg[section][key]);
    if (re.test(`${key} ${value}`)) delete pkg[section][key];
  }
  if (Object.keys(pkg[section]).length === 0) delete pkg[section];
}
for (const key of Object.keys(pkg)) if (re.test(key)) delete pkg[key];
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
NODE

ARG GLITCH_PREPARE_AT_BUILD=1
RUN --mount=type=cache,id=glitch-pip-cache-py310,target=/root/.cache/pip,sharing=locked \
    --mount=type=cache,id=glitch-bazel-cache,target=/root/.cache/bazel,sharing=locked \
    chmod +x scripts/glitch/prepare-glitch-image.sh scripts/glitch/run-glitch-web.sh scripts/glitch/healthcheck-glitch-web.cjs \
    && bash -n scripts/glitch/prepare-glitch-image.sh \
    && bash -n scripts/glitch/run-glitch-web.sh \
    && if [ "$GLITCH_PREPARE_AT_BUILD" = "1" ]; then scripts/glitch/prepare-glitch-image.sh; else echo "Skipping image preparation at build because GLITCH_PREPARE_AT_BUILD=$GLITCH_PREPARE_AT_BUILD"; fi

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
  CMD node scripts/glitch/healthcheck-glitch-web.cjs || exit 1

ENTRYPOINT ["tini", "--"]
CMD ["./scripts/glitch/run-glitch-web.sh"]
