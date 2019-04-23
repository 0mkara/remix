"use strict";

import AddressType from "./types/Address";
import ArrayType from "./types/ArrayType";
import BoolType from "./types/Bool";
import BytesType from "./types/DynamicByteArray";
import BytesXType from "./types/FixedByteArray";
import EnumType from "./types/Enum";
import StringType from "./types/StringType";
import StructType from "./types/Struct";
import IntType from "./types/Int";
import UintType from "./types/Uint";
import MappingType from "./types/Mapping";
import util from "./types/util";

/**
 * mapping decode the given @arg type
 *
 * @param {String} type - type given by the AST
 * @return {Object} returns decoded info about the current type: { storageBytes, typeName}
 */
function mapping(
  type: string,
  stateDefinitions: any,
  contractName: any
): object {
  let match = type.match(/mapping\((.*?)=>(.*)\)$/);
  let keyTypeName = match[1].trim();
  let valueTypeName = match[2].trim();

  let keyType = parseType(
    keyTypeName,
    stateDefinitions,
    contractName,
    "storage"
  );
  let valueType = parseType(
    valueTypeName,
    stateDefinitions,
    contractName,
    "storage"
  );

  let underlyingTypes = {
    keyType: keyType,
    valueType: valueType
  };
  return new MappingType(
    underlyingTypes,
    "location",
    util.removeLocation(type)
  );
}

/**
 * Uint decode the given @arg type
 *
 * @param {String} type - type given by the AST (e.g uint256, uint32)
 * @return {Object} returns decoded info about the current type: { storageBytes, typeName}
 */
function uint(type: string): object {
  type === "uint" ? "uint256" : type;
  let storageBytes = parseInt(type.replace("uint", "")) / 8;
  return new UintType(storageBytes);
}

/**
 * Int decode the given @arg type
 *
 * @param {String} type - type given by the AST (e.g int256, int32)
 * @return {Object} returns decoded info about the current type: { storageBytes, typeName}
 */
function int(type: string): object {
  type === "int" ? "int256" : type;
  let storageBytes = parseInt(type.replace("int", "")) / 8;
  return new IntType(storageBytes);
}

/**
 * Address decode the given @arg type
 *
 * @param {String} type - type given by the AST (e.g address)
 * @return {Object} returns decoded info about the current type: { storageBytes, typeName}
 */
function address(type: string): any {
  return new AddressType();
}

/**
 * Bool decode the given @arg type
 *
 * @param {String} type - type given by the AST (e.g bool)
 * @return {Object} returns decoded info about the current type: { storageBytes, typeName}
 */
function bool(type: string): any {
  return new BoolType();
}

/**
 * DynamicByteArray decode the given @arg type
 *
 * @param {String} type - type given by the AST (e.g bytes storage ref)
 * @param {null} stateDefinitions - all state definitions given by the AST (including struct and enum type declaration) for all contracts
 * @param {null} contractName - contract the @args typeName belongs to
 * @param {String} location - location of the data (storage ref| storage pointer| memory| calldata)
 * @return {Object} returns decoded info about the current type: { storageBytes, typeName}
 */
function dynamicByteArray(
  type: string,
  stateDefinitions: any,
  contractName: any,
  location: any
): any {
  if (!location) {
    location = util.extractLocation(type);
  }
  if (location) {
    return new BytesType(location);
  } else {
    return null;
  }
}

/**
 * FixedByteArray decode the given @arg type
 *
 * @param {String} type - type given by the AST (e.g bytes16)
 * @return {Object} returns decoded info about the current type: { storageBytes, typeName}
 */
function fixedByteArray(type: string): any {
  let storageBytes = parseInt(type.replace("bytes", ""));
  return new BytesXType(storageBytes);
}

/**type
 * StringType decode the given @arg type
 *
 * @param {String} type - type given by the AST (e.g string storage ref)
 * @param {null} stateDefinitions - all state definitions given by the AST (including struct and enum type declaration) for all contracts
 * @param {null} contractName - contract the @args typeName belongs to
 * @param {String} location - location of the data (storage ref| storage pointer| memory| calldata)
 * @return {Object} returns decoded info about the current type: { storageBytes, typeName}
 */
function stringType(
  type: string,
  stateDefinitions: any,
  contractName: any,
  location: any
): any {
  if (!location) {
    location = util.extractLocation(type);
  }
  if (location) {
    return new StringType(location);
  } else {
    return null;
  }
}

