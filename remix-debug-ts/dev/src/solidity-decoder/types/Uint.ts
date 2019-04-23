'use strict'
import util from './util'
import ValueType from './ValueType'

export default class Uint extends ValueType {
  constructor (storageBytes) {
    super(1, storageBytes, 'uint' + storageBytes * 8)
  }

  decodeValue (value: any): any {
    value = util.extractHexByteSlice(value, this.storageBytes, 0)
    return util.decodeIntFromHex(value, this.storageBytes, false)
  }
}

