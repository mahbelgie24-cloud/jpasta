# Handoff — برنامج النخبة، الجلسة التالية (2026-11-15)

> اقرأ هذا الملف كاملاً قبل أي تنفيذ. هو التسليم الرسمي من الجلسة السابقة:
> ما أُنجز، أين توقف العمل بالضبط، ما الذي جُرّب واستُبعد، البيئات ومزالقها،
> والآلية الإلزامية للعمل. المراجع الأعلى: `docs/technical-spec.md` ثم
> `AGENTS.md` ثم `docs/brand/brand.md` — أي تعارض يرجع للمواصفة.

---

## 1. لقطة الحالة الحالية (دقيقة لحظة التسليم)

> **محدّثة 2026-11-16** — جلسة P0 اكتملت بالكامل. هذه هي الحالة الجارية الآن:

- **PR #5 (elite/design-system): مدموج في main** — بعد إصلاح رحلة webkit
  (الجذر: توجيه CSP `upgrade-insecure-requests` كان يُصدر على صفحات HTTP
  وWebKit يطبّقه حتى على 127.0.0.1 فيقتل hydration؛ الآن للصفحات https فقط
  — b906f86) + إصلاح سباق في مساعد الدخول e2e (4f52f82).
- **PR #6: مدموج** — حادثة إنتاجية اكتُشفت أثناء التحقق الحي بعد النشر:
  بناء الإنتاج كان prerender الكتالوج من قاعدة الاختبار المحلية عبر ربط
  Hyperdrive المحلي (ghost product ids → كل طلب أول-طرفي يُرفض بـ
  «صنف غير متوفر»). الإصلاح: phase guard في lib/db + تنظيف `.next/cache`
  - حارس loopback في check-env (c6eeaa9, d9d0c7e).
- **الإنتاج**: `jpasta.ascendly.space` على Version `6dc60cb8` (من main بعد
  الدمجين، بناء نظيف بمعرفات Neon متحققاً حياً). التحقق الحي الكامل أخضر:
  health ✅ · CSP على مسارين ✅ · 20×200 ✅ · رحلة طلب حقيقية على جهازين
  (JP-261116-001، دفع DO **264ms**، لوحة «مباشر») ✅ · دخان مستقبِل CSP
  **204** ✅.
- **تدريب الاستعادة الإنتاجية**: نُفّذ — نسخة مشفرة من Neon + استعادة كاملة
  في scratch مع مطابقة 7/7 جدولاً (§4 أدناه).
- **الشجرة المحلية**: نظيفة على main بعد الدمجين؛ كل شيء مرفوع.
- البوابات عند آخر دمج: CI أخضر كامل (verify · e2e · lighthouse)؛ محلياً
  vitest **146/146** (30 ملفاً) · chromium **48/48** ×2 · webkit 3/3 ·
  firefox 3/3 · lint 0 · build أخضر.

## 2. المهمة المعلقة رقم 1: رحلة webkit المفشلة (شخّص قبل أن تلمس)

### العرض

`[webkit] menu @smoke`: بعد كتابة اسم أول طبق في حقل البحث والتحقق من نتائج
التصفية، الرحلة تنتظر 60 ثانية على
`getByRole('button', { name: 'مسح البحث' })` ثم تفشل. نفس الرحلة تمر على
chromium وfirefox. سجل CI يقول `waiting for …` **بلا** سطر
`locator resolved to` — أي أن الزر غير موجود في لحظة البحث.

### ما جُرّب واستُبعد (لا تعيد هذه الدروب)

1. ~~`fill()` أحداث اصطناعية لا يسمعها React 19 في webkit~~ — استُبدلت
   بـ `pressSequentially` (أحداث لوحة مفاتيح موثوقة) و**الفشل نفسه**.
2. ~~الزر متداخل داخل `<label>` فتبتلعه شجرة الوصول في WebKit~~ — أُعيدت
   البنية إلى أقارب (`htmlFor`/`id="menu-search"`) و**الفشل نفسه**.
3. ~~زر المسح الأصلي لـ webkit (`::-webkit-search-cancel-button`) يحجب زرنا~~ —
   أُخفي CSS و**الفشل نفسه** (يبقى الإخفاء: قرارات التصميم الثلاثة أعلاه
   صحيحة ومستقلة بذاتها، لا تُرجع).

