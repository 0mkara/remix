"use strict";
import { BN } from "ethereumjs-util";
import util from "./util";
import remixLib from "remix-lib";
const sha3256 = remixLib.util.sha3_256;
export default class RefType {
  location: any;
  storageSlots: any;
  storageBytes: any;
  typeName: any;
  basicType: string;
  constructor(storageSlots, storageBytes, typeName, location) {
    this.location = location;
    this.storageSlots = storageSlots;
    this.storageBytes = storageBytes;
    this.typeName = typeName;
    this.basicType = "RefType";
  }

  /**
   * decode the type from the stack
   *
   * @param {Int} stackDepth - position of the type in the stack
   * @param {Array} stack - stack
   * @param {String} - memory
   * @param {Object} - storageResolver
   * @return {Object} decoded value
   */
  async decodeFromStack(
    stackDepth: any,
    stack: Array<any>,
    memory: string,
    storageResolver: object
  ): Promise<any> {
    if (stack.length - 1 < stackDepth) {
      return {
        error: "<decoding failed - stack underflow " + stackDepth + ">",
        type: this.typeName
      };
    }
    let offset = stack[stack.length - 1 - stackDepth];
    if (this.isInStorage()) {
      offset = util.toBN(offset);
      try {
        return await this.decodeFromStorage(
          // ADDING func from dynamicByteArray.ts
          { offset: 0, slot: offset },
          storageResolver
        );
      } catch (e) {
        console.log(e);
        return {
          error: "<decoding failed - " + e.message + ">",
          type: this.typeName
        };
      }
    } else if (this.isInMemory()) {
      offset = parseInt(offset, 16);
      return this.decodeFromMemoryInternal(offset, memory);
    } else {
      return {
        error: "<decoding failed - no decoder for " + this.location + ">",
        type: this.typeName
      };
    }
  }

  /**
   * decode the type from the memory
   *
   * @param {Int} offset - position of the ref of the type in memory
   * @param {String} memory - memory
   * @return {Object} decoded value
   */
  decodeFromMemory(offset: any, memory: string): object {
    offset = memory.substr(2 * offset, 64);
    offset = parseInt(offset, 16);
    return this.decodeFromMemoryInternal(offset, memory); // ADDING function from dynamicByteArray.ts
  }

  decodeFromMemoryInternal(offset: any, memory: any): any {
    offset = 2 * offset;
    let length = memory.substr(offset, 64);
    length = 2 * parseInt(length, 16);
    return {
      length: "0x" + length.toString(16),
      value: "0x" + memory.substr(offset + 64, length),
      type: this.typeName
    };
  }

  async decodeFromStorage(location: any, storageResolver: any): Promise<any> {
    let value = "0x0";
    try {
      value = await util.extractHexValue(
        location,
        storageResolver,
        this.storageBytes
      );
    } catch (e) {
      console.log(e);
      return {
        value: "<decoding failed - " + e.message + ">",
        type: this.typeName
      };
    }
    let bn = new BN(value, 16);
    if (bn.testn(0)) {
      let length = bn.div(new BN(2));
      let dataPos = new BN(sha3256(location.slot).replace("0x", ""), 16);
      let ret = "";
      let currentSlot = "0x";
      try {
        currentSlot = await util.readFromStorage(dataPos, storageResolver);
      } catch (e) {
        console.log(e);
        return {
          value: "<decoding failed - " + e.message + ">",
          type: this.typeName
        };
      }
      while (length.gt(ret.length) && ret.length < 32000) {
        currentSlot = currentSlot.replace("0x", "");
        ret += currentSlot;
        dataPos = dataPos.add(new BN(1));
        try {
          currentSlot = await util.readFromStorage(dataPos, storageResolver);
        } catch (e) {
          console.log(e);
          return {
            value: "<decoding failed - " + e.message + ">",
            type: this.typeName
          };
        }
      }
      return {
        value: "0x" + ret.replace(/(00)+$/, ""),
        length: "0x" + length.toString(16),
        type: this.typeName
      };
    } else {
      let size = parseInt(value.substr(value.length - 2, 2), 16) / 2;
      return {
        value: "0x" + value.substr(0, size * 2),
        length: "0x" + size.toString(16),
        type: this.typeName
      };
    }
  }

  /**
   * current type defined in storage
   *
   * @return {Bool} - return true if the type is defined in the storage
   */
  isInStorage(): boolean {
    return this.location.indexOf("storage") === 0;
  }

  /**
   * current type defined in memory
   *
   * @return {Bool} - return true if the type is defined in the memory
   */
  isInMemory(): boolean {
    return this.location.indexOf("memory") === 0;
  }
}
