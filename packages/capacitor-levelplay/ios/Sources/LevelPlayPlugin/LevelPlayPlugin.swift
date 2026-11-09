import Foundation
import UIKit
import Capacitor
import IronSource
import AppTrackingTransparency

/// Unity LevelPlay interstitials, consent and App Tracking Transparency.
///
/// JS name: "LevelPlay". It answers the same calls, with the same arguments
/// and results, as the studio's Unity Ads plugin, so the app drives it with
/// that package's JS client (see src/ads/index.ts): `gameId` carries the
/// LevelPlay app key and `placementId` the interstitial ad unit ID.
///
/// Every method resolves rather than rejects for expected failures (no fill,
/// not ready) so the game never sees an unhandled promise.
///
/// The class annotation below must stay the only objc annotation with a plain
/// name in this file: `cap sync` registers the first one it finds as the
/// plugin class. Selector annotations (with a colon) do not count.
@objc(LevelPlayPlugin)
public class LevelPlayPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LevelPlayPlugin"
    public let jsName = "LevelPlay"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "initialize", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setConsent", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "prepareInterstitial", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showInterstitial", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "trackingAuthorizationStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestTrackingAuthorization", returnType: CAPPluginReturnPromise)
    ]

    private static let log = "[PoliteCarrot LevelPlay]"

    private var initialized = false
    /// Calls waiting on an initialisation already under way.
    private var initCalls: [CAPPluginCall] = []

    /// The interstitial for the current consent answer. LevelPlay reloads the
    /// same object after each show; a consent change replaces it, so an ad
    /// fetched under the old answer is never shown.
    private var interstitial: InterstitialListener?
    private var showCall: CAPPluginCall?

    // MARK: - Initialisation and consent

    @objc func initialize(_ call: CAPPluginCall) {
        guard let appKey = call.getString("gameId"), !appKey.isEmpty else {
            call.reject("appKey is required")
            return
        }
        DispatchQueue.main.async {
            if self.initialized {
                call.resolve(["initialized": true])
                return
            }
            self.initCalls.append(call)
            if self.initCalls.count > 1 { return }
            let request = LPMInitRequestBuilder(appKey: appKey).build()
            LevelPlay.initWith(request) { _, error in
                DispatchQueue.main.async {
                    let calls = self.initCalls
                    self.initCalls = []
                    if let error = error as NSError? {
                        NSLog("%@ Init failed: %@", Self.log, error.localizedDescription)
                        calls.forEach { $0.reject(error.localizedDescription, String(error.code)) }
                    } else {
                        NSLog("%@ Initialised, SDK %@", Self.log, LevelPlay.sdkVersion())
                        self.initialized = true
                        calls.forEach { $0.resolve(["initialized": true]) }
                    }
                }
            }
        }
    }

    /// granted = the player turned personalised ads on AND iOS tracking is
    /// authorised. LevelPlay passes these on to every network, and they can be
    /// set before or after initialisation.
    @objc func setConsent(_ call: CAPPluginCall) {
        let granted = call.getBool("granted") ?? false
        DispatchQueue.main.async {
            LPMPrivacySettings.setGDPRConsent(granted)
            // CCPA's flag means "do not sell", the opposite of consent.
            LPMPrivacySettings.setCCPA(!granted)
            // Drop any ad loaded, or loading, under the old answer. Not the
            // one on screen: its listener stays alive until it closes.
            if let old = self.interstitial, old !== self.showingListener {
                old.abandon()
            }
            self.interstitial = nil
            call.resolve()
        }
    }

    // MARK: - Interstitials

    private var showingListener: InterstitialListener?

    @objc func prepareInterstitial(_ call: CAPPluginCall) {
        guard let adUnitId = call.getString("placementId"), !adUnitId.isEmpty else {
            call.reject("placementId is required")
            return
        }
        // force: an ad loaded under an old consent answer is thrown away.
        let force = call.getBool("force") ?? false
        DispatchQueue.main.async {
            guard self.initialized else {
                call.resolve(["loaded": false, "reason": "not initialised"])
                return
            }
            if force || self.interstitial?.adUnitId != adUnitId {
                if let old = self.interstitial, old !== self.showingListener { old.abandon() }
                self.interstitial = nil
            }
            let listener = self.interstitial ?? InterstitialListener(adUnitId: adUnitId, owner: self)
            self.interstitial = listener
            listener.load(call)
        }
    }

    @objc func showInterstitial(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let listener = self.interstitial, listener.ad.isAdReady() else {
                call.resolve(["shown": false, "reason": "not loaded"])
                return
            }
            guard let vc = self.bridge?.viewController else {
                call.resolve(["shown": false, "reason": "no view controller"])
                return
            }
            if self.showCall != nil {
                call.resolve(["shown": false, "reason": "already showing"])
                return
            }
            guard UIApplication.shared.applicationState == .active,
                  vc.viewIfLoaded?.window != nil,
                  vc.presentedViewController == nil,
                  !vc.isBeingDismissed else {
                call.resolve(["shown": false, "reason": "presenter not available"])
                return
            }
            self.showCall = call
            self.showingListener = listener
            NSLog("%@ Presenting interstitial", Self.log)
            listener.ad.showAd(viewController: vc, placementName: nil)
        }
    }

    fileprivate func interstitialClosed(_ listener: InterstitialListener) {
        guard showingListener === listener else { return }
        NSLog("%@ Interstitial closed", Self.log)
        showCall?.resolve(["shown": true, "finishState": "completed"])
        showCall = nil
        showingListener = nil
    }

    fileprivate func interstitialFailedToShow(_ listener: InterstitialListener, _ error: NSError) {
        guard showingListener === listener else { return }
        NSLog("%@ Interstitial failed to show: %@", Self.log, error.localizedDescription)
        showCall?.resolve(["shown": false, "reason": error.localizedDescription, "code": error.code])
        showCall = nil
        showingListener = nil
    }

    // MARK: - App Tracking Transparency
    // The same result shape as the Unity plugin's:
    // { status: authorized | denied | notDetermined | restricted }.

    @objc func trackingAuthorizationStatus(_ call: CAPPluginCall) {
        call.resolve(["status": Self.statusString(ATTrackingManager.trackingAuthorizationStatus)])
    }

    @objc func requestTrackingAuthorization(_ call: CAPPluginCall) {
        // iOS only shows the prompt while the app is active; the request is
        // silently answered "notDetermined" otherwise, so wait for active.
        DispatchQueue.main.async {
            if UIApplication.shared.applicationState == .active {
                self.requestTracking(call)
            } else {
                var token: NSObjectProtocol?
                token = NotificationCenter.default.addObserver(
                    forName: UIApplication.didBecomeActiveNotification,
                    object: nil,
                    queue: .main
                ) { _ in
                    if let t = token { NotificationCenter.default.removeObserver(t) }
                    self.requestTracking(call)
                }
            }
        }
    }

    private func requestTracking(_ call: CAPPluginCall) {
        ATTrackingManager.requestTrackingAuthorization { status in
            call.resolve(["status": Self.statusString(status)])
        }
    }

    private static func statusString(_ status: ATTrackingManager.AuthorizationStatus) -> String {
        switch status {
        case .authorized: return "authorized"
        case .denied: return "denied"
        case .restricted: return "restricted"
        case .notDetermined: return "notDetermined"
        @unknown default: return "notDetermined"
        }
    }
}

