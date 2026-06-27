'use strict';

const { TonClient, WalletContractV4 } = require('@ton/ton');
const { mnemonicToPrivateKey } = require('@ton/crypto');

require('dotenv').config();

async function main() {
    const mnemonic = process.env.TON_MNEMONIC.split(' ');
    const keyPair  = await mnemonicToPrivateKey(mnemonic);
    const wallet   = WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: 0 });
    const address  = wallet.address.toString({ bounceable: false, testOnly: true });

    const client   = new TonClient({ endpoint: process.env.TON_ENDPOINT });
    const balance  = await client.getBalance(wallet.address);

    console.log(`Адрес:  ${address}`);
    console.log(`Баланс: ${Number(balance) / 1e9} TON`);
}

main().catch(console.error);
