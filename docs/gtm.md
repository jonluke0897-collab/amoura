# Go-to-Market — Amoura

## 1. Market Context

Dating apps are a $10B+ global category, but the "trans-inclusive" segment of it is broken in a way that is obvious to trans people and invisible to everyone else. On mainstream apps — Tinder, Hinge, Bumble — trans women are routinely harassed, outed, reported, and have their profiles removed. Moderation is reactive, uneven, and trained on cis norms. The "trans-friendly" competitors that exist (Taimi, Transdr, Butterfly) have solved the presence problem — a trans woman can list herself honestly — but not the quality problem: the user base skews heavily toward cis men looking for a "hookup with a trans woman" rather than for partnership, the UX is dated, the moderation is indistinguishable from mainstream apps, and the experience of using them is often described by trans users as depressing. There is a gap between "a place where trans people are allowed to exist" and "a place designed, from the first pixel, with trans women at the center."

The timing is right for three convergent reasons. First, the public conversation around trans identity has sharpened in a way that makes the existing "all-in-one inclusive" dating positioning feel cowardly — trans users want platforms that take a side. Second, the technical stack has reached a point where a solo founder can ship a modern, realtime, cross-platform mobile product in 8–10 weeks with no funding — which wasn't true even 24 months ago. And third, the T4T (trans-for-trans) community has organized itself across Discord, Twitter/X, and TikTok into an audience that is both reachable and underserved. The audience is already talking; they're just not being built for.

Amoura's wedge is architectural, not promotional. The like-with-comment gate, the T4T preference toggle as a first-class control, the extended respect pledge for cis users, and the anti-fetishization design principles baked into the schema are what separate this product from "a dating app with trans-friendly marketing." This is the story we'll tell: a platform where the protection is built in, not bolted on.

---

## 2. Launch Strategy

Amoura's go-to-market follows three sequenced phases, each gated on a specific outcome rather than a fixed calendar.

**Pre-launch (weeks -8 to 0)** is about building trust and a waitlist inside the communities that will be most skeptical of the product. Because Jon is a cis man building a trans-first product, every pre-launch asset — every tweet, every TikTok, every Discord introduction — is calibrated to demonstrate humility, transparency, and proof-of-work rather than confidence. The goal is not to recruit users in this phase; it's to recruit paid trans advisors, get the first ten beta testers lined up, and give the trans community a chance to shape the product before it ships. The explicit, stated posture is: "I'm building this because I think it should exist, I know I'm not the expert on this, and I'm paying advisors and deferring to them on everything that matters."

**Soft launch (weeks 1–4)** is a closed beta in three cities — Austin, Brooklyn, and Oakland — chosen for their existing trans community density. The app is available only by invite via the waitlist, and users are onboarded in small weekly batches of 50–100. The goal is to prove the density problem is solvable ("the feed doesn't feel empty when you open it") and to iterate on the mechanics (like-with-comment, respect pledge) based on real user response. No paid marketing. No press. Build-in-public posts continue, but they shift from "here's what I'm building" to "here's what I'm learning from the first users."

**Public launch (weeks 5+)** is the broader reveal. The same three cities open to self-serve signup on the same day, supported by a coordinated content push across Twitter/X, TikTok, and a single piece of press (ideally them/Autostraddle/Xtra — not TechCrunch). The success gate for moving to public launch is qualitative, not quantitative: when 10+ beta users, unprompted, are telling their friends about the app and asking when they can invite them, you're ready. Growth from there is organic, city-by-city, gated on density metrics (see § 9).

---

## 3. Pre-Launch Playbook

