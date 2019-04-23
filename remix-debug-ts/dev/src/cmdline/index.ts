import Web3 from "web3";
import Debugger from "../debugger/debugger.js";
import ContextManager from "./contextManager.js";
import EventManager from "events";
import { dataType, inputJSONType, compilationType } from "./types.js";

export default class CmdLine {
  events: EventManager;
  lineColumnPos: any;
  rawLocation: any;
  web3: any;
  compilation: any;
  contextManager: any;
  debugger: any;
  filename: any;
  txHash: any;
  solidityState: any;
  solidityLocals: any;

  constructor() {
    this.events = new EventManager();
    this.lineColumnPos = null;
    this.rawLocation = null;
  }

  connect(providerType: string, url: string): void {
    if (providerType !== "http") throw new Error("unsupported provider type");
    this.web3 = new Web3(new Web3.providers.HttpProvider(url));
  }

  loadCompilationData(inputJson: inputJSONType, outputJson: object): void {
    let data: dataType;
    data.data = outputJson;
    data.source = { sources: inputJson.sources };
    this.loadCompilationResult(data);
  }

  loadCompilationResult(compilationResult: any): void {
    this.compilation.lastCompilationResult = compilationResult;
  }

  initDebugger(cb: Function): void {
    const self = this;
    this.contextManager = new ContextManager();

    this.debugger = new Debugger({
      web3: this.contextManager.getWeb3(),
      compiler: this.compilation
    });

    this.contextManager.event.register(
      "providerChanged",
      (): void => {
        self.debugger.updateWeb3(self.contextManager.getWeb3());
      }
    );

    this.contextManager.initProviders();

    this.contextManager.addProvider("debugger_web3", this.web3);
    this.contextManager.switchProvider("debugger_web3", cb);
  }

  getSource(): Array<any> {
    const self = this;

    let lineColumnPos = this.lineColumnPos;

    if (!lineColumnPos || !lineColumnPos.start) return [];

    let content = self.compilation.lastCompilationResult.source.sources[
      this.filename
    ].content.split("\n");

    let source = [];

    let line;
    line = content[lineColumnPos.start.line - 2];
    if (line !== undefined) {
      source.push("    " + (lineColumnPos.start.line - 1) + ":  " + line);
    }
    line = content[lineColumnPos.start.line - 1];
    if (line !== undefined) {
      source.push("    " + lineColumnPos.start.line + ":  " + line);
    }

    let currentLineNumber = lineColumnPos.start.line;
    let currentLine = content[currentLineNumber];
    source.push("=>  " + (currentLineNumber + 1) + ":  " + currentLine);

    let startLine = lineColumnPos.start.line;
    for (var i = 1; i < 4; i++) {
      let line = content[startLine + i];
      source.push("    " + (startLine + i + 1) + ":  " + line);
    }

    return source;
  }

  getCurrentLine(): Array<any> | string {
    let lineColumnPos = this.lineColumnPos;
    if (!lineColumnPos) return "";
    let currentLineNumber = lineColumnPos.start.line;
    let content = this.compilation.lastCompilationResult.source.sources[
      this.filename
    ].content.split("\n");
    return content[currentLineNumber];
  }

  startDebug(txNumber: any, filename: any, cb: Function): void {
    const self = this;
    this.filename = filename;
    this.txHash = txNumber;
    this.debugger.debug(null, txNumber, null, () => {
      self.debugger.event.register("newSourceLocation", function(
        lineColumnPos,
        rawLocation
      ) {
        self.lineColumnPos = lineColumnPos;
        self.rawLocation = rawLocation;
        self.events.emit("source", [lineColumnPos, rawLocation]);
      });

      self.debugger.vmDebuggerLogic.event.register("solidityState", data => {
        self.solidityState = data;
        self.events.emit("globals", data);
      });

      // TODO: this doesnt work too well, it should request the data instead...
      self.debugger.vmDebuggerLogic.event.register("solidityLocals", data => {
        if (JSON.stringify(data) === "{}") return;
        self.solidityLocals = data;
        self.events.emit("locals", data);
      });

      if (cb) {
        // TODO: this should be an onReady event
        setTimeout(cb, 1000);
      }
    });
  }

  getVars(): object {
    return {
      locals: this.solidityLocals,
      contract: this.solidityState
    };
  }

  triggerSourceUpdate(): void {
    this.events.emit("source", [this.lineColumnPos, this.rawLocation]);
  }

  stepJumpNextBreakpoint(): void {
    this.debugger.step_manager.jumpNextBreakpoint();
  }

  stepJumpPreviousBreakpoint(): void {
    this.debugger.step_manager.jumpPreviousBreakpoint();
  }

  stepOverForward(solidityMode: any): void {
    this.debugger.step_manager.stepOverForward(solidityMode);
  }

  stepOverBack(solidityMode: any): void {
    this.debugger.step_manager.stepOverBack(solidityMode);
  }

  stepIntoForward(solidityMode: any): void {
    this.debugger.step_manager.stepIntoForward(solidityMode);
  }

  stepIntoBack(solidityMode: any): void {
    this.debugger.step_manager.stepIntoBack(solidityMode);
  }

  jumpTo(step: any): void {
    this.debugger.step_manager.jumpTo(step);
  }

  getTraceLength(): any {
    if (!this.debugger.step_manager) return 0;
    return this.debugger.step_manager.traceLength;
  }

  getCodeFirstStep(): any {
    if (!this.debugger.step_manager) return 0;
    return this.debugger.step_manager.calculateFirstStep();
  }

  getCodeTraceLength(): any {
    if (!this.debugger.step_manager) return 0;
    return this.debugger.step_manager.calculateCodeLength();
  }

  nextStep(): any {
    if (!this.debugger.step_manager) return 0;
    return this.debugger.step_manager.nextStep();
  }

  previousStep(): any {
    if (!this.debugger.step_manager) return 0;
    return this.debugger.step_manager.previousStep();
  }

  currentStep(): any {
    if (!this.debugger.step_manager) return 0;
    return this.debugger.step_manager.currentStepIndex;
  }

  canGoNext(): any {
    return this.currentStep() < this.getCodeTraceLength();
  }

  canGoPrevious(): any {
    return this.currentStep() > this.getCodeFirstStep();
  }

  unload(): any {
    return this.debugger.unload();
  }

  displayLocals(): void {
    console.dir("= displayLocals");
    console.dir(this.solidityLocals);
  }

  displayGlobals(): void {
    console.dir("= displayGlobals");
    console.dir(this.solidityState);
  }
}
