'use strict'
import DynamicBytes from './DynamicByteArray'

export default class StringType extends DynamicBytes {
  constructor (location) {
    super(location)
    this.typeName = 'string'
  }

  async decodeFromStorage (location: any, storageResolver: any): Promise<any> {
    let decoded = '0x'
    try {
      decoded = await super.decodeFromStorage(location, storageResolver)
    } catch (e) {
      console.log(e)
      return '<decoding failed - ' + e.message + '>'
    }
    return format(decoded)
  }

  async decodeFromStack (stackDepth: any, stack: any, memory: any): Promise<any> {
    try {
      return await super.decodeFromStack(stackDepth, stack, memory, null) // TODO sending null as 4th @param
    } catch (e) {
      console.log(e)
      return '<decoding failed - ' + e.message + '>'
    }
  }

  decodeFromMemoryInternal (offset, memory) {
    let decoded = super.decodeFromMemoryInternal(offset, memory)
    return format(decoded)
  }
}

function format (decoded: any): any {
  if (decoded.error) {
    return decoded
  }
  let value = decoded.value
  value = value.replace('0x', '').replace(/(..)/g, '%$1')
  let ret: any = {
    length: decoded.length,
    raw: decoded.value,
    type: 'string'
  }
  try {
    ret.value = decodeURIComponent(value)
  } catch (e) {
    ret.error = 'Invalid UTF8 encoding'
    ret.raw = decoded.value
  }
  return ret
}
