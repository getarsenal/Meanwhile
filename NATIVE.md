# Native (iOS) features — setup

These power-ups only run inside the **App Store / Capacitor build**. On the web they degrade to a
friendly hint, so the single-file web app is unaffected. The JS is already wired in `index.html`
(the `NATIVE (Capacitor iOS)` section); this doc is the native side you do once in Xcode.

Do the [`APP_STORE.md`](./APP_STORE.md) scaffolding first (`npx cap add ios`). Then:

## 1. Install the plugins

```bash
npm install            # picks up the deps in package.json
npx cap sync ios       # registers the native plugins into the iOS project
```

Plugins used: `@capacitor/app`, `@capacitor/preferences`, `@capacitor/local-notifications`,
`@capacitor-community/contacts`, `@ebarooni/capacitor-calendar`.

## 2. Permission strings (Info.plist)

Add these keys to `ios/App/App/Info.plist` (Apple rejects the build without usage strings for
anything it accesses):

```xml
<key>NSCalendarsUsageDescription</key>
<string>Meanwhile reads your calendar to suggest interview entries you can review.</string>
<key>NSContactsUsageDescription</key>
<string>Meanwhile can pull an interviewer's photo and details from your contacts.</string>
```

Local notifications need no Info.plist string — permission is requested in-app when you tap
**Settings → Turn on reminders**.

## 3. Reminders, Calendar, Contacts — done

Those three work as soon as the plugins are synced and the Info.plist strings are in:

- **Reminders** — Settings → *Turn on reminders*. Schedules local notifications for upcoming
  rounds (1h before), next-step dates, and offer deadlines; reschedules whenever data changes.
- **Calendar scan** — Settings (or the Smart add modal) → *Scan calendar*. Reads the next 30 days,
  keeps interview-looking events, and drops them into Smart add for review.
- **Contacts** — in the Add/Edit person form → *Pull from Contacts* fills name/title/email/URL and
  the photo (shown on the person's avatar).

## 4. Share-into-app (the big one) — a Share Extension

This lets you hit **Share → Meanwhile** on a recruiter email or a LinkedIn profile and have it open
Smart add pre-filled. It needs a small native target Capacitor can't scaffold for you:

1. **App Group.** In Xcode, select the **App** target → Signing & Capabilities → **+ App Groups** →
   add `group.com.scheidelholdings.callback`. (Must match `APP_GROUP` in `index.html`.)
2. **New target:** File → New → Target → **Share Extension**. Name it `ShareToMeanwhile`. Give it the
   **same App Group**.
3. In the extension's `ShareViewController.swift`, write the shared text into the App Group and open
   the app via its `callback://` scheme:

   ```swift
   import UIKit
   import Social
   import MobileCoreServices

   class ShareViewController: UIViewController {
     let group = "group.com.scheidelholdings.callback"
     override func viewDidAppear(_ animated: Bool) {
       super.viewDidAppear(animated)
       guard let item = extensionContext?.inputItems.first as? NSExtensionItem,
             let provider = item.attachments?.first else { return finish() }
       let want = { (t: String) in provider.hasItemConformingToTypeIdentifier(t) }
       let handle: (Any?) -> Void = { value in
         let text = (value as? String) ?? (value as? URL)?.absoluteString ?? ""
         if let d = UserDefaults(suiteName: self.group) { d.set(text, forKey: "shared_intake") }
         if let url = URL(string: "callback://share") {
           // open the host app; extension context can't openURL directly, so use a responder hop
           var r: UIResponder? = self
           while r != nil { if let app = r as? UIApplication { app.perform(#selector(UIApplication.open(_:options:completionHandler:)), with: url); break }; r = r?.next }
         }
         self.finish()
       }
       if want(kUTTypePlainText as String) { provider.loadItem(forTypeIdentifier: kUTTypePlainText as String, options: nil) { v, _ in DispatchQueue.main.async { handle(v) } } }
       else if want(kUTTypeURL as String) { provider.loadItem(forTypeIdentifier: kUTTypeURL as String, options: nil) { v, _ in DispatchQueue.main.async { handle(v) } } }
       else { finish() }
     }
     func finish() { extensionContext?.completeRequest(returningItems: nil) }
   }
   ```

   > The responder-hop `openURL` is the common workaround for opening the host app from a Share
   > Extension. If Apple review flags it, the fallback is: write to the App Group only, and the app
   > picks it up on next launch/resume (the JS already reads `shared_intake` on `resume`).

4. The app side is already handled: on launch/resume it configures `Preferences` with the App Group,
   reads `shared_intake`, clears it, and opens Smart add with the text. The `callback://` scheme is
   already set in `capacitor.config.json`.

## 5. After any web change

`index.html` stays the source of truth — re-run `npx cap copy ios` before each build so the native
shell serves the latest app.
