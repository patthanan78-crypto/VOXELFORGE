pub mod perf;
pub mod versions;

use eframe::egui;
use perf::{build_optimal_tune, LaunchTune};
use serde::Deserialize;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tokio::process::Command;
use versions::{version_catalog, MinecraftRelease, PerformancePreset, PlatformTarget};

const MOJANG_MANIFEST_URL: &str =
    "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";

#[derive(Debug, Deserialize)]
struct PistonManifest {
    versions: Vec<PistonVersionEntry>,
}

#[derive(Debug, Deserialize)]
struct PistonVersionEntry {
    id: String,
    url: String,
}

#[derive(Debug, Deserialize)]
struct VersionDetails {
    id: String,
    #[serde(rename = "mainClass")]
    main_class: String,
    #[serde(rename = "assetIndex")]
    asset_index: AssetIndexRef,
    downloads: VersionDownloads,
    libraries: Vec<LibraryEntry>,
}

#[derive(Debug, Deserialize)]
struct AssetIndexRef {
    id: String,
    url: String,
}

#[derive(Debug, Deserialize)]
struct VersionDownloads {
    client: ArtifactRef,
}

#[derive(Debug, Deserialize)]
struct ArtifactRef {
    url: String,
    sha1: Option<String>,
}

#[derive(Debug, Deserialize)]
struct LibraryEntry {
    downloads: Option<LibraryDownloads>,
    rules: Option<Vec<LibraryRule>>,
}

#[derive(Debug, Deserialize)]
struct LibraryDownloads {
    artifact: Option<ArtifactWithPath>,
}

#[derive(Debug, Deserialize)]
struct ArtifactWithPath {
    path: String,
    url: String,
}

#[derive(Debug, Deserialize)]
struct LibraryRule {
    action: String,
    os: Option<OsRule>,
}

#[derive(Debug, Deserialize)]
struct OsRule {
    name: Option<String>,
}

fn rule_allows_platform(rules: &Option<Vec<LibraryRule>>, platform: PlatformTarget) -> bool {
    let Some(rules) = rules else { return true };
    let target_os = match platform {
        PlatformTarget::WindowsX64 => "windows",
        PlatformTarget::AndroidArm64 => "linux",
    };
    let mut allowed = false;
    for rule in rules {
        let matches = match &rule.os {
            Some(os) => os.name.as_deref() == Some(target_os),
            None => true,
        };
        if matches {
            allowed = rule.action == "allow";
        }
    }
    allowed
}

async fn download_if_missing(client: &reqwest::Client, url: &str, dest: &Path) -> Result<(), String> {
    if dest.exists() {
        return Ok(());
    }
    if let Some(parent) = dest.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed creating directory: {e}"))?;
    }
    let bytes = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("HTTP request failed: {e}"))?
        .error_for_status()
        .map_err(|e| format!("HTTP error status: {e}"))?
        .bytes()
        .await
        .map_err(|e| format!("Failed reading bytes: {e}"))?;
    tokio::fs::write(dest, &bytes)
        .await
        .map_err(|e| format!("Failed writing file: {e}"))?;
    Ok(())
}

/// Downloads official Mojang version metadata, client.jar, libraries, and spawns real Minecraft Java Edition.
pub async fn launch_official_minecraft(
    version_id: String,
    platform: PlatformTarget,
    tune: LaunchTune,
    game_dir: PathBuf,
    username: String,
    access_token: String,
) -> Result<String, String> {
    let http = reqwest::Client::new();

    let manifest: PistonManifest = http
        .get(MOJANG_MANIFEST_URL)
        .send()
        .await
        .map_err(|e| format!("Failed fetching Mojang manifest: {e}"))?
        .json()
        .await
        .map_err(|e| format!("Invalid Mojang manifest JSON: {e}"))?;

    let entry = manifest
        .versions
        .into_iter()
        .find(|v| v.id == version_id)
        .ok_or_else(|| format!("Version {version_id} not found in Mojang Piston Meta manifest"))?;

    let details: VersionDetails = http
        .get(&entry.url)
        .send()
        .await
        .map_err(|e| format!("Failed fetching version JSON: {e}"))?
        .json()
        .await
        .map_err(|e| format!("Invalid version JSON: {e}"))?;

    let versions_dir = game_dir.join("versions").join(&details.id);
    let client_jar = versions_dir.join(format!("{}.jar", details.id));
    download_if_missing(&http, &details.downloads.client.url, &client_jar).await?;

    let asset_index_path = game_dir
        .join("assets")
        .join("indexes")
        .join(format!("{}.json", details.asset_index.id));
    download_if_missing(&http, &details.asset_index.url, &asset_index_path).await?;

    let mut classpath_entries = Vec::new();
    let libs_dir = game_dir.join("libraries");
    for lib in &details.libraries {
        if !rule_allows_platform(&lib.rules, platform) {
            continue;
        }
        if let Some(downloads) = &lib.downloads {
            if let Some(artifact) = &downloads.artifact {
                let jar_path = libs_dir.join(&artifact.path);
                download_if_missing(&http, &artifact.url, &jar_path).await?;
                classpath_entries.push(jar_path.to_string_lossy().to_string());
            }
        }
    }
    classpath_entries.push(client_jar.to_string_lossy().to_string());

    let cp_sep = if cfg!(target_os = "windows") { ";" } else { ":" };
    let classpath = classpath_entries.join(cp_sep);
    let java_bin = if cfg!(target_os = "windows") { "javaw" } else { "java" };

    let mut cmd = Command::new(java_bin);
    cmd.current_dir(&game_dir);
    for flag in &tune.jvm_flags {
        cmd.arg(flag);
    }
    cmd.arg("-cp")
        .arg(&classpath)
        .arg(&details.main_class)
        .arg("--username")
        .arg(&username)
        .arg("--version")
        .arg(&details.id)
        .arg("--gameDir")
        .arg(&game_dir)
        .arg("--assetsDir")
        .arg(game_dir.join("assets"))
        .arg("--assetIndex")
        .arg(&details.asset_index.id)
        .arg("--accessToken")
        .arg(&access_token)
        .arg("--userType")
        .arg("msa");

    cmd.spawn()
        .map_err(|e| format!("Failed spawning {java_bin}: {e}"))?;

    Ok(format!("Launched real Minecraft {} ({})", details.id, details.main_class))
}