**Week -8: Foundation and advisor recruitment.** Create the @getamoura handles on Twitter/X, TikTok, and Instagram. Stand up the landing page at amoura.app with a single sentence ("A dating app designed for trans women first, built with them, not for them") and a waitlist form. The first three tweets and the first TikTok should be the founder's story — honest, first-person, stating the thing out loud: "I'm a cis man building a trans-first dating app. I know how that sounds. Here's why, and here's what I'm doing to make sure I don't screw it up." Post a short Loom of Jon on camera explaining the motivation and inviting feedback. Simultaneously, reach out to 20 trans women in your existing network and on Twitter/X with a direct, specific ask: "I want to pay you $75/hour to be an advisor on this product. I'm hiring for [this specific thing]. Would you be open to a 30-minute call?" The goal by end of week: three paid advisors signed on retainer.

**Week -7: Advisor-shaped copy review.** Run the onboarding copy, the respect pledge, the brand voice, and the landing page copy past the advisors. Revise. This produces the "advisor-reviewed" badge you can honestly put on the site. Post a mid-week update: "This week I rewrote every piece of copy in the app based on advisor feedback. Here's one thing I got wrong." Specificity in public fuel the trust narrative.

**Week -6: Start building in public on Twitter/X and TikTok.** Twitter: 3 posts per week. One on technical progress (screenshots of feature completion), one on a design decision that reveals the anti-fetishization thinking ("Here's why we made sending a like require a comment on a specific photo or prompt"), one on something you got wrong and fixed. TikTok: 2 videos per week, 30–60 seconds each, same themes, face-to-camera. Start with 500 followers as the target by launch. The TikTok content has higher ROI for reaching trans Gen Z; Twitter/X has higher ROI for reaching the queer tech-adjacent crowd who will write about you.

**Week -5: Discord outreach.** Identify 8–12 trans-focused Discord servers that allow member announcements (r/asktransgender-adjacent, T4T-specific, trans-for-plants-of-all-things-style niche servers). Join as yourself, not as a brand. Introduce yourself in #introductions or similar, participate for a week before pitching anything. End of week: politely ask mods for permission to share the waitlist link in the appropriate channel. If they say no, respect it — don't post anyway.

**Week -4: Reddit participation, Subreddits r/asktransgender, r/MtF, r/actuallesbians, r/transgenderUK, r/T4T.** Never pitch the app cold. Participate in threads, share opinions, answer questions. After 2 weeks of good-faith participation, post a "building a dating app for trans women — what do you wish existed?" thread in one community at a time. Do not crosspost. Every comment you write is a brand impression — keep the voice warm, specific, and honest.

**Week -3: Recruit the first ten beta testers.** From your waitlist (target: 300+ by now), pick ten users across the three launch cities who look like the persona triad (a Maya, a Sarah, an Alex — per docs/product-vision.md § 2.1). Reach out personally via email. Offer: free Amoura Plus for life, a 30-minute feedback call after week 1, and a "founding member" badge on their profile forever. Explicitly tell them: "I'm picking you because I want your honest feedback more than I want happy users."

**Week -2: Beta build ready.** EAS build distributed via TestFlight (iOS) and Play Internal Testing (Android) to the ten testers. Over this week, they complete onboarding and populate their profiles. The feed is seeded with their profiles plus advisor profiles plus ~15 additional profiles from folks in the waitlist willing to be "early profiles." The goal is that when a 11th user signs up, the feed isn't empty.

**Week -1: Feedback sprint.** Run 30-minute feedback calls with every tester. Compile findings. Fix the three most impactful issues. Post a public build-in-public update: "Ten trans women have been using Amoura this week. Here's what I'm changing because of what they told me."

**Week 0: Soft launch day.** Open the beta to the next 100 waitlist users. Do not tweet about it widely. Do not email press. Watch the metrics (§ 9). Keep shipping.

---

## 4. Launch Week Plan

Assume launch week = the public launch after the soft launch phase (typically around week 5 from soft launch, depending on beta signal). Day-by-day:

