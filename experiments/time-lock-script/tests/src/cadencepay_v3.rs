// ============================================================
// CadencePay Type Script v3 — security tests (W11)
//
// Each test is named after the attack or rule it proves.
// Threat model: notes/cadencepay-threat-model.md
//
// Cell model under test:
//   lock = Input Type Proxy Lock (args = hash of the cell's own type script)
//   type = cadencepay (data1), args = type_id[32] ‖ subscriber_lock_hash[32]
//   data = recipient_lock_hash[32] ‖ amount u64 ‖ interval u64 ‖ next_claim_block u64
// ============================================================

use crate::Loader;
use ckb_testtool::{
    builtin::ALWAYS_SUCCESS,
    ckb_error::Error as CkbError,
    ckb_hash::new_blake2b,
    ckb_types::{
        bytes::Bytes,
        core::{HeaderBuilder, ScriptHashType, TransactionBuilder, TransactionView},
        packed::*,
        prelude::*,
    },
    context::Context,
};
use std::{fs, path::PathBuf};

const MAX_CYCLES: u64 = 10_000_000;
const CKB: u64 = 100_000_000;
const AMOUNT: u64 = 100 * CKB;
const INTERVAL: u64 = 2_000;
const CELL_CAP: u64 = 600 * CKB;
/// Occupied capacity of a v3 Subscription Cell:
/// 8 (capacity) + 65 (proxy lock) + 97 (type, 64-byte args) + 56 (data) bytes
const OCCUPIED: u64 = 226 * CKB;
const NOW: u64 = 9_000;
const NEXT: u64 = 10_000;

// Error codes — must match contracts/cadencepay/src/main.rs
const INVALID_ARGS: i8 = 1;
const INVALID_DATA_SIZE: i8 = 2;
const INVALID_GROUP_SHAPE: i8 = 3;
const TYPE_ID_INVALID: i8 = 4;
const NO_HEADER: i8 = 5;
const CLAIM_TOO_EARLY: i8 = 6;
const SCHEDULE_NOT_ADVANCED: i8 = 7;
const FIELDS_CHANGED: i8 = 8;
const LOCK_CHANGED: i8 = 9;
const CAPACITY_MISMATCH: i8 = 10;
const PAYOUT_MISSING: i8 = 11;
const MULTIPLE_SUBSCRIPTIONS: i8 = 12;
const SUBSCRIBER_AUTH_MISSING: i8 = 13;
const REFUND_MISSING: i8 = 14;
const INVALID_TERMS: i8 = 15;
const WRONG_LOCK: i8 = 16;
const INSUFFICIENT_CAPACITY: i8 = 17;
const OVERFLOW: i8 = 18;
const BALANCE_SUFFICIENT: i8 = 19;
const INVALID_START: i8 = 20;

// ── Test environment ─────────────────────────────────────────

struct Env {
    ctx: Context,
    cadencepay: OutPoint,
    proxy: OutPoint,
    subscriber: Script,
    creator: Script,
    keeper: Script,
    stranger: Script,
}

#[derive(Clone)]
struct Sub {
    out_point: OutPoint,
    type_script: Script,
    lock: Script,
    data: Bytes,
    capacity: u64,
}

fn hash32(script: &Script) -> [u8; 32] {
    script.calc_script_hash().unpack()
}

fn sub_data(recipient: [u8; 32], amount: u64, interval: u64, next: u64) -> Bytes {
    let mut d = Vec::with_capacity(56);
    d.extend_from_slice(&recipient);
    d.extend_from_slice(&amount.to_le_bytes());
    d.extend_from_slice(&interval.to_le_bytes());
    d.extend_from_slice(&next.to_le_bytes());
    Bytes::from(d)
}

fn with_next(data: &Bytes, next: u64) -> Bytes {
    let mut d = data.to_vec();
    d[48..56].copy_from_slice(&next.to_le_bytes());
    Bytes::from(d)
}

fn input(out_point: &OutPoint) -> CellInput {
    CellInput::new_builder().previous_output(out_point.clone()).build()
}

