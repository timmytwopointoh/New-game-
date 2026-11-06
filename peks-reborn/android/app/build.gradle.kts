plugins { id("com.android.application") }
android {
 namespace = "com.peks.plunder.rebuilt"
 compileSdk = 35
 defaultConfig { applicationId = "com.peks.plunder.rebuilt"; minSdk = 23; targetSdk = 35; versionCode = 1; versionName = "1.0.0-prealpha" }
 buildTypes { getByName("release") { isMinifyEnabled = false } }
}
val syncPeksGame by tasks.registering(Copy::class) {
 from("../../game"); into("src/main/assets"); include("*.html", "*.css", "*.js")
}
tasks.named("preBuild") { dependsOn(syncPeksGame) }