**Sunday (launch eve).** Final pre-launch tweet at 8pm PT: a first-person reflection on what it took to get here, not a "we're launching tomorrow" hype post. Attach a 60-second TikTok of the founder thanking advisors by name (with their permission), walking through the product, and stating the honest goal: "I want to build something trans women actually recommend to their friends." Post the same video cross-cut for Twitter/X. Confirm the website, app store listings, paywall, webhooks, and sandbox purchases are all green. Email beta users: "Tomorrow we open to the public. Here's what's changing for you." (Answer: nothing changes, they keep their founding-member badge.)

**Monday (launch day).** 7am PT: TikTok and Twitter/X launch posts go live simultaneously. TikTok post is face-to-camera, 45 seconds, no music, "Today I'm launching Amoura — a dating app designed for trans women first. Here's what makes it different." Twitter/X is a 7-tweet thread opening with the same line but explaining the architectural decisions (like-with-comment, T4T toggle, respect pledge). 9am PT: email the waitlist (target: 1,500+ by now) with a warm invitation and download links. 11am PT: post in the Discord communities you've been participating in for the last two months, with explicit mod permission obtained in advance. Throughout the day: reply to every comment on Twitter/X within 30 minutes, reply to every DM within 2 hours. Do not mass-DM; respond to what comes in. Metrics to watch: waitlist → install conversion (target > 40%), install → completed onboarding (target > 70%), first 24-hour completed-profile count (target > 500).

**Tuesday.** One thoughtful, longer-form post. Either a Medium/Substack essay titled "Why I built a dating app for trans women as a cis man" (published to your own blog, linked from Twitter/X), or a 90-second TikTok doing the video version of the same. This is the piece that targets the crowd that was on the fence about you yesterday. Include the explicit advisor model, the open financials of what you're paying advisors, and the honest admission of what could still go wrong. Metrics: check DAU, check the Likes Inbox queue depth across the three cities (the first "this city has enough people" signal).

**Wednesday.** Press outreach — but only one target per day, not a blast. Email one queer-media journalist at them, Autostraddle, or Xtra with a personal pitch ("Here's the product, here's the founder story, here's why this specific journalist might care"). Do not pitch TechCrunch; that audience isn't your early adopters and will actively hurt brand credibility with your actual audience.

**Thursday.** First product iteration. Based on 3 days of real-user data, pick the single highest-friction moment in the onboarding funnel and fix it. Ship that afternoon. Post about it publicly: "Day 4 of launch. Here's the first thing I fixed based on what I saw this week."

**Friday.** Check in with advisors. 20-minute call: what's working, what's breaking, what copy needs to change. If any advisor raises a concern, treat it as a P0.

**Saturday.** No new content. Respond to messages. Look at the data quietly. The goal this day is to not overreact to noise.

**Sunday.** Week-in-review post on Twitter/X and TikTok. Honest. Specific numbers where you can share them, specific lessons where you can't. End with: what's shipping next week.

Metrics to watch throughout launch week: waitlist → install rate, install → completed profile rate, completed profile → first-like-sent rate, first-like-sent → match rate, support inbox volume and first-response time, and safety-report rate (the one you most want to stay low).

---

## 5. Post-Launch Growth

**Weeks 1–4: Solidify the soft launch cities.** The goal is not new city expansion; it's density in the three existing cities. Run a weekly founder livestream on TikTok (30 minutes, Q&A format, "ask me anything about building Amoura"). Run weekly product updates on Twitter/X. Host one in-person meetup in each launch city in week 3 or 4 — small, 15–30 people, at a queer-owned bar or community space. The meetup's goal is not marketing; it's creating a feedback loop between real users and the founder. Bring an advisor to co-host. Every meetup produces 2–3 TikToks of community, not marketing.

**Weeks 5–8: Iterate on the primary metric.** Amoura's primary metric is WAU-TNB (weekly active users who are trans / non-binary, per docs/product-vision.md § 3.4). By week 5 you'll have enough data to see whether the number is growing week-over-week. If yes, double down on the channels producing growth. If no, diagnose: is it acquisition (top of funnel), activation (completed profile), or retention (return in week 2)? Ship the highest-leverage fix. Keep the build-in-public cadence at 3 posts per week on Twitter/X, 2 per week on TikTok, and 1 long-form piece every two weeks.

