import util from "../solidity-decoder/types/util";

export default {
  decodeMappingsKeys
};

/**
 * extract the mappings location from the storage
 * like { "<mapping_slot>" : { "<mapping-key1>": preimageOf1 }, { "<mapping-key2>": preimageOf2 }, ... }
 *
 * @param {Object} storage  - storage given by storage Viewer (basically a mapping hashedkey : {key, value})
 * @param {Array} corrections - used in case the calculated sha3 has been modifyed before SSTORE (notably used for struct in mapping).
 * @param {Function} callback  - calback
 * @return {Map} - solidity mapping location (e.g { "<mapping_slot>" : { "<mapping-key1>": preimageOf1 }, { "<mapping-key2>": preimageOf2 }, ... })
 */
async function decodeMappingsKeys(web3: any, storage: object, corrections: Array<any>, callback: Function): Promise<any> {
  let ret = {};
  if (!corrections.length) corrections.push({ offset: 0, slot: 0 });
  for (let hashedLoc in storage) {
    let preimage;
    try {
      let key = storage[hashedLoc].key;
      for (let k in corrections) {
        let corrected = util.sub(key, corrections[k].slot).toString(16);
        preimage = await getPreimage(web3, "0x" + corrected);
        if (preimage) break;
      }
    } catch (e) {}
    if (preimage) {
      // got preimage!
      // get mapping position (i.e. storage slot), its the last 32 bytes
      let slotByteOffset = preimage.length - 64;
      let mappingSlot = preimage.substr(slotByteOffset);
      let mappingKey = preimage.substr(0, slotByteOffset);
      if (!ret[mappingSlot]) {
        ret[mappingSlot] = {};
      }
      ret[mappingSlot][mappingKey] = preimage;
    }
  }
  callback(null, ret);
}

/**
 * Uses web3 to return preimage of a key
 *
 * @param {String} key  - key to retrieve the preimage of
 * @return {String} - preimage of the given key
 */
function getPreimage(web3: any, key: string): Promise<any> {
  return new Promise((resolve, reject) => {
    web3.debug.preimage(key.indexOf("0x") === 0 ? key : "0x" + key, function(
      error,
      preimage
    ) {
      if (error) {
        resolve(null);
      } else {
        resolve(preimage);
      }
    });
  });
}
