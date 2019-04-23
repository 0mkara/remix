import remixLib from "remix-lib";
const EventManager = remixLib.EventManager;
const ui = remixLib.helpers.ui;
import StorageResolver from "../storage/storageResolver";
import StorageViewer from "../storage/storageViewer";

import DebuggerSolidityState from "./solidityState";
import DebuggerSolidityLocals from "./solidityLocals";

export default class VmDebuggerLogic {
  event: any;
  debugger: any;
  stepManager: any;
  _traceManager: any;
  _codeManager: any;
  _solidityProxy: any;
  _callTree: any;
  storageResolver: any;
  tx: any;
  debuggerSolidityState: DebuggerSolidityState;
  debuggerSolidityLocals: DebuggerSolidityLocals;
  address: any[];
  traceLength: number;
  addresses: any;

  constructor(
    _debugger,
    tx,
    _stepManager,
    _traceManager,
    _codeManager,
    _solidityProxy,
    _callTree
  ) {
    this.event = new EventManager();
    this.debugger = _debugger;
    this.stepManager = _stepManager;
    this._traceManager = _traceManager;
    this._codeManager = _codeManager;
    this._solidityProxy = _solidityProxy;
    this._callTree = _callTree;
    this.storageResolver = null;
    this.tx = tx;

    this.debuggerSolidityState = new DebuggerSolidityState(
      tx,
      _stepManager,
      _traceManager,
      _codeManager,
      _solidityProxy
    );
    this.debuggerSolidityLocals = new DebuggerSolidityLocals(
      tx,
      _stepManager,
      _traceManager,
      _callTree
    );
  }

  start(): void {
    this.listenToEvents();
    this.listenToCodeManagerEvents();
    this.listenToTraceManagerEvents();
    this.listenToFullStorageChanges();
    this.listenToNewChanges();

    this.listenToSolidityStateEvents();
    this.listenToSolidityLocalsEvents();
  }

  listenToEvents(): void {
    const self = this;
    this.debugger.event.register("traceUnloaded", function(): void {
      self.event.trigger("traceUnloaded");
    });

    this.debugger.event.register("newTraceLoaded", function(): void {
      self.event.trigger("newTraceLoaded");
    });
  }

  listenToCodeManagerEvents(): void {
    const self = this;
    this._codeManager.event.register("changed", function(
      code: any,
      address: any,
      index: number
    ): void {
      self.event.trigger("codeManagerChanged", [code, address, index]);
    });
  }

  listenToTraceManagerEvents(): void {
    const self = this;

    this.event.register("indexChanged", this, function(index: number): void {
      if (index < 0) return;
      if (self.stepManager.currentStepIndex !== index) return;

      self.event.trigger("indexUpdate", [index]);

      self._traceManager.getCallDataAt(index, function(
        error: Error,
        calldata: any
      ): void {
        if (error) {
          // console.log(error)
          self.event.trigger("traceManagerCallDataUpdate", [{}]);
        } else if (self.stepManager.currentStepIndex === index) {
          self.event.trigger("traceManagerCallDataUpdate", [calldata]);
        }
      });

      self._traceManager.getMemoryAt(index, function(
        error: Error,
        memory: any
      ): void {
        if (error) {
          // console.log(error)
          self.event.trigger("traceManagerMemoryUpdate", [{}]);
        } else if (self.stepManager.currentStepIndex === index) {
          self.event.trigger("traceManagerMemoryUpdate", [
            ui.formatMemory(memory, 16)
          ]);
        }
      });

      self._traceManager.getCallStackAt(index, function(
        error: Error,
        callstack: any
      ): void {
        if (error) {
          // console.log(error)
          self.event.trigger("traceManagerCallStackUpdate", [{}]);
        } else if (self.stepManager.currentStepIndex === index) {
          self.event.trigger("traceManagerCallStackUpdate", [callstack]);
        }
      });

      self._traceManager.getStackAt(index, function(
        error: Error,
        callstack: any
      ): void {
        if (error) {
          // console.log(error)
          self.event.trigger("traceManagerStackUpdate", [{}]);
        } else if (self.stepManager.currentStepIndex === index) {
          self.event.trigger("traceManagerStackUpdate", [callstack]);
        }
      });

      self._traceManager.getCurrentCalledAddressAt(
        index,
        (error: Error, address: any): void => {
          if (error) return;
          if (!self.storageResolver) return;

          var storageViewer = new StorageViewer(
            {
              stepIndex: self.stepManager.currentStepIndex,
              tx: self.tx,
              address: address
            },
            self.storageResolver,
            self._traceManager
          );

          storageViewer.storageRange(
            (error: Error, storage: any): void => {
              if (error) {
                // console.log(error)
                self.event.trigger("traceManagerStorageUpdate", [{}]);
              } else if (self.stepManager.currentStepIndex === index) {
                var header = storageViewer.isComplete(address)
                  ? "completely loaded"
                  : "partially loaded...";
                self.event.trigger("traceManagerStorageUpdate", [
                  storage,
                  header
                ]);
              }
            }
          );
        }
      );

      self._traceManager.getCurrentStep(index, function(
        error: Error,
        step: any
      ): void {
        self.event.trigger("traceCurrentStepUpdate", [error, step]);
      });

      self._traceManager.getMemExpand(index, function(
        error: Error,
        addmem: any
      ): void {
        self.event.trigger("traceMemExpandUpdate", [error, addmem]);
      });

      self._traceManager.getStepCost(index, function(
        error: Error,
        gas: any
      ): void {
        self.event.trigger("traceStepCostUpdate", [error, gas]);
      });

      self._traceManager.getCurrentCalledAddressAt(index, function(
        error: Error,
        address: any
      ) {
        self.event.trigger("traceCurrentCalledAddressAtUpdate", [
          error,
          address
        ]);
      });

      self._traceManager.getRemainingGas(index, function(
        error: Error,
        remaining: any
      ): void {
        self.event.trigger("traceRemainingGasUpdate", [error, remaining]);
      });

      self._traceManager.getReturnValue(index, function(
        error: Error,
        returnValue: any
      ): void {
        if (error) {
          self.event.trigger("traceReturnValueUpdate", [[error]]);
        } else if (self.stepManager.currentStepIndex === index) {
          self.event.trigger("traceReturnValueUpdate", [[returnValue]]);
        }
      });
    });
  }

