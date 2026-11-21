plugins {
    id("com.android.application")
}

android {
    namespace = "io.voxelforge.launcher"
    compileSdk = 34

    defaultConfig {
        applicationId = "io.voxelforge.launcher"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "0.26.3"
        ndk {
            abiFilters += listOf("arm64-v8a")
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    sourceSets {
        getByName("main") {
            jniLibs.srcDirs("src/main/jniLibs")
        }
    }
}