**Weeks 9–12: Consider city 4.** If any of the three launch cities has > 500 WAU-TNB and organic growth is consistent, open the next city (Los Angeles, Chicago, or Minneapolis — pick based on where the waitlist skews). Repeat the soft-launch playbook with a 2-week on-ramp. Do not open more than one city per month; density is the bottleneck, not availability.

Feedback collection is continuous. The in-app NPS prompt (TASK-093 in the roadmap) fires 7 days after onboarding. Weekly, compile: NPS score, top three free-text themes from NPS, top three support email themes, top three advisor-raised concerns, three most-surprising user behaviors from analytics. Publish an abbreviated version of this summary monthly on Twitter/X — it becomes a flywheel because it signals to prospective users that feedback is taken seriously.

The double-down/pivot gate is at week 12. If WAU-TNB is growing organically ≥ 15% WoW and paid conversion is ≥ 6%, you have product-market fit and the next 90 days are about scaling acquisition. If WAU-TNB is flat or shrinking and paid conversion is < 3%, something fundamental is off — take two weeks to do 20 user interviews, then ship a single, decisive product change before growth work resumes.

---

## 6. Channel Strategy

**TikTok (highest ROI).** The founder's personal TikTok, @jonbuilds or similar (brand-adjacent, not brand-primary). Expected effort: 10–12 hours per week including filming, editing, posting, and replying. Expected return: the highest-quality top-of-funnel for the Gen Z and younger-millennial trans audience, which is the bulk of Amoura's users. Timeline to meaningful results: 6–10 weeks of consistent posting before any single video cracks 100k views, but smaller videos (1k–10k views) compound into a reliable 50–100 waitlist signups per week by week 8. Content buckets: founder transparency (30%), product-in-progress (30%), trans community narrative (20%), reply-to-comments content (20%).

**Twitter/X (high ROI for early adopters and press).** Two accounts: founder personal (higher-traffic, higher-voice) and product (quieter, launch-announcements and support). Expected effort: 5–7 hours per week across tweets, threads, and replies. Expected return: the crowd that writes about you — queer media, queer tech folks, LGBT VCs (if relevant later), and the early beta users. Timeline: first meaningful thread (1k+ likes) typically happens in weeks -4 to -2 if the build-in-public content is specific enough. This is the channel for breaking news ("Here's what I shipped this week") and reaching people who will amplify.

**Discord communities (medium ROI, high trust).** 8–12 trans-focused servers where authentic participation (not promotion) over 4–8 weeks earns the right to post about Amoura. Expected effort: 3–5 hours per week of genuine participation. Expected return: the first 300–500 waitlist signups and the highest-quality beta testers. Timeline: value materializes in week -4 through launch; fades as a primary channel after the soft launch.

**Reddit (medium ROI, specific subreddits).** r/asktransgender, r/MtF, r/actuallesbians, r/T4T, r/transgenderUK. Same rule: participate before pitching. Expected effort: 2–3 hours per week. Expected return: steady waitlist growth + the occasional post that catches fire (unpredictable). Timeline: similar to Discord.

**In-person meetups (high ROI in launch cities, low ROI elsewhere).** Host one per city per month during weeks 3–12. Expected effort: ~6 hours of prep per event plus travel if applicable. Expected return: compounding community trust in each launch city; each meetup typically produces 8–12 high-quality word-of-mouth referrals in the following two weeks. Timeline: immediate return per event.

**Queer media press (medium ROI, timing-dependent).** them.us, Autostraddle, Xtra, Dazed. One pitch per outlet, sequentially, in launch week. Expected effort: 4–6 hours across pitching + interviews. Expected return: a single strong article produces 200–600 waitlist signups and lasting SEO value. Timeline: typically 2–4 weeks from pitch to publication.

