plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }
android {
    namespace = "com.peckscove.capers"
    compileSdk = 35
    defaultConfig { applicationId = "com.peckscove.capers"; minSdk = 26; targetSdk = 35; versionCode = 10; versionName = "0.9.1" }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
    sourceSets.getByName("main").assets.srcDirs("../../web")

    // Only TEST signing: the private key lives in GitHub Actions secrets, never Git.
    signingConfigs {
        create("persistentDebug") {
            storeFile = file(System.getenv("PEKS_TEST_KEYSTORE_PATH") ?: "MISSING-PERSISTENT-SIGNING-KEY.p12")
            storePassword = System.getenv("PEKS_TEST_STORE_PASSWORD") ?: ""
            keyAlias = "peks_test"
            keyPassword = System.getenv("PEKS_TEST_KEY_PASSWORD") ?: ""
        }
    }
    buildTypes {
        getByName("debug") {
            signingConfig = signingConfigs.getByName("persistentDebug")
        }
    }
}
