// ============================================================
// Message in a Cell: capsule lock tests
//
// Each test is named after the attack or rule it proves. Wallets are
// always-success locks with distinct args, so "the recipient's input is in
// the tx" can be simulated without signatures; real wallets bring their own
// signature checks.
//
// Note: ckb-testtool runs scripts only; it does not check `since` against the
// chain. These tests prove the lock demands the right `since`; CKB consensus
// then refuses any tx whose `since` hasn't been reached.
// ============================================================

use crate::Loader;
use ckb_testtool::{
    builtin::ALWAYS_SUCCESS,
    ckb_error::Error as CkbError,
    ckb_types::{
        bytes::Bytes,
        core::{TransactionBuilder, TransactionView},
        packed::*,
        prelude::*,
    },
    context::Context,
};

const MAX_CYCLES: u64 = 10_000_000;
const CKB: u64 = 100_000_000;
const GIFT: u8 = 0;
const LEGACY: u8 = 1;
const GRACE: u64 = 90 * 24 * 60 * 60;
const UNLOCK_AT: u64 = 1_893_456_000; // 2030-01-01
const WINDOW: u64 = 180 * 24 * 60 * 60;

// since encodings (RFC 0017)
fn abs_ts(secs: u64) -> u64 { (0b10 << 61) | secs }
fn rel_ts(secs: u64) -> u64 { (1 << 63) | (0b10 << 61) | secs }
fn abs_block(n: u64) -> u64 { n }

// error codes from contracts/capsule-lock
const INVALID_ARGS: i8 = 1;
const NOT_AUTHORIZED: i8 = 2;
const TOO_EARLY: i8 = 3;
const RECLAIM_TOO_EARLY: i8 = 4;
const OVERFLOW: i8 = 5;

struct Env {
    ctx: Context,
    capsule_bin: OutPoint,
    wallet_bin: OutPoint,
}

#[derive(Clone, Copy)]
enum Who { Sender, Recipient, Stranger }

impl Env {
    fn new() -> Self {
        let mut ctx = Context::default();
        let capsule_bin = ctx.deploy_cell(Loader::default().load_binary("capsule-lock"));
        let wallet_bin = ctx.deploy_cell(ALWAYS_SUCCESS.clone());
        Env { ctx, capsule_bin, wallet_bin }
    }

    fn wallet(&mut self, who: Who) -> Script {
        let tag: &[u8] = match who { Who::Sender => b"sender", Who::Recipient => b"recipient", Who::Stranger => b"stranger" };
        self.ctx.build_script(&self.wallet_bin, Bytes::copy_from_slice(tag)).unwrap()
    }

    fn capsule_lock_with_args(&mut self, args: Vec<u8>) -> Script {
        self.ctx.build_script(&self.capsule_bin, Bytes::from(args)).unwrap()
    }

    fn capsule_lock(&mut self, mode: u8, t: u64) -> Script {
        let sender = self.wallet(Who::Sender).calc_script_hash();
        let recipient = self.wallet(Who::Recipient).calc_script_hash();
        let mut args = vec![mode];
        args.extend_from_slice(sender.as_slice());
        args.extend_from_slice(recipient.as_slice());
        args.extend_from_slice(&t.to_le_bytes());
        self.capsule_lock_with_args(args)
    }

    fn cell(&mut self, lock: Script, capacity: u64) -> OutPoint {
        self.ctx.create_cell(CellOutput::new_builder().capacity(capacity).lock(lock).build(), Bytes::new())
    }

    /// Spend `capsules` (each with its since) plus one cell from each of `who`.
    fn open(&mut self, capsules: &[(Script, u64)], who: &[Who]) -> Result<u64, CkbError> {
        let mut tx = TransactionBuilder::default();
        let mut total = 0;
        for (lock, since) in capsules {
            let op = self.cell(lock.clone(), 2_000 * CKB);
            total += 2_000 * CKB;
            tx = tx.input(CellInput::new_builder().previous_output(op).since(*since).build());
        }
        for w in who {
            let lock = self.wallet(*w);
            let op = self.cell(lock, 100 * CKB);
            total += 100 * CKB;
            tx = tx.input(CellInput::new_builder().previous_output(op).build());
        }
        let out_lock = self.wallet(who.first().copied().unwrap_or(Who::Stranger));
        let tx: TransactionView = tx
            .output(CellOutput::new_builder().capacity(total - CKB).lock(out_lock).build())
            .output_data(Bytes::new().pack())
            .build();
        let tx = self.ctx.complete_tx(tx);
        self.ctx.verify_tx(&tx, MAX_CYCLES)
    }
}

