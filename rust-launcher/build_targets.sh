#!/usr/bin/env bash
set -euo pipefail

# 1. Windows x86_64 Native Binary (.exe) with LTO + wgpu (DX12/Vulkan)
rustup target add x86_64-pc-windows-msvc
cargo build --release --target x86_64-pc-windows-msvc

# 2. Android ARM64 NDK Shared Library (.so -> .apk) with Vulkan 1.3
rustup target add aarch64-linux-android
cargo install cargo-ndk --locked
cargo ndk -t arm64-v8a -o ./android/app/src/main/jniLibs build --release
