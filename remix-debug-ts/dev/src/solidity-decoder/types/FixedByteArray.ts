"use strict";
import ValueType from "./ValueType";

export default class FixedByteArray extends ValueType {
  storageBytes: number;
  constructor(storageBytes) {
    super(1, storageBytes, "bytes" + storageBytes);
  }

  decodeValue(value: any): any {
    return "0x" + value.substr(0, 2 * this.storageBytes).toUpperCase();
  }
}