### ما نعرفه يقيناً

- تأكيدات التصفية (`results.first() == query` و`count ≤ total`) **تمر حتى لو
  لم تتحدّث حالة React** — لأن أول بطاقة تحتوي نص الاستعلام أصلاً. إذن لم
  نثبت قط أن `onChange` يعمل/لا يعمل في webkit؛ فرضية «query === ""» ما زالت
  حية، وفرضية «الزر موجود وPlaywright لا يراه» ما زالت حية.
- الزر: `{query && <button aria-label="مسح البحث">}` في
  `components/menu/menu-shell.tsx` (~سطر 175 بعد إعادة الهيكلة).

### خطوات التشخيص التالية — بالترتيب

**الشرط المسبق**: `sudo npx playwright install-deps webkit` — أمر المالك
(الوكيل لا يشغّل sudo بنفسه). بدونه لا يوجد webkit محلياً ولا رؤية.

1. شغّل محلياً بالأثر الكامل:
   `npx playwright test --project=webkit e2e/storefront.spec.ts --trace-on`
   ثم `npx playwright show-trace test-results/…` — انظر DOM الحية والـ console
   لحظة الفشل (وليس تخميناً من سجل CI).
2. افصل الفرضيتين بقياس مباشر (probe داخل الاختبار مؤقتاً أو `--debug`):
   - `page.locator('button[aria-label="مسح البحث"]').count()` بعد الكتابة —
     إن كان **1 في DOM** لكن getByRole لا يراه → مشكلة ARIA في محرك webkit مع
     Playwright → الحل على مستوى الاختبار: استعمل CSS locator بدل getByRole
     لهذا التأكيد (البنية الدلالية القائمة تبقى كما هي — هي صحيحة).
   - إن كان **0 في DOM** → `onChange` فعلاً لا يحدّث الحالة في webkit →
     افحص console لأي خطأ hydration/React، وجرّب `type="text"` + `inputMode`
     بدل `type="search"` للتحقق من خلل webkit مع حقول search في React 19.
3. **قاعدة صارمة**: لا تحذف/تضعّف الرحلة لتخضرّ. رحلة البحث رحلة زبون حقيقية.
4. تحقق محلياً قبل أي دفع — كل دورة CI = ~7 دقائق، والمحلي ثوانٍ.

## 3. بعد webkit: الدمج ثم النشر (دفتر `docs/DEPLOY.md` §4–§5 حرفياً)

1. `gh pr checks 5` أخضر كامل → دمج الـ PR (merge commit يحفظ سرد الالتزامات).
2. حذف الفرع بعد الدمج (`git branch -d` + `git push origin --delete`).
3. النشر من الجذر:
   ```bash
   set -a && source .env.local && source .env.production.local && set +a
   NEXT_PUBLIC_SITE_URL="https://jpasta.ascendly.space" npm run deploy
   ```
   (`npm run deploy` = check-env → OpenNext build → wrangler deploy).
4. **تحقق ما بعد النشر** (DEPLOY.md §5): health، رأس CSP على مسار ديناميكي
   وثابت، 20×200 على `/menu`، رحلة طلب حقيقية على جهازين (الـ DO)، وصورة طبل.
   - السطر الجديد: دخان مستقبِل CSP (توقع `204`).
5. إن لزم التراجع: `npx wrangler rollback` · السجلات: `npx wrangler tail`.
6. **Service Worker**: رُفع إلى `jpasta-v6` مع هذا الفرع (الهيكل تغيّر) —
   أجهزة الموظفين ستتحدث تلقائياً بعد أول زيارة.

## 4. بيئات العمل ومزالقها (كل واحد كلف وقتاً حقيقياً — لا تتعلمها بالطريقة الصعبة)

