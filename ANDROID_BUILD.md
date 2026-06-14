# Bongo Inventory — Android App (Capacitor)

এই project এর সাথে Capacitor configure করা আছে। নিচের steps আপনার নিজের কম্পিউটারে (Lovable-এর বাইরে) চালাতে হবে, কারণ Android APK/AAB build করতে Android Studio + JDK 17 দরকার যা Lovable sandbox এ নেই।

---

## এক-বার এর Setup (Local Machine)

### 1. Requirements
- **Node.js 20+** এবং **bun** বা **npm**
- **Android Studio** (latest) — https://developer.android.com/studio
- **JDK 17** (Android Studio এর সাথে আসে)

### 2. Project Clone & Install
```bash
git clone <your-lovable-github-repo-url>
cd <project-folder>
bun install
```

### 3. Android Platform যোগ করুন
```bash
bunx cap add android
```
এটা `android/` folder তৈরি করবে।

---

## Development Mode (Live Reload থেকে Phone-এ)

`capacitor.config.ts` এ `server.url` already আপনার Lovable preview URL এ set করা আছে। অর্থাৎ phone-এ install করলে Lovable preview সরাসরি load হবে — Lovable-এ যা change করবেন, phone-এ সাথে সাথে দেখাবে।

```bash
bunx cap sync android
bunx cap open android
```
Android Studio খুলবে — phone কে USB debugging mode-এ connect করে ▶ Run চাপুন।

---

## Production APK / AAB (Play Store-ready)

### Step 1: Live-reload off করুন
`capacitor.config.ts` থেকে পুরো `server: { ... }` block টা **delete** করুন। তাহলে app টা bundled web assets থেকে চলবে, internet ছাড়াও UI খুলবে।

### Step 2: Web build তৈরি করুন
```bash
bun run build
```
এটা `dist/client/` এ static files তৈরি করবে।

### Step 3: Capacitor-এ Sync করুন
```bash
bunx cap sync android
```

### Step 4: Android Studio-তে Build করুন
```bash
bunx cap open android
```
Android Studio এ:
- **Debug APK** (test এর জন্য): `Build → Build Bundle(s) / APK(s) → Build APK(s)`
- **Release AAB** (Play Store এর জন্য): `Build → Generate Signed Bundle / APK → Android App Bundle`
  - প্রথমবার নতুন **Keystore** তৈরি করুন এবং নিরাপদে রাখুন (এটা হারালে আর update push করা যাবে না)।

Output file: `android/app/build/outputs/bundle/release/app-release.aab`

### Step 5: Play Store-এ Upload
1. https://play.google.com/console এ Developer account খুলুন ($25 one-time)
2. New app তৈরি করুন → Production track-এ AAB upload করুন
3. Store listing, screenshots, privacy policy দিন
4. Review-এ পাঠান (সাধারণত 1-3 দিন)

---

## App Identity
- **App ID**: `com.nusrattelecom.bongoinventory`
- **App Name**: Bongo Inventory
- **Splash/Status Bar Color**: #1E1B4B (Royal Indigo)

App icon পরিবর্তন করতে: `android/app/src/main/res/mipmap-*/` এ icon গুলো replace করুন, অথবা Android Studio এর **Image Asset Studio** ব্যবহার করুন (`File → New → Image Asset`)।

---

## Backend Note
App backend (Lovable Cloud / Supabase) cloud-এ চলে, তাই APK build করলেও database, login, POS sync সব আগের মতই কাজ করবে — শুধু internet দরকার।

---

কোনো step-এ আটকে গেলে জানান, আমি guide করব।
