import { MinecraftVersion, PerformancePreset, PlatformTarget } from './versions';

// Import raw Rust crate files directly via Vite ?raw so they stay 100% synced with /rust-launcher/
import cargoTomlRaw from '../../rust-launcher/Cargo.toml?raw';
import libRsRaw from '../../rust-launcher/src/lib.rs?raw';
import mainRsRaw from '../../rust-launcher/src/main.rs?raw';
import versionsRsRaw from '../../rust-launcher/src/versions.rs?raw';
import perfRsRaw from '../../rust-launcher/src/perf.rs?raw';
import buildTargetsShRaw from '../../rust-launcher/build_targets.sh?raw';
import releaseApkYmlRaw from '../../.github/workflows/release-apk.yml?raw';
import androidManifestRaw from '../../rust-launcher/android/app/src/main/AndroidManifest.xml?raw';
import appBuildGradleRaw from '../../rust-launcher/android/app/build.gradle.kts?raw';
import rootBuildGradleRaw from '../../rust-launcher/android/build.gradle.kts?raw';
import settingsGradleRaw from '../../rust-launcher/android/settings.gradle.kts?raw';
import apkSettingsGradleRaw from '../../android-apk/settings.gradle.kts?raw';
import apkRootBuildGradleRaw from '../../android-apk/build.gradle.kts?raw';
import apkGradlePropertiesRaw from '../../android-apk/gradle.properties?raw';
import apkAppBuildGradleRaw from '../../android-apk/app/build.gradle.kts?raw';
import apkManifestRaw from '../../android-apk/app/src/main/AndroidManifest.xml?raw';
import apkMainActivityRaw from '../../android-apk/app/src/main/java/io/voxelforge/app/MainActivity.java?raw';

export interface RustSourceFile {
  path: string;
  filename: string;
  language: 'toml' | 'rust' | 'bash' | 'yaml' | 'xml' | 'kotlin' | 'java' | 'properties';
  description: string;
  content: string;
}

