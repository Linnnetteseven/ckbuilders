// ============================================================
// Climate Black Box: Evidence Ledger + Evidence Gate tests
//
// Ledger: one append-only, unforkable evidence history per project.
// Gate:   the lock CadencePay pays into; the project can spend only while
//         the ledger shows no open alert, the donor only while one is open.
// Composition: the real CadencePay v3 binary collecting into a gate.
//
// Each test is named after the attack or rule it proves.
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

const MAX_CYCLES: u64 = 20_000_000;
const CKB: u64 = 100_000_000;
const LEDGER_CAP: u64 = 200 * CKB;

// Ledger error codes (contracts/evidence-ledger)
const L_INVALID_GROUP_SHAPE: i8 = 3;
const L_TYPE_ID_INVALID: i8 = 4;
const L_RECORDER_MISSING: i8 = 5;
const L_NOT_EMPTY_AT_CREATE: i8 = 6;
const L_NO_EVENTS: i8 = 7;
const L_BAD_ENTRIES: i8 = 8;
const L_UNKNOWN_KIND: i8 = 9;
const L_PERIOD_WENT_BACK: i8 = 10;
const L_ALERT_FOR_UNOBSERVED: i8 = 11;
const L_NO_OPEN_ALERT: i8 = 12;
const L_STATE_MISMATCH: i8 = 13;
const L_LOCK_CHANGED: i8 = 14;
const L_CAPACITY_CHANGED: i8 = 15;
const L_INVALID_PERIOD: i8 = 16;

// Gate error codes (contracts/evidence-gate)
const G_INVALID_ARGS: i8 = 1;
const G_LEDGER_MISSING: i8 = 2;
const G_ALERT_OPEN: i8 = 3;
const G_NO_ALERT_OPEN: i8 = 4;
const G_NOT_AUTHORIZED: i8 = 5;

const OBS: u8 = 1;
const ALERT: u8 = 2;
const RESOLVE: u8 = 3;
const OTHER: u8 = 4;

#[derive(Clone, Copy, PartialEq, Debug)]
struct State { seq: u64, head: [u8; 32], last_period: u32, open: u16 }

impl State {
    fn empty() -> Self { State { seq: 0, head: [0; 32], last_period: 0, open: 0 } }
    fn bytes(&self) -> Bytes {
        let mut d = Vec::with_capacity(48);
        d.extend_from_slice(&self.seq.to_le_bytes());
        d.extend_from_slice(&self.head);
        d.extend_from_slice(&self.last_period.to_le_bytes());
        d.extend_from_slice(&self.open.to_le_bytes());
        d.extend_from_slice(&[0, 0]);
        Bytes::from(d)
    }
}

fn entry(kind: u8, period: u32, seed: u8) -> Vec<u8> {
    let mut e = vec![kind];
    e.extend_from_slice(&period.to_le_bytes());
    e.extend_from_slice(&[seed; 32]); // stands in for a manifest sha256
    e
}

/// Off-chain mirror of the script's fold, as the verifier will compute it
fn apply(s: State, entries: &[Vec<u8>]) -> State {
    let mut s = s;
    for e in entries {
        let period = u32::from_le_bytes([e[1], e[2], e[3], e[4]]);
        match e[0] {
            OBS => s.last_period = period,
            ALERT => s.open += 1,
            RESOLVE => s.open -= 1,
            _ => {}
        }
        let mut h = new_blake2b();
        h.update(&s.head);
        h.update(e);
        h.finalize(&mut s.head);
        s.seq += 1;
    }
    s
}

fn hash32(s: &Script) -> [u8; 32] { s.calc_script_hash().unpack() }

fn output(capacity: u64, lock: &Script, type_: Option<&Script>) -> CellOutput {
    CellOutput::new_builder().capacity(capacity).lock(lock.clone())
        .type_(ScriptOpt::new_builder().set(type_.cloned()).build()).build()
}

fn proxy_lock_binary() -> Bytes {
    let path: PathBuf = [env!("CARGO_MANIFEST_DIR"), "fixtures", "input-type-proxy-lock"].iter().collect();
    fs::read(path).expect("tests/fixtures/input-type-proxy-lock").into()
}