**Paid ads (explicitly deprioritized).** Meta and TikTok ads to trans-specific audiences are ethically fraught (audience detection uses proxies that can out users), badly performing (targeting is weak for this audience), and expensive per install. Do not spend on paid acquisition in the first 6 months. If at month 6 organic is stable and the business is profitable, revisit with a small $500 test budget on TikTok, not Meta.

**SEO / content hub (low ROI short-term, compounds long-term).** A handful of blog posts at amoura.app/writing: "How to safely date as a trans woman online," "What T4T means and why it matters," "The best questions to ask on a first date," etc. Expected effort: 2 hours per week. Expected return: compounds after month 3; ranks in 6–12 months. Timeline: long-tail value, don't prioritize before product-market fit.

**Podcasts (high ROI once you can pitch "I built a trans-first dating app").** Queer podcasts, indie hacker podcasts, build-in-public podcasts. Wait until post-launch, when you have a product and a story. Expected effort: 2 hours per episode. Expected return: each episode is a 300–600 waitlist spike and builds founder credibility. Timeline: weeks 6+ post-launch.

---

## 7. Content Strategy

The anchor content premise is the honest founder journey. Every post — TikTok, Twitter/X, blog, podcast — is tied back to one of three narratives: the trans dating landscape is broken in specific ways; here is one specific thing I'm doing to fix it; here is one specific thing I got wrong and changed.

**Cadence.** TikTok: 2–3 videos per week, 30–90 seconds each, face-to-camera. Twitter/X: 3 posts per week (a mix of single tweets and 5–10-tweet threads). Blog: 1 post every 2–3 weeks, 800–1500 words. Instagram: light cross-posting only, not a primary channel. LinkedIn: zero unless there's a specific B2B angle later (unlikely).

**Video content types on TikTok.** (a) "Design decision" explainers — the camera on Jon, showing the app, walking through why a specific design choice was made (e.g., "Here's why you can't send a generic like in Amoura"). These perform well because they're specific. (b) "What I got wrong this week" posts — honest retrospective, high trust-building. (c) Advisor spotlights (with advisor permission and co-authored scripts) — amplifies trans voices, builds credibility. (d) Community stories — users who agreed to be featured telling their Amoura story (never without written consent; pay for their time). Never use stock footage of trans people, never use AI-generated "trans people" imagery.

**Thread content types on Twitter/X.** Technical deep-dives on interesting architecture decisions (e.g., the like-with-comment schema) perform well in the queer-tech-adjacent crowd. "What I shipped this week" recap threads build a reliable audience. Occasional longer threads reflecting on founder-market-fit — "Here's how I think about being a cis man building a trans-first app" — should be edited by an advisor before posting and should be rare (maybe one per month); overdoing this thread type becomes performative.

**Blog content.** The blog at amoura.app/writing is written for two audiences: prospective users (practical posts about trans dating) and prospective press (founder-journey posts that reporters can mine for quotes). Keep the tone consistent with the app: warm, specific, not preachy. Every post gets reviewed by an advisor before publishing when it touches trans experience.

**Content that's off-limits.** Never post drama or screenshots of bad behavior on competitor apps — it reads as punching down and drags the brand into a defensive posture. Never post statistics about violence against trans people as marketing — it's exploitative. Never use the word "allies" about yourself. Never post "look how inclusive we are" content; show it through product decisions, not declarations.

---

## 8. Community Strategy

The trans community is not a single community. It's a dense web of overlapping communities — trans Twitter, Trans TikTok, specific Discord servers, local community centers, drag and ballroom circles, queer sports leagues, specific subreddits. Amoura cannot "build a community" from scratch because those communities already exist and are more valuable than anything Amoura could create. The strategy is participation, amplification, and support — not creation.

