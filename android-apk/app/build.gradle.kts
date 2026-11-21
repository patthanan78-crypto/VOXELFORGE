plugins {
    id("com.android.application")
}

android {
    namespace = "io.voxelforge.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "io.voxelforge.app"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.26.3"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("androidx.webkit:webkit:1.12.1")
}
