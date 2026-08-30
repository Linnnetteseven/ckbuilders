use ckb_testtool::{
    builtin::ALWAYS_SUCCESS,
    ckb_types::{
        bytes::Bytes,
        core::{HeaderBuilder, TransactionBuilder},
        packed::*,
        prelude::*,
    },
    context::Context,
};

use crate::Loader;

const MAX_CYCLES: u64 = 10_000_000;

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
}

/// Cell is past its unlock time — transaction must succeed
#[test]
fn test_unlocks_after_timestamp() {
    let mut context = Context::default();

    let contract_out_point = context.deploy_cell(Loader::default().load_binary("time-lock"));
    let always_success_out_point = context.deploy_cell(ALWAYS_SUCCESS.clone());

    let unlock_ms = now_ms() - 60_000;
    let args = Bytes::from(unlock_ms.to_le_bytes().to_vec());
    let lock = context.build_script(&contract_out_point, args).expect("build lock");

    let input_out_point = context.create_cell(
        CellOutput::new_builder()
            .capacity(1_000u64)
            .lock(lock.clone())
            .build(),
        Bytes::new(),
    );

    let header = HeaderBuilder::default().timestamp(now_ms()).build();
    let header_hash = header.hash();
    context.insert_header(header);

    let output_lock = context
        .build_script(&always_success_out_point, Bytes::new())
        .unwrap();

    let tx = TransactionBuilder::default()
        .input(CellInput::new_builder().previous_output(input_out_point).build())
        .output(CellOutput::new_builder().capacity(999u64).lock(output_lock).build())
        .output_data(Bytes::new().pack())
        .header_dep(header_hash)
        .build();

    let tx = context.complete_tx(tx);
    let cycles = context.verify_tx(&tx, MAX_CYCLES).expect("should pass");
    println!("[PASS] Unlocked after timestamp — cycles: {}", cycles);
}

/// Cell unlock time is in the future — transaction must be rejected
#[test]
fn test_rejects_before_timestamp() {
    let mut context = Context::default();

    let contract_out_point = context.deploy_cell(Loader::default().load_binary("time-lock"));
    let always_success_out_point = context.deploy_cell(ALWAYS_SUCCESS.clone());

    let unlock_ms = now_ms() + 3_600_000;
    let args = Bytes::from(unlock_ms.to_le_bytes().to_vec());
    let lock = context.build_script(&contract_out_point, args).expect("build lock");

    let input_out_point = context.create_cell(
        CellOutput::new_builder()
            .capacity(1_000u64)
            .lock(lock.clone())
            .build(),
        Bytes::new(),
    );

    let header = HeaderBuilder::default().timestamp(now_ms()).build();
    let header_hash = header.hash();
    context.insert_header(header);

    let output_lock = context
        .build_script(&always_success_out_point, Bytes::new())
        .unwrap();

    let tx = TransactionBuilder::default()
        .input(CellInput::new_builder().previous_output(input_out_point).build())
        .output(CellOutput::new_builder().capacity(999u64).lock(output_lock).build())
        .output_data(Bytes::new().pack())
        .header_dep(header_hash)
        .build();

    let tx = context.complete_tx(tx);
    let err = context.verify_tx(&tx, MAX_CYCLES).expect_err("should reject");
    println!("[PASS] Early unlock correctly rejected — error: {}", err);
}

/// No header_dep provided — script must reject
#[test]
fn test_rejects_missing_header_dep() {
    let mut context = Context::default();

    let contract_out_point = context.deploy_cell(Loader::default().load_binary("time-lock"));
    let always_success_out_point = context.deploy_cell(ALWAYS_SUCCESS.clone());

    let unlock_ms: u64 = 1_000;
    let args = Bytes::from(unlock_ms.to_le_bytes().to_vec());
    let lock = context.build_script(&contract_out_point, args).expect("build lock");

    let input_out_point = context.create_cell(
        CellOutput::new_builder()
            .capacity(1_000u64)
            .lock(lock.clone())
            .build(),
        Bytes::new(),
    );

    let output_lock = context
        .build_script(&always_success_out_point, Bytes::new())
        .unwrap();

    let tx = TransactionBuilder::default()
        .input(CellInput::new_builder().previous_output(input_out_point).build())
        .output(CellOutput::new_builder().capacity(999u64).lock(output_lock).build())
        .output_data(Bytes::new().pack())
        .build();

    let tx = context.complete_tx(tx);
    let err = context.verify_tx(&tx, MAX_CYCLES).expect_err("should reject");
    println!("[PASS] Missing header_dep correctly rejected — error: {}", err);
}
