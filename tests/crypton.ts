const anchor = require("@project-serum/anchor");
import * as assert from "assert";
import {Program, web3} from "@project-serum/anchor";

const { SystemProgram } = anchor.web3;

describe("crypton", () => {
  const provider = anchor.Provider.local();
  const donater = anchor.web3.Keypair.generate();
  const owner = anchor.web3.Keypair.generate();
  const bad_wallet = anchor.web3.Keypair.generate();

  const init_lamperts_dropped = 10*web3.LAMPORTS_PER_SOL;

  let init_donater_balance;
  let init_owner_balance;
  let init_bad_wallet_balance;

  console.log("\t\tDonater: " + donater.publicKey);
  console.log("\t\tOwner: " + owner.publicKey);

  const program = anchor.workspace.Crypton as Program;
  let wallet_balance;
  let wallet_key;
  let settings_key;

  it("Accounts inited", async () => {
    let signature = await provider.connection.requestAirdrop(donater.publicKey, init_lamperts_dropped);
    await provider.connection.confirmTransaction(signature);

    signature = await provider.connection.requestAirdrop(owner.publicKey, init_lamperts_dropped);
    await provider.connection.confirmTransaction(signature);

    signature = await provider.connection.requestAirdrop(bad_wallet.publicKey, init_lamperts_dropped);
    await provider.connection.confirmTransaction(signature);

    init_donater_balance = await provider.connection.getBalance(donater.publicKey);
    console.log("\t\tDonater balance: ", init_donater_balance);
    init_owner_balance = await provider.connection.getBalance(owner.publicKey);
    console.log("\t\tOwner balance: ", init_donater_balance);

    init_bad_wallet_balance = await provider.connection.getBalance(bad_wallet.publicKey);

    assert.ok(init_donater_balance == init_lamperts_dropped);
    assert.ok(init_owner_balance == init_lamperts_dropped);
  });

  it("Init donate program for owner", async () => {
    const [admindata, _] = await web3.PublicKey
      .findProgramAddress(
        [
          anchor.utils.bytes.utf8.encode("admin"),
          program.programId.toBuffer()
        ],
        program.programId
      );
    settings_key = admindata;

    const [wallet, __] = await web3.PublicKey
      .findProgramAddress(
        [
          anchor.utils.bytes.utf8.encode("wallet")
        ],
        program.programId
      );
    await program.rpc.initialize({
      accounts: {
        adminSettings: admindata,
        admin: owner.publicKey,
        wallet: wallet,
        systemProgram: SystemProgram.programId,
      },
      signers: [owner],
    });

    wallet_key = wallet;

    wallet_balance = await provider.connection.getBalance(wallet);
    console.log("\t\tWallet balance: ", wallet_balance);
  });

  it("Make donate from donater", async () => {
    let t;
    await program.rpc.donate(new anchor.BN(web3.LAMPORTS_PER_SOL), {
      accounts: {
        fromAccount: donater.publicKey,
        toAccount: wallet_key,
        adminSettings: settings_key,
        systemProgram: SystemProgram.programId,
      },
      signers: [donater],
    });

    t = await provider.connection.getBalance(wallet_key);
    console.log("\t\tWallet balance: ", t);
    assert.ok(wallet_balance+web3.LAMPORTS_PER_SOL == t);
    wallet_balance = t;

    t = await provider.connection.getBalance(donater.publicKey);
    console.log("\t\tDonater balance: ", t);
    assert.ok(init_donater_balance-web3.LAMPORTS_PER_SOL == t);

    const data = await program.account.adminData.fetch(settings_key);
    let history_k = data.historyDonaters[0].toBase58();
    let history_a = data.historyAmount[0].toNumber();
    console.log("\t\tHistory record: ", history_k, ":", history_a);
    assert.ok(history_k == donater.publicKey);
    assert.ok(history_a == web3.LAMPORTS_PER_SOL);
  });

  it("Can't pass bad wallet or bad settings accounts", async () => {
    try {
      await program.rpc.donate(new anchor.BN(web3.LAMPORTS_PER_SOL), {
        accounts: {
          fromAccount: donater.publicKey,
          toAccount: bad_wallet.publicKey,
          adminSettings: settings_key,
          systemProgram: SystemProgram.programId,
        },
        signers: [donater],
      });
      assert.ok(false);
    } catch (error){
      const expectedError = 'Error: failed to send transaction: Transaction simulation failed: Error processing Instruction 0: invalid program argument';
      assert.equal(error.toString(), expectedError);
    }

    try {
      await program.rpc.donate(new anchor.BN(web3.LAMPORTS_PER_SOL), {
        accounts: {
          fromAccount: donater.publicKey,
          toAccount: wallet_key,
          adminSettings: bad_wallet.publicKey,
          systemProgram: SystemProgram.programId,
        },
        signers: [donater],
      });
      assert.ok(false);
    } catch (ignored){
    }

  });

  it("Claim donates", async () => {
    let t;

    init_owner_balance = await provider.connection.getBalance(owner.publicKey);
    console.log("\t\tOwner balance before: ", init_owner_balance);
    console.log("\t\tWallet balance before: ", await provider.connection.getBalance(wallet_key));
    console.log("");

    await program.rpc.claimDonates({
      accounts: {
        owner: owner.publicKey,
        adminSettings: settings_key,
        wallet: wallet_key,
        systemProgram: SystemProgram.programId,
      },
    });

    t = await provider.connection.getBalance(owner.publicKey);
    console.log("\t\tOwner balance after: ", t);

    console.log("\t\tWallet balance after: ", await provider.connection.getBalance(wallet_key));
    assert.ok(init_owner_balance + web3.LAMPORTS_PER_SOL == t);
  });

  it("Can't claim donates with not owner", async () => {
    try {
      await program.rpc.claimDonates({
        accounts: {
          owner: donater.publicKey,
          adminSettings: settings_key,
          wallet: wallet_key,
          systemProgram: SystemProgram.programId,
        },
      });
      assert.ok(false);
    } catch (error){
      const expectedError = 'Error: failed to send transaction: Transaction simulation failed: Error processing Instruction 0: incorrect program id for instruction';
      assert.equal(error.toString(), expectedError);
    }
  });

});