**Participation first, promotion later.** In each target Discord and subreddit, the founder is a member and contributor for at least 4 weeks before pitching anything. Participation means: answering questions, sharing opinions, making jokes, being a regular human. Mods notice; members notice. The trust earned in this period is what makes the eventual "hey, I'm building a dating app for this community" post land rather than get flagged as spam. In practice: log 2–3 hours per week in the communities you care about most, not as a chore but as a part of normal life.

**Amplify trans voices.** When an advisor publishes something, when a user writes something thoughtful about dating, when a trans creator makes a video relevant to the problem — retweet, repost, tag, credit. The Amoura brand's content volume on trans voices should exceed its content volume on itself. This is a structural discipline, not a vibes thing: track the ratio monthly and keep it above 2:1 (two amplification posts for every one self-promotional post).

**Pay for expertise.** Every person whose expertise the product relies on gets paid. The three trans advisors on retainer are line items in the budget (§ 10). Every user featured in content gets paid ($100–$200 per feature). Every meetup host is compensated. This is a moral baseline but it's also good marketing: the fact that Amoura pays for trans expertise becomes part of the story and a credible differentiator.

**Host, don't own.** The in-person meetups are Amoura-sponsored, not Amoura-run. A local community member co-hosts each one and is paid for the time. The event is at a queer-owned venue. The branding is light. The vibe is that Amoura showed up to support an existing community gathering, not that Amoura invented a new one.

**Have an explicit stance.** The brand voice is warm but has an edge (per docs/product-vision.md § 4.2). Take sides on transphobia. Don't hide behind "both sides" framing when it comes to trans rights. This will alienate some potential cis users; that's fine, it also strengthens trust with the primary audience. The stance is a retention tool, not just an acquisition tool.

**Handle backlash with advisors.** There will be backlash — from TERFs, from cis men rejected from the respect pledge, from some corners of tech Twitter. Have an advisor-reviewed playbook for the three most likely attacks: the "why is a cis man building this" attack (response: transparency, specifics about advisor model), the "you're excluding X" attack (response: who the product is explicitly for, with no apologies), and the "this is just a fetish app" attack (response: walk through the architectural decisions that prevent fetishization, and dare them to show any other dating app with similar protections). Do not engage in extended arguments online; make the point once, link to a blog post that makes it in more depth, and move on.

---

## 9. Key Metrics

The business goal is that Jon leaves retail within 6 months of launch, via ~350 paying Amoura Plus subscribers at $14.99/mo producing ~$5,000/mo net (after platform fees, RevenueCat, Convex, Clerk, and operational costs). To hit that, the funnel looks like:

**Acquisition.** Waitlist signups: target 1,500 by soft launch, 3,000 by public launch, 8,000 by end of month 3 post-launch. Key channels ranked by expected waitlist-signup volume: TikTok (40%), Twitter/X (20%), Discord (15%), Reddit (10%), press (10%), other (5%). Install-from-waitlist conversion target: 50%+. Total installs goal at 90 days post-public-launch: 5,000+.

**Activation.** Completed-profile rate (install → completed onboarding): target 70%+. This is the single most leveraged metric — every 5-point improvement here compounds into every downstream metric. Time-to-first-like: median under 10 minutes from install. First-like-to-match rate: 15–25% in the first month is healthy; below 10% signals density problems in the feed.

**Retention.** D1: 50%+. D7: 30%+. D30: 20%+. The primary metric — WAU-TNB (weekly active users who identify as trans or non-binary) — is the north star; if it grows week-over-week, everything else works. If it's flat for three consecutive weeks, the soft launch isn't landing and something substantial needs to change.

**Revenue.** Free-to-paid conversion rate: 6% target, with 4% as the alarm floor and 10% as the stretch. Monthly churn on paid: target < 8%; anything above 12% signals value-delivery issues. ARPU: $13 blended (monthly + yearly). By end of month 6: 350 active paid subscribers producing ~$4,500/mo net, which is the quit-retail threshold. By end of month 12: 1,500 active paid subscribers producing ~$19,000/mo net, which is the "this is a real business" threshold.

