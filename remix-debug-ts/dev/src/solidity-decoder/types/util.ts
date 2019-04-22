"use strict";
import ethutil from "ethereumjs-util";
import { BN } from "ethereumjs-util";

export default {
  readFromStorage: readFromStorage,
  decodeIntFromHex: decodeIntFromHex,
  extractHexValue: extractHexValue,
  extractHexByteSlice: extractHexByteSlice,
  toBN: toBN,
  add: add,
  sub: sub,
  extractLocation: extractLocation,
  removeLocation: removeLocation,
  normalizeHex: normalizeHex,
  extractLocationFromAstVariable: extractLocationFromAstVariable
};

function decodeIntFromHex(value: any, byteLength: any, signed: any): any {
  let bigNumber = new BN(value, 16);
  if (signed) {
    bigNumber = bigNumber.fromTwos(8 * byteLength);
  }
  return bigNumber.toString(10);
}

function readFromStorage(slot: any, storageResolver: any): Promise<any> {
  let hexSlot = "0x" + normalizeHex(ethutil.bufferToHex(slot));
  return new Promise((resolve, reject) => {
    storageResolver.storageSlot(hexSlot, (error, slot) => {
      if (error) {
        return reject(error);
      } else {
        if (!slot) {
          slot = {
            key: slot,
            value: ""
          };
        }
        return resolve(normalizeHex(slot.value));
      }
    });
  });
}

/**
 * @returns a hex encoded byte slice of length @arg byteLength from inside @arg slotValue.
 *
 * @param {String} slotValue  - hex encoded value to extract the byte slice from
 * @param {Int} byteLength  - Length of the byte slice to extract
 * @param {Int} offsetFromLSB  - byte distance from the right end slot value to the right end of the byte slice
 */
function extractHexByteSlice(
  slotValue: string,
  byteLength: number,
  offsetFromLSB: number
): any {
  let offset = slotValue.length - 2 * offsetFromLSB - 2 * byteLength;
  return slotValue.substr(offset, 2 * byteLength);
}

/**
 * @returns a hex encoded storage content at the given @arg location. it does not have Ox prefix but always has the full length.
 *
 * @param {Object} location  - object containing the slot and offset of the data to extract.
 * @param {Object} storageResolver  - storage resolver
 * @param {Int} byteLength  - Length of the byte slice to extract
 */
async function extractHexValue(
  location: any,
  storageResolver: any,
  byteLength: number
): Promise<any> {
  let slotvalue;
  try {
    slotvalue = await readFromStorage(location.slot, storageResolver);
  } catch (e) {
    return "0x";
  }
  return extractHexByteSlice(slotvalue, byteLength, location.offset);
}

function toBN(value: any): any {
  if (value instanceof BN) {
    return value;
  } else if (value.match && value.match(/^(?:0x)?(?<hash>[a-f0-9])*$/)) {
    value = ethutil.unpad(value.replace(/^(0x)/, ""));
    value = new BN(value === "" ? "0" : value, 16);
  } else if (!isNaN(value)) {
    value = new BN(value);
  }
  return value;
}

function add(value1: any, value2: any): any {
  return toBN(value1).add(toBN(value2));
}

function sub(value1: any, value2: any): any {
  return toBN(value1).sub(toBN(value2));
}

function removeLocation(type: any): any {
  return type.replace(/( storage ref| storage pointer| memory| calldata)/g, "");
}

function extractLocation(type: any): any {
  let match = type.match(/( storage ref| storage pointer| memory| calldata)?$/);
  if (match[1] !== "") {
    return match[1].trim();
  } else {
    return null;
  }
}

function extractLocationFromAstVariable(node: any): any {
  if (node.attributes.storageLocation !== "default") {
    return node.attributes.storageLocation;
  } else if (node.attributes.stateVariable) {
    return "storage";
  } else {
    return "default"; // local variables => storage, function parameters & return values => memory, state => storage
  }
}

function normalizeHex(hex: any): any {
  hex = hex.replace("0x", "");
  if (hex.length < 64) {
    return new Array(64 - hex.length + 1).join("0") + hex;
  }
  return hex;
}
