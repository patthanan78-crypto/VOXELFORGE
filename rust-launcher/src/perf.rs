use crate::versions::{MinecraftRelease, PerformancePreset, PlatformTarget};

#[derive(Debug, Clone)]
pub struct LaunchTune {
    pub graphics_backend: &'static str,
    pub render_distance_chunks: u8,
    pub max_heap_mb: u32,
    pub jvm_flags: Vec<String>,
    pub wgpu_present_mode: &'static str,
}

pub fn build_optimal_tune(
    release: &MinecraftRelease,
    platform: PlatformTarget,
    preset: PerformancePreset,
) -> LaunchTune {
    let graphics_backend = match platform {
        PlatformTarget::WindowsX64 => "Vulkan / DirectX 12 (wgpu)",
        PlatformTarget::AndroidArm64 => "Vulkan 1.3 Mobile / GLES 3.2",
    };

    let render_distance_chunks = match (platform, preset) {
        (PlatformTarget::AndroidArm64, PerformancePreset::UltraFps) => 6,
        (PlatformTarget::AndroidArm64, PerformancePreset::Balanced) => 10,
        (PlatformTarget::AndroidArm64, PerformancePreset::Vibrant) => 14,
        (PlatformTarget::WindowsX64, PerformancePreset::UltraFps) => 10,
        (PlatformTarget::WindowsX64, PerformancePreset::Balanced) => 16,
        (PlatformTarget::WindowsX64, PerformancePreset::Vibrant) => 24,
    };

    let max_heap_mb = match platform {
        PlatformTarget::AndroidArm64 => release.min_ram_mb.max(2048),
        PlatformTarget::WindowsX64 => release.min_ram_mb.max(4096),
    };

    let mut jvm_flags = vec![
        format!("-Xms{}M", (max_heap_mb / 2).max(512)),
        format!("-Xmx{}M", max_heap_mb),
        "-XX:+UnlockExperimentalVMOptions".to_string(),
        "-XX:+AlwaysPreTouch".to_string(),
    ];

    if release.java_major >= 21 {
        jvm_flags.push("-XX:+UseZGC".to_string());
        jvm_flags.push("-XX:+ZGenerational".to_string());
    } else {
        jvm_flags.push("-XX:+UseG1GC".to_string());
        jvm_flags.push("-XX:MaxGCPauseMillis=16".to_string());
    }

    let wgpu_present_mode = match preset {
        PerformancePreset::UltraFps => "Immediate (Uncapped FPS)",
        PerformancePreset::Balanced => "Mailbox (Low-Latency Triple Buffer)",
        PerformancePreset::Vibrant => "Fifo (Tear-Free VSync)",
    };

    LaunchTune {
        graphics_backend,
        render_distance_chunks,
        max_heap_mb,
        jvm_flags,
        wgpu_present_mode,
    }
}
