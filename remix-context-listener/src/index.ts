"use strict";
import remixLib from "remix-lib";
const SourceMappingDecoder = remixLib.SourceMappingDecoder;
const AstWalker = remixLib.AstWalker;
import EventManager from "../../lib/events";
import globalRegistry from "../../global/registry";

class ContextualListener {
  constructor(opts, localRegistry) {
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
