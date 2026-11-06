plugins { id("com.android.application") }
android {
 namespace = "com.peks.plunder.rebuilt"
 compileSdk = 35
 defaultConfig { applicationId = "com.peks.plunder.rebuilt"; minSdk = 23; targetSdk = 35; versionCode = 2; versionName = "0.3.0-classic-restoration-test" }
 buildTypes { getByName("release") { isMinifyEnabled = false } }
}
val syncPeksGame by tasks.registering(Copy::class) {
 from("../../game"); into("src/main/assets"); include("*.html", "*.css", "*.js")
}
tasks.named("preBuild") { dependsOn(syncPeksGame) }
