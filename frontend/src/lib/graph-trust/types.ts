export type GraphTier = "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";

export type GraphTrustState = "indexed" | "sparse" | "not_found";

export type GraphResultType = "path" | "global_only" | "not_found";

export interface GraphRelationship {
  entity: string;
  relation: string;
}

export interface PathTrust {
  score: number;
  pathCount: number;
  sources: string[];
}

export interface GlobalStanding {
  composite: number;
  confidence: number;
  verdict: string;
}

export interface GraphTrust {
  address: string;
  graphScore: number;
  graphTier: GraphTier;
  attestationCount: number;
  endorsements: number;
  connectedEntities: number;
  topRelationships?: GraphRelationship[];
  state: GraphTrustState;
  pathTrust: PathTrust | null;
  globalStanding: GlobalStanding | null;
  resultType: GraphResultType;
  explainer: string;
}