fn error_code(err: &CkbError) -> Option<i64> {
    let s = err.to_string();
    let i = s.find("error code ")? + "error code ".len();
    s[i..].chars().take_while(|c| *c == '-' || c.is_ascii_digit()).collect::<String>().parse().ok()
}

fn assert_rejected(res: Result<u64, CkbError>, code: i8) {
    match res {
        Ok(_) => panic!("expected rejection with error code {code}, but the tx verified"),
        Err(e) => assert_eq!(error_code(&e), Some(code as i64), "expected error code {code}, got: {e}"),
    }
}

// ── Gift ─────────────────────────────────────────────────────

#[test]
fn gift_recipient_opens_on_the_day() {
    let mut env = Env::new();
    let lock = env.capsule_lock(GIFT, UNLOCK_AT);
    env.open(&[(lock, abs_ts(UNLOCK_AT))], &[Who::Recipient]).expect("recipient opens on time");
}

#[test]
fn gift_recipient_opens_any_time_after() {
    let mut env = Env::new();
    let lock = env.capsule_lock(GIFT, UNLOCK_AT);
    env.open(&[(lock, abs_ts(UNLOCK_AT + 400 * 86_400))], &[Who::Recipient]).expect("still openable later");
}

#[test]
fn gift_rejects_opening_one_second_early() {
    let mut env = Env::new();
    let lock = env.capsule_lock(GIFT, UNLOCK_AT);
    assert_rejected(env.open(&[(lock, abs_ts(UNLOCK_AT - 1))], &[Who::Recipient]), TOO_EARLY);
}

#[test]
fn gift_rejects_missing_since() {
    let mut env = Env::new();
    let lock = env.capsule_lock(GIFT, UNLOCK_AT);
    assert_rejected(env.open(&[(lock, 0)], &[Who::Recipient]), TOO_EARLY);
}

#[test]
fn gift_rejects_block_number_since_posing_as_time() {
    // A block number numerically ≥ t must not count as a timestamp
    let mut env = Env::new();
    let lock = env.capsule_lock(GIFT, UNLOCK_AT);
    assert_rejected(env.open(&[(lock, abs_block(UNLOCK_AT * 10))], &[Who::Recipient]), TOO_EARLY);
}

#[test]
fn gift_rejects_relative_since_instead_of_absolute() {
    let mut env = Env::new();
    let lock = env.capsule_lock(GIFT, UNLOCK_AT);
    assert_rejected(env.open(&[(lock, rel_ts(UNLOCK_AT))], &[Who::Recipient]), TOO_EARLY);
}

#[test]
fn gift_rejects_stranger_even_after_unlock() {
    let mut env = Env::new();
    let lock = env.capsule_lock(GIFT, UNLOCK_AT);
    assert_rejected(env.open(&[(lock, abs_ts(UNLOCK_AT + 1))], &[Who::Stranger]), NOT_AUTHORIZED);
}

#[test]
fn gift_rejects_no_wallet_at_all() {
    let mut env = Env::new();
    let lock = env.capsule_lock(GIFT, UNLOCK_AT);
    assert_rejected(env.open(&[(lock, abs_ts(UNLOCK_AT + 1))], &[]), NOT_AUTHORIZED);
}

#[test]
fn gift_rejects_sender_taking_it_back_before_grace() {
    let mut env = Env::new();
    let lock = env.capsule_lock(GIFT, UNLOCK_AT);
    assert_rejected(env.open(&[(lock, abs_ts(UNLOCK_AT + GRACE - 1))], &[Who::Sender]), RECLAIM_TOO_EARLY);
}

#[test]
fn gift_rejects_sender_undo_right_after_sealing() {
    let mut env = Env::new();
    let lock = env.capsule_lock(GIFT, UNLOCK_AT);
    assert_rejected(env.open(&[(lock, abs_ts(UNLOCK_AT - 30 * 86_400))], &[Who::Sender]), RECLAIM_TOO_EARLY);
}

#[test]
fn gift_sender_reclaims_after_grace_if_unopened() {
    let mut env = Env::new();
    let lock = env.capsule_lock(GIFT, UNLOCK_AT);
    env.open(&[(lock, abs_ts(UNLOCK_AT + GRACE))], &[Who::Sender]).expect("reclaim after grace");
}

#[test]
fn gift_rejects_second_capsule_riding_along_without_since() {
    // Same lock, same group: every capsule input must meet the time rule
    let mut env = Env::new();
    let lock = env.capsule_lock(GIFT, UNLOCK_AT);
    assert_rejected(env.open(&[(lock.clone(), abs_ts(UNLOCK_AT)), (lock, 0)], &[Who::Recipient]), TOO_EARLY);
}

