"use strict";
import util from "./util";
import Bool from "./Bool";

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
    return this.decodeFromMemoryInternal(offset, memory);
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
