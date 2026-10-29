plugins { id("com.android.application") }
android {
    namespace = "com.peks.plunder"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.peks.plunder"
        minSdk = 23
        targetSdk = 35
        versionCode = 42
        versionName = "0.42"
    }
    buildTypes { getByName("release") { isMinifyEnabled = false } }
}
