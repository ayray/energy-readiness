import { describe, expect, it } from "vitest";
import {
  INITIAL_STATE,
  SCENARIOS,
  canDismiss,
  dismissReason,
  readiness,
  reducer,
  type Action,
  type State,
} from "./domain";

const run = (actions: Action[], from: State = INITIAL_STATE) => actions.reduce(reducer, from);

describe("review check, freshness check, and action rules", () => {
  it("review check: a Watch health flag on fresh data recommends review", () => {
    expect(readiness(SCENARIOS.fresh)).toBe("review-recommended");
  });

  it("freshness check: stale data withholds the assessment even though the flag is Watch", () => {
    expect(readiness(SCENARIOS.stale)).toBe("cannot-assess");
  });

  it("freshness boundary: exactly 15 minutes is still fresh, 16 is stale", () => {
    expect(readiness({ ...SCENARIOS.fresh, ageMinutes: 15 })).toBe("review-recommended");
    expect(readiness({ ...SCENARIOS.fresh, ageMinutes: 16 })).toBe("cannot-assess");
  });

  it("action rule: dismissal is allowed on fresh data only", () => {
    expect(canDismiss(SCENARIOS.fresh)).toBe(true);
    expect(canDismiss(SCENARIOS.stale)).toBe(false);
  });
});

describe("dismissal reasons (AC-05)", () => {
  it("requires a choice", () => {
    expect(dismissReason(null, "")).toBeNull();
  });
  it("accepts either preset", () => {
    expect(dismissReason("Concern already addressed", "")).toBe("Concern already addressed");
    expect(dismissReason("Reviewed; no further action needed", "")).toBe("Reviewed; no further action needed");
  });
  it("requires at least 5 non-space characters for Other", () => {
    expect(dismissReason("Other", "  abcd  ")).toBeNull();
    expect(dismissReason("Other", " abcde ")).toBe("Other: abcde");
  });
});

describe("reducer", () => {
  it("records an inspection request on fresh data", () => {
    const s = run([{ type: "request-inspection" }]);
    expect(s.decision).toEqual({ kind: "inspection-requested", at: "09:41", dataWasStale: false });
  });

  it("records a dismissal with its reason", () => {
    const s = run([{ type: "start-dismiss" }, { type: "confirm-dismiss", reason: "Concern already addressed" }]);
    expect(s.decision).toEqual({ kind: "dismissed", at: "09:41", reason: "Concern already addressed" });
  });

  it("refuses a dismissal without a reason", () => {
    const s = run([{ type: "start-dismiss" }, { type: "confirm-dismiss", reason: "  " }]);
    expect(s.decision.kind).toBe("dismissing");
  });

  it("cancel returns to no decision (AC-07)", () => {
    expect(run([{ type: "start-dismiss" }, { type: "cancel-dismiss" }]).decision.kind).toBe("none");
  });

  it("blocks dismissal when stale but allows inspection (AC-09)", () => {
    const stale = run([{ type: "set-scenario", scenario: "stale" }]);
    expect(run([{ type: "start-dismiss" }], stale).decision.kind).toBe("none");
    expect(run([{ type: "confirm-dismiss", reason: "x" }], { ...stale, decision: { kind: "dismissing" } }).decision.kind).toBe(
      "dismissing",
    );
    expect(run([{ type: "request-inspection" }], stale).decision).toEqual({
      kind: "inspection-requested",
      at: "09:41",
      dataWasStale: true,
    });
  });

  it("a recorded decision cannot be overwritten", () => {
    const s = run([{ type: "request-inspection" }, { type: "start-dismiss" }, { type: "confirm-dismiss", reason: "x" }]);
    expect(s.decision.kind).toBe("inspection-requested");
  });

  it("switching scenario clears the decision; reset restores the initial state (AC-10)", () => {
    const decided = run([{ type: "request-inspection" }]);
    expect(run([{ type: "set-scenario", scenario: "stale" }], decided)).toEqual({
      scenario: "stale",
      decision: { kind: "none" },
    });
    expect(run([{ type: "set-scenario", scenario: "stale" }, { type: "request-inspection" }, { type: "reset" }])).toEqual(
      INITIAL_STATE,
    );
  });
});