fn output(capacity: u64, lock: &Script, type_: Option<&Script>) -> CellOutput {
    CellOutput::new_builder()
        .capacity(capacity)
        .lock(lock.clone())
        .type_(ScriptOpt::new_builder().set(type_.cloned()).build())
        .build()
}

fn proxy_lock_binary() -> Bytes {
    let path: PathBuf = [env!("CARGO_MANIFEST_DIR"), "fixtures", "input-type-proxy-lock"]
        .iter()
        .collect();
    fs::read(path).expect("tests/fixtures/input-type-proxy-lock").into()
}

impl Env {
    fn new() -> Self {
        let mut ctx = Context::default();
        let cadencepay = ctx.deploy_cell(Loader::default().load_binary("cadencepay"));
        let proxy = ctx.deploy_cell(proxy_lock_binary());
        let always = ctx.deploy_cell(ALWAYS_SUCCESS.clone());
        let mut tagged = |tag: &str| {
            ctx.build_script(&always, Bytes::copy_from_slice(tag.as_bytes()))
                .unwrap()
        };
        let subscriber = tagged("subscriber");
        let creator = tagged("creator");
        let keeper = tagged("keeper");
        let stranger = tagged("stranger");
        Env { ctx, cadencepay, proxy, subscriber, creator, keeper, stranger }
    }

    fn type_script(&mut self, type_id: [u8; 32], subscriber_hash: [u8; 32]) -> Script {
        let mut args = type_id.to_vec();
        args.extend_from_slice(&subscriber_hash);
        self.type_script_raw_args(Bytes::from(args))
    }

    fn type_script_raw_args(&mut self, args: Bytes) -> Script {
        self.ctx
            .build_script_with_hash_type(&self.cadencepay, ScriptHashType::Data1, args)
            .unwrap()
    }

    fn proxy_lock(&mut self, type_script: &Script) -> Script {
        let args = Bytes::copy_from_slice(type_script.calc_script_hash().as_slice());
        self.ctx
            .build_script_with_hash_type(&self.proxy, ScriptHashType::Data1, args)
            .unwrap()
    }

    fn plain_cell(&mut self, lock: &Script, capacity: u64) -> OutPoint {
        self.ctx.create_cell(output(capacity, lock, None), Bytes::new())
    }

    fn header(&mut self, number: u64) -> Byte32 {
        let header = HeaderBuilder::default()
            .number(number)
            .epoch(1000u64 << 40)
            .build();
        let hash = header.hash();
        self.ctx.insert_header(header);
        hash
    }

    /// A live Subscription Cell that already exists on chain.
    fn live_sub(&mut self, seed: u8, capacity: u64, data: Bytes) -> Sub {
        let subscriber_hash = hash32(&self.subscriber.clone());
        let type_script = self.type_script([seed; 32], subscriber_hash);
        let lock = self.proxy_lock(&type_script);
        let out_point = self
            .ctx
            .create_cell(output(capacity, &lock, Some(&type_script)), data.clone());
        Sub { out_point, type_script, lock, data, capacity }
    }

    fn default_sub(&mut self, seed: u8) -> Sub {
        let recipient = hash32(&self.creator.clone());
        self.live_sub(seed, CELL_CAP, sub_data(recipient, AMOUNT, INTERVAL, NEXT))
    }

    fn verify(&mut self, tx: TransactionView) -> Result<u64, CkbError> {
        let tx = self.ctx.complete_tx(tx);
        self.ctx.verify_tx(&tx, MAX_CYCLES)
    }
}

fn error_code(err: &CkbError) -> Option<i64> {
    let s = err.to_string();
    let i = s.find("error code ")? + "error code ".len();
    let digits: String = s[i..]
        .chars()
        .take_while(|c| *c == '-' || c.is_ascii_digit())
        .collect();
    digits.parse().ok()
}

fn assert_rejected(res: Result<u64, CkbError>, code: i8) {
    match res {
        Ok(_) => panic!("expected rejection with error code {code}, but the tx verified"),
        Err(e) => assert_eq!(
            error_code(&e),
            Some(code as i64),
            "expected error code {code}, got: {e}"
        ),
    }
}

