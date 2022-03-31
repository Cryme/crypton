import {web3} from "@project-serum/anchor";

const anchor = require("@project-serum/anchor");
import { readFileSync } from 'fs'
const { SystemProgram } = anchor.web3;
const os = require('os');

//wallet - ./keypair.json
//program - AugCL9CzhtXXsL5W8ZQNmSohqEz9gGBHQRKYE1DC5amA
async function main() {
  // #region main
  const reader = require("readline-sync");
  process.env.ANCHOR_PROVIDER_URL="https://api.devnet.solana.com"
  process.env.ANCHOR_WALLET = reader.question('Enter your wallet keypair path (empty for default): ');
  if(process.env.ANCHOR_WALLET == ""){
    process.env.ANCHOR_WALLET = os.homedir()+"/.config/solana/id.json";
  }

  let provider = anchor.Provider.env();
  anchor.setProvider(provider);

  console.log("wallet:", provider.wallet.publicKey.toBase58());

  let path = "./target/idl/crypton.json";

  let idl = JSON.parse(
    readFileSync(path, "utf8")
  );

  let programId = reader.question('Enter program id (empty for default): ');

  if(programId == ""){
    programId = new anchor.web3.PublicKey("AugCL9CzhtXXsL5W8ZQNmSohqEz9gGBHQRKYE1DC5amA");
  }
  let program = new anchor.Program(idl, programId);

  let action = reader.question('Select action:\n\t0 - Initialize program\n\t1 - Make donate\n\t2 - Show donate history\n\t3 - Show donations for exact addr\n\t4 - Claim donates\n: ',);
  switch(action) {
    case '0':
      await init(program, provider);
      break;
    case '1':
      await donate(program, provider, reader);
      break;
    case '2':
      await show_history(program);
      break;
    case '3':
      await show_amount_for(program, reader);
      break;
    case '4':
      await claim_donates(provider, program);
      break;
    default:
      console.log('Invalid option!');
      break;
  }
  // #endregion main
}

async function claim_donates(provider, program){
    let settings = await getSettingsAdress(program);
    let wallet = await getWalletsAdress(program);
    await program.rpc.claimDonates({
        accounts: {
            owner: provider.wallet.publicKey,
            adminSettings: settings,
            wallet: wallet,
            systemProgram: SystemProgram.programId,
        },
    });
    console.log("Done!")
}

async function show_amount_for(program, reader){
    let addrs = reader.question('Enter address(in base58): ');
    let settings = await getSettingsAdress(program);
    const data = await program.account.adminData.fetch(settings);
    let total = 0;

    for (let _i = 0; _i < data.historyDonaters.length; _i++) {
        let history_k = data.historyDonaters[_i].toBase58();
        if(history_k == addrs){
            total += data.historyAmount[_i].toNumber();
        }
    }
    if (total > 0){
        console.log("Total:", total, "from wallet:", addrs)
    } else{
        console.log("Wallet:", addrs, "never donated!")
    }
}

async function show_history(program){
  let settings = await getSettingsAdress(program);
  const data = await program.account.adminData.fetch(settings);

  console.log("Total records:", data.historyDonaters.length);
  for (let _i = 0; _i < data.historyDonaters.length; _i++) {
      let history_k = data.historyDonaters[_i].toBase58();
      let history_a = data.historyAmount[_i].toNumber();
      console.log("\t\t", history_k, ":", history_a);
  }
}

async function donate(program, provider, reader){
  let amount = reader.question('Enter lamperts amount: ');
  let settings = await getSettingsAdress(program);
  let wallet = await getWalletsAdress(program);

  await program.rpc.donate(new anchor.BN(amount), {
    accounts: {
      fromAccount: provider.wallet.publicKey,
      toAccount: wallet,
      adminSettings: settings,
      systemProgram: SystemProgram.programId,
    },
    signers: [provider.wallet.keyPair],
  });
    console.log("Done!")
}

async function init(program, provider){
  console.log("Initializing...");
  let admindata = await getSettingsAdress(program);
  let wallet = await getWalletsAdress(program);

  await program.rpc.initialize({
    accounts: {
      adminSettings: admindata,
      admin: provider.wallet.publicKey,
      wallet: wallet,
      systemProgram: SystemProgram.programId,
    },
    signers: [provider.wallet.keyPair],
  });
  console.log("Wallet public key:", wallet.toBase58());
  console.log("Settings public key:", admindata.toBase58());
}

async function getSettingsAdress(program){
    const [settings, _] = await web3.PublicKey
        .findProgramAddress(
            [
                anchor.utils.bytes.utf8.encode("admin"),
                program.programId.toBuffer()
            ],
            program.programId
        );
    return settings;
}
async function getWalletsAdress(program){
    const [wallet, __] = await web3.PublicKey
        .findProgramAddress(
            [
                anchor.utils.bytes.utf8.encode("wallet")
            ],
            program.programId
        );
    return wallet;
}

main();