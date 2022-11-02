import { WalletTypes, Address, toNano, fromNano, getRandomNonce, convertAmount, zeroAddress } from "locklift";
const BigNumber = require("bignumber.js"); 
// const logger = require('mocha-logger');
const chai = require('chai');
// chai.use(require('chai-bignumber')());

const { expect, assert } = chai;

const Config = require("../scripts/utilsConfig.js"); 

let signer, owner, router, cell1, cell2, cell3;
let cellCoord1 = {  x: 2,  y: 1,  z: -3  } // user1 start
let cellCoord2 = {  x: 2,  y: 2,  z: -4 } // user1 mark
let cellCoord3 = {  x: 3,  y: 1,  z: -4 } // user2 start

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
 
function arraysContainSame(a, b) {
  a = Array.isArray(a) ? a : [];
  b = Array.isArray(b) ? b : [];
  return a.length === b.length && a.every(el => b.includes(el));
}



describe(`Test Router contract (BASE)`, async function() {
  //this.timeout(20000000);
  let _randomNonce = locklift.utils.getRandomNonce().toString();
  
  it('Start 1', async () => {
    signer = (await locklift.keystore.getSigner("0"));
    console.log('signer publicKey', signer)
    console.log('_randomNonce', _randomNonce)
    const { account: _owner } = await locklift.factory.accounts.addNewAccount({
      publicKey: signer.publicKey,
      type: WalletTypes.WalletV3,
      value: toNano(100),
    });
    owner = _owner;
    console.log(`Owner: ${owner.publicKey.toString(16)}`);
  });
  
  it('Deploy router', async () => {
    
    const Cell = await locklift.factory.getContractArtifacts("Cell");
    let { contract: _router } = await locklift.factory.deployContract({
      contract: "Router",
      publicKey: signer.publicKey,
      initParams: {
        _nonce: _randomNonce,
      },
      constructorParams: {
        codeCell: Cell.code,
        ownerPubkey: `0x${signer.publicKey}`,
      },
      value: toNano(2),
    });
    router = _router;
    console.log(`Router deployed at: ${router.address.toString()}`);
    
    let details
    details = await router.methods.getDetails().call();
    console.log('getDetails router', details);
    expect(details.nonce)
        .to.be.equal(_randomNonce, 'Wrong nonce');
    expect(BigNumber(details.owner).toString(16).padStart("0", 64))
        .to.be.equal(signer.publicKey, 'Wrong public Key');
    let conf = Config.readConf();
    conf.router = router.address.toString()
    Config.saveConf(conf)
  });
  
});

describe(`Test Cell contract (BASE)`, async function() {
  it('Start Cell1 User1', async () => {
    
    let res = await locklift.tracing.trace(router.methods.newGame({
        sendGasTo: owner.address.toString(),
        baseCoord: cellCoord1
    }).send({
        from: owner.address.toString(),
        amount: toNano(2),
    }));

    let details
    details = await router.methods._resolveCell({ coord: cellCoord1 }).call();
    console.log('address cell1', details);

    cell1 = locklift.factory.getDeployedContract(
      "Cell",
      new Address(details.cellAddress.toString()),
    );
    details = await cell1.methods.getDetails({}).call();
    console.log('getDetails cell1', details);

    expect(details.level)
        .to.be.equal('0', 'Wrong level');

  });

  it('Mark Cell2 User1', async () => {
    
    let res = await locklift.tracing.trace(cell1.methods.markCell({
        sendGasTo: owner.address.toString(),
        targetCoord: cellCoord2,
        energy: 1000
    }).send({
        from: owner.address.toString(),
        amount: toNano(2),
    }));
    
    let details
    details = await cell1.methods.getDetails({}).call();
    console.log('getDetails cell1', details);

    details = await router.methods._resolveCell({ coord: cellCoord2 }).call();
    console.log('address cell2', details);

    cell2 = locklift.factory.getDeployedContract(
      "Cell",
      new Address(details.cellAddress.toString()),
    );
    details = await cell2.methods.getDetails({}).call();
    console.log('getDetails cell2', details);

    expect(details.level)
        .to.be.equal('0', 'Wrong level');

  });

  it('Upgrade Cell2 User1', async () => {
    
    let res = await locklift.tracing.trace(cell2.methods.upgradeCell({
        sendGasTo: owner.address.toString(),
    }).send({
        from: owner.address.toString(),
        amount: toNano(1),
    }));
    
    let details
    details = await cell2.methods.getDetails({}).call();
    console.log('getDetails cell2', details);

    expect(details.level)
        .to.be.equal('1', 'Wrong level');

  });

  it('help Cell1 to Cell2 User1', async () => {
    
    let res = await locklift.tracing.trace(cell1.methods.helpCell({
        sendGasTo: owner.address.toString(),
        targetCoord: cellCoord2,
        energy: 500
    }).send({
        from: owner.address.toString(),
        amount: toNano(1),
    }));
    
    let details
    details = await cell1.methods.getDetails({}).call();
    console.log('getDetails cell1', details);

    details = await cell2.methods.getDetails({}).call();
    console.log('getDetails cell2', details);

    expect(details.level)
        .to.be.equal('1', 'Wrong level');

  });

  it('Start new game User2', async () => {
    
    let res = await locklift.tracing.trace(router.methods.newGame({
        sendGasTo: owner.address.toString(),
        baseCoord: cellCoord3
    }).send({
        from: owner.address.toString(),
        amount: toNano(2),
    }));

    let details
    details = await router.methods._resolveCell({ coord: cellCoord3 }).call();
    console.log('_resolveCell', details);

    cell3 = locklift.factory.getDeployedContract(
      "Cell",
      new Address(details.cellAddress.toString()),
    );
    details = await cell3.methods.getDetails({}).call();
    console.log('getDetails cell3', details);

    expect(details.level)
        .to.be.equal('0', 'Wrong level');

  });

  it('attk Cell3 to Cell1 User2', async () => {
    
    let res = await locklift.tracing.trace(cell3.methods.attkCell({
        sendGasTo: owner.address.toString(),
        targetCoord: cellCoord1,
        energy: 1000
    }).send({
        from: owner.address.toString(),
        amount: toNano(1),
    }));
    
    let details
    details = await cell1.methods.getDetails({}).call();
    console.log('getDetails cell1', details);

    details = await cell3.methods.getDetails({}).call();
    console.log('getDetails cell3', details);

    expect(details.level)
        .to.be.equal('0', 'Wrong level');

  });

});
