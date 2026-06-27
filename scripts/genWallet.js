'use strict';

const { mnemonicNew, mnemonicToPrivateKey } = require('@ton/crypto');
const { WalletContractV4 } = require('@ton/ton');

async function main() {
    const mnemonic = await mnemonicNew();
    const keyPair  = await mnemonicToPrivateKey(mnemonic);
    const wallet   = WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: 0 });

    const address = wallet.address.toString({ bounceable: false, testOnly: true });

    console.log('\n=== TON Wallet ===\n');
    console.log('MNEMONIC (сохрани в надёжное место!):\n');
    console.log(mnemonic.join(' '));
    console.log('\nADDRESS (testnet):\n');
    console.log(address);
    console.log('\nДобавь в .env:');
    console.log(`TON_MNEMONIC="${mnemonic.join(' ')}"`);
    console.log(`TON_COLLECTION_ADDRESS=  ← заполним после деплоя коллекции\n`);
}

main().catch(console.error);
