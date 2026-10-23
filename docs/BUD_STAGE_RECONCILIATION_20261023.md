# BU’D stage reconciliation — 23 October 2026

Status: DRAFT AUDIT / NO STAGE CLOSED. Prepared in an independent documentation lane; this document itself still requires a separate reviewer. No Notion records, remote services or code were changed by this lane.

## Audit basis and freshness

Local baseline read: `85a1d71c42408e0427562a938ccbeac8d2f71212`. Work in progress on the authorized S00–S11 batch is not certified by this snapshot. Replace this baseline with the final candidate SHA only after inspecting that candidate; retain both observations.

Read-only Notion retrieval on 23 October 2026 covered the Command Center, Stage00 reconciliation/audit, S01–S06 pages, Stages, detailed Gates, detailed Tests and Approval Register schemas and records. Fetch responses expose a 22 October as-of timestamp; this audit reports returned state, not a guarantee that the connector has no caching or concurrent changes. Re-query before any closure.

- [Command Center](https://app.notion.com/p/401b475e25f18133bdedc0fab9ee1287)
- [Stage00 current reconciliation](https://app.notion.com/p/401b475e25f181909556f65d42e19590)
- [ADR-001–005 and final audit](https://app.notion.com/p/401b475e25f1814d9cc7f75ffcd1bf0c)
- [Stages database](https://app.notion.com/p/b1063485122448079c7a4d3e923ab693)
- [Detailed gates database](https://app.notion.com/p/73a23d7c9ffe4e69b3c5abb7c66b66bc)
- [Detailed tests database](https://app.notion.com/p/6dbccf1974a94168991ce5a5a7ddf030)
- [Approval Register](https://app.notion.com/p/18f6f548df064abd9b55284736101f9d)

Queries returned all 14 stages as Official Gate=Not verified, Owner Approved=false, QA Approved=false. AP-S01 through AP-S14 are PENDING VERIFICATION without version/evidence. Scoped front-end release and governance-automation approvals are VERIFIED; neither is a stage-exit approval.

| Stage | Detailed gates expected/read | Detailed tests expected/read | Current closure recommendation |
|---|---:|---:|---|
| S01 | 6 | 3 | Candidate for documentary reconciliation review; NOT READY to close |
| S02 | 11 | 5 | BLOCKED on revised policy and connected auth/session/transaction proof |
| S03 | 11 | 6 | Local host behavior evidence available; connected/history acceptance incomplete |
| S04 | 8 | 4 | BLOCKED on current PRD/test-oracle reconciliation and independent exact-version review |
| S05 | 10 | 5 | Public UX evidence is partial; secure host/dashboard/recovery/usability coverage pending |
| S06 | 12 | 6 | Public visual evidence is partial; full current component/state acceptance not mapped |
| Total | 58 | 29 | No closure |

All 58 returned detailed gate rows have no Evidence URL or Version SHA. All 29 returned detailed tests are NOT RUN with no Evidence URL. These are registry observations, not a claim that no code was tested: prior feature QA exists but has not been reconciled into these acceptance rows. Historical summary rows were excluded from these counts.

## Current decisions and how prior approval applies

1. The owner has approved the current website identity and Code-first reusable responsive development. ADR-005 archives Figma as a mandatory new-design authority. Do not block equivalent approved scope on another Figma review or immutable frame receipt.
2. No bot, participant onboarding, attendance, selection or Discord participant identity. Discord OAuth is for the purchasing host at Buy, not public browsing.
3. ADR-001 assigns connected product timing to shared Engine / Timer Manager. The public fixed two-card sample has its own bounded sample countdown; it is not evidence that the future connected host engine already satisfies shared ownership.
4. ADR-002 approves maximum four-hour sessions and no additional Slot debit for resuming the same session. It does not settle disconnected clock accounting, old seven-day prestart entitlement, ten-second grace or once/60-minute restart.
5. ADR-003 approves persistent Game History and Copy Summary matching closing results. This supersedes automatic seven-day result deletion. Retention of financial/security records and lawful deletion remain separate policy work.
6. ADR-004 allows duplicate display names with independent record IDs. Its older note requests a nonblocking warning. Later explicit owner scope accepted duplicates and independently tested numbered records; it never restores uniqueness blocking. Record whether the later accepted UI supersedes warning wording; do not silently certify an untested warning.
7. Later owner requests explicitly allow manual winner addition within original prize capacity, deletion/replacement with monotonic IDs, and opt-in anonymous prize opening. These are permitted exceptions to the earlier Correct-only entry path; do not reject them by applying the older generic sentence.
8. Latest public scope is fixed inline Q&C cards, five-second sample timer, same-pair reset; full host workspace is development-only until secure authenticated entitlement/API delivery. Trial buttons were expressly removed. Preserve Buy and honest unavailable states until integration acceptance.
9. Owner publication authorization for reviewed frontend batches is sufficient within those scopes. The new S00–S11 mandate authorizes the requested engineering/documentation work; do not re-request routine implementation permission. It does not create missing test evidence, decide prices/refunds/tax, supply credentials or certify a commercial activation.
10. Prior original assets are provenance records. Newly authorized regenerated art and exact SVG overlays supersede any blanket prohibition on approved art changes; archives remain preserved.

Local source reconciliation needed: early paragraphs in BUD_CURRENT_APPROVED_SPEC.md, BUD_SOURCE_OF_TRUTH.md, BUD_SUPERSEDED_DECISIONS.md, BUD_VERIFICATION_REPORT.md and BUD_BACKEND_CONTRACT.md still contain old main/Preview/Figma, duplicate-rejection, seven-day or pre-migration assertions. Some later appendices qualify them. Rewrite only active status summaries with dated supersession links; preserve archived reports. inline-event-preview.md still mentions removed modal Try actions. These are stale documentation gaps, not new owner questions.

## Stage00 closure checklist

- [ ] Reconcile all current-scope rules against ADR-001–005 and later owner changes above, including public/development boundary.
- [ ] Preserve original gate/test text and link a current replacement criterion for every superseded clause. Do not PASS “bot fallback” because no bot exists.
- [ ] Give every deferred issue an owning stage, dependency and activation boundary. Commercial unresolved rules need not block unrelated public frontend work.
- [ ] Confirm expected 140 detailed gates / 73 detailed tests, correct Stage/Approval relations, unique stable IDs and valid formulas from current readback. Historical import proof is useful but not a current full recount in this lane.
- [ ] Map actual browser/logic/SQL evidence to exact current acceptance IDs, candidate SHA, date, environment, observations and limitations.
- [ ] Verify source/asset provenance and current Code-first visual acceptance; do not demand archived Figma signoff.
- [ ] Independently review final reconciliation and current interactive evidence. This author cannot independently approve these three authored documents.
- [ ] Capture owner acceptance already applicable by exact scope; resolve any truly new commercial/retention/session choices with an explicit dated decision.
- [ ] Authorized root records reviewed outcomes in Notion and re-reads formulas/relations/approval rows. Formulas flag readiness; they do not prevent manual edits.
- [ ] Write a dated closure decision only if the above criteria actually pass. This document recommends no closure now.

## Exact S01–S06 gate worklist

Every row below also requires Evidence URL, exact Version SHA, Reviewed By and Verified At. For superseded text, approve and link the replacement acceptance criterion first. Current Result is the returned Notion value, not a new verdict.

| Gate/source | Imported criterion | Returned Result | Current criterion / actual missing work |
|---|---|---|---|
| [S01-G01](https://app.notion.com/401b475e25f1811a9c8bd25669d1110a) | تثبيت رؤية بُعد كمنصة Discord-first وتحديد الجمهور والمشكلة والقيمة | NOT RUN | Reconcile audience/problem/value with current multi-product public site; link dated owner decision. |
| [S01-G02](https://app.notion.com/401b475e25f18182aebce7d211adef19) | تثبيت MVP بفعالية واحدة «سؤال وشرط» واستبعاد اللعبة الثانية حاليًا | NOT RUN | Record Q&C as first event; Bots/Designs stay galleries with truthful unavailable states; public sample is not full hosting. |
| [S01-G03](https://app.notion.com/401b475e25f181ad994fc4880079ba13) | اعتماد نموذج محرك جلسات مشترك ووحدة منطق مستقلة لكل فعالية | NOT RUN | Approve shared Engine / Timer / Session responsibilities and independent template contract; implementation is separate evidence. |
| [S01-G04](https://app.notion.com/401b475e25f181538eb4d5d170898642) | تحديد نطاق البناء الحالي والخدمات المؤجلة والافتراضات والمخاطر | NOT RUN | List public sample, protected hosting, dashboard, commerce and deferred services separately; attach risks/dependencies. |
| [S01-G05](https://app.notion.com/401b475e25f1816f9eecdf619b09d2d8) | ربط كل قرار بمصدر وتاريخ ومالك القرار | NOT RUN | Attach exact decision references, dates, applicable scope and authority for each current rule. |
| [S01-G06](https://app.notion.com/401b475e25f181f9a30cec39c4006fb4) | التحقق من عدم خلط اكتمال Discovery باكتمال التنفيذ | NOT RUN | Demonstrate discovery signoff is distinct from implementation, remote activation and commercial launch. |
| [S02-G01](https://app.notion.com/401b475e25f1811a84ded409ed72bd61) | توثيق تسجيل Discord OAuth للمضيف ومن ينضم من الويب | BLOCKED | Replace participant OAuth clause with purchaser-host Discord verification; prove guest browsing and negative host-identity tests. |
| [S02-G02](https://app.notion.com/401b475e25f181ebb63ef661c81438cf) | التمييز بين حضور Stage والمنضمين للويب والمتنافسين النشطين | BLOCKED | Preserve historical participant row; link replacement asserting no participant registry/attendance/selection endpoints. |
| [S02-G03](https://app.notion.com/401b475e25f1816dbbbbed5c7289b9d9) | توثيق سياسات القبول والطرد ومنع العودة والاختيار اليدوي والعشوائي | BLOCKED | Replace participant kick/selection policy with explicit host authorization boundaries and manual winner workflow. |
| [S02-G04](https://app.notion.com/401b475e25f181808cb3f50c04edb48f) | تثبيت صلاحيات المشتري والمتحكم الواحد وآلية استرجاع التحكم | NOT RUN | Specify sole-controller fencing/reclaim/resume; prove stale controller denied and same-session resume does not debit. |
| [S02-G05](https://app.notion.com/401b475e25f1814cb20fef8fbd47a62c) | توثيق استحقاق 7 أيام قبل البدء وجلسة 240 دقيقة وتحذيرات الانتهاء | BLOCKED | Four-hour cap is approved; decide disconnected-time accounting, prestart entitlement and warnings before connected acceptance. |
| [S02-G06](https://app.notion.com/401b475e25f181d9861ef5eeaff49b3d) | توثيق إعادة البدء المسموحة مرة واحدة وضوابط أول 60 دقيقة | BLOCKED | Distinguish same-session resume from restart; old once/60-minute rule is not approved by ADR-002. |
| [S02-G07](https://app.notion.com/401b475e25f18109a952d234cf52e32c) | تفريق رصيد المحفظة عن تفعيل الجلسة والخصم الذري | BLOCKED | Replace stored money with product play-count Slots; verified purchase +1/new start -1/resume 0; real transaction evidence missing. |
| [S02-G08](https://app.notion.com/401b475e25f1815c95bdfce62e5bc7c0) | إثبات جدوى صلاحيات Discord والبوت الاختياري وبديل الويب بدون بوت | BLOCKED | Replace bot feasibility/fallback with host-only web flow; no bot implementation required. |
| [S02-G09](https://app.notion.com/401b475e25f1810dbab8ef505fb14dcd) | إثبات idempotency وfencing وتزامن الجلسات والصلاحيات وRLS | NOT RUN | Prove real multi-connection idempotency, tenant isolation/RLS and fencing; local serialized SQL is insufficient. |
| [S02-G10](https://app.notion.com/401b475e25f181e69754cdeff83f1bc2) | اختبار حالات الفشل والانقطاع وانتهاء الوقت وغياب البوت | BLOCKED | Use host disconnect/expiry/network error matrix; no disabled-bot fallback acceptance. |
| [S02-G11](https://app.notion.com/401b475e25f1819ba98ccfd318e22b5a) | ربط فجوات Stage 02 بأدلة المراحل 07–11 وإعادة التدقيق بعد الربط | NOT RUN | Link unresolved contracts and executed evidence to S07–S11; rerun this stage after integrations exist. |
| [S03-G01](https://app.notion.com/401b475e25f18109a973d908949960c2) | تثبيت المراحل الأربع: إعداد الفعالية ← شاشة الفعالية ← الجوائز ← الختام | NOT RUN | Verify four host phases and forbidden transitions on current version; public sample is a separate two-card surface. |
| [S03-G02](https://app.notion.com/401b475e25f1810b9fedcff74c48ef3e) | تثبيت المؤقت حصريًا 5 أو 7 أو 10 ثوانٍ وعدد المحاولات 1–3 | BLOCKED | Replace preset-only timer with optional custom seconds/central manager; 1–3 attempts retained; commercial bounds still need policy resolution. |
| [S03-G03](https://app.notion.com/401b475e25f1815db59ce840225e77e2) | تثبيت الجوائز 0–50 والإدخال متعدد الأسطر وقفل الإعداد عند البدء | NOT RUN | Verify 0/50 prizes, multiline/length validation and configuration lock; distinguish unlimited no-prize rehearsal from commercial hosting. |
| [S03-G04](https://app.notion.com/401b475e25f181c29089f6c5d27aed08) | تثبيت استقلال سحب السؤال والشرط والبدء بعد كشف البطاقتين | NOT RUN | Host template signals the central timer after both cards; public fixed sample timer does not certify connected engine centralization. |
| [S03-G05](https://app.notion.com/401b475e25f181d4bb12cc21b32d9244) | تثبيت حكم المضيف اليدوي حتى بعد انتهاء الوقت دون فشل تلقائي | NOT RUN | Verify expiry never auto-judges; Correct opens winner input, with explicit owner-approved manual-add exception. |
| [S03-G06](https://app.notion.com/401b475e25f181b4aaf7e4458bb16ad6) | تثبيت عدم تكرار الزوج داخل دورة السحب الواحدة وإعادة دورة بعد الاستنفاد | NOT RUN | Verify independent draw bags/fresh pair/cycle exhaustion for full engine; fixed public sample intentionally replays same pair. |
| [S03-G07](https://app.notion.com/401b475e25f18137a4f4e7092031c348) | تثبيت أولوية العشوائي للمشاركين الجدد فقط والسماح اليدوي للخاسرين المؤهلين دون الفائزين | BLOCKED | Replace participant random selection with manual winner records; latest owner duplicate allowance supersedes name uniqueness. |
| [S03-G08](https://app.notion.com/401b475e25f181dda4bec21031911383) | تثبيت ترتيب التأهل وفتح الجوائز والتعيين أو الفتح دون تخصيص | NOT RUN | Verify ID-based assignment, recipient confirmation, opt-in anonymous opening and separate closing/copy results. |
| [S03-G09](https://app.notion.com/401b475e25f1814b9119fcbfe54782f7) | تثبيت قواعد الرجوع للفعالية قبل فتح أي جائزة ومنعه بعد أول فتح | NOT RUN | Verify back allowed before any reveal and denied after named or anonymous reveal. |
| [S03-G10](https://app.notion.com/401b475e25f181a5a076e1b92d191b1e) | تثبيت الختام النهائي والإبقاء المؤقت على الجوائز الممنوحة فعليًا فقط | NOT RUN | Replace temporary TTL with persistent Game History; verify stored event/status/time and exact summary, plus separate lawful deletion process. |
| [S03-G11](https://app.notion.com/401b475e25f181fab425d7089d13ad5a) | ربط هذه القواعد بآخر تصحيحات Stage 04 ومنع نصوص superseded | NOT RUN | Map all revised rules to S04 and latest owner changes; preserve old rows and link successors. |
| [S04-G01](https://app.notion.com/401b475e25f1810bae50ed6ea72e471a) | توفير PRD النهائي بمراجع كل متطلب وقرار معتمد | NOT RUN | Publish one reconciled current PRD/version; appendices must explicitly override stale paragraphs rather than requiring guesswork. |
| [S04-G02](https://app.notion.com/401b475e25f18185bf2eca52be9654af) | فصل حالات الجلسة التقنية ومراحل تجربة الفعالية والمحاولة والجائزة | NOT RUN | Separate session, host phase, round/attempt, card and prize states; define transition ownership. |
| [S04-G03](https://app.notion.com/401b475e25f181ec8be4efe97b4fc605) | توصيف الصلاحيات والانتقالات والحالات السلبية والاستثناءات | NOT RUN | Define authorization, negative transitions, retry/concurrency and recovery contracts. |
| [S04-G04](https://app.notion.com/401b475e25f1812d9977e8b77575b4c1) | تحويل كل MUST إلى Acceptance test ID وحالة متوقعة | NOT RUN | Every MUST needs a decision and precise acceptance ID; generic 'Pass acceptance contract' is not a test oracle. |
| [S04-G05](https://app.notion.com/401b475e25f181e39b0dd9b482b798ef) | معالجة التعارض بين القرارات القديمة والمعدلة باستخدام Supersession | NOT RUN | Reconcile ADR-001..005 plus later manual-add/anonymous-prize/public-sample/CTA owner corrections. |
| [S04-G06](https://app.notion.com/401b475e25f18151ba7cc03c2b643455) | تغطية سياسات البيانات: المسح عند إعادة البداية، نتائج الجوائز الفعلية 7 أيام، الفصل عن السجلات المالية | BLOCKED | Replace automatic 7-day deletion with persistent history; approve actual privacy/financial retention and deletion handling separately. |
| [S04-G07](https://app.notion.com/401b475e25f18133bed1e9c91da03439) | إغلاق Gap Audit وتوثيق المراجعة المستقلة على نسخة محددة | NOT RUN | Independent exact-version specification/gap review and resolved high-severity findings required. |
| [S04-G08](https://app.notion.com/401b475e25f1811b8396f09aff53b4c1) | حفظ إثبات إغلاق المواصفات دون الادعاء بإنجاز الاختبارات التشغيلية | NOT RUN | Preserve historical specification closure proof; do not relabel it operational acceptance. |
| [S05-G01](https://app.notion.com/401b475e25f1817f8c87cfdb5d5ac13c) | حصر الشاشات ومسارات المضيف والمشارك والزائر والمشاهد | BLOCKED | Replace participant/observer screen inventory with guest, purchaser-host and authorized-host dashboard journeys. |
| [S05-G02](https://app.notion.com/401b475e25f181a5b7d1f0e3740cfb3f) | رسم رحلات الشراء/التفعيل والانضمام والإعداد واللعب والجوائز والختام | BLOCKED | Map public sample versus authenticated purchase/setup/live/prizes/closing/history; remove participant onboarding. |
| [S05-G03](https://app.notion.com/401b475e25f18182b344c502664a8ed7) | تغطية الخروج والخطأ والانقطاع والاسترداد وانتهاء الاستحقاق | NOT RUN | Prove empty/error/exit/unauthorized/offline/expired/recovery states; unavailable commerce copy is only current fail-closed coverage. |
| [S05-G04](https://app.notion.com/401b475e25f181f199a9f36b0fdfaed0) | بناء Prototype قابل للنقر للكمبيوتر والجوال بالاتجاهين وفق الحاجة | NOT RUN | Code-first interactive prototypes on AR/EN desktop/mobile; no new Figma approval prerequisite. |
| [S05-G05](https://app.notion.com/401b475e25f1819684feffedc6e9e08a) | مراجعة وجود فصل واضح لسلطة المضيف عن واجهة المشاركة | BLOCKED | Validate host control authority and controller fencing; participant UI is out of scope. |
| [S05-G06](https://app.notion.com/401b475e25f1818fac4df4acf1d9f7fc) | التحقق من رحلة Discord-first دون بوت | NOT RUN | Guest gallery/modal + host-only Discord-at-Buy journey; no bot fallback. |
| [S05-G07](https://app.notion.com/401b475e25f1810794b7f872613018e1) | تجربة القابلية للاستخدام: الإجراءات الحرجة واضحة دون تفسير | NOT RUN | Attach actual usability observations for critical actions; browser automation does not prove unaided user comprehension. |
| [S05-G08](https://app.notion.com/401b475e25f181418e44e498a34cf591) | توثيق النسخ المبنية في Figma أو Codex Preview وروابطها وحدود اختبارها | NOT RUN | Record exact SHA, tested URL/environment and screenshots; source links without exact-version evidence are insufficient. |
| [S05-G09](https://app.notion.com/401b475e25f1819c82a1d6c0e7dc0d4e) | تقييم حركة الانتقال بين أقسام الموقع بدون Scroll حسب القرار المعتمد | NOT RUN | Apply no-scroll to approved fixed Home viewports without clipping; data-heavy Events/history need usable overflow. |
| [S05-G10](https://app.notion.com/401b475e25f1813fbf93f5e21b59f523) | إغلاق مشاكل UX ذات الشدة العالية وإرفاق دليل مراجعة المستخدم | NOT RUN | Track and resolve high-severity UX issues; link relevant owner acceptance and independent review. |
| [S06-G01](https://app.notion.com/401b475e25f1816fb379f265ef969dfb) | اعتماد هوية بُعد Light Mode وReadex Pro والألوان الرسمية | NOT RUN | Existing owner visual acceptance suffices for approved Light/Readex/identity scope; bind it to released version. |
| [S06-G02](https://app.notion.com/401b475e25f181bf85faf436d7e3d0ca) | استخدام الشعار المتجهي الأصلي دون إعادة رسم أو تعديل غير معتمد | NOT RUN | Verify official SVG provenance and transformations; generated art must not redraw the emblem. |
| [S06-G03](https://app.notion.com/401b475e25f181589691efb495911e1c) | توصيف tokens للألوان والتباعد والحدود والخطوط والتجاوب | NOT RUN | Document actual tokens/breakpoints/type/spacing; verify reused values and responsive behavior. |
| [S06-G04](https://app.notion.com/401b475e25f181b194f3e9bec94c83d5) | بناء مكونات قابلة لإعادة الاستخدام للحالات والأشكال والقوائم والنوافذ | NOT RUN | Inventory reusable cards/dialogs/navigation/controls and all current states including forthcoming secure dashboard. |
| [S06-G05](https://app.notion.com/401b475e25f18173811ae6f587570878) | اعتماد أسلوب Retro Modern/Arcade واللمسات Gaming المعتمدة | NOT RUN | Use accepted current website aesthetic; no reopening archived Figma for equivalent approved scope. |
| [S06-G06](https://app.notion.com/401b475e25f18166ba60ff418ea87131) | تنفيذ الواجهات في Codex مع الرجوع إلى Figma عند مراجعة تصميم محدد | NOT RUN | Code-first supersedes mandatory Figma; attach current Preview acceptance and reusable component evidence. |
| [S06-G07](https://app.notion.com/401b475e25f1814da48fcb2ebfed50cf) | مراجعة الأصول الجاهزة أولًا وترخيصها ثم إعادة الاستخدام والتخصيص | NOT RUN | Retain asset/model/source provenance and license review; competitor observation is not a copying license. |
| [S06-G08](https://app.notion.com/401b475e25f181789f44d78a1e8258a2) | اختبار عدم وجود Scroll في صفحات العرض الثابتة مع عدم قص المحتوى | NOT RUN | Check approved fixed-screen viewport matrix without clipped controls; do not hide data to manufacture no-scroll. |
| [S06-G09](https://app.notion.com/401b475e25f1819980bdd4d2fc5b6511) | توفير motion specs: hover / flip / transitions / reduced motion | NOT RUN | Verify hover/focus/flip/transitions and reduced motion; no fabricated 60fps claim. |
| [S06-G10](https://app.notion.com/401b475e25f1817c83bcc8dac9408a5b) | فحص RTL/LTR ودقة الأيقونات والشعارات والتباين وحالات الخطأ | NOT RUN | Verify AR/EN RTL/LTR, actual contrast, focus, icons, logos and error states on final candidate. |
| [S06-G11](https://app.notion.com/401b475e25f181d0bef5c99748f64bb8) | تثبيت تصميم بطاقات السؤال/الشرط والجوائز مع اختلاف وظائفها | NOT RUN | Shared GameCard proves reusable visuals, not host backend availability; verify prize-card function separately. |
| [S06-G12](https://app.notion.com/401b475e25f1812e92e7dd2abc129c1e) | مقارنة Preview بالمرجع واعتماد المالك للتصميم المعروض فعليًا | NOT RUN | Bind prior owner acceptance to exact scope/version; independently review new secure-dashboard views before closure. |

## Detailed tests that still require acceptance mapping

All returned Expected Result values are the generic “Pass acceptance contract”. Before execution, supply concrete setup, actor/permissions, input, transition, expected output and failure oracle in each current replacement test. A generic expected phrase cannot establish correctness.

| Test/source | Imported test | Returned state |
|---|---|---|
| [S01-T01](https://app.notion.com/401b475e25f181a998c1ccbdc4df4e12) | مطابقة نطاق MVP مع سجل القرارات الأحدث | NOT RUN; evidence absent |
| [S01-T02](https://app.notion.com/401b475e25f181fcba22e26864a2d615) | فحص قائمة الميزات المؤجلة وحدود المنتج | NOT RUN; evidence absent |
| [S01-T03](https://app.notion.com/401b475e25f18110b63dc7f2fd8e13c3) | مطابقة ملف الرؤية مع سجل القرارات بدون تعارض | NOT RUN; evidence absent |
| [S02-T01](https://app.notion.com/401b475e25f18196be5ae1b77234dc34) | Discord OAuth/join source spoofing negative test | NOT RUN; evidence absent |
| [S02-T02](https://app.notion.com/401b475e25f1817db3a2de2ec781c6e9) | Single controller takeover and stale-session fencing | NOT RUN; evidence absent |
| [S02-T03](https://app.notion.com/401b475e25f181909e73ea4dc1f69800) | Ledger retry and double-debit concurrency test | NOT RUN; evidence absent |
| [S02-T04](https://app.notion.com/401b475e25f181899198dfd10241fe2c) | Fake-clock prestart/live/restart and expiry test | NOT RUN; evidence absent |
| [S02-T05](https://app.notion.com/401b475e25f181da85eff0b5e966ca2c) | RLS tenant isolation and disabled-bot web fallback | NOT RUN; evidence absent |
| [S03-T01](https://app.notion.com/401b475e25f181baac11c1115ba418d7) | State-machine coverage for four phases | NOT RUN; evidence absent |
| [S03-T02](https://app.notion.com/401b475e25f18140bb55fe5442b88927) | Timer begins only after both card flips | NOT RUN; evidence absent |
| [S03-T03](https://app.notion.com/401b475e25f18124ba04d4fb31f3cc26) | Fresh pair on retries; cycle exhausted -> new cycle | NOT RUN; evidence absent |
| [S03-T04](https://app.notion.com/401b475e25f181c18a1ae40817e71bf3) | Never-played-only random; manual losers; winner exclusion | NOT RUN; evidence absent |
| [S03-T05](https://app.notion.com/401b475e25f181a4a0b0c74920990940) | Prize 0/50 and assignment/no-assignment invariants | NOT RUN; evidence absent |
| [S03-T06](https://app.notion.com/401b475e25f181feaf61deca341c2530) | No return after first prize opened; final-end immutable | NOT RUN; evidence absent |
| [S04-T01](https://app.notion.com/401b475e25f181d9843deee93c34d9ce) | Traceability: every MUST has decision and acceptance ID | NOT RUN; evidence absent |
| [S04-T02](https://app.notion.com/401b475e25f181648eb1e4fbc16306a2) | No conflicting current game/session policy | NOT RUN; evidence absent |
| [S04-T03](https://app.notion.com/401b475e25f181409699c4f17b1eb731) | Retention 7-day authorization and deletion spec present | NOT RUN; evidence absent |
| [S04-T04](https://app.notion.com/401b475e25f181d5a8b3c4681e203d42) | Independent specification review evidence | NOT RUN; evidence absent |
| [S05-T01](https://app.notion.com/401b475e25f181578ad7e4b779e00744) | Critical journey: visitor -> Discord sign-in -> preview purchase -> setup | NOT RUN; evidence absent |
| [S05-T02](https://app.notion.com/401b475e25f1817e8dbacfd9ccda5802) | Host multi-step flow and negative/error recovery | NOT RUN; evidence absent |
| [S05-T03](https://app.notion.com/401b475e25f181558405d80491b30c79) | Mobile 390×844 and desktop 1366×768 fit viewport | NOT RUN; evidence absent |
| [S05-T04](https://app.notion.com/401b475e25f181deb155c16b5c158acd) | Keyboard focus order and screen sharing privacy | NOT RUN; evidence absent |
| [S05-T05](https://app.notion.com/401b475e25f18143ab2bd8047e2c7bd7) | No bot end-to-end host journey | NOT RUN; evidence absent |
| [S06-T01](https://app.notion.com/401b475e25f181c4a5cad2fc23150225) | Desktop + mobile screenshot visual regression at target viewports | NOT RUN; evidence absent |
| [S06-T02](https://app.notion.com/401b475e25f1814d87fef8f6ce66051f) | Accessibility: contrast/focus/keyboard/reduced motion | NOT RUN; evidence absent |
| [S06-T03](https://app.notion.com/401b475e25f1816b8ecfc090f93510f5) | Motion: flip double click, 60fps target as aspiration not fabricated PASS | NOT RUN; evidence absent |
| [S06-T04](https://app.notion.com/401b475e25f181fdac5ac1cb08857656) | Responsive 360×800 /375×667 /390×844 /1366×768 /1440×900 | NOT RUN; evidence absent |
| [S06-T05](https://app.notion.com/401b475e25f181febcdffdbf6f7429ab) | Arabic/English no overflow no clipped cards | NOT RUN; evidence absent |
| [S06-T06](https://app.notion.com/401b475e25f181e4b39debe314d5bfbb) | No extra gameplay functionality introduced by visuals | NOT RUN; evidence absent |

Evidence candidates are tests/manual-game.test.ts, tests/server-commerce.test.ts (if still present), tests/server-sql.test.ts, tests/browser/production.spec.ts, tests/browser/prize-draw.spec.ts and tests/browser/event-preview.spec.ts plus docs/evidence/. Verify actual filenames and case applicability on the final candidate. Public sample timer tests do not satisfy full host/session concurrency tests; PGlite tests do not satisfy remote multi-connection PostgreSQL races. A prior reviewer PASS on a scoped feature is not independent review of this new batch.

## Record-level closeout procedure

1. Freeze candidate SHA and deployed environment. Re-read all relevant Notion rows; reconcile against concurrent root changes.
2. For each applicable current criterion, attach the exact test/run and observed result. A single CI URL can support multiple mapped cases only when the report proves each case executed at that SHA.
3. For obsolete criteria, keep history and link reviewed replacements. Keep Notion counts/relations consistent; adding replacements without retiring their mandatory predecessors can leave readiness correctly blocked.
4. Record failed, unexecuted and externally blocked cases honestly. Do not use PASS for “not applicable”; document supersession through the approved registry mechanism.
5. Attach independent specialist review and existing applicable owner decision. If closure authority requires a new explicit exit acceptance, capture that decision after evidence exists, rather than treating a prior publish request as blanket signoff.
6. Only then may authorized root update QA/owner/official gate fields and read back calculated readiness, relation counts, approvals and final status.

## S07–S11 handoff / owner-only dependencies

S07/S08: secure identity/entitlement contract, tenant isolation, single controller, timing ownership, migrations, actual environment inventory, secrets, restore drill. S09: secure authoritative host mutations/history, content versions and sample separation. S10: provider OAuth configuration, sandbox verifier/idempotency, approved product mapping, clock/prestart/restart/refund/expiry policies. S11: full browser→Auth→API→DB journey, real concurrent transactions, rate abuse/error recovery, accessibility, performance and security evidence. Backend source edits or a private sandbox migration alone close none of these.

Owner/account-admin inputs that engineering cannot invent: production entity/contact/domain, privacy/legal jurisdiction and final text, prices/currency/tax treatment/refund/Slot expiry, unresolved session time semantics, provider account/credential access, billing activation and hosting/backup plan choices. Existing mandate avoids redundant routine approval requests; request only the missing consequential choice or unavailable access, with a concrete prepared result.

No remote backup/PITR, provider configuration, branch protection, Notion sync, policy publication or commercial enablement is asserted by this audit.