**Safety.** Report volume per 100 DAU per week: aim for < 2. Repeat-offender rate (users reported 3+ times in their first 30 days): track weekly, intervene fast. Average time-to-report-resolution: < 24 hours for safety issues, < 72 hours for other. These metrics are not optional; a dating app for a vulnerable audience that can't keep safety metrics healthy doesn't have a business regardless of growth.

**Qualitative signal.** In addition to all of the above, track a single qualitative metric weekly: the count of unprompted messages (support emails, DMs, tweets) from users saying some version of "thank you for building this." When that count is regularly > 10/week, the product is resonating. When it's 0 for two weeks straight, something is off that the numbers aren't showing yet.

---

## 10. Budget Considerations

Jon is a retail worker funding this out of pocket. Every dollar needs to justify itself. Monthly budget projection for the first 6 months, assuming no external funding:

**Infrastructure (roughly $150–$400/mo, scaling with usage).** Convex (~$25–$100), Clerk (~$25 until 10k MAU, then paid tier), RevenueCat (free until $2.5k MTR), OneSignal (free tier until 10k subscribers), AWS Rekognition for photo verification (~$10–$50), Persona for ID verification (~$1–$2 per verification, so $50–$200/mo at launch volume), PostHog (free until 1M events), Sentry (free until ~5k monthly errors), domain + email hosting (~$10/mo). Expect this to grow with users but remain under $500/mo through month 6.

**Advisors (highest-priority spend, $900–$1500/mo).** Three trans advisors on retainer at $300–$500/mo each (4–6 hours of work per advisor per month). This is non-negotiable and should be the first line item paid before any other discretionary expense. Advisors review copy changes, flag moderation edge cases, co-create content, and serve as a reality check on product decisions. If cash flow is tight, reduce the hours per advisor before reducing the number of advisors — the goal is maintaining the relationships and the accountability structure.

**Legal (one-time + occasional, $1500–$3500 upfront, $200/mo retainer).** A lawyer experienced in LGBTQ+ platforms for the Privacy Policy, Terms, and Community Guidelines ($1500–$3000 one-time before launch). A small retainer ($200/mo) for availability when unusual situations come up (law enforcement requests, subpoenas, platform policy questions).

**Marketing (variable, $0–$300/mo for first 6 months).** Primary marketing is founder time, which is already accounted for. Cash spend is for things like: paid scheduling tool (Buffer/Hypefury, $15/mo), basic video editing tool (CapCut free tier, or $10/mo for a pro feature), Notion for content calendar ($10/mo), Canva Pro if needed ($15/mo), a budget for "pay users featured in content" ($100–$200/mo). No paid ads.

**Events (variable, $200–$800 per event).** In-person meetups in launch cities. Venue (often free if you pick a queer-owned bar on an off night), food/drinks ($150–$400), co-host fee ($100–$200), transportation if traveling. Budget for one event per launch city per month starting month 2.

**Founder self-support.** Jon is funding this while working retail. There is no "founder salary" in the first 6 months. The quit-retail threshold (~$4,500/mo net from the app) is the threshold for replacing the retail paycheck; until then, the retail income is the founder's income, and the app's income is reinvested into infrastructure, advisors, and legal.

**Total baseline monthly burn (lean):** ~$1,250–$2,200 for infrastructure + advisors + marketing + legal retainer. The critical floor is $900 for advisors — if cash flow doesn't support advisors, the product should delay shipping rather than cut that line. Every other expense is negotiable.

**Funding posture.** No outside funding in the first 12 months. Not because it's impossible — a few queer-founder-friendly angel investors exist — but because outside capital at this stage changes the product calculus. A bootstrapped Amoura can prioritize user trust over growth metrics; a funded Amoura will have pressure to grow faster than trust-building allows. If the business hits $15k/mo MRR and wants to accelerate, revisit the funding question at that point.

---

## 11. Risks

