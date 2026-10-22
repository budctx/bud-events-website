> **ARCHIVED — historical implementation evidence only (superseded on 2026-10-22).** Participant registration/tracking, Discord bots and Dark Mode in this document are **not** current BU’D requirements. See [current approved spec](BUD_CURRENT_APPROVED_SPEC.md), [superseded decisions](BUD_SUPERSEDED_DECISIONS.md) and [archive manifest](BUD_REPOSITORY_ARCHIVE.md). Preserve historical details for traceability; do not implement them as live features.

# Optional Discord bot — impact study

2026-10-14, Asia/Riyadh. Research owner: `/root/bot_study`; integration owner: Root. **Documentation feasibility study; no bot, OAuth or server integration has been implemented or tested.** This study changes no approved policy and adds no service subscription. Whop remains the payment provider.

## Recommendation

Build the complete authenticated website journey first. The optional bot adds a second, explicitly chosen source of participants: people currently attending one authorized Discord Stage channel. It must not own event state, payment, the timer, judging, prizes or completion. Defer automated Stage moderation until a separate connected test proves permissions and real client behavior. This preserves the full no-bot product and limits operational cost.

## Authoritative project contracts read

- [Current Handoff](https://drive.google.com/file/d/1xGJOwRTxoaWojCACHil_Ro6h_m5_USj-/view).
- [Stage 02](https://drive.google.com/file/d/1cVPx-QZV-WwKm7UAusBgVCgjRM-dlPQs/view): current invariants and Q16/19/20/26.
- [Stage 03](https://drive.google.com/file/d/19qMGINiPUOmYA3j8l3EXxtWyADeEt8lQ/view): current selection, replay and qualification rules.
- [Current Stage 04 PRD](https://drive.google.com/file/d/1DMnh0FdqQlrnuSLSu93_yAcS_4vWCwQ0/view): R-002/042–045/055; ST04-AC-16/N03/N04/N11.
- [Decision Registry](https://drive.google.com/file/d/1GESYhkr9sB_VsD_RnyfJ6SrtCw7w7pEq/view): latest approvals supersede historical random-priority toggles/fallbacks.

Stage attendance, website entrants and active competitors are distinct sets. Host and web entrants require Discord OAuth; Discord-only audience does not require website login. Joining never automatically grants competitor status. The buyer alone hosts; paid entitlement is server-agnostic. Selection validates identity, admission, ban and eligibility server-side. Random selects eligible never-played people only, with no loser fallback; manual also allows previous losers in a fresh round with full attempts. Qualified winners cannot replay. Kick/rejoin and session ban are platform controls, not Discord guild removal.

## Capabilities and effect on the experience

| Capability | Without bot | With optional bot | Evidence / boundary |
|---|---|---|---|
| Participant source | OAuth web joiners via link/code | Authorized Stage attendees, chosen explicitly | Product contract; sets remain separate |
| Current Stage attendance | Host sees Discord itself; website must not claim verified attendance | Worker consumes Gateway voice-state snapshot/deltas filtered by guild/channel | [D1], [D2], [D3]; needs connected validation |
| Manual/random selection | Fully available over eligible web entrants | Same rules over eligible Stage source | Source never silently mixes or switches |
| Verbal answers | Native Discord voice/Stage, host handles speakers | Same; bot does not evaluate audio | No audio recording or transcription needed |
| Judge/timer/retry | Website host and authoritative server | Unchanged | Gateway health never judges or restarts a round |
| Prizes/results | Website, same recipient ID and server award rules | Unchanged | Presence is not prize qualification |
| Speaker/mute controls | Host uses native Discord controls | Later optional controls after feasibility tests | [D3], [D4]; not an MVP dependency |
| Payment/session time | Whop/server entitlement | Unchanged | Bot failure is not host-control failure |

Gateway `GUILD_VOICE_STATES` delivers `VOICE_STATE_UPDATE`; it is not one of the three privileged intents. Proposed minimum worker intents are `GUILDS` and `GUILD_VOICE_STATES`. Do not request message content, presences or a whole-guild member list just to count a Stage. Discord documents an initial `GUILD_CREATE.voice_states` snapshot and subsequent events; voice states expose stable user/channel IDs. Attendance-only work therefore does not require an audio voice connection. This last conclusion is an engineering inference from the event API, subject to the connected visibility test. [D1–D3]

Use bot installation authorization and verify the selected guild/channel server-side; OAuth redirect parameters alone are not proof of installation. Minimum web identity scope is `identify`; add `guilds` only if the host actually needs a guild picker. Never automate a normal Discord account. [D5] Resolve display names without treating them as identity; if unavailable, show a safe ID label rather than silently requiring privileged member access. Exclude bot accounts using trusted user metadata. Store stable IDs as strings.

For Stage moderation, Discord exposes changing another user's `suppress` state only when that user already occupies the Stage and the caller has `MUTE_MEMBERS`. This does not prove that a chosen person automatically accepts a speaker invitation or produces audible speech; self-mute and client behavior are separate. [D3] Regular voice mute and movement have distinct permissions, including `MUTE_MEMBERS` and `MOVE_MEMBERS`. [D4] Do not request Administrator or add moderation privileges to the attendance-only install. Verify channel visibility/access and permission overwrites before enabling a feature; a later single-user voice-state lookup also requires connect permission. [D3/D4]

## Full journey without a bot

1. Buyer authenticates, activates the paid session through server entitlement, and configures attempts, challenge seconds and one prize per input line; details lock at Start.
2. Participants open the session link/code, authenticate with Discord, then enter the web admission list. Host shares the event screen and operates Discord speakers manually. Website source is the default, independent of installation status.
3. Host manually selects an eligible new/previous loser or randomly selects an eligible never-played entrant. Reveal both cards; server timer starts once; host alone judges verbal answers. Failure with attempts left produces a fresh pair. Qualified winners remain history and cannot replay.
4. Host proceeds to prizes, chooses qualified recipient/card and confirms actual opening/award or opening without recipient. First opening locks gameplay return/restart.
5. Host reviews Closing, confirms irreversible final end and copies actual awarded results. Identity, leases, eligibility and awards require server enforcement; current local fixtures do not establish these guarantees.

No guild selector, attendance permission, bot health check or automatic Discord message is required to finish this path.

## Minimal settings for a later connected version

| Setting / status | Proposed behavior |
|---|---|
| Participant source | Website entrants by default; Stage attendance enabled only after verified installation/channel/health. Display source beside list/count |
| Stage context | Guild + one Stage channel, shown only for Stage source; contextual choice never binds purchased entitlement to guild |
| Admission | Existing open/close joining, kick and session ban controls; preserve current contracts |
| Bot status | Absent / connecting / ready / reconnecting / permission missing / unavailable; informational, not a user toggle |
| Source change | Explicit host action; warns that the candidate list changes, preserves rounds/qualifications/awards and defers a change during an active round |
| Moderation | No controls in attendance MVP; later per-action controls only after permission verification/testing |

These are implementation recommendations, not a new owner-approved settings specification. No repeat-priority toggle, automatic source fallback, AI judging or payment-provider setting is proposed. Channel-pool eligibility/exclusions must be implemented against N04; do not invent a rule that Stage users must also log into the website.

## Loss, recovery and trust boundaries

On missing heartbeat acknowledgement, unavailable guild, permission removal or worker loss, mark Stage data stale and disable new Stage-based draws. Preserve the active contestant, attempts, server clock and committed results; website controls remain available. Offer a clear host-approved switch to web entrants. If that list is empty, show join link/code and an empty-pool state, never fabricate a contestant. Recovery does not silently switch the source back.

Gateway Resume can replay missed events; fresh Identify requires rebuilding the presence snapshot. [D1] Apply sequence-aware updates, fence previous worker generations, verify guild/channel permissions and mark ready only after snapshot/replay completes. Recheck the selected candidate's current source eligibility in the authoritative selection transaction; leaving after a committed selection does not rewrite history. Rate limits/retries must not duplicate a selection or moderation action. Bot loss does not trigger the distinct buyer-controller expiry/10-second grace rules.

The bot is a trusted server adapter, never a browser token or client-supplied ID feed. Publish session-scoped participant projections; prevent another tenant from reading guild attendance. Keep bot token/OAuth secret in service configuration. Avoid logging tokens or retaining full Gateway payloads. Cache only necessary Discord ID, display label/avatar where required, channel membership and freshness; retain event results under the existing 7-day entry/retention contract, not an indefinite attendance archive. No audio/message content collection.

## Hosting and cost

The approved Workflow assigns the persistent Gateway worker to Railway; website/backend ownership stays unchanged. A continuously connected worker needs heartbeats, reconnect logic and monitoring. Railway pricing combines subscription and measured resource usage; estimate from measured RAM/CPU/network and uptime, not an invented fixed bot price. [D6] Use one lightweight attendance worker first, no audio processing and no new service. Enable cost alerts; a hard usage cap can take the worker offline, so this failure must preserve the web path. [D7] No Railway project/subscription has been created by this study.

## Connected acceptance matrix — pending, not PASS

| Case | Required outcome |
|---|---|
| No installation at all | OAuth web joining → full event → prize awards → final results works |
| Bot absent + empty web list | Actionable join link; random returns no candidate |
| Stage-only audience | Trusted bot IDs selectable without website login, admission/ban rules enforced |
| Same ID in both sets / same display name on different IDs | Stable-ID deduplication; names never merge identities |
| New, loser, qualified, banned, departed, bot account | Exact manual/random eligibility; no loser random fallback |
| Wrong guild/channel / forged client ID / other tenant | Reject without leaking attendance or changing event |
| Permissions removed / guild unavailable / worker stopped | Stale source disabled; explicit web switch; active round/results preserved |
| Resume replay / failed resume + fresh snapshot | No duplicate members/draws; ready only after reconciled state |
| Switch during round / reconnect while web source active | Current round immutable; no automatic switch-back |
| Leave during selection race / stale worker generation | Authoritative eligibility transaction and fencing reject stale commands |
| Host connection lost / bot loss after paid expiry | Distinguish existing buyer-controller rules from adapter loss |
| Speaker controls denied / self-muted / invitation behavior | Explain native Discord alternative; never promise audible speaking |
| Final award + reconnect / repeated command | Idempotent server award, no duplicate recipient/card |
| AR/EN, RTL/LTR, Light/Dark, reduced motion | Source/status/errors stay readable and accessible in viewport |

## Primary public sources checked 2026-10-14

- D1 [Discord Gateway](https://docs.discord.com/developers/events/gateway): intents, heartbeat/reconnect/resume.
- D2 [Discord Gateway Events](https://docs.discord.com/developers/events/gateway-events): initial guild voice states and updates.
- D3 [Discord Voice Resource](https://docs.discord.com/developers/resources/voice): voice state fields, retrieval and Stage suppression caveats.
- D4 [Discord Permissions](https://docs.discord.com/developers/topics/permissions): per-channel permissions and voice capabilities.
- D5 [Discord OAuth2](https://docs.discord.com/developers/topics/oauth2): identity, bot authorization, guild hint warning and no self-bots.
- D6 [Railway Pricing](https://docs.railway.com/pricing): subscription/resource usage model; no bot-specific price assumed.
- D7 [Railway Cost Control](https://docs.railway.com/pricing/cost-control): alerts/hard-limit outage behavior.

Verification boundary: source/contract reads and recommendation review only. No real guild installation, permissions, Gateway attendance, speaker behavior, OAuth, Railway deployment or full authenticated no-bot journey test performed. The existing website journey remains a local simulation until services are connected.
