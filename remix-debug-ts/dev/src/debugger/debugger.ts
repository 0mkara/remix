"use strict";
import remixLib from "remix-lib";
import Ethdebugger from "../Ethdebugger";
const EventManager = remixLib.EventManager;
const traceHelper = remixLib.helpers.trace;
const OffsetToColumnConverter = remixLib.OffsetToColumnConverter;

import StepManager from "./stepManager";
import VmDebuggerLogic from "./VmDebugger";

export default class Debugger {
  event: any;
  offsetToLineColumnConverter: any;
  compiler: any;
  debugger: Ethdebugger;
  breakPointManager: any;
  step_manager: any;
  vmDebuggerLogic: VmDebuggerLogic;

  constructor(options) {
    var self = this;
    this.event = new EventManager();

    this.offsetToLineColumnConverter =
      options.offsetToLineColumnConverter || new OffsetToColumnConverter();
    this.compiler = options.compiler;

    this.debugger = new Ethdebugger({
      web3: options.web3,
      compilationResult: (): null => {
        var compilationResult = this.compiler.lastCompilationResult;
        if (compilationResult) {
          return compilationResult.data;
        }
        return null;
      }
    });

    this.breakPointManager = new remixLib.code.BreakpointManager(
      this.debugger,
      sourceLocation => {
        return self.offsetToLineColumnConverter.offsetToLineColumn(
          sourceLocation,
          sourceLocation.file,
          this.compiler.lastCompilationResult.source.sources,
          this.compiler.lastCompilationResult.data.sources
        );
      },
      step => {
        self.event.trigger("breakpointStep", [step]);
      }
    );

    this.debugger.setBreakpointManage(this.breakPointManager);

    this.debugger.event.register("newTraceLoaded", this, function(): void {
      self.event.trigger("debuggerStatus", [true]);
    });

    this.debugger.event.register("traceUnloaded", this, function(): void {
      self.event.trigger("debuggerStatus", [false]);
    });

    this.event.register("breakpointStep", function(step): void {
      self.step_manager.jumpTo(step);
    });
  }

  registerAndHighlightCodeItem(index: any): void {
    const self = this;
    // register selected code item, highlight the corresponding source location
    if (!self.compiler.lastCompilationResult) return;
    self.debugger.traceManager.getCurrentCalledAddressAt(
      index,
      (error: Error, address: any) => {
        if (error) return console.log(error);
        self.debugger.callTree.sourceLocationTracker.getSourceLocationFromVMTraceIndex(
          address,
          index,
          self.compiler.lastCompilationResult.data.contracts,
          function(error: Error, rawLocation: any) {
            if (
              !error &&
              self.compiler.lastCompilationResult &&
              self.compiler.lastCompilationResult.data
            ) {
              var lineColumnPos = self.offsetToLineColumnConverter.offsetToLineColumn(
                rawLocation,
                rawLocation.file,
                self.compiler.lastCompilationResult.source.sources,
                self.compiler.lastCompilationResult.data.sources
              );
              self.event.trigger("newSourceLocation", [
                lineColumnPos,
                rawLocation
              ]);
            } else {
              self.event.trigger("newSourceLocation", [null]);
            }
          }
        );
      }
    );
  }

  updateWeb3(web3: any): void {
    this.debugger.web3 = web3;
  }

  debug(blockNumber: any, txNumber: any, tx: any, loadingCb: any): any {
    const self = this;
    let web3 = this.debugger.web3;

    if (this.debugger.traceManager.isLoading) {
      return;
    }

    if (tx) {
      if (!tx.to) {
        tx.to = traceHelper.contractCreationToken("0");
      }
      return self.debugTx(tx, loadingCb);
    }

    try {
      if (txNumber.indexOf("0x") !== -1) {
        return web3.eth.getTransaction(txNumber, function(
          _error: Error,
          result: any
        ) {
          let tx = result;
          self.debugTx(tx, loadingCb);
        });
      }
      web3.eth.getTransactionFromBlock(blockNumber, txNumber, function(
        _error: Error,
        result: any
      ) {
        let tx = result;
        self.debugTx(tx, loadingCb);
      });
    } catch (e) {
      console.error(e.message);
    }
  }

  debugTx(tx: any, loadingCb: any): void {
    const self = this;
    this.step_manager = new StepManager(
      this.debugger,
      this.debugger.traceManager
    );

    this.debugger.codeManager.event.register(
      "changed",
      this,
      (code: any, address: any, instIndex: any) => {
        self.debugger.callTree.sourceLocationTracker.getSourceLocationFromVMTraceIndex(
          address,
          this.step_manager.currentStepIndex,
          this.debugger.solidityProxy.contracts,
          (error, sourceLocation) => {
            if (!error) {
              self.vmDebuggerLogic.event.trigger("sourceLocationChanged", [
                sourceLocation
              ]);
            }
          }
        );
      }
    );

    this.vmDebuggerLogic = new VmDebuggerLogic(
      this.debugger,
      tx,
      this.step_manager,
      this.debugger.traceManager,
      this.debugger.codeManager,
      this.debugger.solidityProxy,
      this.debugger.callTree
    );
    this.vmDebuggerLogic.start();

    this.step_manager.event.register("stepChanged", this, function(
      stepIndex
    ): any | void {
      if (!stepIndex) {
        return self.event.trigger("endDebug");
      }

      self.debugger.codeManager.resolveStep(stepIndex, tx);
      self.step_manager.event.trigger("indexChanged", [stepIndex]);
      self.vmDebuggerLogic.event.trigger("indexChanged", [stepIndex]);
      self.registerAndHighlightCodeItem(stepIndex);
    });

    loadingCb();
    this.debugger.debug(tx);
  }

  unload(): void {
    this.debugger.unLoad();
    this.event.trigger("debuggerUnloaded");
  }
}
