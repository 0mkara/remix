import remixLib from 'remix-lib';
const EventManager = remixLib.EventManager
import stateDecoder from '../solidity-decoder/stateDecoder';
import StorageViewer from '../storage/storageViewer';

export default class DebuggerSolidityState {
  event: any;
  storageResolver: any;
  stepManager: any;
  traceManager: any;
  codeManager: any;
  solidityProxy: any;
  stateVariablesByAddresses: {};
  tx: any;

  constructor (tx, _stepManager, _traceManager, _codeManager, _solidityProxy) {
    this.event = new EventManager()
    this.storageResolver = null
    this.stepManager = _stepManager
    this.traceManager = _traceManager
    this.codeManager = _codeManager
    this.solidityProxy = _solidityProxy
    this.stateVariablesByAddresses = {}
    this.tx = tx
  }

  init (index: number): any | null {
    var self = this
    var decodeTimeout = null
    if (index < 0) {
      return self.event.trigger('solidityStateMessage', ['invalid step index'])
    }

    if (self.stepManager.currentStepIndex !== index) return
    if (!self.solidityProxy.loaded()) {
      return self.event.trigger('solidityStateMessage', ['invalid step index'])
    }

    if (!self.storageResolver) {
      return
    }
    if (decodeTimeout) {
      window.clearTimeout(decodeTimeout)
    }
    self.event.trigger('solidityStateUpdating')
    decodeTimeout = setTimeout(function (): void {
      // necessary due to some states that can crash the debugger
      try {
        self.decode(index)
      } catch (err) {
        console.dir('====> error')
        console.dir(err)
      }
    }, 500)
  }

  reset (): void {
    this.stateVariablesByAddresses = {}
  }

  decode (index: number): any {
    const self = this
    self.traceManager.getCurrentCalledAddressAt(self.stepManager.currentStepIndex, function (error, address) {
      if (error) {
        return self.event.trigger('solidityState', [{}])
      }
      if (self.stateVariablesByAddresses[address]) {
        return self.extractStateVariables(self.stateVariablesByAddresses[address], address)
      }
      self.solidityProxy.extractStateVariablesAt(index, function (error, stateVars) {
        if (error) {
          return self.event.trigger('solidityState', [{}])
        }
        self.stateVariablesByAddresses[address] = stateVars
        self.extractStateVariables(stateVars, address)
      })
    })
  }

  extractStateVariables (stateVars: any, address: any):void {
    const self = this
    var storageViewer = new StorageViewer({ stepIndex: self.stepManager.currentStepIndex, tx: self.tx, address: address }, self.storageResolver, self.traceManager)
    stateDecoder.decodeState(stateVars, storageViewer).then((result: any): any => {
      self.event.trigger('solidityStateMessage', [''])
      if (result.error) {
        return self.event.trigger('solidityStateMessage', [result.error])
      }
      self.event.trigger('solidityState', [result])
    })
  }

}

