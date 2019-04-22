"use strict";
import util from "./util";
import ValueType from "./ValueType";

export default class Address extends ValueType {
  storageBytes: any;
  constructor() {
    super(1, 20, "address");
  }

  decodeValue(value: any): any {
    if (!value) {
      return "0x0000000000000000000000000000000000000000";
    } else {
      return (
        "0x" +
        util.extractHexByteSlice(value, this.storageBytes, 0).toUpperCase()
      );
    }
  }
}

