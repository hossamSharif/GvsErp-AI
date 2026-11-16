# License keys — owner guide / دليل المالك

Tools to create license keys for the **Local Edition**. They run with plain
Node.js (v18+) on **your own PC** — no extra packages.

## How licensing works

- A new installation gets a **14-day free trial** (up to 3 users).
- After the trial, or when a key expires, the app becomes **read-only**:
  clients can still see and print everything, but can't add or change data
  until a valid key is entered. Nobody is ever locked out of their data.
- A key sets: client name, **number of active users**, **expiry** (or never),
  and optionally **one PC** it works on.
- The client enters the key in **Settings → License**. That page also shows
  the client's **PC ID** (`XXXX-XXXX-XXXX-XXXX`).

## 1. One time: create your signing key

```bash
node scripts/license/keygen.mjs --out C:\GvsLicense
```

- `C:\GvsLicense\gvs-license-private.pem` is your **secret**. Back it up
  (USB + password manager). Anyone who has it can create licenses. If you lose
  it, you can't create keys for installations built with its public key.
- The command prints a **public key**. Paste it into
  `apps/api/src/lib/license/public-key.ts`, set `IS_TEST_KEY = false`, commit.
  New builds then accept only keys signed by you.
- Until then the app uses a **TEST key** (its private half is in the repo, so
  it protects nothing). The License page shows a yellow warning while it's in use.

## 2. For each client: issue a key

```bash
# Works on any PC, 5 users, 1 year
node scripts/license/issue.mjs --key C:\GvsLicense\gvs-license-private.pem \
  --client "Al Noor Pharmacy" --users 5 --days 365

# Locked to one PC (client sends you the PC ID from Settings → License)
node scripts/license/issue.mjs --key C:\GvsLicense\gvs-license-private.pem \
  --client "Al Noor Pharmacy" --users 5 --days 365 --machine 9CC1-2E0E-7C69-2A2D

# Never expires: leave out --days
```

The key is printed on one line (starts with `GVS1.`). Send it to the client
(WhatsApp/email); they paste it into Settings → License → **Activate key**.

## 3. Check a key (support)

```bash
node scripts/license/verify.mjs GVS1.xxxxx...
```

Shows the client, users, expiry, PC, and whether the signature is valid.

---

## بالعربية (مختصر)

- كل تثبيت جديد يحصل على **فترة تجريبية مجانية 14 يوماً** (حتى 3 مستخدمين).
- بعد انتهاء الفترة التجريبية أو انتهاء المفتاح يصبح البرنامج **للقراءة فقط**:
  يمكن للعميل عرض وطباعة بياناته، لكن لا يمكنه الإضافة أو التعديل حتى يُدخل مفتاحاً صالحاً.
- **مرة واحدة على جهازك:** شغّل `keygen.mjs` واحفظ الملف `gvs-license-private.pem`
  في مكان آمن مع نسخة احتياطية. لا تشاركه مع أحد ولا ترفعه إلى GitHub.
  ثم ضع المفتاح العام المطبوع في `apps/api/src/lib/license/public-key.ts`
  واجعل `IS_TEST_KEY = false`.
- **لكل عميل:** شغّل `issue.mjs` مع اسم العميل وعدد المستخدمين وعدد الأيام.
  لربط المفتاح بجهاز واحد أضف `--machine` مع **معرّف الجهاز** الذي يظهر للعميل في
  الإعدادات ← الترخيص.
- يلصق العميل المفتاح في **الإعدادات ← الترخيص ← تفعيل المفتاح**.
