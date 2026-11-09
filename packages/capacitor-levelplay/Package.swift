// swift-tools-version: 5.9
// Unity LevelPlay 9.7.0 with its Unity Ads adapter 5.13.0 (which brings Unity
// Ads 4.21.0). Both pinned exactly: LevelPlay only supports the adapter
// versions it was released with.
import PackageDescription

let package = Package(
    name: "PolitecarrotCapacitorLevelplay",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "PolitecarrotCapacitorLevelplay",
            targets: ["LevelPlayPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0"),
        .package(url: "https://github.com/ironsource-mobile/LevelPlay-Swift-Package", exact: "9.7.0"),
        .package(url: "https://github.com/ironsource-mobile/LevelPlay-UnityAds-Adapter-Swift-Package", exact: "5.13.0")
    ],
    targets: [
        .target(
            name: "LevelPlayPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "UnityMediationSDK", package: "LevelPlay-Swift-Package"),
                .product(name: "UnityAdsAdapter", package: "LevelPlay-UnityAds-Adapter-Swift-Package")
            ],
            path: "ios/Sources/LevelPlayPlugin")
    ]
)
