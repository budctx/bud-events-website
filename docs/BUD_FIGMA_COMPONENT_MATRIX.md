# BU’D Figma source audit and component map

Checked 2026-10-22, source file `STOmHGc7E9OQudKbyWDEli`. Source content is current observed design, not an independent proof of owner approval or version-history certification.

## Source identity

| Surface | Figma node | Observed dimensions | Implementation |
| --- | --- | --- | --- |
| Home Desktop | 339:2068, H01 — الرئيسية / Desktop | 1440 × 900 | Platform Home |
| Home Mobile | 339:2070, H02 — الرئيسية / Mobile | 390 × 844 | Platform Home mobile |
| Gallery Desktop | 383:11100, G01 — معرض الفعاليات / Desktop | 1440 × 900 | Events gallery |
| Gallery Mobile | 383:11923, G02 — معرض الفعاليات / Mobile | 390 × 844 | Events gallery mobile |
| Header | 339:2072; mobile339:2129 | 1312 × 92 / 342 × 108 | Shared header |
| Hero | 339:2099; mobile339:2151 | 530 × 560 / 342 × 270 | Hero text/actions |
| Gallery card | 383:11116; mobile383:11939 | 1000 × 440 / 342 × 476 | Q&C product card |
| Footer | 339:2123; mobile339:2168 | 1312 × 32 / 342 × 32 | Shared footer |
| Social proof | 359:2272; mobile359:2350 | 530 × 120 / 342 × 106 | Honest empty states in equivalent slots |
| Product details modal | No frame found in inspected page | Not specified | Reversible implementation from existing component tokens; pending visual acceptance |

Page339:2067 is named `02 — الرئيسية • Retro Portal • مراجعة المالك`; page314:2 is `01 — سؤال وشرط • التصميم المعتمد`. Node names do not certify approval dates or immutable design version IDs. No version identifier was returned by the inspected tools.

## Verified high-fidelity properties

- Readex Pro. Main ink #333333; amber #FBB03B; canvas #F6F0E2; white cards #FDFDFF. Typography Desktop hero56px / 1.42, Mobile36px / 1.4; eyebrow14px desktop,12px mobile; body16px desktop,14px mobile.
- Desktop header x64 y12, width1312 height92. Login190×44. Logo wrapper64×75.375. Header nav Home/Events/Bots/Designs; latter two explicitly marked coming soon.
- Home Desktop hero x846 y205; Mobile x24 y142. Desktop CTA258×52 and158×52, mobile218×48 and112×48. CTA border2px radius8px hard shadow3px3px. No CTA under-labels.
- Social proof positioned near footer: Desktop y680; Mobile y686. Testimonials are sample text `@discord_user`, `نص رأي العميل عن تجربته يظهر هنا`, `محتوى توضيحي`. Partner component description explicitly says placeholders, not actual endorsements. Implementation uses transparent empty content instead of fictional endorsements.
- Gallery title40px desktop/30px mobile. Gallery Desktop content max1000px; card x220 y268,1000×440, border2 radius16 shadow4px5px. Card Desktop uses420px preview and484px information, gap32px.
- Q&C preview black card body #212121,176×187.2 desktop and130×138.271 mobile. Original paired corner emblems. Q medallion amber label; C medallion blue #5DB1FF label. Existing logo source is original approved six-vector emblem155:1048, imported in Figma component192:41.
- Card text: `سؤال وشرط`, `سؤال يختبرك، وشرط يغيّر التحدّي. أدر الفعالية بطريقتك مع مجتمعك.`, `إدارة للهوست · جوائز · مؤقت اختياري`.

## Asset provenance and actual status

| Asset | Figma source | Local path | Status |
| --- | --- | --- | --- |
| Desktop portal original | Background339:2069; image hash9ea0800694f6ad3ad9e2eaf46b1eaa32c3868056 | public/assets/home-portal-desktop.png | Exact original bytes1713057; SHA1 equals Figma image hash |
| Mobile portal original | Background339:2071; image hashbc5d6de766e1527185c7615400c2b5cdf28b5e87; Library libfile_4d7364b1a1908191b3036c801ae4d78b | public/assets/home-portal-mobile.png | Exact original bytes1432441; SHA1 equals Figma image hash;851×1848 |
| Original BU’D emblem | Existing repo asset, Figma source155:1048/component192:41 | public/assets/bud-emblem.svg | Reused existing exact original mark; native32×23 attributes retained |
| Community dot texture — secondary hero CTA | Figma instance374:7324 / component374:2942, original community source NzywZGvAw380fzj0MlPvXb2:44198 | public/assets/community-dots-secondary.svg | EXACT native SVG export 61,473 bytes, 158×52 viewport and group opacity0.12; used on Home secondary CTA only. Additional container textures still OPEN. |

Figma asset curl requests returned HTTP200 text/html `Site Unavailable`,195bytes, not valid images. Native read-only `getImageByHash().getBytesAsync()` recovered the Desktop raster through bounded chunks; SHA1 verifies exact bytes. All failed HTML files remain outside the repo. After native retrieval hit its call limit, Library inventory resolved both original artworks: `Golden portal with floating cards.png` (mobile, libfile_4d7364b1a1908191b3036c801ae4d78b) and `Amber portal and floating cards.png` (desktop, libfile_140d6511a9788191af41594e9c503cca). Both SHA1 hashes equal the Figma fill image hashes. The complete mobile original is now available to the implementation; root integration and visual verification remain required.

## Interaction and acceptance scope

- Shared public Gallery → Product Modal → CTA for Events/Bots/Designs. Upcoming categories are visible and their CTA cannot purchase. Active Q&C shows a local rehearsal CTA and an honest unavailable state for unconfigured purchasing; no artificial OAuth or purchase success.
- Native HTML dialog provides modal semantics, focus containment, Escape, backdrop dismissal, return focus and scroll lock. These are implementation choices pending browser verification.
- AR/EN with document language/direction and a persisted optional locale preference. English text is a working translation pending owner content acceptance; design contains Arabic only.
- Reduced motion disables section/modal/control animations. No carousel runs without real approved content.
- Legal/support content remains an explicit preparation state. Real approved copy required before purchasing opens.

## Remaining visual blockers

1. Exact Mobile portal raster integrated with picture/source at max-width700px; current mobile screenshot compared with Figma. Geometry and interactions tested; other un-restored container textures and honest replacement of sample endorsements mean no full pixel-parity claim.
2. Exact Home secondary CTA dot texture was restored from native Figma instance374:7324 on 2026-10-22. Card/review/other dotted textures remain unverified and visually incomplete.
3. No latest immutable Figma version/approval timestamp returned. Current frame identity and owner-provided candidate registry are evidence; formal approval linkage remains open.
4. Product modal, Bots and Designs empty layouts require owner visual acceptance. They reuse existing tokens and do not replace verified Home/Gallery layouts.
5. Original desktop/mobile Figma screenshots exist as internal evidence in `/workspace/scratch/f0cb861765a1/design-audit/screenshots/`. They are never used as runtime assets.

Verdict: IMPLEMENTED_WITH_LIMITS, not final visual PASS. Root QA must test exact committed SHA and responsive/modal/RTL/EN geometry; other dotted textures remain a scoped blocker; root must verify recovered Mobile asset placement.