/**
 * ArrayType decode the given @arg type
 *
 * @param {String} type - type given by the AST (e.g int256[] storage ref, int256[] storage ref[] storage ref)
 * @param {Object} stateDefinitions - all state definitions given by the AST (including struct and enum type declaration) for all contracts
 * @param {String} contractName - contract the @args typeName belongs to
 * @param {String} location - location of the data (storage ref| storage pointer| memory| calldata)
 * @return {Object} returns decoded info about the current type: { storageBytes, typeName, arraySize, subArray}
 */
function array(
  type: string,
  stateDefinitions: any,
  contractName: any,
  location: any
): any {
  let arraySize;
  let match = type.match(
    /(.*)\[(.*?)\]( storage ref| storage pointer| memory| calldata)?$/
  );
  if (!match) {
    console.log("unable to parse type " + type);
    return null;
  }
  if (!location) {
    location = match[3].trim();
  }
  arraySize = match[2] === "" ? "dynamic" : parseInt(match[2]);
  let underlyingType = parseType(
    match[1],
    stateDefinitions,
    contractName,
    location
  );
  if (underlyingType === null) {
    console.log("unable to parse type " + type);
    return null;
  }
  return new ArrayType(underlyingType, arraySize, location);
}

/**
 * Enum decode the given @arg type
 *
 * @param {String} type - type given by the AST (e.g enum enumDef)
 * @param {Object} stateDefinitions - all state definitions given by the AST (including struct and enum type declaration) for all contracts
 * @param {String} contractName - contract the @args typeName belongs to
 * @return {Object} returns decoded info about the current type: { storageBytes, typeName, enum}
 */
function enumType(
  type: string,
  stateDefinitions: object,
  contractName: string
): object {
  let match = type.match(/enum (.*)/);
  let enumDef = getEnum(match[1], stateDefinitions, contractName);
  if (enumDef === null) {
    console.log("unable to retrieve decode info of " + type);
    return null;
  }
  return new EnumType(enumDef);
}

/**
 * Struct decode the given @arg type
 *
 * @param {String} type - type given by the AST (e.g struct structDef storage ref)
 * @param {Object} stateDefinitions - all state definitions given by the AST (including struct and enum type declaration) for all contracts
 * @param {String} contractName - contract the @args typeName belongs to
 * @param {String} location - location of the data (storage ref| storage pointer| memory| calldata)
 * @return {Object} returns decoded info about the current type: { storageBytes, typeName, members}
 */
function struct(
  type: string,
  stateDefinitions: any,
  contractName: string,
  location: string
): object {
  let match = type.match(
    /struct (\S*?)( storage ref| storage pointer| memory| calldata)?$/
  );
  if (match) {
    if (!location) {
      location = match[2].trim();
    }
    let memberDetails = getStructMembers(
      match[1],
      stateDefinitions,
      contractName,
      location
    ); // type is used to extract the ast struct definition
    if (!memberDetails) return null;
    return new StructType(memberDetails, location, match[1]);
  } else {
    return null;
  }
}

/**
 * retrieve enum declaration of the given @arg type
 *
 * @param {String} type - type given by the AST (e.g enum enumDef)
 * @param {Object} stateDefinitions  - all state declarations given by the AST (including struct and enum type declaration) for all contracts
 * @param {String} contractName - contract the @args typeName belongs to
 * @return {Array} - containing all value declaration of the current enum type
 */
function getEnum(
  type: string,
  stateDefinitions: object,
  contractName: string
): Array<any> {
  let split = type.split(".");
  if (!split.length) {
    type = contractName + "." + type;
  } else {
    contractName = split[0];
  }
  let state = stateDefinitions[contractName];
  if (state) {
    for (let dec of state.stateDefinitions) {
      if (
        dec.attributes &&
        dec.attributes.name &&
        type === contractName + "." + dec.attributes.name
      ) {
        return dec;
      }
    }
  }
  return null;
}

/**
 * retrieve memebers declared in the given @arg tye
 *
 * @param {String} typeName - name of the struct type (e.g struct <name>)
 * @param {Object} stateDefinitions  - all state definition given by the AST (including struct and enum type declaration) for all contracts
 * @param {String} contractName - contract the @args typeName belongs to
 * @param {String} location - location of the data (storage ref| storage pointer| memory| calldata)
 * @return {Array} containing all members of the current struct type
 */