// ── Create ───────────────────────────────────────────────────

struct CreateCase {
    amount: u64,
    interval: u64,
    next: u64,
    recipient: Option<[u8; 32]>,
    capacity: u64,
    proxy_lock: bool,
    subscriber_input: bool,
    corrupt_type_id: bool,
    short_args: bool,
    two_outputs: bool,
    extra_data_byte: bool,
    header: Option<u64>,
}

impl Default for CreateCase {
    fn default() -> Self {
        CreateCase {
            amount: AMOUNT,
            interval: INTERVAL,
            next: NEXT,
            recipient: None,
            capacity: CELL_CAP,
            proxy_lock: true,
            subscriber_input: true,
            corrupt_type_id: false,
            short_args: false,
            two_outputs: false,
            extra_data_byte: false,
            header: Some(NOW),
        }
    }
}

fn run_create(case: CreateCase) -> Result<u64, CkbError> {
    let mut env = Env::new();
    let funder = if case.subscriber_input { env.subscriber.clone() } else { env.stranger.clone() };
    let funding = env.plain_cell(&funder, 10_000 * CKB);
    let first_input = input(&funding);

    // Type ID = blake2b(first CellInput ‖ output index as u64 LE)
    let mut type_id = [0u8; 32];
    let mut hasher = new_blake2b();
    hasher.update(first_input.as_slice());
    hasher.update(&0u64.to_le_bytes());
    hasher.finalize(&mut type_id);
    if case.corrupt_type_id {
        type_id[0] ^= 0xff;
    }

    let subscriber_hash = hash32(&env.subscriber.clone());
    let type_script = if case.short_args {
        env.type_script_raw_args(Bytes::copy_from_slice(&type_id))
    } else {
        env.type_script(type_id, subscriber_hash)
    };
    let lock = if case.proxy_lock { env.proxy_lock(&type_script) } else { env.stranger.clone() };

    let recipient = case.recipient.unwrap_or_else(|| hash32(&env.creator.clone()));
    let mut data = sub_data(recipient, case.amount, case.interval, case.next).to_vec();
    if case.extra_data_byte {
        data.push(0);
    }
    let data = Bytes::from(data);

    let mut tx = TransactionBuilder::default()
        .input(first_input)
        .output(output(case.capacity, &lock, Some(&type_script)))
        .output_data(data.pack());
    if case.two_outputs {
        tx = tx
            .output(output(case.capacity, &lock, Some(&type_script)))
            .output_data(data.pack());
    }
    if let Some(n) = case.header {
        tx = tx.header_dep(env.header(n));
    }
    env.verify(tx.build())
}

#[test]
fn create_valid_subscription() {
    run_create(CreateCase::default()).expect("valid create");
}

#[test]
fn create_rejects_forged_type_id() {
    assert_rejected(run_create(CreateCase { corrupt_type_id: true, ..Default::default() }), TYPE_ID_INVALID);
}

#[test]
fn create_rejects_short_args() {
    assert_rejected(run_create(CreateCase { short_args: true, ..Default::default() }), INVALID_ARGS);
}

#[test]
fn create_rejects_zero_amount() {
    assert_rejected(run_create(CreateCase { amount: 0, ..Default::default() }), INVALID_TERMS);
}

#[test]
fn create_rejects_zero_interval_infinite_claims() {
    assert_rejected(run_create(CreateCase { interval: 0, ..Default::default() }), INVALID_TERMS);
}

#[test]
fn create_rejects_interval_below_minimum() {
    assert_rejected(run_create(CreateCase { interval: 99, ..Default::default() }), INVALID_TERMS);
}

#[test]
fn create_rejects_zero_recipient() {
    assert_rejected(run_create(CreateCase { recipient: Some([0u8; 32]), ..Default::default() }), INVALID_TERMS);
}

#[test]
fn create_rejects_schedule_overflow() {
    assert_rejected(
        run_create(CreateCase { next: u64::MAX - 1, header: Some(NOW), ..Default::default() }),
        OVERFLOW,
    );
}

#[test]
fn create_rejects_start_before_header_backdated_claims() {
    assert_rejected(run_create(CreateCase { next: NOW - 1, ..Default::default() }), INVALID_START);
}