struct Env {
    ctx: Context,
    ledger_bin: OutPoint,
    gate_bin: OutPoint,
    cadencepay_bin: OutPoint,
    proxy_bin: OutPoint,
    recorder: Script,
    project: Script,
    donor: Script,
    keeper: Script,
    stranger: Script,
}

struct Ledger { out_point: OutPoint, type_script: Script, state: State }

impl Env {
    fn new() -> Self {
        let mut ctx = Context::default();
        let ledger_bin = ctx.deploy_cell(Loader::default().load_binary("evidence-ledger"));
        let gate_bin = ctx.deploy_cell(Loader::default().load_binary("evidence-gate"));
        let cadencepay_bin = ctx.deploy_cell(Loader::default().load_binary("cadencepay"));
        let proxy_bin = ctx.deploy_cell(proxy_lock_binary());
        let always = ctx.deploy_cell(ALWAYS_SUCCESS.clone());
        let mut tagged = |t: &str| ctx.build_script(&always, Bytes::copy_from_slice(t.as_bytes())).unwrap();
        let (recorder, project, donor, keeper, stranger) = (tagged("recorder"), tagged("project"), tagged("donor"), tagged("keeper"), tagged("stranger"));
        Env { ctx, ledger_bin, gate_bin, cadencepay_bin, proxy_bin, recorder, project, donor, keeper, stranger }
    }

    fn ledger_type(&mut self, type_id: [u8; 32]) -> Script {
        let mut args = type_id.to_vec();
        args.extend_from_slice(&hash32(&self.recorder.clone()));
        self.ctx.build_script_with_hash_type(&self.ledger_bin, ScriptHashType::Data1, Bytes::from(args)).unwrap()
    }

    fn plain(&mut self, lock: &Script, cap: u64) -> OutPoint {
        self.ctx.create_cell(output(cap, lock, None), Bytes::new())
    }

    fn live_ledger(&mut self, seed: u8, state: State) -> Ledger {
        let type_script = self.ledger_type([seed; 32]);
        let recorder = self.recorder.clone();
        let out_point = self.ctx.create_cell(output(LEDGER_CAP, &recorder, Some(&type_script)), state.bytes());
        Ledger { out_point, type_script, state }
    }

    fn verify(&mut self, tx: TransactionView) -> Result<u64, CkbError> {
        let tx = self.ctx.complete_tx(tx);
        self.ctx.verify_tx(&tx, MAX_CYCLES)
    }

    /// Append `entries`, claiming the resulting state is `claimed` (defaults to the honest fold).
    fn append(&mut self, l: &Ledger, entries: &[Vec<u8>], claimed: Option<State>, with_recorder: bool, out_lock: Option<Script>, out_cap: u64) -> Result<u64, CkbError> {
        let after = claimed.unwrap_or_else(|| apply(l.state, entries));
        let witness = WitnessArgs::new_builder()
            .input_type(BytesOpt::new_builder().set(Some(entries.concat().pack())).build())
            .build();
        let lock = out_lock.unwrap_or(self.recorder.clone());
        let mut tx = TransactionBuilder::default()
            .input(CellInput::new_builder().previous_output(l.out_point.clone()).build())
            .output(output(out_cap, &lock, Some(&l.type_script)))
            .output_data(after.bytes().pack())
            .witness(witness.as_bytes().pack());
        if with_recorder {
            let r = self.recorder.clone();
            let op = self.plain(&r, 100 * CKB);
            tx = tx.input(CellInput::new_builder().previous_output(op).build())
                .output(output(99 * CKB, &r, None)).output_data(Bytes::new().pack());
        }
        self.verify(tx.build())
    }

    fn gate_lock(&mut self, ledger_type_hash: [u8; 32]) -> Script {
        let mut args = ledger_type_hash.to_vec();
        args.extend_from_slice(&hash32(&self.project.clone()));
        args.extend_from_slice(&hash32(&self.donor.clone()));
        self.ctx.build_script_with_hash_type(&self.gate_bin, ScriptHashType::Data1, Bytes::from(args)).unwrap()
    }

