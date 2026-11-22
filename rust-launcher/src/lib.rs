pub mod perf;
pub mod versions;

use eframe::egui;
use md5::{Digest, Md5};
use perf::{build_optimal_tune, LaunchTune};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tokio::process::Command;
use versions::{version_catalog, MinecraftRelease, PerformancePreset, PlatformTarget};

const MOJANG_MANIFEST_URL: &str =
    "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
const RESOURCES_BASE_URL: &str = "https://resources.download.minecraft.net";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AccountMode {
    OfflineFree,
    MicrosoftOnline,
}

#[derive(Debug, Clone)]
pub struct AuthenticatedJavaSession {
    pub username: String,
    pub uuid: String,
    pub access_token: String,
    pub user_type: &'static str,
}

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
struct AssetIndexObjects {
    objects: HashMap<String, AssetObjectEntry>,
}

#[derive(Debug, Deserialize)]
struct AssetObjectEntry {
    hash: String,
}

#[derive(Debug, Deserialize)]
struct VersionDownloads {
    client: ArtifactRef,
}

#[derive(Debug, Deserialize)]
struct ArtifactRef {
    url: String,
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

#[derive(Debug, Deserialize)]
struct DeviceCodeResponse {
    device_code: String,
    user_code: String,
    verification_uri: String,
    interval: Option<u64>,
    expires_in: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct MsTokenResponse {
    access_token: Option<String>,
    error: Option<String>,
}

#[derive(Debug, Serialize)]
struct XblAuthRequest<'a> {
    #[serde(rename = "Properties")]
    properties: XblProperties<'a>,
    #[serde(rename = "RelyingParty")]
    relying_party: &'a str,
    #[serde(rename = "TokenType")]
    token_type: &'a str,
}

#[derive(Debug, Serialize)]
struct XblProperties<'a> {
    #[serde(rename = "AuthMethod")]
    auth_method: &'a str,
    #[serde(rename = "SiteName")]
    site_name: &'a str,
    #[serde(rename = "RpsTicket")]
    rps_ticket: String,
}

#[derive(Debug, Serialize)]
struct XstsAuthRequest<'a> {
    #[serde(rename = "Properties")]
    properties: XstsProperties<'a>,
    #[serde(rename = "RelyingParty")]
    relying_party: &'a str,
    #[serde(rename = "TokenType")]
    token_type: &'a str,
}

#[derive(Debug, Serialize)]
struct XstsProperties<'a> {
    #[serde(rename = "SandboxId")]
    sandbox_id: &'a str,
    #[serde(rename = "UserTokens")]
    user_tokens: Vec<&'a str>,
}

#[derive(Debug, Deserialize)]
struct XboxAuthResponse {
    #[serde(rename = "Token")]
    token: String,
    #[serde(rename = "DisplayClaims")]
    display_claims: XboxDisplayClaims,
}

#[derive(Debug, Deserialize)]
struct XboxDisplayClaims {
    xui: Vec<XboxXui>,
}

#[derive(Debug, Deserialize)]
struct XboxXui {
    uhs: String,
}

#[derive(Debug, Serialize)]
struct McLoginWithXbox<'a> {
    #[serde(rename = "identityToken")]
    identity_token: String,
}

#[derive(Debug, Deserialize)]
struct McAuthResponse {
    access_token: String,
}

#[derive(Debug, Deserialize)]
struct McProfileResponse {
    id: String,
    name: String,
}

