// Penetration module (refactored): re-export public API from submodules
// This thin wrapper keeps backward compatibility with existing imports:
//   import { loadPenetration } from "./modules/penetration.js";
export {
  buildGraphFromLayersAndPenetration,
  renderPenetrationGraph,
  loadPenetration,
} from "./penetration/index.js";