function getStructMembers(
  type: string,
  stateDefinitions: object,
  contractName: string,
  location: string
): object {
  let split = type.split(".");
  if (!split.length) {
    type = contractName + "." + type;
  } else {
    contractName = split[0];
  }
  let state = stateDefinitions[contractName];
  if (state) {
    for (let dec of state.stateDefinitions) {
      if (
        dec.name === "StructDefinition" &&
        type === contractName + "." + dec.attributes.name
      ) {
        let offsets = computeOffsets(
          dec.children,
          stateDefinitions,
          contractName,
          location
        );
        if (!offsets) {
          return null;
        }
        return {
          members: offsets.typesOffsets,
          storageSlots: offsets.endLocation.slot
        };
      }
    }
  }
  return null;
}

/**
 * parse the full type
 *
 * @param {String} fullType - type given by the AST (ex: uint[2] storage ref[2])
 * @return {String} returns the token type (used to instanciate the right decoder) (uint[2] storage ref[2] will return 'array', uint256 will return uintX)
 */
function typeClass(fullType: string): string {
  fullType = util.removeLocation(fullType);
  if (fullType.lastIndexOf("]") === fullType.length - 1) {
    return "array";
  }
  if (fullType.indexOf("mapping") === 0) {
    return "mapping";
  }
  if (fullType.indexOf(" ") !== -1) {
    fullType = fullType.split(" ")[0];
  }
  let char = fullType.indexOf("bytes") === 0 ? "X" : "";
  return fullType.replace(/[0-9]+/g, char);
}

/**
 * parse the type and return an object representing the type
 *
 * @param {Object} type - type name given by the ast node
 * @param {Object} stateDefinitions - all state stateDefinitions given by the AST (including struct and enum type declaration) for all contracts
 * @param {String} contractName - contract the @args typeName belongs to
 * @param {String} location - location of the data (storage ref| storage pointer| memory| calldata)
 * @return {Object} - return the corresponding decoder or null on error
 */
function parseType(
  type: string,
  stateDefinitions: object,
  contractName: string,
  location: string
): object {
  let decodeInfos = {
    contract: address,
    address: address,
    array: array,
    bool: bool,
    bytes: dynamicByteArray,
    bytesX: fixedByteArray,
    enum: enumType,
    string: stringType,
    struct: struct,
    int: int,
    uint: uint,
    mapping: mapping
  };
  let currentType = typeClass(type);
  if (currentType === null) {
    console.log("unable to retrieve decode info of " + type);
    return null;
  }
  if (decodeInfos[currentType]) {
    return decodeInfos[currentType](
      type,
      stateDefinitions,
      contractName,
      location
    );
  } else {
    return null;
  }
}

/**
 * compute offset (slot offset and byte offset of the @arg list of types)
 *
 * @param {Array} types - list of types
 * @param {Object} stateDefinitions - all state definitions given by the AST (including struct and enum type declaration) for all contracts
 * @param {String} contractName - contract the @args typeName belongs to
 * @param {String} location - location of the data (storage ref| storage pointer| memory| calldata)
 * @return {Array} - return an array of types item: {name, type, location}. location defines the byte offset and slot offset
 */
function computeOffsets(types: Array<any>, stateDefinitions: object, contractName: string, location: string): object {
  let ret = [];
  let storagelocation = {
    offset: 0,
    slot: 0
  };
  for (let i in types) {
    let variable = types[i];
    let type: any = parseType(
      variable.attributes.type,
      stateDefinitions,
      contractName,
      location
    );
    if (!type) {
      console.log(
        "unable to retrieve decode info of " + variable.attributes.type
      );
      return null;
    }
    if (
      !variable.attributes.constant &&
      storagelocation.offset + type.storageBytes > 32
    ) {
      storagelocation.slot++;
      storagelocation.offset = 0;
    }
    ret.push({
      name: variable.attributes.name,
      type: type,
      constant: variable.attributes.constant,
      storagelocation: {
        offset: variable.attributes.constant ? 0 : storagelocation.offset,
        slot: variable.attributes.constant ? 0 : storagelocation.slot
      }
    });
    if (!variable.attributes.constant) {
      if (
        type.storageSlots === 1 &&
        storagelocation.offset + type.storageBytes <= 32
      ) {
        storagelocation.offset += type.storageBytes;
      } else {
        storagelocation.slot += type.storageSlots;
        storagelocation.offset = 0;
      }
    }
  }
  if (storagelocation.offset > 0) {
    storagelocation.slot++;
  }
  return {
    typesOffsets: ret,
    endLocation: storagelocation
  };
}

export default {
  parseType: parseType,
  computeOffsets: computeOffsets,
  Uint: uint,
  Address: address,
  Bool: bool,
  DynamicByteArray: dynamicByteArray,
  FixedByteArray: fixedByteArray,
  Int: int,
  String: stringType,
  Array: array,
  Enum: enumType,
  Struct: struct
};
