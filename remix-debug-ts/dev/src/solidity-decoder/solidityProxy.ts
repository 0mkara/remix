'use strict'
import remixLib from 'remix-lib'
const traceHelper = remixLib.helpers.trace
import stateDecoder from './stateDecoder'
import astHelper from './astHelper'
const util = remixLib.util

export default class SolidityProxy {
  cache: Cache;
  traceManager: any;
  codeManager: any;
  sources: any;
  contracts: any;
  constructor (traceManager, codeManager) {
    this.cache = new Cache()
    this.reset({})
    this.traceManager = traceManager
    this.codeManager = codeManager
  }

  /**
    * reset the cache and apply a new @arg compilationResult
    *
    * @param {Object} compilationResult  - result os a compilatiion (diectly returned by the compiler)
    */
  reset (compilationResult: any): any {
    this.sources = compilationResult.sources
    this.contracts = compilationResult.contracts
    this.cache.reset()
  }

  /**
    * check if the object has been properly loaded
    *
    * @return {Bool} - returns true if a compilation result has been applied
    */
  loaded (): boolean {
    return this.contracts !== undefined
  }

  /**
    * retrieve the compiled contract name at the @arg vmTraceIndex (cached)
    *
    * @param {Int} vmTraceIndex  - index in the vm trave where to resolve the executed contract name
    * @param {Function} cb  - callback returns (error, contractName)
    */
  contractNameAt (vmTraceIndex: number, cb: Function): void {
    this.traceManager.getCurrentCalledAddressAt(vmTraceIndex, (error, address) => {
      if (error) {
        cb(error)
      } else {
        if (this.cache.contractNameByAddress[address]) {
          cb(null, this.cache.contractNameByAddress[address])
        } else {
          this.codeManager.getCode(address, (error, code) => {
            if (error) {
              cb(error)
            } else {
              let contractName = contractNameFromCode(this.contracts, code.bytecode, address)
              this.cache.contractNameByAddress[address] = contractName
              cb(null, contractName)
            }
          })
        }
      }
    })
  }

  /**
    * extract the state variables of the given compiled @arg contractName (cached)
    *
    * @param {String} contractName  - name of the contract to retrieve state variables from
    * @return {Object} - returns state variables of @args contractName
    */
  extractStatesDefinitions (): object {
    if (!this.cache.contractDeclarations) {
      this.cache.contractDeclarations = astHelper.extractContractDefinitions(this.sources)
    }
    if (!this.cache.statesDefinitions) {
      this.cache.statesDefinitions = astHelper.extractStatesDefinitions(this.sources, this.cache.contractDeclarations)
    }
    return this.cache.statesDefinitions
  }

  /**
    * extract the state variables of the given compiled @arg contractName (cached)
    *
    * @param {String} contractName  - name of the contract to retrieve state variables from
    * @return {Object} - returns state variables of @args contractName
    */
  extractStateVariables (contractName: string): object {
    if (!this.cache.stateVariablesByContractName[contractName]) {
      this.cache.stateVariablesByContractName[contractName] = stateDecoder.extractStateVariables(contractName, this.sources)
    }
    return this.cache.stateVariablesByContractName[contractName]
  }

  /**
    * extract the state variables of the given compiled @arg vmtraceIndex (cached)
    *
    * @param {Int} vmTraceIndex  - index in the vm trave where to resolve the state variables
    * @return {Object} - returns state variables of @args vmTraceIndex
    */
  extractStateVariablesAt (vmtraceIndex: number, cb: Function): void {
    this.contractNameAt(vmtraceIndex, (error: Error, contractName: any) => {
      if (error) {
        cb(error)
      } else {
        cb(null, this.extractStateVariables(contractName))
      }
    })
  }

  /**
    * get the AST of the file declare in the @arg sourceLocation
    *
    * @param {Object} sourceLocation  - source location containing the 'file' to retrieve the AST from
    * @return {Object} - AST of the current file
    */
  ast (sourceLocation: any): object {
    let file: any = this.fileNameFromIndex(sourceLocation.file)
    if (this.sources[file]) {
      return this.sources[file].legacyAST
    } else {
      // console.log('AST not found for file id ' + sourceLocation.file)
      return null
    }
  }

  /**
   * get the filename refering to the index from the compilation result
   *
   * @param {Int} index  - index of the filename
   * @return {String} - filename
   */
  fileNameFromIndex (index: number): string {
    return Object.keys(this.contracts)[index]
  }
}

function contractNameFromCode (contracts: any, code: any, address: any): any | null {
  let isCreation = traceHelper.isContractCreation(address)
  for (let file in contracts) {
    for (let contract in contracts[file]) {
      let bytecode = isCreation ? contracts[file][contract].evm.bytecode.object : contracts[file][contract].evm.deployedBytecode.object
      if (util.compareByteCode(code, '0x' + bytecode)) {
        return contract
      }
    }
  }
  return null
}

class Cache {
  contractNameByAddress: {};
  stateVariablesByContractName: {};
  contractDeclarations: any;
  statesDefinitions: any;
  constructor () {
    this.reset()
  }
  reset (): void {
    this.contractNameByAddress = {}
    this.stateVariablesByContractName = {}
    this.contractDeclarations = null
    this.statesDefinitions = null
  }
}

