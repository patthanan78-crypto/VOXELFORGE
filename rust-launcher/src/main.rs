use eframe::egui;
use voxelforge_launcher::VoxelForgeLauncherApp;

fn main() -> eframe::Result<()> {
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size([1180.0, 740.0])
            .with_title("VoxelForge Rust Launcher — Windows & Android"),
        renderer: eframe::Renderer::Wgpu,
        ..Default::default()
    };

    eframe::run_native(
        "VoxelForge Rust Launcher",
        options,
        Box::new(|_cc| Ok(Box::new(VoxelForgeLauncherApp::default()))),
    )
}