#[test]
fn gift_two_capsules_both_due_open_together() {
    let mut env = Env::new();
    let lock = env.capsule_lock(GIFT, UNLOCK_AT);
    env.open(&[(lock.clone(), abs_ts(UNLOCK_AT)), (lock, abs_ts(UNLOCK_AT + 5))], &[Who::Recipient]).expect("both due");
}

#[test]
fn gift_grace_overflow_is_an_error_not_a_panic() {
    let mut env = Env::new();
    let lock = env.capsule_lock(GIFT, u64::MAX - 10);
    assert_rejected(env.open(&[(lock, abs_ts(0x00ff_ffff_ffff_ffff))], &[Who::Sender]), OVERFLOW);
}

#[test]
fn future_me_cannot_open_early_by_being_both_sender_and_recipient() {
    // Sender == recipient: the recipient path still needs the date
    let mut env = Env::new();
    let me = env.wallet(Who::Recipient).calc_script_hash();
    let mut args = vec![GIFT];
    args.extend_from_slice(me.as_slice());
    args.extend_from_slice(me.as_slice());
    args.extend_from_slice(&UNLOCK_AT.to_le_bytes());
    let lock = env.capsule_lock_with_args(args.clone());
    assert_rejected(env.open(&[(lock, abs_ts(UNLOCK_AT - 1))], &[Who::Recipient]), TOO_EARLY);
    let lock = env.capsule_lock_with_args(args);
    env.open(&[(lock, abs_ts(UNLOCK_AT))], &[Who::Recipient]).expect("opens on the day");
}

// ── Legacy ───────────────────────────────────────────────────

#[test]
fn legacy_owner_can_always_move_their_savings() {
    let mut env = Env::new();
    let lock = env.capsule_lock(LEGACY, WINDOW);
    env.open(&[(lock, 0)], &[Who::Sender]).expect("owner check-in / withdraw any time");
}

#[test]
fn legacy_beneficiary_claims_after_inactivity_window() {
    let mut env = Env::new();
    let lock = env.capsule_lock(LEGACY, WINDOW);
    env.open(&[(lock, rel_ts(WINDOW))], &[Who::Recipient]).expect("beneficiary after window");
}

#[test]
fn legacy_rejects_beneficiary_before_window() {
    let mut env = Env::new();
    let lock = env.capsule_lock(LEGACY, WINDOW);
    assert_rejected(env.open(&[(lock, rel_ts(WINDOW - 1))], &[Who::Recipient]), TOO_EARLY);
}

#[test]
fn legacy_rejects_absolute_since_posing_as_inactivity() {
    // An absolute timestamp is always "large"; it must not satisfy a relative window
    let mut env = Env::new();
    let lock = env.capsule_lock(LEGACY, WINDOW);
    assert_rejected(env.open(&[(lock, abs_ts(UNLOCK_AT))], &[Who::Recipient]), TOO_EARLY);
}

#[test]
fn legacy_rejects_relative_block_count_instead_of_time() {
    let mut env = Env::new();
    let lock = env.capsule_lock(LEGACY, WINDOW);
    assert_rejected(env.open(&[(lock, (1 << 63) | WINDOW * 10)], &[Who::Recipient]), TOO_EARLY);
}

#[test]
fn legacy_rejects_stranger() {
    let mut env = Env::new();
    let lock = env.capsule_lock(LEGACY, WINDOW);
    assert_rejected(env.open(&[(lock, rel_ts(WINDOW * 4))], &[Who::Stranger]), NOT_AUTHORIZED);
}

// ── Args ─────────────────────────────────────────────────────

#[test]
fn rejects_short_args() {
    let mut env = Env::new();
    let lock = env.capsule_lock_with_args(vec![GIFT; 40]);
    assert_rejected(env.open(&[(lock, abs_ts(UNLOCK_AT))], &[Who::Recipient]), INVALID_ARGS);
}

#[test]
fn rejects_unknown_mode() {
    let mut env = Env::new();
    let sender = env.wallet(Who::Sender).calc_script_hash();
    let recipient = env.wallet(Who::Recipient).calc_script_hash();
    let mut args = vec![7u8];
    args.extend_from_slice(sender.as_slice());
    args.extend_from_slice(recipient.as_slice());
    args.extend_from_slice(&UNLOCK_AT.to_le_bytes());
    let lock = env.capsule_lock_with_args(args);
    assert_rejected(env.open(&[(lock, abs_ts(UNLOCK_AT))], &[Who::Recipient]), INVALID_ARGS);
}