#[test]
fn create_rejects_missing_header_dep() {
    assert_rejected(run_create(CreateCase { header: None, ..Default::default() }), NO_HEADER);
}

#[test]
fn create_rejects_lock_other_than_type_proxy() {
    assert_rejected(run_create(CreateCase { proxy_lock: false, ..Default::default() }), WRONG_LOCK);
}

#[test]
fn create_rejects_without_subscriber_input() {
    assert_rejected(run_create(CreateCase { subscriber_input: false, ..Default::default() }), SUBSCRIBER_AUTH_MISSING);
}

#[test]
fn create_rejects_capacity_below_one_payment() {
    assert_rejected(
        run_create(CreateCase { capacity: OCCUPIED + AMOUNT - 1, ..Default::default() }),
        INSUFFICIENT_CAPACITY,
    );
}

#[test]
fn create_rejects_two_outputs_same_subscription() {
    assert_rejected(run_create(CreateCase { two_outputs: true, ..Default::default() }), INVALID_GROUP_SHAPE);
}

#[test]
fn create_rejects_extra_data_bytes() {
    assert_rejected(run_create(CreateCase { extra_data_byte: true, ..Default::default() }), INVALID_DATA_SIZE);
}

// ── Claim ────────────────────────────────────────────────────

/// Default = a valid keeper claim: no subscriber or creator signature,
/// keeper pays the fee from their own cell.
struct ClaimParts {
    out_data: Bytes,
    out_capacity: u64,
    out_lock: Script,
    payouts: Vec<(Script, u64)>,
    header: Option<u64>,
    extra_inputs: Vec<OutPoint>,
}

fn run_claim_on(env: &mut Env, sub: &Sub, edit: impl FnOnce(&mut Env, &mut ClaimParts)) -> Result<u64, CkbError> {
    let (_, _, _, next) = decode(&sub.data);
    let (_, amount, interval, _) = decode(&sub.data);
    let keeper_cell = env.plain_cell(&env.keeper.clone(), 1_000 * CKB);
    let mut parts = ClaimParts {
        out_data: with_next(&sub.data, next + interval),
        out_capacity: sub.capacity - amount,
        out_lock: sub.lock.clone(),
        payouts: vec![(env.creator.clone(), amount)],
        header: Some(next + 5),
        extra_inputs: vec![keeper_cell],
    };
    edit(env, &mut parts);

    let mut tx = TransactionBuilder::default()
        .input(input(&sub.out_point))
        .output(output(parts.out_capacity, &parts.out_lock, Some(&sub.type_script)))
        .output_data(parts.out_data.pack());
    for op in &parts.extra_inputs {
        tx = tx.input(input(op));
    }
    for (lock, cap) in &parts.payouts {
        tx = tx.output(output(*cap, lock, None)).output_data(Bytes::new().pack());
    }
    if let Some(n) = parts.header {
        tx = tx.header_dep(env.header(n));
    }
    env.verify(tx.build())
}

fn run_claim(edit: impl FnOnce(&mut Env, &mut ClaimParts)) -> Result<u64, CkbError> {
    let mut env = Env::new();
    let sub = env.default_sub(1);
    run_claim_on(&mut env, &sub, edit)
}

fn decode(data: &Bytes) -> ([u8; 32], u64, u64, u64) {
    let mut recipient = [0u8; 32];
    recipient.copy_from_slice(&data[0..32]);
    let u = |r: std::ops::Range<usize>| u64::from_le_bytes(data[r].try_into().unwrap());
    (recipient, u(32..40), u(40..48), u(48..56))
}

#[test]
fn claim_valid_by_keeper_without_any_signature() {
    run_claim(|_, _| {}).expect("valid keeper claim");
}

#[test]
fn claim_rejects_header_before_next_claim() {
    assert_rejected(run_claim(|_, p| p.header = Some(NEXT - 1)), CLAIM_TOO_EARLY);
}

#[test]
fn claim_rejects_missing_header_dep() {
    assert_rejected(run_claim(|_, p| p.header = None), NO_HEADER);
}

