plugins { id("com.android.application") }

android {
    namespace = "com.veilforge.riftworld"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.veilforge.riftworld"
        minSdk = 26
        targetSdk = 28
        versionCode = 1
        versionName = "0.1.0-genesis-alpha"
    }
    buildTypes {
        getByName("release") { isMinifyEnabled = false }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
