# This file describes the development environment for Biomes.
FROM ubuntu:24.04

LABEL description="Linux development environment for building biomes."

# Install some basic development tools.
ARG DEBIAN_FRONTEND=noninteractive
RUN apt-get update --fix-missing && apt-get -y install \
  curl \
  perl \
  sudo \
  locales \
  bzip2 \
  bash \
  xz-utils \
  htop \
  git \
  git-lfs \
  wget \
  vim \
  man \
  pkg-config \
  yasm \
  gnupg \
  make \
  cmake \
  clang \
  clangd \
  python-is-python3 \
  pip \
  binutils \
  gdb \
  g++ \
  clang-tidy \
  clang-format \
  apt-transport-https \
  build-essential \
  libcairo2-dev \
  libpango1.0-dev \
  libjpeg-dev \
  libgif-dev \
  librsvg2-dev \
  # To enable SSH access to remote workspaces (e.g. codespaces).
  openssh-server \
  # For software EGL/GLES2.
  libgles2-mesa-dev \
  rsync \
  && apt-get clean && apt-get purge && apt-get autoremove --purge -y

# Setup our locale.
RUN echo "en_US.UTF-8 UTF-8" > /etc/locale.gen
RUN locale-gen en_US.UTF-8
ENV LANG=en_US.UTF-8

# Prepare to create a non-root user for the container work, since node doesn't
# like it when it's run as root.
ARG DOCKER_USER_NAME=docker-user
ARG DOCKER_USER_UID=1000
ARG DOCKER_USER_GID=${DOCKER_USER_UID}

# Create the user
RUN groupadd --gid ${DOCKER_USER_GID} ${DOCKER_USER_NAME} \
  && useradd --uid ${DOCKER_USER_UID} --gid ${DOCKER_USER_GID} -m ${DOCKER_USER_NAME} \
  && echo ${DOCKER_USER_NAME} ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/${DOCKER_USER_NAME} \
  && chmod 0440 /etc/sudoers.d/${DOCKER_USER_NAME}

# Set the default user to something other than root, node doesn't like being
# run as root.
USER ${DOCKER_USER_NAME}
ENV HOME=/home/${DOCKER_USER_NAME}

# Create this in advance as "docker-user" so that it doesn't instead get created
# as root.
RUN mkdir -p ${HOME}/.vscode-server/extensions

# Install nvm.
ENV NVM_DIR=${HOME}/.nvm
ENV NODE_VERSION=24.18.1

RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash \
  && . "$NVM_DIR/nvm.sh"  \
  && nvm install ${NODE_VERSION} \
  && nvm alias default ${NODE_VERSION} \
  && nvm use default

ENV PATH=${NVM_DIR}/versions/node/v${NODE_VERSION}/bin:$PATH

# Install yarn.
RUN npm install -g yarn@1.22.22

# Install Bazel.
RUN npm install -g @bazel/bazelisk@1.28.1

# Install buildifier for vscode bazel file formatting support.
RUN sudo wget -O /usr/bin/buildifier https://github.com/bazelbuild/buildtools/releases/download/0.29.0/buildifier
RUN sudo chmod 755 /usr/bin/buildifier

# Install gcloud CLI.
RUN curl -s https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-428.0.0-linux-x86_64.tar.gz | tar xvz -C ${HOME} && \
  ${HOME}/google-cloud-sdk/install.sh --quiet --usage-reporting false --path-update true --command-completion true

# Install kubectl.
RUN ${HOME}/google-cloud-sdk/bin/gcloud components install kubectl

# Install Flux CLI.
RUN curl -s https://fluxcd.io/install.sh | sudo bash

# Install Rust to get access to the Rust CLI tools.
RUN curl https://sh.rustup.rs/?version=1.97.1 -sSf | bash -s -- -y --default-toolchain 1.97.1
ENV PATH="${HOME}/.cargo/bin:${PATH}"
RUN rustup target add wasm32-wasip1
RUN rustup target add wasm32-unknown-unknown

# Install some helpful WASM inspection tools like wasm2wat
RUN sudo apt install wabt

# Install Redis
# Build the exact production patch from the official source archive instead of
# inheriting the base distribution's older Redis package.
ARG REDIS_VERSION=8.8.1
ARG REDIS_SHA256=1d1e423c9c808de3cb01dd3300d2b8d305b7691382e31a847ec17b66d3157477
# Match the production image's deterministic Redis build: Redis 8.8 turns on
# GCC LTO at -O3, whose nested linker make can lose container jobserver file
# descriptors. This retains parallel O3 compilation while disabling LTO.
RUN curl -fsSL https://download.redis.io/releases/redis-${REDIS_VERSION}.tar.gz -o /tmp/redis.tar.gz \
    && echo "${REDIS_SHA256}  /tmp/redis.tar.gz" | sha256sum -c - \
    && tar xzf /tmp/redis.tar.gz -C ${HOME} \
    && make -j`nproc` -C ${HOME}/redis-${REDIS_VERSION} ENABLE_LTO= \
    && sudo make install -C ${HOME}/redis-${REDIS_VERSION} \
    && rm -rf ${HOME}/redis-${REDIS_VERSION} /tmp/redis.tar.gz

# Remember our console history between sessions.
ENV COMMAND_HISTORY_DIR=${HOME}/commandhistory
RUN SNIPPET="export PROMPT_COMMAND='history -a' && export HISTFILE=${COMMAND_HISTORY_DIR}/.bash_history" \
  && mkdir -p ${COMMAND_HISTORY_DIR} \
  && echo $SNIPPET >> "${HOME}/.bashrc"
