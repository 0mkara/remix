"use strict";
import remixLib from "remix-lib";
const SourceMappingDecoder = remixLib.SourceMappingDecoder;
const AstWalker = remixLib.AstWalker;
import EventManager from "./lib/events";
import globalRegistry from "./global/registry";
import { ContextNode } from "types";

class ContextualListener {
    currentPosition: any;
    currentFile: any;
    nodes: any;
    results: any;
  _stopHighlighting() {
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

  getActiveHighlights(): Array<any> {
    return [...this._activeHighlights];
  }

  declarationOf(node: ContextNode): any | null {
    if (node.attributes && node.attributes.referencedDeclaration) {
      return this._index["FlatReferences"][
        node.attributes.referencedDeclaration
      ];
    }
    return null;
  }

  referencesOf(node: ContextNode) {
    return this._index["Declarations"][node.id];
  }

  _highlightItems(cursorPosition: any, compilationResult: any, file: any): void {
    if (this.currentPosition === cursorPosition) return;
    if (this.currentFile !== file) {
      this.currentFile = file;
      this.currentPosition = cursorPosition;
      return;
    }
    this._stopHighlighting();
    this.currentPosition = cursorPosition;
    this.currentFile = file;
    if (
      compilationResult &&
      compilationResult.data &&
      compilationResult.data.sources[file]
    ) {
      var nodes = this.sourceMappingDecoder.nodesAtPosition(
        null,
        cursorPosition,
        compilationResult.data.sources[file]
      );
      this.nodes = nodes;
      if (nodes && nodes.length && nodes[nodes.length - 1]) {
        this._highlightExpressions(nodes[nodes.length - 1], compilationResult);
      }
      this.event.trigger("contextChanged", [nodes]);
    }
  }

  _buildIndex(compilationResult: any, source: any): void {
    if (compilationResult && compilationResult.sources) {
      var self = this;
      var callback = {};
      callback["*"] = function(node) {
        if (node && node.attributes && node.attributes.referencedDeclaration) {
          if (
            !self._index["Declarations"][node.attributes.referencedDeclaration]
          ) {
            self._index["Declarations"][
              node.attributes.referencedDeclaration
            ] = [];
          }
          self._index["Declarations"][
            node.attributes.referencedDeclaration
          ].push(node);
        }
        self._index["FlatReferences"][node.id] = node;
        return true;
      };
      for (var s in compilationResult.sources) {
        this.astWalker.walk(compilationResult.sources[s].legacyAST, callback);
      }
    }
  }

  _highlight(node: any, compilationResult: any) {
    if (!node) return;
    var self = this;
    var position = this.sourceMappingDecoder.decode(node.src);
    var eventId = this._highlightInternal(position, node);
    let lastCompilationResult = self._deps.compilersArtefacts["__last"];
    if (eventId && lastCompilationResult) {
      this._activeHighlights.push({
        eventId,
        position,
        fileTarget: lastCompilationResult.getSourceName(position.file),
        nodeId: node.id
      });
    }
  }


  _highlightInternal(position: any, node: any): any {
    var self = this;
    let lastCompilationResult = self._deps.compilersArtefacts["__last"];
    if (lastCompilationResult) {
      var lineColumn = self._deps.offsetToLineColumnConverter.offsetToLineColumn(
        position,
        position.file,
        lastCompilationResult.getSourceCode().sources,
        lastCompilationResult.getAsts()
      );
      var css = "highlightreference";
      if (node.children && node.children.length) {
        // If node has children, highlight the entire line. if not, just highlight the current source position of the node.
        css = "highlightreference";
        lineColumn = {
          start: {
            line: lineColumn.start.line,
            column: 0
          },
          end: {
            line: lineColumn.start.line + 1,
            column: 0
          }
        };
      }
      var fileName = lastCompilationResult.getSourceName(position.file);
      if (fileName) {
        return self.editor.addMarker(lineColumn, fileName, css);
      }
    }
    return null;
  }

  _highlightExpressions(node: any, compilationResult: any): void {
    var self = this;
    function highlights(id) {
      if (self._index["Declarations"] && self._index["Declarations"][id]) {
        var refs = self._index["Declarations"][id];
        for (var ref in refs) {
          var node = refs[ref];
          self._highlight(node, compilationResult);
        }
      }
    }
    if (node.attributes && node.attributes.referencedDeclaration) {
      highlights(node.attributes.referencedDeclaration);
      var current = this._index["FlatReferences"][
        node.attributes.referencedDeclaration
      ];
      this._highlight(current, compilationResult);
    } else {
      highlights(node.id);
      this._highlight(node, compilationResult);
    }
    this.results = compilationResult;
  }

}

export default ContextualListener;