#[test]
fn claim_rejects_next_claim_not_advanced_by_interval() {
    // v2 behaviour (next := header number) is no longer accepted
    assert_rejected(
        run_claim(|_, p| p.out_data = with_next(&p.out_data, NEXT + 5)),
        SCHEDULE_NOT_ADVANCED,
    );
}

#[test]
fn claim_rejects_double_amount_in_one_tx() {
    assert_rejected(
        run_claim(|_, p| {
            p.out_data = with_next(&p.out_data, NEXT + 2 * INTERVAL);
            p.out_capacity = CELL_CAP - 2 * AMOUNT;
            p.payouts[0].1 = 2 * AMOUNT;
        }),
        SCHEDULE_NOT_ADVANCED,
    );
}

#[test]
fn claim_rejects_output_capacity_drop_gt_amount_drain() {
    assert_rejected(
        run_claim(|env, p| {
            p.out_capacity = CELL_CAP - 3 * AMOUNT;
            p.payouts.push((env.keeper.clone(), 2 * AMOUNT));
        }),
        CAPACITY_MISMATCH,
    );
}

#[test]
fn claim_rejects_missing_payout() {
    assert_rejected(run_claim(|_, p| p.payouts.clear()), PAYOUT_MISSING);
}

#[test]
fn claim_rejects_payout_below_amount() {
    assert_rejected(run_claim(|_, p| p.payouts[0].1 = AMOUNT - 1), PAYOUT_MISSING);
}

#[test]
fn claim_rejects_payout_redirected_to_other_lock() {
    assert_rejected(run_claim(|env, p| p.payouts[0].0 = env.keeper.clone()), PAYOUT_MISSING);
}

#[test]
fn claim_rejects_payout_funded_by_creators_own_input() {
    // Creator recycles their own cell as the "payout"; the subscription's amount goes elsewhere.
    assert_rejected(
        run_claim(|env, p| {
            let own = env.plain_cell(&env.creator.clone(), AMOUNT);
            p.extra_inputs.push(own);
            p.payouts = vec![(env.creator.clone(), AMOUNT), (env.keeper.clone(), AMOUNT)];
        }),
        PAYOUT_MISSING,
    );
}

#[test]
fn claim_valid_creator_merges_small_payout_into_own_cell() {
    run_claim(|env, p| {
        let own = env.plain_cell(&env.creator.clone(), 200 * CKB);
        p.extra_inputs.push(own);
        p.payouts = vec![(env.creator.clone(), 200 * CKB + AMOUNT)];
    })
    .expect("creator may merge the payout into an existing cell");
}

#[test]
fn claim_rejects_changed_recipient() {
    assert_rejected(
        run_claim(|env, p| {
            let mut d = p.out_data.to_vec();
            d[0..32].copy_from_slice(&hash32(&env.keeper.clone()));
            p.out_data = Bytes::from(d);
        }),
        FIELDS_CHANGED,
    );
}

#[test]
fn claim_rejects_changed_amount() {
    assert_rejected(
        run_claim(|_, p| {
            let mut d = p.out_data.to_vec();
            d[32..40].copy_from_slice(&(AMOUNT * 2).to_le_bytes());
            p.out_data = Bytes::from(d);
        }),
        FIELDS_CHANGED,
    );
}

#[test]
fn claim_rejects_changed_interval() {
    assert_rejected(
        run_claim(|_, p| {
            let mut d = p.out_data.to_vec();
            d[40..48].copy_from_slice(&1u64.to_le_bytes());
            p.out_data = Bytes::from(d);
        }),
        FIELDS_CHANGED,
    );
}

#[test]
fn claim_rejects_changed_lock() {
    assert_rejected(run_claim(|env, p| p.out_lock = env.keeper.clone()), LOCK_CHANGED);
}

#[test]
fn claim_rejects_extra_data_bytes() {
    assert_rejected(
        run_claim(|_, p| {
            let mut d = p.out_data.to_vec();
            d.push(0);
            p.out_data = Bytes::from(d);
        }),
        INVALID_DATA_SIZE,
    );
}