/// One LevelPlay interstitial object and its callbacks. LevelPlay holds its
/// delegate weakly, so the plugin keeps this alive for as long as the ad is.
private final class InterstitialListener: NSObject, LPMInterstitialAdDelegate {
    let adUnitId: String
    let ad: LPMInterstitialAd
    private weak var owner: LevelPlayPlugin?
    /// Calls waiting for the load under way; all get its result.
    private var loadCalls: [CAPPluginCall] = []
    private var loading = false
    private var abandoned = false

    init(adUnitId: String, owner: LevelPlayPlugin) {
        self.adUnitId = adUnitId
        self.ad = LPMInterstitialAd(adUnitId: adUnitId)
        self.owner = owner
        super.init()
        ad.setDelegate(self)
    }

    /// Resolves `{ loaded }` once an ad is ready, or after 10 seconds with
    /// `loaded: false`. A load that finishes after that is still kept, and the
    /// next call finds it ready.
    func load(_ call: CAPPluginCall) {
        if ad.isAdReady() {
            call.resolve(["loaded": true])
            return
        }
        loadCalls.append(call)
        DispatchQueue.main.asyncAfter(deadline: .now() + 10) { [weak self] in
            guard let self = self, let index = self.loadCalls.firstIndex(where: { $0 === call }) else { return }
            self.loadCalls.remove(at: index)
            call.resolve(["loaded": false, "reason": "load timed out"])
        }
        if !loading {
            loading = true
            ad.loadAd()
        }
    }

    /// The consent answer changed: anyone waiting is told no, and the ad is
    /// never shown.
    func abandon() {
        abandoned = true
        settle(["loaded": false, "reason": "consent changed"])
    }

    private func settle(_ result: [String: Any]) {
        loading = false
        let calls = loadCalls
        loadCalls = []
        calls.forEach { $0.resolve(result) }
    }

    @objc(didLoadAdWithAdInfo:)
    func didLoadAd(with adInfo: LPMAdInfo) {
        guard !abandoned else { return }
        NSLog("[PoliteCarrot LevelPlay] Interstitial loaded from %@", adInfo.adNetwork)
        settle(["loaded": true])
    }

    @objc(didFailToLoadAdWithAdUnitId:error:)
    func didFailToLoadAd(withAdUnitId adUnitId: String, error: Error) {
        guard !abandoned else { return }
        let error = error as NSError
        settle(["loaded": false, "reason": error.localizedDescription, "code": error.code])
    }

    @objc(didDisplayAdWithAdInfo:)
    func didDisplayAd(with adInfo: LPMAdInfo) {
        NSLog("[PoliteCarrot LevelPlay] Interstitial shown from %@", adInfo.adNetwork)
    }

    @objc(didFailToDisplayAdWithAdInfo:error:)
    func didFailToDisplayAd(with adInfo: LPMAdInfo, error: Error) {
        owner?.interstitialFailedToShow(self, error as NSError)
    }

    @objc(didCloseAdWithAdInfo:)
    func didCloseAd(with adInfo: LPMAdInfo) {
        owner?.interstitialClosed(self)
    }
}
