import remixLib from "remix-lib";

const EventManager = remixLib.EventManager;
const executionContext = remixLib.execution.executionContext;
const Web3Providers = remixLib.vm.Web3Providers;
const DummyProvider = remixLib.vm.DummyProvider;
const init = remixLib.init;

export default class ContextManager {
  executionContext: any;
  web3: any;
  event: any;
  web3Providers: any;

  constructor() {
    this.executionContext = executionContext;
    this.web3 = this.executionContext.web3();
    this.event = new EventManager();
  }

  initProviders(): void {
    this.web3Providers = new Web3Providers();
    this.addProvider("DUMMYWEB3", new DummyProvider());
    this.switchProvider("DUMMYWEB3");

    this.addProvider("vm", this.executionContext.vm());
    this.addProvider("injected", this.executionContext.internalWeb3());
    this.addProvider("web3", this.executionContext.internalWeb3());
    this.switchProvider(this.executionContext.getProvider());
  }

  getWeb3(): any {
    return this.web3;
  }

  addProvider(type: any, obj: object): void {
    this.web3Providers.addProvider(type, obj);
    this.event.trigger("providerAdded", [type]);
  }

  switchProvider(type: any, cb?: Function) {
    var self = this;
    this.web3Providers.get(type, function(error: Error, obj: object) {
      if (error) {
        // console.log('provider ' + type + ' not defined')
      } else {
        self.web3 = obj;
        self.executionContext.detectNetwork((error, network) => {
          if (error || !network) {
            self.web3 = obj;
          } else {
            var webDebugNode = init.web3DebugNode(network.name);
            self.web3 = !webDebugNode ? obj : webDebugNode;
          }
          self.event.trigger("providerChanged", [type, self.web3]);
          if (cb) return cb();
        });
        self.event.trigger("providerChanged", [type, self.web3]);
      }
    });
  }
}