#[test]
fn claim_rejects_insufficient_balance_use_close() {
    let mut env = Env::new();
    let recipient = hash32(&env.creator.clone());
    let sub = env.live_sub(1, OCCUPIED + AMOUNT - 1, sub_data(recipient, AMOUNT, INTERVAL, NEXT));
    assert_rejected(run_claim_on(&mut env, &sub, |_, _| {}), INSUFFICIENT_CAPACITY);
}

#[test]
fn claim_rejects_two_inputs_one_output_merge() {
    let mut env = Env::new();
    let a = env.default_sub(7);
    // A second live cell carrying the identical type script (pre-v3 style duplicate)
    let b_op = env
        .ctx
        .create_cell(output(CELL_CAP, &a.lock, Some(&a.type_script)), a.data.clone());
    let res = run_claim_on(&mut env, &a, |_, p| p.extra_inputs.push(b_op));
    assert_rejected(res, INVALID_GROUP_SHAPE);
}

#[test]
fn claim_rejects_one_input_two_outputs_split() {
    let mut env = Env::new();
    let sub = env.default_sub(1);
    let keeper_cell = env.plain_cell(&env.keeper.clone(), 1_000 * CKB);
    let out_data = with_next(&sub.data, NEXT + INTERVAL);
    let forged = with_next(&sub.data, 0);
    let header = env.header(NEXT + 5);
    let tx = TransactionBuilder::default()
        .input(input(&sub.out_point))
        .input(input(&keeper_cell))
        .output(output(CELL_CAP - AMOUNT, &sub.lock, Some(&sub.type_script)))
        .output_data(out_data.pack())
        .output(output(CELL_CAP, &sub.lock, Some(&sub.type_script)))
        .output_data(forged.pack())
        .output(output(AMOUNT, &env.creator.clone(), None))
        .output_data(Bytes::new().pack())
        .header_dep(header)
        .build();
    assert_rejected(env.verify(tx), INVALID_GROUP_SHAPE);
}

#[test]
fn claim_rejects_shared_payout_across_two_subscriptions() {
    let mut env = Env::new();
    let a = env.default_sub(1);
    let b = env.default_sub(2);
    let keeper_cell = env.plain_cell(&env.keeper.clone(), 1_000 * CKB);
    let header = env.header(NEXT + 5);
    let tx = TransactionBuilder::default()
        .input(input(&a.out_point))
        .input(input(&b.out_point))
        .input(input(&keeper_cell))
        .output(output(CELL_CAP - AMOUNT, &a.lock, Some(&a.type_script)))
        .output_data(with_next(&a.data, NEXT + INTERVAL).pack())
        .output(output(CELL_CAP - AMOUNT, &b.lock, Some(&b.type_script)))
        .output_data(with_next(&b.data, NEXT + INTERVAL).pack())
        // one payout pretending to cover both subscriptions; keeper pockets the other
        .output(output(AMOUNT, &env.creator.clone(), None))
        .output_data(Bytes::new().pack())
        .output(output(AMOUNT, &env.keeper.clone(), None))
        .output_data(Bytes::new().pack())
        .header_dep(header)
        .build();
    assert_rejected(env.verify(tx), MULTIPLE_SUBSCRIPTIONS);
}

#[test]
fn claim_catchup_three_sequential_txs_then_too_early() {
    let mut env = Env::new();
    let recipient = hash32(&env.creator.clone());
    let header = NEXT + 2 * INTERVAL + 5; // three periods are due
    let mut capacity = CELL_CAP;
    let mut next = NEXT;
    for round in 0..4 {
        let sub = env.live_sub(1, capacity, sub_data(recipient, AMOUNT, INTERVAL, next));
        let res = run_claim_on(&mut env, &sub, |_, p| p.header = Some(header));
        if round < 3 {
            res.unwrap_or_else(|e| panic!("catch-up claim {round} should pass: {e}"));
            capacity -= AMOUNT;
            next += INTERVAL;
        } else {
            assert_rejected(res, CLAIM_TOO_EARLY);
        }
    }
}

// ── Top-up ───────────────────────────────────────────────────