pub struct VoxelForgeLauncherApp {
    releases: Vec<MinecraftRelease>,
    selected_idx: usize,
    platform: PlatformTarget,
    preset: PerformancePreset,
    search_query: String,
    username: String,
    status_line: Arc<Mutex<String>>,
    runtime: tokio::runtime::Runtime,
}

impl Default for VoxelForgeLauncherApp {
    fn default() -> Self {
        let platform = if cfg!(target_os = "android") {
            PlatformTarget::AndroidArm64
        } else {
            PlatformTarget::WindowsX64
        };
        let runtime = tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            .build()
            .expect("Tokio runtime initialization failed");

        Self {
            releases: version_catalog(),
            selected_idx: 0,
            platform,
            preset: PerformancePreset::Balanced,
            search_query: String::new(),
            username: "Player".to_string(),
            status_line: Arc::new(Mutex::new("Ready — fetches real Mojang Piston Meta manifest".to_string())),
            runtime,
        }
    }
}

impl VoxelForgeLauncherApp {
    fn current_tune(&self) -> LaunchTune {
        build_optimal_tune(&self.releases[self.selected_idx], self.platform, self.preset)
    }
}

impl eframe::App for VoxelForgeLauncherApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        egui::CentralPanel::default().show(ctx, |ui| {
            ui.heading("VoxelForge Rust Launcher (Official Mojang 1.0 - 1.26.3)");
            ui.horizontal(|ui| {
                ui.selectable_value(&mut self.platform, PlatformTarget::WindowsX64, "Windows x64");
                ui.selectable_value(&mut self.platform, PlatformTarget::AndroidArm64, "Android ARM64");
                ui.separator();
                ui.selectable_value(&mut self.preset, PerformancePreset::UltraFps, "Ultra FPS");
                ui.selectable_value(&mut self.preset, PerformancePreset::Balanced, "Balanced");
                ui.selectable_value(&mut self.preset, PerformancePreset::Vibrant, "Vibrant");
            });

            ui.add(egui::TextEdit::singleline(&mut self.search_query).hint_text("Filter version (e.g. 1.21.4, 1.8.9)..."));

            egui::ScrollArea::vertical().max_height(260.0).show(ui, |ui| {
                let q = self.search_query.to_lowercase();
                for (idx, rel) in self.releases.iter().enumerate() {
                    if !q.is_empty() && !rel.id.contains(&q) && !rel.title.to_lowercase().contains(&q) {
                        continue;
                    }
                    let label = format!("{} — {} ({}, Java {})", rel.id, rel.title, rel.era, rel.java_major);
                    if ui.selectable_label(self.selected_idx == idx, label).clicked() {
                        self.selected_idx = idx;
                    }
                }
            });

            let tune = self.current_tune();
            ui.separator();
            ui.label(format!("Backend: {} | Present: {}", tune.graphics_backend, tune.wgpu_present_mode));
            ui.label(format!("Chunks: {} | Max Heap: {} MB", tune.render_distance_chunks, tune.max_heap_mb));
            ui.label(format!("JVM Flags: {}", tune.jvm_flags.join(" ")));

            let ver_id = self.releases[self.selected_idx].id.to_string();
            if ui.button(format!("Download & Launch Real Minecraft {}", ver_id)).clicked() {
                let status_arc = Arc::clone(&self.status_line);
                let platform = self.platform;
                let username = self.username.clone();
                let game_dir = directories::ProjectDirs::from("io", "voxelforge", "launcher")
                    .map(|p| p.data_dir().to_path_buf())
                    .unwrap_or_else(|| PathBuf::from("./minecraft"));

                *status_arc.lock().unwrap() = format!("Fetching Mojang Piston Meta for {}...", ver_id);
                self.runtime.spawn(async move {
                    let result = launch_official_minecraft(
                        ver_id,
                        platform,
                        tune,
                        game_dir,
                        username,
                        "0".to_string(),
                    )
                    .await;
                    let msg = match result {
                        Ok(ok) => ok,
                        Err(err) => format!("Launch error: {err}"),
                    };
                    *status_arc.lock().unwrap() = msg;
                });
            }
            ui.label(self.status_line.lock().unwrap().as_str());
        });
    }
}

#[cfg(target_os = "android")]
#[unsafe(no_mangle)]
pub fn android_main(app: android_activity::AndroidApp) {
    let mut options = eframe::NativeOptions::default();
    options.android_app = Some(app);
    let _ = eframe::run_native(
        "VoxelForge Rust Launcher",
        options,
        Box::new(|_cc| Ok(Box::new(VoxelForgeLauncherApp::default()))),
    );
}