- **Postgres الاختباري**: حاوية `jpasta-test-pg` (postgres:17 على
  `127.0.0.1:54330`، المستخدم postgres/postgres). قاعدتان: `jpasta_test`
  (وحدات+تكامل) و`jpasta` (اصطلاح التطوير لـ `next start`/E2E).
  التهيئة: `docker run -d --name jpasta-test-pg -e POSTGRES_PASSWORD=postgres
-e POSTGRES_DB=jpasta_test -p 127.0.0.1:54330:5432 postgres:17` ثم
  migrate+seed للقاعدتين (لباسطة `jpasta`: صدّر `.env.local` ووجّه
  DATABASE_URL ثم `npm run db:migrate && npm run db:seed -- --force`).
  **بعد أي إعادة إنشاء للحاوية يجب إعادة دور `jpasta`** — `wrangler.jsonc`
  يربط Hyperdrive المحلي عبر `localConnectionString` =
  `postgres://jpasta:jpasta@127.0.0.1:54330/jpasta` (يتجاوز أي DATABASE_URL
  مُصدَّر)، والحاوية الطازجة تنشئ postgres فقط. بدون الدور يعيد health
  «db: down» رغم سلامة القاعدة نفسها:
  `CREATE USER jpasta WITH PASSWORD 'jpasta'; ALTER DATABASE jpasta OWNER
TO jpasta;` ثم GRANT ALL على جداول وsequences القاعدتين.
- **WebKit محلياً على Fedora (بلا sudo، وُثّق 2026-11-16)**: متصفح Playwright
  مرتبط بـ ICU 74 و`libjpeg.so.8` بينما Fedora 45 تحمل ICU 77/78، و
  `sudo npx playwright install-deps webkit` يفشل أصلاً (لا يتعرّف على Fedora
  ويجرب apt-get). الوصفة المجربة: استخرج `libicu74` + `libjpeg-turbo8` من
  حزم deb أوبونتو 24.04 إلى `~/.local/lib/pw-host-libs` (ar x + tar، بدون
  root)، ثم رقّع غلافَي MiniBrowser تحت `~/.cache/ms-playwright/webkit-*/`
  ليحفظا `LD_LIBRARY_PATH` الخارجي بدل استبداله:
  `export LD_LIBRARY_PATH="${LD_LIBRARY_PATH:+$LD_LIBRARY_PATH:}${MYDIR}/lib:${MYDIR}/sys/lib"`.
  وأطلق الـ E2E دائماً بـ:
  `export LD_LIBRARY_PATH="$HOME/.local/lib/pw-host-libs"
PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1`.
  إعادة تنزيل webkit بأي إصدار جديد تمحو رقعة الغلاف (المسار يتغير برقم
  الإصدار) — أعد الرقعة. (إن توفرت لاحقاً حزمة `icu-74` بـ dnf فهي بديل أنظف.)
- **env لـ vitest**: `export TEST_DATABASE_URL=…/jpasta_test` (الإعدادات
  تحوّله إلى DATABASE_URL داخلياً).
- **env لـ E2E**: صدّر **كلاهما** `TEST_DATABASE_URL` و`DATABASE_URL`
  → `…/jpasta_test`، **بعد** `set -a; source .env.local` (لأسرار صحيحة).
  سبب القاعدة: `.env.production.local` يحمل URL Neon **إنتاجياً** وPIN/pepper
  إنتاجيين ويتفوق على `.env.local` تحت `next start` (NODE_ENV=production) —
  دفعة E2E قديمة فشلت «الرمز غير صحيح» ثلاث مرات بسببها.
- **لا تكتب `pkill -f 'next start'`** — النمط يطابق أمر الصدفة نفسه ويقتل
  العملية. استعمل `fuser -k 3220/tcp`.
- **`reuseExistingServer` مفعّل محلياً** — خادم قديم ببيئة خاطئة يُعاد استخدام
  بصمت؛ اقتل المنفذ 3220 قبل أي تشغيل.
- **النسخ الاحتياطي**: `backup-db.mjs` يفترض حاوية `jpasta-pg` (متوقفة) —
  مرر `JPASTA_DB_CONTAINER=jpasta-test-pg`؛ و`BACKUP_ENCRYPTION_KEY` يجب أن
  يُصدَّر (`set -a` قبل المصدر) وإلا خرجت النسخة غير مشفّرة. تدريب استعادة
  كامل مُنفّذ وموثق (audit/05 §5) — **كرره بنجاح على أول نسخة إنتاجية حقيقية
  (2026-11-16)**: نسخة Neon مشفرة عبر `JPASTA_USE_PG_DUMP=1 DATABASE_URL=
"$DIRECT_DATABASE_URL"` ثم استعادة كاملة في حاوية scratch — مطابقة 7/7
  جدولاً. **درس تشغيلي**: قيم Neon تحمل `&` (مثل `?sslmode=require&…`) و
  `source .env.production.local` يكسرها — استخرج متغيرات النشر حصراً بـ
  `export VAR="$(grep '^VAR=' .env.production.local | cut -d= -f2-)"`، و
  `DIRECT_DATABASE_URL` (المباشر) هو الصحيح لـ pg_dump وليس pooled.