/// Computes the exact standard Java Edition Offline UUID v3 (`OfflinePlayer:<username>`).
pub fn offline_uuid_v3(username: &str) -> String {
    let clean = username.trim();
    let final_name = if clean.is_empty() { "Player" } else { clean };
    let mut hasher = Md5::new();
    hasher.update(format!("OfflinePlayer:{final_name}").as_bytes());
    let mut bytes: [u8; 16] = hasher.finalize().into();
    bytes[6] = (bytes[6] & 0x0f) | 0x30; // Version 3
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
    format!(
        "{:02x}{:02x}{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}",
        bytes[0], bytes[1], bytes[2], bytes[3],
        bytes[4], bytes[5], bytes[6], bytes[7],
        bytes[8], bytes[9], bytes[10], bytes[11],
        bytes[12], bytes[13], bytes[14], bytes[15]
    )
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

/// Real Microsoft OAuth 2.0 Device Code -> Xbox Live -> XSTS -> Minecraft Java Services login.
pub async fn authenticate_microsoft_device_code(
    client_id: String,
    status_arc: Arc<Mutex<String>>,
) -> Result<AuthenticatedJavaSession, String> {
    let trimmed_id = client_id.trim();
    if trimmed_id.is_empty() {
        return Err("Enter your Azure AD Client ID for Microsoft Device Code login, or use Offline Free mode.".to_string());
    }

    let http = reqwest::Client::new();
    let dc: DeviceCodeResponse = http
        .post("https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode")
        .form(&[
            ("client_id", trimmed_id),
            ("scope", "XboxLive.signin offline_access"),
        ])
        .send()
        .await
        .map_err(|e| format!("Device code request failed: {e}"))?
        .error_for_status()
        .map_err(|e| format!("Device code error: {e}"))?
        .json()
        .await
        .map_err(|e| format!("Invalid device code JSON: {e}"))?;

    *status_arc.lock().unwrap() = format!(
        "Open {} and enter code: {}",
        dc.verification_uri, dc.user_code
    );

    let poll_interval = dc.interval.unwrap_or(5).max(3);
    let max_polls = (dc.expires_in.unwrap_or(300) / poll_interval).max(12);
    let mut msa_access_token: Option<String> = None;

    for _ in 0..max_polls {
        tokio::time::sleep(std::time::Duration::from_secs(poll_interval)).await;
        let resp: MsTokenResponse = http
            .post("https://login.microsoftonline.com/consumers/oauth2/v2.0/token")
            .form(&[
                ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
                ("client_id", trimmed_id),
                ("device_code", dc.device_code.as_str()),
            ])
            .send()
            .await
            .map_err(|e| format!("Token poll failed: {e}"))?
            .json()
            .await
            .map_err(|e| format!("Invalid token JSON: {e}"))?;

        if let Some(tok) = resp.access_token {
            msa_access_token = Some(tok);
            break;
        }
        if let Some(err) = resp.error {
            if err != "authorization_pending" && err != "slow_down" {
                return Err(format!("Microsoft sign-in aborted: {err}"));
            }
        }
    }

    let msa_token = msa_access_token.ok_or_else(|| "Microsoft Device Code timed out.".to_string())?;
    *status_arc.lock().unwrap() = "Authenticating with Xbox Live...".to_string();

    let xbl: XboxAuthResponse = http
        .post("https://user.auth.xboxlive.com/user/authenticate")
        .json(&XblAuthRequest {
            properties: XblProperties {
                auth_method: "RPS",
                site_name: "user.auth.xboxlive.com",
                rps_ticket: format!("d={msa_token}"),
            },
            relying_party: "http://auth.xboxlive.com",
            token_type: "JWT",
        })
        .send()
        .await
        .map_err(|e| format!("Xbox Live auth failed: {e}"))?
        .error_for_status()
        .map_err(|e| format!("Xbox Live HTTP error: {e}"))?
        .json()
        .await
        .map_err(|e| format!("Invalid XBL JSON: {e}"))?;

    let xsts: XboxAuthResponse = http
        .post("https://xsts.auth.xboxlive.com/xsts/authorize")
        .json(&XstsAuthRequest {
            properties: XstsProperties {
                sandbox_id: "RETAIL",
                user_tokens: vec![xbl.token.as_str()],
            },
            relying_party: "rp://api.minecraftservices.com/",
            token_type: "JWT",
        })
        .send()
        .await
        .map_err(|e| format!("XSTS auth failed: {e}"))?
        .error_for_status()
        .map_err(|e| format!("XSTS HTTP error: {e}"))?
        .json()
        .await
        .map_err(|e| format!("Invalid XSTS JSON: {e}"))?;

    let uhs = xsts
        .display_claims
        .xui
        .first()
        .map(|x| x.uhs.clone())
        .ok_or_else(|| "Missing Xbox userhash".to_string())?;

    *status_arc.lock().unwrap() = "Verifying Minecraft Java Edition entitlement...".to_string();

    let mc_auth: McAuthResponse = http
        .post("https://api.minecraftservices.com/authentication/login_with_xbox")
        .json(&McLoginWithXbox {
            identity_token: format!("XBL3.0 x={};{}", uhs, xsts.token),
        })
        .send()
        .await
        .map_err(|e| format!("Minecraft auth failed: {e}"))?
        .error_for_status()
        .map_err(|e| format!("Minecraft Services HTTP error: {e}"))?
        .json()
        .await
        .map_err(|e| format!("Invalid MC auth JSON: {e}"))?;

    let profile: McProfileResponse = http
        .get("https://api.minecraftservices.com/minecraft/profile")
        .bearer_auth(&mc_auth.access_token)
        .send()
        .await
        .map_err(|e| format!("Profile fetch failed: {e}"))?
        .error_for_status()
        .map_err(|_| "This Microsoft account does not own Minecraft: Java Edition.".to_string())?
        .json()
        .await
        .map_err(|e| format!("Invalid MC profile JSON: {e}"))?;

    Ok(AuthenticatedJavaSession {
        username: profile.name,
        uuid: profile.id,
        access_token: mc_auth.access_token,
        user_type: "msa",
    })
}

/// Downloads official Mojang version metadata, client.jar, libraries, assets, and spawns Minecraft Java Edition.
pub async fn launch_official_minecraft(
    version_id: String,
    platform: PlatformTarget,
    tune: LaunchTune,
    game_dir: PathBuf,
    session: AuthenticatedJavaSession,
    server_address: Option<String>,
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

    if let Ok(index_raw) = tokio::fs::read(&asset_index_path).await {
        if let Ok(parsed_assets) = serde_json::from_slice::<AssetIndexObjects>(&index_raw) {
            let objects_dir = game_dir.join("assets").join("objects");
            for (_name, obj) in parsed_assets.objects {
                if obj.hash.len() >= 2 {
                    let prefix = &obj.hash[0..2];
                    let obj_path = objects_dir.join(prefix).join(&obj.hash);
                    let obj_url = format!("{RESOURCES_BASE_URL}/{prefix}/{}", obj.hash);
                    let _ = download_if_missing(&http, &obj_url, &obj_path).await;
                }
            }
        }
    }

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

    let cp_sep = if matches!(platform, PlatformTarget::WindowsX64) && cfg!(target_os = "windows") {
        ";"
    } else {
        ":"
    };
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
        .arg(&session.username)
        .arg("--uuid")
        .arg(&session.uuid)
        .arg("--version")
        .arg(&details.id)
        .arg("--gameDir")
        .arg(&game_dir)
        .arg("--assetsDir")
        .arg(game_dir.join("assets"))
        .arg("--assetIndex")
        .arg(&details.asset_index.id)
        .arg("--accessToken")
        .arg(&session.access_token)
        .arg("--userType")
        .arg(session.user_type);

    if let Some(addr) = server_address {
        let trimmed = addr.trim();
        if !trimmed.is_empty() {
            let mut parts = trimmed.splitn(2, ':');
            if let Some(host) = parts.next() {
                cmd.arg("--server").arg(host);
                if let Some(port) = parts.next() {
                    cmd.arg("--port").arg(port);
                }
            }
        }
    }

    cmd.spawn()
        .map_err(|e| format!("Failed spawning {java_bin}: {e}"))?;

    Ok(format!(
        "Launched Minecraft Java {} as {} ({})",
        details.id, session.username, session.user_type
    ))
}

pub struct VoxelForgeLauncherApp {
    releases: Vec<MinecraftRelease>,
    selected_idx: usize,
    platform: PlatformTarget,
    preset: PerformancePreset,
    account_mode: AccountMode,
    search_query: String,
    offline_username: String,
    azure_client_id: String,
    server_address: String,
    msa_session: Arc<Mutex<Option<AuthenticatedJavaSession>>>,
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
            account_mode: AccountMode::OfflineFree,
            search_query: String::new(),
            offline_username: "Player".to_string(),
            azure_client_id: String::new(),
            server_address: String::new(),
            msa_session: Arc::new(Mutex::new(None)),
            status_line: Arc::new(Mutex::new(
                "Ready — Offline Free mode or Microsoft Java Account".to_string(),
            )),
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
            ui.heading("VoxelForge Java Edition Launcher (1.0 - 26.3)");

            ui.horizontal(|ui| {
                ui.selectable_value(&mut self.account_mode, AccountMode::OfflineFree, "Offline Free (No Account)");
                ui.selectable_value(&mut self.account_mode, AccountMode::MicrosoftOnline, "Microsoft Account (Online Java)");
            });

            match self.account_mode {
                AccountMode::OfflineFree => {
                    ui.horizontal(|ui| {
                        ui.label("Offline Username:");
                        ui.add(egui::TextEdit::singleline(&mut self.offline_username).desired_width(180.0));
                        ui.label(format!("UUID: {}", offline_uuid_v3(&self.offline_username)));
                    });
                }
                AccountMode::MicrosoftOnline => {
                    ui.horizontal(|ui| {
                        ui.label("Azure Client ID:");
                        ui.add(egui::TextEdit::singleline(&mut self.azure_client_id).hint_text("Enter Azure AD App Client ID").desired_width(240.0));
                        if ui.button("Sign In (Device Code)").clicked() {
                            let client_id = self.azure_client_id.clone();
                            let status_arc = Arc::clone(&self.status_line);
                            let session_arc = Arc::clone(&self.msa_session);
                            *status_arc.lock().unwrap() = "Requesting Microsoft device code...".to_string();
                            self.runtime.spawn(async move {
                                match authenticate_microsoft_device_code(client_id, Arc::clone(&status_arc)).await {
                                    Ok(sess) => {
                                        let name = sess.username.clone();
                                        *session_arc.lock().unwrap() = Some(sess);
                                        *status_arc.lock().unwrap() = format!("Signed in with Microsoft Java: {name}");
                                    }
                                    Err(err) => {
                                        *status_arc.lock().unwrap() = err;
                                    }
                                }
                            });
                        }
                    });
                    if let Some(sess) = self.msa_session.lock().unwrap().as_ref() {
                        ui.label(format!("Active Microsoft Profile: {} ({})", sess.username, sess.uuid));
                    }
                }
            }

            ui.separator();
            ui.horizontal(|ui| {
                ui.selectable_value(&mut self.platform, PlatformTarget::WindowsX64, "Windows x64");
                ui.selectable_value(&mut self.platform, PlatformTarget::AndroidArm64, "Android ARM64");
                ui.separator();
                ui.selectable_value(&mut self.preset, PerformancePreset::UltraFps, "Ultra FPS");
                ui.selectable_value(&mut self.preset, PerformancePreset::Balanced, "Balanced");
                ui.selectable_value(&mut self.preset, PerformancePreset::Vibrant, "Vibrant");
            });

            ui.horizontal(|ui| {
                ui.add(egui::TextEdit::singleline(&mut self.search_query).hint_text("Filter version (26.3, 1.21.4, 1.8.9)..."));
                ui.add(egui::TextEdit::singleline(&mut self.server_address).hint_text("Optional server (ip:port)"));
            });

            egui::ScrollArea::vertical().max_height(220.0).show(ui, |ui| {
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
            ui.label(format!("JVM Flags: {}", tune.jvm_flags.join(" ")));

            let ver_id = self.releases[self.selected_idx].id.to_string();
            if ui.button(format!("Download & Launch Java Edition {}", ver_id)).clicked() {
                let status_arc = Arc::clone(&self.status_line);
                let platform = self.platform;
                let server = if self.server_address.trim().is_empty() {
                    None
                } else {
                    Some(self.server_address.clone())
                };
                let session_opt = match self.account_mode {
                    AccountMode::OfflineFree => {
                        let name = if self.offline_username.trim().is_empty() {
                            "Player".to_string()
                        } else {
                            self.offline_username.trim().to_string()
                        };
                        let uuid = offline_uuid_v3(&name);
                        Some(AuthenticatedJavaSession {
                            username: name,
                            uuid,
                            access_token: "0".to_string(),
                            user_type: "legacy",
                        })
                    }
                    AccountMode::MicrosoftOnline => self.msa_session.lock().unwrap().clone(),
                };

                if let Some(session) = session_opt {
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
                            session,
                            server,
                        )
                        .await;
                        *status_arc.lock().unwrap() = match result {
                            Ok(ok) => ok,
                            Err(err) => format!("Launch error: {err}"),
                        };
                    });
                } else {
                    *status_arc.lock().unwrap() = "Sign in with Microsoft first, or switch to Offline Free mode.".to_string();
                }
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
        "VoxelForge Java Edition Launcher",
        options,
        Box::new(|_cc| Ok(Box::new(VoxelForgeLauncherApp::default()))),
    );
}