  listenToFullStorageChanges(): void {
    const self = this;

    this.address = [];
    this.traceLength = 0;

    self.debugger.event.register("newTraceLoaded", function(
      length: number
    ): void {
      self._traceManager.getAddresses(function(
        error: Error,
        addresses: any
      ): void {
        if (error) return;
        self.event.trigger("traceAddressesUpdate", [addresses]);
        self.addresses = addresses;
      });

      self._traceManager.getLength(function(
        error: Error,
        length: number
      ): void {
        if (error) return;
        self.event.trigger("traceLengthUpdate", [length]);
        self.traceLength = length;
      });
    });

    self.debugger.event.register("indexChanged", this, function(
      index: number
    ): void {
      if (index < 0) return;
      if (self.stepManager.currentStepIndex !== index) return;
      if (!self.storageResolver) return;

      if (index !== self.traceLength - 1) {
        return self.event.trigger("traceLengthUpdate", [{}]);
      }
      var storageJSON = {};
      for (var k in self.addresses) {
        var address = self.addresses[k];
        var storageViewer = new StorageViewer(
          {
            stepIndex: self.stepManager.currentStepIndex,
            tx: self.tx,
            address: address
          },
          self.storageResolver,
          self._traceManager
        );
        storageViewer.storageRange(function(error: Error, result: any): void {
          if (!error) {
            storageJSON[address] = result;
            self.event.trigger("traceLengthUpdate", [storageJSON]);
          }
        });
      }
    });
  }

  listenToNewChanges(): any {
    const self = this;
    self.debugger.event.register("newTraceLoaded", this, function(): void {
      self.storageResolver = new StorageResolver({ web3: self.debugger.web3 });
      self.debuggerSolidityState.storageResolver = self.storageResolver;
      self.debuggerSolidityLocals.storageResolver = self.storageResolver;
      self.event.trigger("newTrace", []);
    });

    self.debugger.event.register("callTreeReady", function(): any {
      if (self.debugger.callTree.reducedTrace.length) {
        return self.event.trigger("newCallTree", []);
      }
    });
  }

  listenToSolidityStateEvents(): void {
    const self = this;
    this.event.register(
      "indexChanged",
      this.debuggerSolidityState.init.bind(this.debuggerSolidityState)
    );
    this.debuggerSolidityState.event.register("solidityState", function(
      state: any
    ): void {
      self.event.trigger("solidityState", [state]);
    });
    this.debuggerSolidityState.event.register("solidityStateMessage", function(
      message: any
    ) {
      self.event.trigger("solidityStateMessage", [message]);
    });
    this.debuggerSolidityState.event.register(
      "solidityStateUpdating",
      function(): void {
        self.event.trigger("solidityStateUpdating", []);
      }
    );
    this.event.register(
      "traceUnloaded",
      this.debuggerSolidityState.reset.bind(this.debuggerSolidityState)
    );
    this.event.register(
      "newTraceLoaded",
      this.debuggerSolidityState.reset.bind(this.debuggerSolidityState)
    );
  }

  listenToSolidityLocalsEvents(): void {
    const self = this;
    this.event.register(
      "sourceLocationChanged",
      this.debuggerSolidityLocals.init.bind(this.debuggerSolidityLocals)
    );
    this.debuggerSolidityLocals.event.register("solidityLocals", function(
      state: any
    ) {
      self.event.trigger("solidityLocals", [state]);
    });
    this.debuggerSolidityLocals.event.register(
      "solidityLocalsMessage",
      function(message: any): void {
        self.event.trigger("solidityLocalsMessage", [message]);
      }
    );
    this.debuggerSolidityLocals.event.register(
      "solidityLocalsUpdating",
      function(): void {
        self.event.trigger("solidityLocalsUpdating", []);
      }
    );
    this.debuggerSolidityLocals.event.register(
      "traceReturnValueUpdate",
      function(data: any, header: any): void {
        self.event.trigger("traceReturnValueUpdate", [data, header]);
      }
    );
  }
}
