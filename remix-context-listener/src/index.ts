"use strict";
import remixLib from "remix-lib";
const SourceMappingDecoder = remixLib.SourceMappingDecoder;
const AstWalker = remixLib.AstWalker;
import EventManager from "../../lib/events";
import globalRegistry from "../../global/registry";

class ContextualListener {
  _stopHighlighting() {
    throw new Error("Method not implemented.");
  }
  _buildIndex(data: any, source: any) {
    throw new Error("Method not implemented.");
  }
  _highlightItems(arg0: any, arg1: any, arg2: any) {
    throw new Error("Method not implemented.");
  }
  _components: {
    registry?: any;
  };
  event: any;
  editor: any;
  pluginManager: any;
  _deps: {
    compilersArtefacts: any;
    config: any;
    offsetToLineColumnConverter: any;
  };
  _index: { Declarations: {}; FlatReferences: {} };
  _activeHighlights: any[];
  sourceMappingDecoder: any;
  astWalker: any;

  constructor(opts: Object | any, localRegistry: Object | any) {
    var self = this;
    this.event = new EventManager();
    self._components = {};
    self._components.registry = localRegistry || globalRegistry;
    self.editor = opts.editor;
    self.pluginManager = opts.pluginManager;
    self._deps = {
      compilersArtefacts: self._components.registry.get("compilersartefacts")
        .api,
      config: self._components.registry.get("config").api,
      offsetToLineColumnConverter: self._components.registry.get(
        "offsettolinecolumnconverter"
      ).api
    };
    this._index = {
      Declarations: {},
      FlatReferences: {}
    };
    this._activeHighlights = [];

    self.pluginManager.event.register(
      "sendCompilationResult",
      (file, source, languageVersion, data) => {
        this._stopHighlighting();
        this._index = {
          Declarations: {},
          FlatReferences: {}
        };
        this._buildIndex(data, source);
      }
    );

    self.editor.event.register("contentChanged", () => {
      this._stopHighlighting();
    });

    this.sourceMappingDecoder = new SourceMappingDecoder();
    this.astWalker = new AstWalker();
    setInterval(() => {
      if (self._deps.compilersArtefacts["__last"]) {
        this._highlightItems(
          self.editor.getCursorPosition(),
          self._deps.compilersArtefacts["__last"],
          self._deps.config.get("currentFile")
        );
      }
    }, 1000);
  }
}

export default ContextualListener;