fn run_topup(subscriber_signs: bool, edit_data: Option<fn(&mut Vec<u8>)>) -> Result<u64, CkbError> {
    let mut env = Env::new();
    let sub = env.default_sub(1);
    let funder = if subscriber_signs { env.subscriber.clone() } else { env.stranger.clone() };
    let funds = env.plain_cell(&funder, 500 * CKB);
    let mut data = sub.data.to_vec();
    if let Some(f) = edit_data {
        f(&mut data);
    }
    let tx = TransactionBuilder::default()
        .input(input(&sub.out_point))
        .input(input(&funds))
        .output(output(CELL_CAP + 400 * CKB, &sub.lock, Some(&sub.type_script)))
        .output_data(Bytes::from(data).pack())
        .output(output(100 * CKB, &funder, None))
        .output_data(Bytes::new().pack())
        .build();
    env.verify(tx)
}

#[test]
fn topup_valid_by_subscriber() {
    run_topup(true, None).expect("valid top-up");
}

#[test]
fn topup_requires_subscriber_input() {
    assert_rejected(run_topup(false, None), SUBSCRIBER_AUTH_MISSING);
}

#[test]
fn topup_rejects_data_change() {
    assert_rejected(
        run_topup(true, Some(|d| d[32..40].copy_from_slice(&1u64.to_le_bytes()))),
        FIELDS_CHANGED,
    );
}

#[test]
fn owner_input_cannot_rewrite_subscription() {
    // The old v2 "owner mode" let any tx with a subscriber input skip all checks.
    assert_rejected(
        run_claim(|env, p| {
            let own = env.plain_cell(&env.subscriber.clone(), 100 * CKB);
            p.extra_inputs.push(own);
            let mut d = p.out_data.to_vec();
            d[0..32].copy_from_slice(&hash32(&env.stranger.clone()));
            p.out_data = Bytes::from(d);
        }),
        FIELDS_CHANGED,
    );
}

// ── Cancel and close (1 → 0) ─────────────────────────────────

fn run_end(capacity: u64, subscriber_signs: bool, refund_to_subscriber: bool) -> Result<u64, CkbError> {
    let mut env = Env::new();
    let recipient = hash32(&env.creator.clone());
    let sub = env.live_sub(1, capacity, sub_data(recipient, AMOUNT, INTERVAL, NEXT));
    let mut tx = TransactionBuilder::default().input(input(&sub.out_point));
    let mut refund = capacity;
    if subscriber_signs {
        let own = env.plain_cell(&env.subscriber.clone(), 100 * CKB);
        tx = tx.input(input(&own));
        refund += 100 * CKB - 100_000; // subscriber pays a 0.001 CKB fee
    } else {
        let keeper_cell = env.plain_cell(&env.keeper.clone(), 1_000 * CKB);
        tx = tx.input(input(&keeper_cell));
    }
    let to = if refund_to_subscriber { env.subscriber.clone() } else { env.stranger.clone() };
    let tx = tx.output(output(refund, &to, None)).output_data(Bytes::new().pack()).build();
    env.verify(tx)
}

#[test]
fn cancel_valid_refunds_subscriber() {
    run_end(CELL_CAP, true, true).expect("valid cancel");
}

#[test]
fn cancel_rejects_refund_to_other_lock() {
    assert_rejected(run_end(CELL_CAP, true, false), REFUND_MISSING);
}

#[test]
fn cancel_rejects_without_subscriber_input() {
    // A stranger cannot destroy a funded subscription
    assert_rejected(run_end(CELL_CAP, false, false), BALANCE_SUFFICIENT);
}

#[test]
fn close_refunds_subscriber_when_balance_below_amount() {
    run_end(OCCUPIED + AMOUNT - 1, false, true).expect("permissionless close");
}

#[test]
fn close_rejects_while_balance_sufficient() {
    assert_rejected(run_end(CELL_CAP, false, true), BALANCE_SUFFICIENT);
}

#[test]
fn close_rejects_refund_to_other_lock() {
    assert_rejected(run_end(OCCUPIED + AMOUNT - 1, false, false), REFUND_MISSING);
}
