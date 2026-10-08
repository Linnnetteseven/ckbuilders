# CKBuilders Weekly Report — Week 10

**Builder:** Linnette Mugwanja (@Linnette77)
**Period:** Sep 28 – Oct 4, 2026

---

## Summary

This was a light week on CKB. The W9 CadencePay MVP wrap-up landed in the first hours of the week. The main CKB work after that was the KeyWay login blocker: I talked to the KeyWay developer and decided to switch the demo's login to JoyID so the capstone isn't blocked. Most of my remaining time went to my Dada Devs fellowship work (Bitcoin), as noted below.

---

## What I worked on

### 1. CadencePay W9 wrap-up (pushed early Sep 28)

These commits landed just after midnight on Sep 28 and close out the W9 MVP. The details are in the W9 report. They're listed here only so the commit history matches.

| Commit | What |
|---|---|
| `2b2d41c` | Keeper cron for automatic payment collection |
| `72aad95` | Fix stray backslash in cron route |
| `5f89212` | W9 report: type script on testnet, 3 cells claimed, keeper cron, UI polish |
| `8f07591` | README updated with W7–W9 reports |

### 2. KeyWay login blocker → switching to JoyID

- **Problem:** CKB KeyWay social login in `cadencepay-demo` shows the modal and accepts the email, but `verify-code` returns 401.
- **What I did:** contacted the KeyWay developer. He is working on updates and new features, and those will take a while.
- **Decision:** move the demo's login to **JoyID via CCC** for now so subscribers can still sign with their own wallet. Social login comes back once KeyWay's updates are out.
- **Also:** following the CKBuilders Telegram discussion on other embedded / social login options for CKB dApps.
- **Status:** JoyID implementation is being carried into W11.

---

## Blockers

- **Social login:** KeyWay isn't usable yet for the demo. JoyID is the workaround.
- **Custody:** the demo still signs with a server-side key. This has to change for CadencePay's core promise (the subscriber keeps custody) to hold. It's the top W11 task.

## Other commitments this week

As I mentioned to Neon earlier, I'm in the **Dada Devs fellowship** (learning and building on Bitcoin). This week I worked on my fellowship capstone and on a Bitcoin/Lightning project for the GirlCode hackathon, which cut into my CKB time.

---

## What I learned

- Building a capstone on another builder's SDK that is still changing is a schedule risk. Having a fallback login (JoyID) ready keeps the product moving.
- Login and signing are separate decisions. Whatever handles login, the subscriber's own wallet has to sign subscribe and cancel transactions, otherwise CadencePay's trust story doesn't hold.

---

## Plan for Week 11 (Oct 5 – Oct 11)

1. Replace server-side signing: the subscriber signs subscribe and cancel with JoyID, and the creator signs claims.
2. Security review and threat model of the CadencePay type script: header_deps trust, script group counts, immutable fields, forged cells and Type ID, cancel authorization.
3. Privacy research from the links Neon shared: Obscell (stealth addresses, confidential transactions) and the optimized SP1 verifier for CKB-VM. Then decide what applies to CadencePay.
4. Push the demo toward a usable "Patreon on CKB": creator page and tiers, member dashboard (balance, next payment, cancel), creator dashboard (claimable, claim, history).
5. Submit the W11 report.

---

## Links

- Repo: https://github.com/Linnnetteseven/ckbuilders
- Demo: https://cadencepay-demo.vercel.app
- CadencePay type script v2 (testnet): code hash `0x05d60806d86b478715633f846d2e4d31e60b95b4ea0af4f5ce6c72e19d4b6fb4`, deploy tx `0x5ee7b1eacd6065bf2f040d678ae2e21987390317dfaadeec1b69be3e8574a3d9`