    /// Spend a gated tranche with `who` present and an optional ledger cell dep.
    fn spend_gate(&mut self, gate: &Script, ledger: Option<&OutPoint>, who: Option<Script>) -> Result<u64, CkbError> {
        let op = self.ctx.create_cell(output(150 * CKB, gate, None), Bytes::new());
        let mut tx = TransactionBuilder::default().input(CellInput::new_builder().previous_output(op).build());
        let to = who.clone().unwrap_or(self.stranger.clone());
        if let Some(w) = who {
            let wop = self.plain(&w, 100 * CKB);
            tx = tx.input(CellInput::new_builder().previous_output(wop).build());
        }
        tx = tx.output(output(240 * CKB, &to, None)).output_data(Bytes::new().pack());
        if let Some(l) = ledger {
            tx = tx.cell_dep(CellDep::new_builder().out_point(l.clone()).build());
        }
        self.verify(tx.build())
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

// ── Ledger: create ───────────────────────────────────────────

fn create_ledger(env: &mut Env, state: State, with_recorder: bool, corrupt_id: bool) -> Result<u64, CkbError> {
    let funder = if with_recorder { env.recorder.clone() } else { env.stranger.clone() };
    let first = env.plain(&funder, 300 * CKB);
    let first_input = CellInput::new_builder().previous_output(first).build();
    let mut type_id = [0u8; 32];
    let mut h = new_blake2b();
    h.update(first_input.as_slice());
    h.update(&0u64.to_le_bytes());
    h.finalize(&mut type_id);
    if corrupt_id { type_id[0] ^= 0xff; }
    let t = env.ledger_type(type_id);
    let recorder = env.recorder.clone();
    let tx = TransactionBuilder::default()
        .input(first_input)
        .output(output(LEDGER_CAP, &recorder, Some(&t)))
        .output_data(state.bytes().pack())
        .build();
    env.verify(tx)
}

#[test]
fn ledger_create_valid() {
    let mut env = Env::new();
    create_ledger(&mut env, State::empty(), true, false).expect("empty ledger by its recorder");
}

#[test]
fn ledger_create_rejects_prefilled_history() {
    let mut env = Env::new();
    let fake = State { seq: 40, head: [7; 32], last_period: 202509, open: 0 };
    assert_rejected(create_ledger(&mut env, fake, true, false), L_NOT_EMPTY_AT_CREATE);
}

#[test]
fn ledger_create_rejects_without_recorder() {
    let mut env = Env::new();
    assert_rejected(create_ledger(&mut env, State::empty(), false, false), L_RECORDER_MISSING);
}

#[test]
fn ledger_create_rejects_forged_type_id() {
    let mut env = Env::new();
    assert_rejected(create_ledger(&mut env, State::empty(), true, true), L_TYPE_ID_INVALID);
}

// ── Ledger: append ───────────────────────────────────────────

#[test]
fn ledger_append_batch_of_observations() {
    let mut env = Env::new();
    let l = env.live_ledger(1, State::empty());
    let batch: Vec<_> = (1..=12).map(|m| entry(OBS, 202400 + m, m as u8)).collect();
    env.append(&l, &batch, None, true, None, LEDGER_CAP).expect("a year of observations in one tx");
}

#[test]
fn ledger_full_alert_lifecycle() {
    let mut env = Env::new();
    let l = env.live_ledger(1, State { seq: 3, head: [9; 32], last_period: 202503, open: 0 });
    let batch = vec![entry(OBS, 202504, 1), entry(ALERT, 202504, 2), entry(OTHER, 202504, 3), entry(RESOLVE, 202504, 4), entry(OBS, 202505, 5)];
    env.append(&l, &batch, None, true, None, LEDGER_CAP).expect("observe, alert, investigate, resolve, observe");
}

#[test]
fn ledger_rejects_append_without_recorder() {
    // The script's own check, independent of the cell's lock: a ledger left
    // under someone else's lock still needs the recorder to append
    let mut env = Env::new();
    let type_script = env.ledger_type([1; 32]);
    let stranger = env.stranger.clone();
    let out_point = env.ctx.create_cell(output(LEDGER_CAP, &stranger, Some(&type_script)), State::empty().bytes());
    let l = Ledger { out_point, type_script, state: State::empty() };
    assert_rejected(env.append(&l, &[entry(OBS, 202501, 1)], None, false, Some(stranger), LEDGER_CAP), L_RECORDER_MISSING);
}

#[test]
fn ledger_rejects_empty_append() {
    let mut env = Env::new();
    let l = env.live_ledger(1, State::empty());
    assert_rejected(env.append(&l, &[], None, true, None, LEDGER_CAP), L_NO_EVENTS);
}

#[test]
fn ledger_rejects_truncated_entry() {
    let mut env = Env::new();
    let l = env.live_ledger(1, State::empty());
    let mut e = entry(OBS, 202501, 1);
    e.pop();
    assert_rejected(env.append(&l, &[e], Some(State::empty()), true, None, LEDGER_CAP), L_BAD_ENTRIES);
}

#[test]
fn ledger_rejects_backdated_observation() {
    let mut env = Env::new();
    let l = env.live_ledger(1, State { seq: 5, head: [1; 32], last_period: 202506, open: 0 });
    assert_rejected(env.append(&l, &[entry(OBS, 202505, 1)], Some(l.state), true, None, LEDGER_CAP), L_PERIOD_WENT_BACK);
}

#[test]
fn ledger_rejects_alert_about_a_future_month() {
    let mut env = Env::new();
    let l = env.live_ledger(1, State { seq: 5, head: [1; 32], last_period: 202506, open: 0 });
    assert_rejected(env.append(&l, &[entry(ALERT, 202507, 1)], Some(l.state), true, None, LEDGER_CAP), L_ALERT_FOR_UNOBSERVED);
}

#[test]
fn ledger_rejects_resolving_when_nothing_is_open() {
    // Stops a recorder "resolving" its way to a clean record
    let mut env = Env::new();
    let l = env.live_ledger(1, State { seq: 5, head: [1; 32], last_period: 202506, open: 0 });
    assert_rejected(env.append(&l, &[entry(RESOLVE, 202506, 1)], Some(l.state), true, None, LEDGER_CAP), L_NO_OPEN_ALERT);
}

#[test]
fn ledger_rejects_quietly_dropping_an_alert() {
    // Appends an alert but claims open_alerts stayed 0
    let mut env = Env::new();
    let l = env.live_ledger(1, State { seq: 5, head: [1; 32], last_period: 202506, open: 0 });
    let batch = vec![entry(ALERT, 202506, 1)];
    let mut lie = apply(l.state, &batch);
    lie.open = 0;
    assert_rejected(env.append(&l, &batch, Some(lie), true, None, LEDGER_CAP), L_STATE_MISMATCH);
}

#[test]
fn ledger_rejects_rewritten_head() {
    // Claims a head that doesn't come from folding these events (a rewrite)
    let mut env = Env::new();
    let l = env.live_ledger(1, State::empty());
    let batch = vec![entry(OBS, 202501, 1), entry(OBS, 202502, 2)];
    let mut lie = apply(l.state, &batch);
    lie.head = apply(State::empty(), &[entry(OBS, 202501, 9), entry(OBS, 202502, 2)]).head;
    assert_rejected(env.append(&l, &batch, Some(lie), true, None, LEDGER_CAP), L_STATE_MISMATCH);
}

#[test]
fn ledger_rejects_reordered_events() {
    let mut env = Env::new();
    let l = env.live_ledger(1, State::empty());
    let batch = vec![entry(OBS, 202501, 1), entry(OBS, 202502, 2)];
    let swapped = apply(l.state, &[entry(OBS, 202502, 2), entry(OBS, 202501, 1)]);
    assert_rejected(env.append(&l, &batch, Some(swapped), true, None, LEDGER_CAP), L_STATE_MISMATCH);
}

#[test]
fn ledger_rejects_skipped_sequence() {
    let mut env = Env::new();
    let l = env.live_ledger(1, State::empty());
    let batch = vec![entry(OBS, 202501, 1)];
    let mut lie = apply(l.state, &batch);
    lie.seq += 5;
    assert_rejected(env.append(&l, &batch, Some(lie), true, None, LEDGER_CAP), L_STATE_MISMATCH);
}

#[test]
fn ledger_rejects_unknown_event_kind() {
    let mut env = Env::new();
    let l = env.live_ledger(1, State::empty());
    assert_rejected(env.append(&l, &[entry(9, 202501, 1)], Some(l.state), true, None, LEDGER_CAP), L_UNKNOWN_KIND);
}

#[test]
fn ledger_rejects_invalid_month() {
    let mut env = Env::new();
    let l = env.live_ledger(1, State::empty());
    assert_rejected(env.append(&l, &[entry(OBS, 202513, 1)], Some(l.state), true, None, LEDGER_CAP), L_INVALID_PERIOD);
}

#[test]
fn ledger_rejects_moving_to_another_lock() {
    let mut env = Env::new();
    let l = env.live_ledger(1, State::empty());
    let stranger = env.stranger.clone();
    assert_rejected(env.append(&l, &[entry(OBS, 202501, 1)], None, true, Some(stranger), LEDGER_CAP), L_LOCK_CHANGED);
}

#[test]
fn ledger_rejects_draining_capacity() {
    let mut env = Env::new();
    let l = env.live_ledger(1, State::empty());
    assert_rejected(env.append(&l, &[entry(OBS, 202501, 1)], None, true, None, LEDGER_CAP - 50 * CKB), L_CAPACITY_CHANGED);
}

#[test]
fn ledger_cannot_be_deleted() {
    let mut env = Env::new();
    let l = env.live_ledger(1, State::empty());
    let r = env.recorder.clone();
    let tx = TransactionBuilder::default()
        .input(CellInput::new_builder().previous_output(l.out_point.clone()).build())
        .output(output(LEDGER_CAP, &r, None)).output_data(Bytes::new().pack()).build();
    assert_rejected(env.verify(tx), L_INVALID_GROUP_SHAPE);
}

#[test]
fn ledger_cannot_fork_into_two_histories() {
    let mut env = Env::new();
    let l = env.live_ledger(1, State::empty());
    let r = env.recorder.clone();
    let a = apply(l.state, &[entry(OBS, 202501, 1)]);
    let tx = TransactionBuilder::default()
        .input(CellInput::new_builder().previous_output(l.out_point.clone()).build())
        .output(output(LEDGER_CAP / 2, &r, Some(&l.type_script))).output_data(a.bytes().pack())
        .output(output(LEDGER_CAP / 2, &r, Some(&l.type_script))).output_data(State::empty().bytes().pack())
        .build();
    assert_rejected(env.verify(tx), L_INVALID_GROUP_SHAPE);
}

// ── Gate ─────────────────────────────────────────────────────

#[test]
fn gate_project_withdraws_when_no_alert_open() {
    let mut env = Env::new();
    let l = env.live_ledger(1, State { seq: 3, head: [1; 32], last_period: 202506, open: 0 });
    let gate = env.gate_lock(hash32(&l.type_script));
    let project = env.project.clone();
    env.spend_gate(&gate, Some(&l.out_point), Some(project)).expect("clean evidence releases the tranche");
}

#[test]
fn gate_holds_funds_while_an_alert_is_open() {
    let mut env = Env::new();
    let l = env.live_ledger(1, State { seq: 4, head: [1; 32], last_period: 202506, open: 1 });
    let gate = env.gate_lock(hash32(&l.type_script));
    let project = env.project.clone();
    assert_rejected(env.spend_gate(&gate, Some(&l.out_point), Some(project)), G_ALERT_OPEN);
}

#[test]
fn gate_donor_takes_back_while_alert_open() {
    let mut env = Env::new();
    let l = env.live_ledger(1, State { seq: 4, head: [1; 32], last_period: 202506, open: 1 });
    let gate = env.gate_lock(hash32(&l.type_script));
    let donor = env.donor.clone();
    env.spend_gate(&gate, Some(&l.out_point), Some(donor)).expect("refund during an alert");
}

#[test]
fn gate_donor_cannot_take_back_clean_funds() {
    let mut env = Env::new();
    let l = env.live_ledger(1, State { seq: 3, head: [1; 32], last_period: 202506, open: 0 });
    let gate = env.gate_lock(hash32(&l.type_script));
    let donor = env.donor.clone();
    assert_rejected(env.spend_gate(&gate, Some(&l.out_point), Some(donor)), G_NO_ALERT_OPEN);
}

#[test]
fn gate_rejects_missing_ledger_dep() {
    let mut env = Env::new();
    let l = env.live_ledger(1, State::empty());
    let gate = env.gate_lock(hash32(&l.type_script));
    let project = env.project.clone();
    assert_rejected(env.spend_gate(&gate, None, Some(project)), G_LEDGER_MISSING);
}

#[test]
fn gate_rejects_another_projects_clean_ledger() {
    // A clean ledger for a different project doesn't unlock this project's funds
    let mut env = Env::new();
    let mine = env.live_ledger(1, State { seq: 4, head: [1; 32], last_period: 202506, open: 1 });
    let other = env.live_ledger(2, State { seq: 3, head: [2; 32], last_period: 202506, open: 0 });
    let gate = env.gate_lock(hash32(&mine.type_script));
    let project = env.project.clone();
    assert_rejected(env.spend_gate(&gate, Some(&other.out_point), Some(project)), G_LEDGER_MISSING);
}

#[test]
fn gate_rejects_strangers() {
    let mut env = Env::new();
    let l = env.live_ledger(1, State::empty());
    let gate = env.gate_lock(hash32(&l.type_script));
    assert_rejected(env.spend_gate(&gate, Some(&l.out_point), None), G_NOT_AUTHORIZED);
}

#[test]
fn gate_rejects_bad_args() {
    let mut env = Env::new();
    let l = env.live_ledger(1, State::empty());
    let gate_bin = env.gate_bin.clone();
    let gate = env.ctx.build_script_with_hash_type(&gate_bin, ScriptHashType::Data1, Bytes::from(vec![0u8; 64])).unwrap();
    let project = env.project.clone();
    assert_rejected(env.spend_gate(&gate, Some(&l.out_point), Some(project)), G_INVALID_ARGS);
}

// ── Composition: real CadencePay v3 collecting into a gate ───

#[test]
fn cadencepay_collects_a_tranche_into_the_evidence_gate() {
    let mut env = Env::new();
    let l = env.live_ledger(1, State { seq: 3, head: [1; 32], last_period: 202506, open: 0 });
    let gate = env.gate_lock(hash32(&l.type_script));
    const AMOUNT: u64 = 150 * CKB; // a gate cell needs ~137 CKB
    const INTERVAL: u64 = 2_000;
    const CAP: u64 = 900 * CKB;

    // Donor's subscription: recipient = the gate
    let mut args = vec![7u8; 32];
    args.extend_from_slice(&hash32(&env.donor.clone()));
    let cp_bin = env.cadencepay_bin.clone();
    let sub_type = env.ctx.build_script_with_hash_type(&cp_bin, ScriptHashType::Data1, Bytes::from(args)).unwrap();
    let proxy_bin = env.proxy_bin.clone();
    let sub_lock = env.ctx.build_script_with_hash_type(&proxy_bin, ScriptHashType::Data1, Bytes::copy_from_slice(sub_type.calc_script_hash().as_slice())).unwrap();
    let data = |next: u64| {
        let mut d = hash32(&gate).to_vec();
        d.extend_from_slice(&AMOUNT.to_le_bytes());
        d.extend_from_slice(&INTERVAL.to_le_bytes());
        d.extend_from_slice(&next.to_le_bytes());
        Bytes::from(d)
    };
    let sub = env.ctx.create_cell(output(CAP, &sub_lock, Some(&sub_type)), data(10_000));
    let header = HeaderBuilder::default().number(10_500u64).epoch(1000u64 << 40).build();
    let header_hash = header.hash();
    env.ctx.insert_header(header);
    let keeper = env.keeper.clone();
    let fee = env.plain(&keeper, 100 * CKB);
    let tx = TransactionBuilder::default()
        .input(CellInput::new_builder().previous_output(sub).build())
        .input(CellInput::new_builder().previous_output(fee).build())
        .output(output(CAP - AMOUNT, &sub_lock, Some(&sub_type))).output_data(data(12_000).pack())
        .output(output(AMOUNT, &gate, None)).output_data(Bytes::new().pack())
        .output(output(99 * CKB, &keeper, None)).output_data(Bytes::new().pack())
        .header_dep(header_hash)
        .build();
    env.verify(tx).expect("CadencePay pays the period into the gate, unchanged");
    // ...and that gated tranche is then the project's only while the ledger is clean
    let project = env.project.clone();
    env.spend_gate(&gate, Some(&l.out_point), Some(project)).expect("project withdraws on clean evidence");
}
