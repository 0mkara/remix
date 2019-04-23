'use strict'
import ValueType from './ValueType'

export default class Enum extends ValueType {
  enumDef: any;
  constructor (enumDef) {
    var storageBytes = 0
    var length = enumDef.children.length
    while (length > 1) {
      length = length / 256
      storageBytes++
    }
    super(1, storageBytes, 'enum')
    this.enumDef = enumDef
  }

  decodeValue (value: any): any {
    if (!value) {
      return this.enumDef.children[0].attributes.name
    } else {
      value = parseInt(value, 16)
      if (this.enumDef.children.length > value) {
        return this.enumDef.children[value].attributes.name
      } else {
        return 'INVALID_ENUM<' + value + '>'
      }
    }
  }
}

