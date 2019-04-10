export interface ContextNode {
  src?: any;
  id?: any;
  attributes: {
    referencedDeclaration: any;
  };
}

// export interface ContextualListenerType {
//     currentPosition: any;
//     currentFile: any;
//     nodes: any;
//     _components: { registry?: any; };
//     event: any;
//     editor: any;
//     pluginManager: any;
//     _deps: { compilersArtefacts: any; config: any; offsetToLineColumnConverter: any; };
//     _index: { Declarations: {}; FlatReferences: {}; };
//     _activeHighlights: any[];
//     sourceMappingDecoder: any;
//     astWalker: any;
// }
