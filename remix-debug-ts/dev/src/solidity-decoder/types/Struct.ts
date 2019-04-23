'use strict'
import util from './util';
import RefType from './RefType';

export default class Struct extends RefType {
  members: any;
  constructor (memberDetails, location, fullType) {
    super(memberDetails.storageSlots, 32, 'struct ' + fullType, location)
    this.members = memberDetails.members
  }

  async decodeFromStorage (location: any, storageResolver: any): Promise<object> {
    var ret = {}
    for (var k in this.members) {
      var item = this.members[k]
      var globalLocation = {
        offset: location.offset + item.storagelocation.offset,
        slot: util.add(location.slot, item.storagelocation.slot)
      }
      try {
        ret[item.name] = await item.type.decodeFromStorage(globalLocation, storageResolver)
      } catch (e) {
        console.log(e)
        ret[item.name] = '<decoding failed - ' + e.message + '>'
      }
    }
    return {
      value: ret,
      type: this.typeName
    }
  }

  decodeFromMemoryInternal (offset: any, memory: any): object {
    var ret = {}
    this.members.map((item, i) => {
      var contentOffset = offset
      var member = item.type.decodeFromMemory(contentOffset, memory)
      ret[item.name] = member
      offset += 32
    })
    return {
      value: ret,
      type: this.typeName
    }
  }
}

