plugins { id("com.android.application") }
android {
 namespace = "com.sectoruprising.afterlight"
 compileSdk = 35
 defaultConfig { applicationId = "com.sectoruprising.afterlight"; minSdk = 26; targetSdk = 35; versionCode = 1; versionName = "0.1.0-afterlight-prototype" }
 buildTypes { release { isMinifyEnabled = false } }
 compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
 sourceSets { getByName("main").assets.srcDirs("src/main/assets") }
}
