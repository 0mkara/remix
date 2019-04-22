import astHelper from "./astHelper";
import decodeInfo from "./decodeInfo";

/**
 * decode the contract state storage
 *
 * @param {Array} storage location  - location of all state variables
 * @param {Object} storageResolver  - resolve storage queries
 * @return {Map} - decoded state variable
 */
async function decodeState(
  stateVars: Array<any>,
  storageResolver: object
): Promise<any> {
  let ret = {};
  for (let k in stateVars) {
    let stateVar = stateVars[k];
    try {
      let decoded = await stateVar.type.decodeFromStorage(
        stateVar.storagelocation,
        storageResolver
      );
      decoded.constant = stateVar.constant;
      if (decoded.constant) {
        decoded.value = "<constant>";
      }
      ret[stateVar.name] = decoded;
    } catch (e) {
      console.log(e);
      ret[stateVar.name] = "<decoding failed - " + e.message + ">";
    }
  }
  return ret;
}

/**
 * return all storage location variables of the given @arg contractName
 *
 * @param {String} contractName  - name of the contract
 * @param {Object} sourcesList  - sources list
 * @return {Object} - return the location of all contract variables in the storage
 */
function extractStateVariables(contractName: string, sourcesList: object) {
  let states = astHelper.extractStatesDefinitions(sourcesList);
  if (!states[contractName]) {
    return [];
  }
  let types = states[contractName].stateVariables;
  let offsets = decodeInfo.computeOffsets(
    types,
    states,
    contractName,
    "storage"
  );
  if (!offsets) {
    return []; // TODO should maybe return an error
  }
  return offsets.typesOffsets;
}

/**
 * return the state of the given @a contractName as a json object
 *
 * @param {Object} storageResolver  - resolve storage queries
 * @param {astList} astList  - AST nodes of all the sources
 * @param {String} contractName  - contract for which state var should be resolved
 * @return {Map} - return the state of the contract
 */
async function solidityState(
  storageResolver: object,
  astList: any,
  contractName: string
): Promise<any> {
  let stateVars = extractStateVariables(contractName, astList);
  try {
    return await decodeState(stateVars, storageResolver);
  } catch (e) {
    return "<decoding failed - " + e.message + ">";
  }
}

export default {
  solidityState,
  extractStateVariables,
  decodeState
};
