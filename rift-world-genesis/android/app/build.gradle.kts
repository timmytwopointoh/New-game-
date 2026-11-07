plugins { id("com.android.application") }

android {
    namespace = "com.veilforge.riftworld"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.veilforge.riftworld"
        minSdk = 26
        targetSdk = 28
        versionCode = 2
        versionName = "0.2.0-living-atlas-test"
    }
    signingConfigs {
        create("riftWorldDebug") {
            storeFile = file(System.getenv("RIFT_WORLD_KEYSTORE") ?: "local-debug.keystore")
            storePassword = "android"
            keyAlias = "riftworlddebug"
            keyPassword = "android"
        }
    }
    buildTypes {
        getByName("debug") { signingConfig = signingConfigs.getByName("riftWorldDebug") }
        getByName("release") { isMinifyEnabled = false }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
