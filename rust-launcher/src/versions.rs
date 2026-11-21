use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PlatformTarget {
    WindowsX64,
    AndroidArm64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PerformancePreset {
    UltraFps,
    Balanced,
    Vibrant,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MinecraftRelease {
    pub id: &'static str,
    pub title: &'static str,
    pub era: &'static str,
    pub year: u16,
    pub java_major: u8,
    pub min_ram_mb: u32,
}

pub fn version_catalog() -> Vec<MinecraftRelease> {
    vec![
        MinecraftRelease { id: "1.26.3", title: "Vibrant Horizons", era: "Next-Gen", year: 2026, java_major: 21, min_ram_mb: 2048 },
        MinecraftRelease { id: "1.26.2", title: "Pale Canopy", era: "Next-Gen", year: 2026, java_major: 21, min_ram_mb: 2048 },
        MinecraftRelease { id: "1.26.1", title: "Skyward Patch", era: "Next-Gen", year: 2026, java_major: 21, min_ram_mb: 2048 },
        MinecraftRelease { id: "1.26.0", title: "Alpine Overhaul", era: "Next-Gen", year: 2026, java_major: 21, min_ram_mb: 2048 },
        MinecraftRelease { id: "1.25.2", title: "Meadow Springs", era: "Next-Gen", year: 2025, java_major: 21, min_ram_mb: 2048 },
        MinecraftRelease { id: "1.24.1", title: "Wildwood", era: "Next-Gen", year: 2025, java_major: 21, min_ram_mb: 2048 },
        MinecraftRelease { id: "1.23.2", title: "Pale Garden", era: "Next-Gen", year: 2024, java_major: 21, min_ram_mb: 2048 },
        MinecraftRelease { id: "1.22.0", title: "Bundles & Stride", era: "Next-Gen", year: 2024, java_major: 21, min_ram_mb: 2048 },
        MinecraftRelease { id: "1.21.4", title: "Tricky Trials", era: "Caves & Trials", year: 2024, java_major: 21, min_ram_mb: 2048 },
        MinecraftRelease { id: "1.20.4", title: "Trails & Tales", era: "Caves & Trials", year: 2023, java_major: 17, min_ram_mb: 2048 },
        MinecraftRelease { id: "1.19.4", title: "The Wild Update", era: "Caves & Trials", year: 2022, java_major: 17, min_ram_mb: 2048 },
        MinecraftRelease { id: "1.18.2", title: "Caves & Cliffs II", era: "Caves & Cliffs", year: 2022, java_major: 17, min_ram_mb: 2048 },
        MinecraftRelease { id: "1.17.1", title: "Caves & Cliffs I", era: "Aquatic & Nether", year: 2021, java_major: 16, min_ram_mb: 1536 },
        MinecraftRelease { id: "1.16.5", title: "Nether Update", era: "Aquatic & Nether", year: 2021, java_major: 8, min_ram_mb: 1536 },
        MinecraftRelease { id: "1.14.4", title: "Village & Pillage", era: "Aquatic & Nether", year: 2019, java_major: 8, min_ram_mb: 1536 },
        MinecraftRelease { id: "1.13.2", title: "Update Aquatic", era: "Aquatic & Nether", year: 2018, java_major: 8, min_ram_mb: 1536 },
        MinecraftRelease { id: "1.12.2", title: "World of Color", era: "Modern Classic", year: 2017, java_major: 8, min_ram_mb: 1024 },
        MinecraftRelease { id: "1.8.9", title: "Bountiful Update", era: "Modern Classic", year: 2015, java_major: 8, min_ram_mb: 1024 },
        MinecraftRelease { id: "1.7.10", title: "Update That Changed the World", era: "Classic", year: 2014, java_major: 8, min_ram_mb: 1024 },
        MinecraftRelease { id: "1.5.2", title: "Redstone Update", era: "Classic", year: 2013, java_major: 8, min_ram_mb: 768 },
        MinecraftRelease { id: "1.2.5", title: "Jungle & Height", era: "Classic", year: 2012, java_major: 8, min_ram_mb: 512 },
        MinecraftRelease { id: "1.0.0", title: "Adventure Update", era: "Classic", year: 2011, java_major: 8, min_ram_mb: 512 },
    ]
}
