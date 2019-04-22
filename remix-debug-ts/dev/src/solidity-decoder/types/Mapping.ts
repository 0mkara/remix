"use strict";
import RefType from "./RefType";
import util from "./util";
import ethutil from "ethereumjs-util";

export default class Mapping extends RefType {
  keyType: any;
  valueType: any;
  initialDecodedState: any;
  typeName: any;
  constructor(underlyingTypes, location, fullType) {
    super(1, 32, fullType, "storage");
    this.keyType = underlyingTypes.keyType;
    this.valueType = underlyingTypes.valueType;
    this.initialDecodedState = null;
  }

  async decodeFromStorage(location: any, storageResolver: any): Promise<any> {
    let corrections = this.valueType.members
      ? this.valueType.members.map(value => {
          return value.storagelocation;
        })
      : [];
    if (!this.initialDecodedState) {
      // cache the decoded initial storage
      let mappingsInitialPreimages;
      try {
        mappingsInitialPreimages = await storageResolver.initialMappingsLocation(
          corrections
        );
        this.initialDecodedState = await this.decodeMappingsLocation(
          mappingsInitialPreimages,
          location,
          storageResolver
        );
      } catch (e) {
        return {
          value: e.message,
          type: this.typeName
        };
      }
    }
    let mappingPreimages = await storageResolver.mappingsLocation(corrections);
    let ret = await this.decodeMappingsLocation(
      mappingPreimages,
      location,
      storageResolver
    ); // fetch mapping storage changes
    ret = Object.assign({}, this.initialDecodedState, ret); // merge changes
    return {
      value: ret,
      type: this.typeName
    };
  }

  decodeFromMemoryInternal(offset: any, memory: any): object {
    // mappings can only exist in storage and not in memory
    // so this should never be called
    return {
      value: "<not implemented>",
      length: "0x",
      type: this.typeName
    };
  }

  async decodeMappingsLocation(preimages: any, location: any, storageResolver: any): Promise<any> {
    let mapSlot = util.normalizeHex(ethutil.bufferToHex(location.slot));
    if (!preimages[mapSlot]) {
      return {};
    }
    let ret = {};
    for (let i in preimages[mapSlot]) {
      let mapLocation = getMappingLocation(i, location.slot);
      let globalLocation = {
        offset: location.offset,
        slot: mapLocation
      };
      ret[i] = await this.valueType.decodeFromStorage(
        globalLocation,
        storageResolver
      );
      console.log("global location", globalLocation, i, ret[i]);
    }
    return ret;
  }
}

function getMappingLocation(key: any, position: any): any {
  // mapping storage location decribed at http://solidity.readthedocs.io/en/develop/miscellaneous.html#layout-of-state-letiables-in-storage
  // > the value corresponding to a mapping key k is located at keccak256(k . p) where . is concatenation.

  // key should be a hex string, and position an int
  let mappingK = ethutil.toBuffer("0x" + key);
  let mappingP = ethutil.intToBuffer(position);
  mappingP = ethutil.setLengthLeft(mappingP, 32);
  let mappingKeyBuf = concatTypedArrays(mappingK, mappingP);
  let mappingKeyPreimage = "0x" + mappingKeyBuf.toString("hex");
  let mappingStorageLocation = ethutil.sha3(mappingKeyPreimage);
  mappingStorageLocation = new ethutil.BN(mappingStorageLocation, 16);
  return mappingStorageLocation;
}

function concatTypedArrays(a: any, b: any): void {
  // a, b TypedArray of same type
  let c = new a.constructor(a.length + b.length);
  c.set(a, 0);
  c.set(b, a.length);
  return c;
}