export const RUST_CRATE_FILES: RustSourceFile[] = [
  {
    path: 'rust-launcher/Cargo.toml',
    filename: 'Cargo.toml',
    language: 'toml',
    description: 'Crate manifest with eframe/wgpu, tokio, reqwest, Android NDK, Windows sys, and LTO release tuning.',
    content: cargoTomlRaw,
  },
  {
    path: 'rust-launcher/src/lib.rs',
    filename: 'lib.rs',
    language: 'rust',
    description: 'Cross-platform Rust launcher UI (egui) and #[no_mangle] android_main NDK entry point.',
    content: libRsRaw,
  },
  {
    path: 'rust-launcher/src/main.rs',
    filename: 'main.rs',
    language: 'rust',
    description: 'Windows x86_64 native desktop entry point powered by the wgpu Vulkan/DX12 renderer.',
    content: mainRsRaw,
  },
  {
    path: 'rust-launcher/src/versions.rs',
    filename: 'versions.rs',
    language: 'rust',
    description: 'Rust version manifest struct & 1.0.0 to 1.26.3 release table with Java runtime mapping.',
    content: versionsRsRaw,
  },
  {
    path: 'rust-launcher/src/perf.rs',
    filename: 'perf.rs',
    language: 'rust',
    description: 'Platform-specific wgpu present mode, chunk radius, and ZGC/G1GC heap tuner.',
    content: perfRsRaw,
  },
  {
    path: 'rust-launcher/build_targets.sh',
    filename: 'build_targets.sh',
    language: 'bash',
    description: 'Cross-compilation build script for Windows (.exe) and Android ARM64 (.so / .apk).',
    content: buildTargetsShRaw,
  },
  {
    path: '.github/workflows/release-apk.yml',
    filename: 'release-apk.yml',
    language: 'yaml',
    description: 'GitHub Actions CI/CD workflow that compiles the Android APK and Windows EXE and attaches them to GitHub Releases.',
    content: releaseApkYmlRaw,
  },
  {
    path: 'rust-launcher/android/app/src/main/AndroidManifest.xml',
    filename: 'AndroidManifest.xml',
    language: 'xml',
    description: 'Android NativeActivity manifest loading libvoxelforge_launcher.so.',
    content: androidManifestRaw,
  },
  {
    path: 'rust-launcher/android/app/build.gradle.kts',
    filename: 'build.gradle.kts',
    language: 'kotlin',
    description: 'Android Gradle app configuration targeting API 34 and arm64-v8a jniLibs.',
    content: appBuildGradleRaw,
  },
  {
    path: 'rust-launcher/android/build.gradle.kts',
    filename: 'build.gradle.kts',
    language: 'kotlin',
    description: 'Android Gradle root project plugin definition.',
    content: rootBuildGradleRaw,
  },
  {
    path: 'rust-launcher/android/settings.gradle.kts',
    filename: 'settings.gradle.kts',
    language: 'kotlin',
    description: 'Android Gradle settings declaring the :app module.',
    content: settingsGradleRaw,
  },
  {
    path: 'android-apk/settings.gradle.kts',
    filename: 'settings.gradle.kts',
    language: 'kotlin',
    description: 'Android WebView APK Gradle settings bundling the exact compiled web app.',
    content: apkSettingsGradleRaw,
  },
  {
    path: 'android-apk/build.gradle.kts',
    filename: 'build.gradle.kts',
    language: 'kotlin',
    description: 'Android WebView APK root Gradle plugin config.',
    content: apkRootBuildGradleRaw,
  },
  {
    path: 'android-apk/gradle.properties',
    filename: 'gradle.properties',
    language: 'properties',
    description: 'AndroidX and Gradle memory properties for building the APK.',
    content: apkGradlePropertiesRaw,
  },
  {
    path: 'android-apk/app/build.gradle.kts',
    filename: 'build.gradle.kts',
    language: 'kotlin',
    description: 'App module config with androidx.webkit for hardware-accelerated WebViewAssetLoader.',
    content: apkAppBuildGradleRaw,
  },
  {
    path: 'android-apk/app/src/main/AndroidManifest.xml',
    filename: 'AndroidManifest.xml',
    language: 'xml',
    description: 'Fullscreen hardware-accelerated Android manifest for VoxelForge Launcher APK.',
    content: apkManifestRaw,
  },
  {
    path: 'android-apk/app/src/main/java/io/voxelforge/app/MainActivity.java',
    filename: 'MainActivity.java',
    language: 'java',
    description: 'Android Activity serving the exact compiled Vite/Three.js app offline with WebGL2 & IndexedDB.',
    content: apkMainActivityRaw,
  },
];

export interface RustRuntimeSummary {
  targetTriple: string;
  graphicsBackend: string;
  presentMode: string;
  javaVersion: number;
  heapMb: number;
  flags: string;
}

export function getRustRuntimeSummary(
  version: MinecraftVersion,
  platform: PlatformTarget,
  performance: PerformancePreset,
): RustRuntimeSummary {
  const majorMinor = version.id.split('.').slice(0, 2).map(Number);
  const major = majorMinor[0] || 1;
  const minor = majorMinor[1] || 0;
  const javaVersion = major >= 26 ? 25 : minor >= 21 ? 21 : minor >= 18 ? 17 : minor >= 17 ? 16 : 8;

  const targetTriple =
    platform === 'android' ? 'aarch64-linux-android' : 'x86_64-pc-windows-msvc';

  const graphicsBackend =
    platform === 'android'
      ? 'Vulkan 1.3 Mobile / GLES 3.2 (wgpu)'
      : 'DirectX 12 / Vulkan (wgpu)';

  const presentMode =
    performance === 'ultra_fps'
      ? 'Immediate (Uncapped)'
      : performance === 'balanced'
        ? 'Mailbox (Low-Latency)'
        : 'Fifo (VSync)';

  const heapMb =
    platform === 'android'
      ? minor >= 18 ? 3072 : 2048
      : minor >= 18 ? 6144 : 4096;

  const gcFlag =
    javaVersion >= 21
      ? '-XX:+UseZGC -XX:+ZGenerational'
      : '-XX:+UseG1GC -XX:MaxGCPauseMillis=16';

  return {
    targetTriple,
    graphicsBackend,
    presentMode,
    javaVersion,
    heapMb,
    flags: `-Xms${Math.floor(heapMb / 2)}M -Xmx${heapMb}M ${gcFlag} -XX:+AlwaysPreTouch`,
  };
}