**Founder-market-fit skepticism (highest probability, highest impact).** A cis man building a trans-first dating app will be questioned, repeatedly and publicly, about legitimacy. Mitigation: the advisor model, paid and named publicly (with advisor permission); published financials around advisor spend; visible deferral to trans advisors on every sensitive decision in build-in-public content; a commitment (written publicly) that within 12 months of product-market fit, at least one trans co-founder or senior team member is brought on equity-at-market. Accept that this risk never fully goes away — manage it continuously, don't try to solve it once.

**Density problem in launch cities (high probability, medium-high impact).** The magic moment ("scroll feels like home") requires enough trans users in each launch city that a newly-signed-up user sees a non-empty feed. If density isn't there, early users churn and the flywheel breaks. Mitigation: city-gated launch with a strict pre-launch density target (100+ completed profiles per city before public launch in that city); explicit "You've seen everyone" UX that protects the feeling rather than showing blank states; advisor and founding-member profiles seeded at launch; don't expand to new cities until the existing ones hit density thresholds.

**Bad-faith cis user infiltration (high probability, high impact).** Even with the respect pledge and verification, some cis users will lie, pass the gates, and harm trans users. A single high-profile incident could destroy the brand. Mitigation: verification required, fast report response (< 24h SLA), aggressive bans on first substantiated report, moderator training with advisors, a "kill switch" to close new signups for specific identity types in a city if the report rate spikes, and a published moderation transparency report quarterly.

**Platform rejection (medium probability, high impact).** Apple and Google have rejected trans-focused dating apps before, often on vague "sensitive content" or "moderation insufficient" grounds. Mitigation: proactive engagement with App Store and Play Store reviewer relations; have a compliance-ready deck explaining the moderation model before submission; conservative on any content that could be classified as adult; legal review of the app store listing copy; have a lawyer ready to escalate if rejection happens; keep a web-based version ready as Plan B.

**Press misframing (medium probability, medium impact).** A piece in mainstream or hostile press could frame the product as "a fetish app" or "a controversial app for sensitive Gen Z users." Mitigation: be strategic about press targets (queer media first, tech press only later and only with outlets known to handle trans topics well); always do 30-minute pre-interviews to vet the reporter's framing; have a media kit that front-loads the advisor model and the architectural safety decisions; if a hostile piece runs, respond once (in a blog post, not on social), then let it pass.

**Burnout and solo-founder exhaustion (high probability, high impact).** Six months of 30+ hours/week on top of retail is hard; 12 months is brutal. Mitigation: protect one full day per week with no Amoura work; ship on a schedule that's sustainable, not heroic; use the roadmap checkbox system to limit scope-creep; be honest with advisors and the public when a week is going sideways (the transparency helps, not hurts); when revenue hits quit-retail threshold, quit immediately rather than delaying.

**Competitor response (low probability, medium impact).** Hinge or Bumble could copy the like-with-comment mechanic or the T4T toggle. Mitigation: the real moat isn't the mechanic, it's the community trust and advisor model — those take years to build and can't be copied by a feature update. Keep building that moat; don't chase feature parity reflexively.

**Financial runway (low probability at current burn, high impact if triggered).** If infrastructure costs scale faster than subscription revenue, the retail income becomes insufficient to cover both personal expenses and app operations. Mitigation: monthly financial review with strict thresholds (if baseline monthly burn exceeds retail income minus personal expenses, raise prices or reduce feature scope before running out of cash); consider a modest Stripe-based "tip jar" or "community support" option if advisors agree it's not off-brand; don't pursue outside funding as a first response — first optimize the existing pricing and cost structure.

**Regulatory / policy risks (emerging, medium-long-term).** Anti-trans legislation in some U.S. states could affect how the app operates regionally. Mitigation: legal review of geographic operations before launch; internal policy that user data is never shared with any entity without a valid legal order and a meaningful legal fight; public commitment to user data protection; a pre-drafted response plan (legal + communications) for any subpoena or state-level action; launch cities chosen in part for their legal environments.
