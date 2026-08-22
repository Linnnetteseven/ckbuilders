import { hexFrom, Transaction, hashTypeToBytes } from '@ckb-ccc/core';
import { readFileSync } from 'fs';
import { Resource, Verifier, DEFAULT_SCRIPT_ALWAYS_SUCCESS, DEFAULT_SCRIPT_CKB_JS_VM } from 'ckb-testtool';

describe('hello-world contract', () => {
  test('should execute successfully', async () => {
    const resource = Resource.default();
    const tx = Transaction.default();

    const mainScript = resource.deployCell(hexFrom(readFileSync(DEFAULT_SCRIPT_CKB_JS_VM)), tx, false);
    const alwaysSuccessScript = resource.deployCell(hexFrom(readFileSync(DEFAULT_SCRIPT_ALWAYS_SUCCESS)), tx, false);
    const contractScript = resource.deployCell(hexFrom(readFileSync('dist/hello-world.bc')), tx, false);
    
    mainScript.args = hexFrom(
      '0x0000' +
        contractScript.codeHash.slice(2) +
        hexFrom(hashTypeToBytes(contractScript.hashType)).slice(2) +
        '0000000000000000000000000000000000000000000000000000000000000000',
    );

    // 1 input cell
    const inputCell = resource.mockCell(alwaysSuccessScript, mainScript, '0xFF000000000000000000000000000000');
    tx.inputs.push(Resource.createCellInput(inputCell));

    // 2 output cells
    const capsule1 = JSON.stringify({message:"Hello future me!",recipient:"Linnette",open_date:"2027-01-01",sealed_at:"2026-08-12"});
    tx.outputs.push(Resource.createCellOutput(alwaysSuccessScript, mainScript));
    tx.outputsData.push(hexFrom(Buffer.from(capsule1)));
    const capsule2 = JSON.stringify({message:"Still building!",recipient:"Linnette",open_date:"2028-01-01",sealed_at:"2026-08-12"});
    tx.outputs.push(Resource.createCellOutput(alwaysSuccessScript, mainScript));
    tx.outputsData.push(hexFrom(Buffer.from(capsule2)));
    const verifier = Verifier.from(resource, tx);
    // if you are using the native ckb-debugger, you can delete the following line.
    verifier.setWasmDebuggerEnabled(true);
    await verifier.verifySuccess(true);
  });
});