- **Next.js معدّل**: اقرأ الدليل المعني من `node_modules/next/dist/docs/`
  قبل أي API (أمثلة: `preload` في next/image بدل `priority`؛ `proxy.ts` بدل
  middleware).

## 5. الآلية الإلزامية — دورة النخبة (كما عملناها، بلا اختصار)

1. **فهم**: أعد صياغة القيود غير البديهية في كتلة قصيرة قبل أي فعل.
2. **خطة**: لأي عمل متعدد الخطوات — استكشف، صمم، اعرض للاعتماد قبل الكود
   (وضع الخطة). عنصر خارطة طريق واحد في كل مرة.
3. **تنفيذ**: أصغر حل صحيح بأسلوب الكود المحيط. لا تجريديات استكشافية.
4. **مراجعة ذاتية عدائية** قبل التسليم: أعد قراءة diff كمراجع معادٍ.
5. **تحقق**: شغّل البوابات الحقيقية وأبلغ الأرقام حرفياً (pass/fail). لا نجاح
   غير متحقق — ولا مبرر لنتيجة فاشلة.
6. **بوابات الوكلاء**: `elite-code-reviewer` على كل diff جوهري؛
   `elite-security-auditor` إلزامي حين يلمس auth/input/secrets/شبكة؛
   `elite-critic` للتسليمات عالية المخاطر — REVISE تعالج فوراً وتُعاد البوابة.
7. **تسليم صادق**: commit اصطلاحي + تحديث الوثائق + قائمة «ما لم يُنجز ولماذا».
8. **انضباط السياق**: وكلاء متوازيون ≤2؛ لا تكرر عمل وكيّل؛ لا تخمين بعيداً
   عن الرؤية المحلية (درس webkit: 3 دورات CI على فرضيات قبل طلب sudo —
   اطلب الرؤية أبكر).

## 6. الثوابت التي لا تُمس (ملخص — المصدر AGENTS.md والمواصفة)

المال بالأقروض عبر `lib/pricing.ts` فقط (parseFloat محظور بالـ lint) ·
idempotency مربوطة بالحمولة · المصدر server-owned · RBAC على السيرفر في كل
مسار · RTL بخصائص منطقية فقط · tokens من globals.css فقط (لا hex) · أهداف
لمس ≥44px · reduced-motion في كل مكان · صحة المحتوى (لا «معجونة اليوم») ·
`npm run build` بوابة النشر · كل تغيير shell يرفع `VERSION` في `public/sw.js`
(الآن v6) · لا WAF/ميزات جديدة بقرار مالك.

## 7. طابور العمل بعد فتح الـ PR (بالأولوية)

> **محدّث 2026-11-16** — العنصر 1 انتهى بالكامل، وعنصران من P1 أُنجزا:

