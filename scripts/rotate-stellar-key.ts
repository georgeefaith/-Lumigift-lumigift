/**
 * Automated Stellar server key rotation — issue #372
 *
 * Implements steps 1–3 of docs/ops/key-rotation.md non-interactively:
 *   1. Generate a new keypair
 *   2. Add it as a co-signer (weight 1) on the server account, signed by the current key
 *   3. Remove the key retired in the *previous* rotation (STELLAR_SERVER_SECRET_KEY_PREVIOUS),
 *      so each old key stays valid for exactly one rotation period.
 *
 * Writes NEW_SECRET / NEW_PUBLIC to $GITHUB_OUTPUT (secret is masked in logs).
 */
import { appendFileSync } from "fs";
import { Horizon, Keypair, Operation, TransactionBuilder, BASE_FEE } from "@stellar/stellar-sdk";

async function main() {
  const current = Keypair.fromSecret(process.env.STELLAR_SERVER_SECRET_KEY!);
  const previousSecret = process.env.STELLAR_SERVER_SECRET_KEY_PREVIOUS;
  const server = new Horizon.Server(process.env.STELLAR_HORIZON_URL!);
  const next = Keypair.random();

  const account = await server.loadAccount(current.publicKey());
  const builder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: process.env.STELLAR_NETWORK_PASSPHRASE!,
  }).addOperation(
    Operation.setOptions({ signer: { ed25519PublicKey: next.publicKey(), weight: 1 } })
  );

  if (previousSecret) {
    const retired = Keypair.fromSecret(previousSecret).publicKey();
    if (retired !== current.publicKey()) {
      builder.addOperation(
        Operation.setOptions({ signer: { ed25519PublicKey: retired, weight: 0 } })
      );
    }
  }

  const tx = builder.setTimeout(60).build();
  tx.sign(current);
  await server.submitTransaction(tx);

  process.stdout.write(`::add-mask::${next.secret()}\n`);
  appendFileSync(
    process.env.GITHUB_OUTPUT!,
    `NEW_SECRET=${next.secret()}\nNEW_PUBLIC=${next.publicKey()}\n`
  );
  process.stdout.write(`Added signer ${next.publicKey()}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
