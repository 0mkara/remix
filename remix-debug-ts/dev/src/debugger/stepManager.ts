import remixLib from 'remix-lib';
const EventManager = remixLib.EventManager
const util = remixLib.util

export default class DebuggerStepManager {
  event: any;
  debugger: any;
  traceManager: any;
  currentStepIndex: number;
  traceLength: number;
  codeTraceLength: number;
  revertionPoint: any;
  currentCall: any;

  constructor(_debugger, traceManager) {
    this.event = new EventManager()
    this.debugger = _debugger
    this.traceManager = traceManager
    this.currentStepIndex = 0
    this.traceLength = 0
    this.codeTraceLength = 0
    this.revertionPoint = null

    this.listenToEvents()
  }

  listenToEvents(): void {
    const self = this

    this.debugger.event.register('newTraceLoaded', this, function (): any {
      self.traceManager.getLength(function (error: Error, newLength: number): any {
        if (error) {
          return console.log(error)
        }
        if (self.traceLength !== newLength) {
          self.event.trigger('traceLengthChanged', [newLength])
          self.traceLength = newLength
          self.codeTraceLength = self.calculateCodeLength()
        }
        self.jumpTo(0)
      })
    })

    this.debugger.callTree.event.register('callTreeReady', (): void => {
      if (self.debugger.callTree.functionCallStack.length) {
        self.jumpTo(self.debugger.callTree.functionCallStack[0])
      }
    })

    this.event.register('indexChanged', this, (index: number): any => {
      if (index < 0) return
      if (self.currentStepIndex !== index) return

      self.traceManager.buildCallPath(index, (error, callsPath) => {
        if (error) {
          console.log(error)
          return self.event.trigger('revertWarning', [''])
        }
        self.currentCall = callsPath[callsPath.length - 1]
        if (self.currentCall.reverted) {
          let revertedReason = self.currentCall.outofgas ? 'outofgas' : ''
          self.revertionPoint = self.currentCall.return
          return self.event.trigger('revertWarning', [revertedReason])
        }
        for (let k = callsPath.length - 2; k >= 0; k--) {
          let parent = callsPath[k]
          if (!parent.reverted) continue
          self.revertionPoint = parent.return
          self.event.trigger('revertWarning', ['parenthasthrown'])
        }
        self.event.trigger('revertWarning', [''])
      })
    })
  }

  triggerStepChanged(step: number): void {
    const self = this
    this.traceManager.getLength(function (error, length) {
      let stepState = 'valid'

      if (error) {
        stepState = 'invalid'
      } else if (step <= 0) {
        stepState = 'initial'
      } else if (step >= length - 1) {
        stepState = 'end'
      }

      let jumpOutDisabled = (step === self.traceManager.findStepOut(step))

      self.event.trigger('stepChanged', [step, stepState, jumpOutDisabled])
    })
  }

  stepIntoBack(solidityMode: any): null {
    if (!this.traceManager.isLoaded()) return
    let step = this.currentStepIndex - 1
    this.currentStepIndex = step
    if (solidityMode) {
      step = this.resolveToReducedTrace(step, -1)
    }
    if (!this.traceManager.inRange(step)) {
      return
    }
    this.event.trigger('stepChanged', [step])
  }

  stepIntoForward(solidityMode: any): null {
    if (!this.traceManager.isLoaded()) return
    let step = this.currentStepIndex + 1
    this.currentStepIndex = step
    if (solidityMode) {
      step = this.resolveToReducedTrace(step, 1)
    }
    if (!this.traceManager.inRange(step)) {
      return
    }
    this.event.trigger('stepChanged', [step])
  }

  stepOverBack(solidityMode: any): void {
    if (!this.traceManager.isLoaded()) return
    let step = this.traceManager.findStepOverBack(this.currentStepIndex)
    if (solidityMode) {
      step = this.resolveToReducedTrace(step, -1)
    }
    this.currentStepIndex = step
    this.event.trigger('stepChanged', [step])
  }

  stepOverForward(solidityMode: any): void {
    if (!this.traceManager.isLoaded()) return
    var step = this.traceManager.findStepOverForward(this.currentStepIndex)
    if (solidityMode) {
      step = this.resolveToReducedTrace(step, 1)
    }
    this.currentStepIndex = step
    this.event.trigger('stepChanged', [step])
  }

  jumpOut(solidityMode: any): void {
    if (!this.traceManager.isLoaded()) return
    var step = this.traceManager.findStepOut(this.currentStepIndex)
    if (solidityMode) {
      step = this.resolveToReducedTrace(step, 0)
    }
    this.currentStepIndex = step
    this.event.trigger('stepChanged', [step])
  }

  jumpTo(step: number): void {
    if (!this.traceManager.inRange(step)) return
    this.currentStepIndex = step
    this.event.trigger('stepChanged', [step])
  }

  jumpToException(): void {
    this.jumpTo(this.revertionPoint)
  }

  jumpNextBreakpoint(): void {
    this.debugger.breakpointManager.jumpNextBreakpoint(this.currentStepIndex, true)
  }

  jumpPreviousBreakpoint(): void {
    this.debugger.breakpointManager.jumpPreviousBreakpoint(this.currentStepIndex, true)
  }

  calculateFirstStep(): any {
    let step = this.resolveToReducedTrace(0, 1)
    return this.resolveToReducedTrace(step, 1)
  }

  calculateCodeStepList(): Array<number> {
    let step = 0
    let steps = []
    while (step < this.traceLength) {
      let _step = this.resolveToReducedTrace(step, 1)
      if (!_step) break
      steps.push(_step)
      step += 1
    }
    steps = steps.filter((item, pos, self) => { return steps.indexOf(item) === pos })
    return steps
  }

  calculateCodeLength(): any {
    this.calculateCodeStepList().reverse()
    return this.calculateCodeStepList().reverse()[1] || this.traceLength
  }

  nextStep(): any {
    return this.resolveToReducedTrace(this.currentStepIndex, 1)
  }

  previousStep(): any {
    return this.resolveToReducedTrace(this.currentStepIndex, -1)
  }

  resolveToReducedTrace(value: number, incr: number): any {
    if (this.debugger.callTree.reducedTrace.length) {
      let nextSource = util.findClosestIndex(value, this.debugger.callTree.reducedTrace)
      nextSource = nextSource + incr
      if (nextSource <= 0) {
        nextSource = 0
      } else if (nextSource > this.debugger.callTree.reducedTrace.length) {
        nextSource = this.debugger.callTree.reducedTrace.length - 1
      }
      return this.debugger.callTree.reducedTrace[nextSource]
    }
    return value
  }

}

