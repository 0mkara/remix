'use strict'

import StorageViewer from './storage/storageViewer'
import StorageResolver from './storage/storageResolver'
import remixLib from 'remix-lib'
import SolidityDecoder from './solidity-decoder'

const SolidityProxy = SolidityDecoder.SolidityProxy
const stateDecoder = SolidityDecoder.stateDecoder
const localDecoder = SolidityDecoder.localDecoder
const InternalCallTree = SolidityDecoder.InternalCallTree

const TraceManager = remixLib.trace.TraceManager
const CodeManager = remixLib.code.CodeManager
const traceHelper = remixLib.helpers.trace
const EventManager = remixLib.EventManager

/**
  * Ethdebugger is a wrapper around a few classes that helps debugging a transaction
  *
  * - Web3Providers - define which environment (web3) the transaction will be retrieved from
  * - TraceManager - Load / Analyze the trace and retrieve details of specific test
  * - CodeManager - Retrieve loaded byte code and help to resolve AST item from vmtrace index
  * - SolidityProxy - Basically used to extract state variable from AST
  * - Breakpoint Manager - Used to add / remove / jumpto breakpoint
  * - InternalCallTree - Used to retrieved local variables
  * - StorageResolver - Help resolving the storage accross different steps
  *
  * @param {Map} opts  -  { function compilationResult } //
  */
export default class Ethdebugger {
  opts: any;
  web3: any;
  event: any;
  tx: any;
  traceManager: any;
  codeManager: any;
  solidityProxy: any;
  storageResolver: any;
  callTree: any;
  breakpointManager: any;
  txBrowser: any;
  statusMessage: any;

  constructor(opts: any){

    this.opts = opts || {}
    if (!this.opts.compilationResult) this.opts.compilationResult = () => { return null }
  
    this.web3 = opts.web3
  
    this.event = new EventManager()
  
    this.tx
  
    this.traceManager = new TraceManager({web3: this.web3})
    this.codeManager = new CodeManager(this.traceManager)
    this.solidityProxy = new SolidityProxy(this.traceManager, this.codeManager)
    this.storageResolver = null
  
    this.callTree = new InternalCallTree(this.event, this.traceManager, this.solidityProxy, this.codeManager, { includeLocalVariables: true })
  }

  setManagers(): void {
    this.traceManager = new TraceManager({web3: this.web3})
    this.codeManager = new CodeManager(this.traceManager)
    this.solidityProxy = new SolidityProxy(this.traceManager, this.codeManager)
    this.storageResolver = null
  
    this.callTree = new InternalCallTree(this.event, this.traceManager, this.solidityProxy, this.codeManager, { includeLocalVariables: true })
  }

  resolveStep(index: any): void {
    this.codeManager.resolveStep(index, this.tx)
  }

  setCompilationResult(compilationResult: any): void {
    if (compilationResult && compilationResult.sources && compilationResult.contracts) {
      this.solidityProxy.reset(compilationResult)
    } else {
      this.solidityProxy.reset({})
    }
  }
  
  /* resolve source location */
  sourceLocationFromVMTraceIndex(address: any, stepIndex: any, callback: Function): void {
    this.callTree.sourceLocationTracker.getSourceLocationFromVMTraceIndex(address, stepIndex, this.solidityProxy.contracts, (error: Error, rawLocation: any) => {
      callback(error, rawLocation)
    })
  }
  
  sourceLocationFromInstructionIndex(address: any, instIndex: any, callback: Function): void {
    this.callTree.sourceLocationTracker.getSourceLocationFromInstructionIndex(address, instIndex, this.solidityProxy.contracts, function (error: Error, rawLocation: any) {
      callback(error, rawLocation)
    })
  }



  /* breakpoint */
  setBreakpointManage(breakpointManager: any): void {
    this.breakpointManager = breakpointManager
  }

  /* decode locals */
  extractLocalsAt(step: any, callback: Function): void {
    callback(null, this.callTree.findScope(step))
  }


  decodeLocalsAt(step: any, sourceLocation: any, callback: Function): void {
    this.traceManager.waterfall([
      this.traceManager.getStackAt,
      this.traceManager.getMemoryAt,
      this.traceManager.getCurrentCalledAddressAt],
      step,
      (error: Error, result: Array<any>) => {
        if (!error) {
          let stack = result[0].value
          let memory = result[1].value
          try {
            let storageViewer = new StorageViewer({
              stepIndex: step,
              tx: this.tx,
              address: result[2].value
            }, this.storageResolver, this.traceManager)
            localDecoder.solidityLocals(step, this.callTree, stack, memory, storageViewer, sourceLocation).then((locals) => {
              if (!locals.error) {
                callback(null, locals)
              } else {
                callback(locals.error)
              }
            })
          } catch (e) {
            callback(e.message)
          }
        } else {
          callback(error)
        }
      })
  }


  /* decode state */
  extractStateAt(step: any, callback: Function): void {
    this.solidityProxy.extractStateVariablesAt(step, function (error: Error, stateVars: any) {
      callback(error, stateVars)
    })
  }

  decodeStateAt(step: any, stateVars: any, callback: Function): any {
    this.traceManager.getCurrentCalledAddressAt(step, (error: Error, address: any) => {
      if (error) return callback(error)
      let storageViewer = new StorageViewer({
        stepIndex: step,
        tx: this.tx,
        address: address
      }, this.storageResolver, this.traceManager)
      stateDecoder.decodeState(stateVars, storageViewer).then((result) => {
        if (!result.error) {
          callback(null, result)
        } else {
          callback(result.error)
        }
      })
    })
  }

  storageViewAt(step: any, address: any): StorageViewer {
    return new StorageViewer({
      stepIndex: step,
      tx: this.tx,
      address: address
    }, this.storageResolver, this.traceManager)
  }

  
  updateWeb3(web3: any): void {
    this.web3 = web3
    this.setManagers()
  }


  debug(tx: any): void {
    this.setCompilationResult(this.opts.compilationResult())
    if (tx instanceof Object) {
      this.txBrowser.load(tx.hash)
    } else if (tx instanceof String) {
      this.txBrowser.load(tx)
    }
  }


  unLoad(): void {
    this.traceManager.init()
    this.codeManager.clear()
    this.event.trigger('traceUnloaded')
  }

}













debug = function (tx) {
  if (this.traceManager.isLoading) {
    return
  }
  if (!tx.to) {
    tx.to = traceHelper.contractCreationToken('0')
  }
  this.setCompilationResult(this.opts.compilationResult())
  this.tx = tx
  var self = this
  this.traceManager.resolveTrace(tx, function (error, result) {
    if (result) {
      self.event.trigger('newTraceLoaded', [self.traceManager.trace])
      if (self.breakpointManager && self.breakpointManager.hasBreakpoint()) {
        self.breakpointManager.jumpNextBreakpoint(false)
      }
      self.storageResolver = new StorageResolver({web3: self.traceManager.web3})
    } else {
      self.statusMessage = error ? error.message : 'Trace not loaded'
    }
  })
}

