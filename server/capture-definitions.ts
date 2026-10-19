import type { EvaluationContract } from '../shared/evaluation.ts';
import { CAPTURE_DEFINITIONS_VERSION, captureDefinitionsSchema } from '../shared/capture-definitions.ts';
import { digest } from './evaluation.ts';

/** Reader projection: no private evaluation settings or author/history fields. */
export function captureDefinitions(contract: EvaluationContract) {
  const projection = { version: CAPTURE_DEFINITIONS_VERSION, kind: contract.kind,
    profileVersion: contract.profileVersion, definitionVersion: contract.definitionVersion,
    settingsRevision: contract.settingsRevision,
    measures: contract.criteria.map(m => ({ id: m.id, label: m.label, area: m.area, enabled: m.weight > 0,
      requirements: (m.requirements || []).map(r => ({ id: r.id, proposition: r.proposition })),
    })),
  };
  return captureDefinitionsSchema.parse({ ...projection, id: digest(projection) });
}
