// Simulated data and the concept's mock checks. Every value here is fictional; the checks are proposed
// concept policies, not Safire standards.

export type ScenarioId = "fresh" | "stale";
export type HealthFlag = "Normal" | "Watch";

export interface Reading {
  asset: string;
  battery: string;
  stateOfCharge: number;
  healthFlag: HealthFlag;
  previousHealthFlag: HealthFlag;
  lastUpdate: string;
  ageMinutes: number;
}

export const SIMULATED_NOW = "09:41";
export const FRESHNESS_LIMIT_MINUTES = 15;

export const SCENARIOS: Record<ScenarioId, Reading> = {
  fresh: {
    asset: "UGV-012",
    battery: "BAT-001",
    stateOfCharge: 81,
    healthFlag: "Watch",
    previousHealthFlag: "Normal",
    lastUpdate: "09:38",
    ageMinutes: 3,
  },
  stale: {
    asset: "UGV-012",
    battery: "BAT-001",
    stateOfCharge: 81,
    healthFlag: "Watch",
    previousHealthFlag: "Normal",
    lastUpdate: "08:59",
    ageMinutes: 42,
  },
};

export const isStale = (r: Reading) => r.ageMinutes > FRESHNESS_LIMIT_MINUTES;

export type Readiness = "review-recommended" | "cannot-assess" | "no-concern";

// The freshness check overrides the review check.
export function readiness(r: Reading): Readiness {
  if (isStale(r)) return "cannot-assess";
  if (r.healthFlag !== "Normal") return "review-recommended";
  return "no-concern";
}

// Action rule: dismissal requires fresh data.
export const canDismiss = (r: Reading) => !isStale(r);

export const DISMISS_PRESETS = [
  "Concern already addressed",
  "Reviewed; no further action needed",
] as const;

export const OTHER_MIN_LENGTH = 5;

export type ReasonChoice = (typeof DISMISS_PRESETS)[number] | "Other";

export function dismissReason(choice: ReasonChoice | null, otherText: string): string | null {
  if (choice === null) return null;
  if (choice !== "Other") return choice;
  const text = otherText.trim();
  return text.length >= OTHER_MIN_LENGTH ? `Other: ${text}` : null;
}

export type Decision =
  | { kind: "none" }
  | { kind: "dismissing" }
  | { kind: "inspection-requested"; at: string; dataWasStale: boolean }
  | { kind: "dismissed"; at: string; reason: string };

export interface State {
  scenario: ScenarioId;
  decision: Decision;
}

export type Action =
  | { type: "set-scenario"; scenario: ScenarioId }
  | { type: "reset" }
  | { type: "request-inspection" }
  | { type: "start-dismiss" }
  | { type: "cancel-dismiss" }
  | { type: "confirm-dismiss"; reason: string };

export const INITIAL_STATE: State = { scenario: "fresh", decision: { kind: "none" } };

export function reducer(state: State, action: Action): State {
  const reading = SCENARIOS[state.scenario];
  const open = state.decision.kind === "none" || state.decision.kind === "dismissing";
  switch (action.type) {
    case "reset":
      return INITIAL_STATE;
    case "set-scenario":
      return { scenario: action.scenario, decision: { kind: "none" } };
    case "request-inspection":
      if (!open || readiness(reading) === "no-concern") return state;
      return {
        ...state,
        decision: { kind: "inspection-requested", at: SIMULATED_NOW, dataWasStale: isStale(reading) },
      };
    case "start-dismiss":
      if (state.decision.kind !== "none" || !canDismiss(reading)) return state;
      return { ...state, decision: { kind: "dismissing" } };
    case "cancel-dismiss":
      if (state.decision.kind !== "dismissing") return state;
      return { ...state, decision: { kind: "none" } };
    case "confirm-dismiss":
      if (state.decision.kind !== "dismissing" || !canDismiss(reading) || !action.reason.trim()) {
        return state;
      }
      return { ...state, decision: { kind: "dismissed", at: SIMULATED_NOW, reason: action.reason } };
  }
}
