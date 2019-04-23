'use strict'
import ValueType from './ValueType'
import util from './util'

export default class Bool extends ValueType {
  storageBytes: any;
  constructor () {
    super(1, 1, 'bool')
  }

  decodeValue (value: any): any {
    if (!value) {
      return false
    } else {
      value = util.extractHexByteSlice(value, this.storageBytes, 0)
      return value !== '00'
    }
  }
}