1. **P0 — webkit أخضر → دمج → نشر → تحقق حي**: ✅ **منجز** (PR #5 + حادثة
   ghost-catalog وPR #6، كلها موثقة في §1 أعلاه).
2. **P1 — خطوات مالك**: تفعيل Cloudflare Web Analytics (RUM — يحسم سؤال LCP
   `/` ثنائي النمط المُفهرس في audit/05 §5) · ~~`sudo npx playwright
install-deps webkit`~~ (حُلّ اليوم دون sudo — وصفة §4) · ~~إعادة أمر
   الاستعادة على أول نسخة إنتاجية~~ (نُفّذ اليوم، مطابقة 7/7) · أسبوع
   التشغيل المتوازي · قرار الاحتفاظ/DSAR (المدة) · **جديد**: تأكيد
   «Always Use HTTPS» مفعّل على منطقة ascendly.space في لوحة Cloudflare
   (مخرج تدقيق أمني — HSTS لا يُسمع على http الأول).
3. **P2 — عند الإشارة + مكتشفات اليوم**: بناء أداة الاحتفاظ/DSAR (آلية
   المالك + سجل تدقيق دون مساس order_status_history) · WAF/Turnstile عند
   أول إشارة إساءة · رفع عتبات التغطية (سقّة لأعلى فقط) · **جديد**:
   التحقق من دورة revalidate الفعلية للكتالوج (الوعود 5 دقائق — بعد
   `db:menu` راقب `/menu` حتى التجدد؛ آلية ISR في OpenNext لم تُختبر فعلياً
   خلال الحادثة) · **جديد**: fail-open في `wsOrigin` عند origin غائب/تالف
   يعيد `wss:` حراً (lib/csp-nonce.ts:42-51) — سطر واحد fail-closed عند
   أول فرصة.

## 8. خريطة الملفات الساخنة

`proxy.ts` (CSP tiers + reporting headers) · `lib/csp-nonce.ts` ·
`lib/server/rate-limit.ts` (شكل limit({key}) الوحيد) ·
`lib/server/{orders,session,console,order-feed}.ts` · `app/api/*` ·
`components/ui/*` (primitives) · `components/menu/{menu-shell,cart-drawer,item-sheet}.tsx` ·
`durable-objects/order-feed.ts` · `worker.ts` · `e2e/helpers.ts` ·
`playwright.config.ts` · `vitest.config.mts` · `lighthouserc.json` ·
`docs/{technical-spec,SECURITY,DEPLOY,brand/brand}.md` ·
`docs/audit/05-elite-elevation-2026-11-15.md` (سجل البرنامج بأكمله).

---

## 9. المطالبة الجاهزة للصق في الجلسة الجديدة

> انسخ الكتلة التالية كما هي في الجلسة الجديدة.

```text
نفّذ المهمة التالية بالدورة النخبوية كاملة دون اختصار أي بوابة (فهم ← خطة ←
تنفيذ ← مراجعة عدائية ← تحقق حرفي ← بوابات الوكلاء ← تسليم صادق).

أولاً: اقرأ docs/HANDOFF-ELITE-2026-11-15.md كاملاً — هو التسليم الرسمي من
الجلسة السابقة (الحالة الدقيقة للمشروع وPR #5، شجرة تشخيص رحلة webkit
المفشلة بما جُرّب واستُبعد، بيئات العمل ومزالقها المصقولة بالخبرة، طابور
العمل بالأولوية). ثم راجع docs/technical-spec.md وAGENTS.md و
docs/brand/brand.md — أي تعارض ترجع فيه للمواصفة.

المهمة الفورية (P0): المهمة المعلقة رقم 1 في ملف التسليم — رحلة webkit
المفشلة التي تحتجز دمج PR #5. الشرط المسبق: اطلب مني تشغيل
`sudo npx playwright install-deps webkit` (لا تشغّل sudo بنفسك). بعدها
شخّص بالرؤية المحلية (trace + فحص DOM فعلي) وفق خطوات القسم 2 بالترتيب،
وأصلح الجذر الحقيقي. قاعدة صارمة: لا تحذف أو تضعّف الرحلة لتخضرّ، ولا دفع
جديد قبل التحقق محلياً (كل دورة CI = 7 دقائق، والمحلي ثوانٍ).

بعد الاخضرار الكامل للـ PR: ادمجه في main (merge commit يحفظ السرد)، احذف
الفرع، ثم انشر الإنتاج وفق docs/DEPLOY.md §4–§5 حرفياً، وتحقق حياً كاملاً:
health، رأس CSP على مسارين، 20×200 على /menu، رحلة طلب حقيقية على جهازين
(تأكيد الـ DO < ثانية)، ودخان مستقبِل CSP = 204. أي فشل نشر:
`npx wrangler rollback` فوراً وأبلغني.

ثم تابع طابور P1/P2 في ملف التسليم بالترتيب نفسه. كل خطوة تلامس
auth/money/PII تمر على elite-security-auditor، والتسليمات عالية المخاطر
على elite-critic قبل عرضها عليّ. لا تنفق سنتاً واحداً ولا تفعّل أي خدمة
مدفوعة. أبلغني بنتائج كل بوابة حرفياً (أرقام pass/fail)، وعند أي قرار
حقيقي توقف واسألني — لا تفترض إجابتي.
```
