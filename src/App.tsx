import { useEffect, useReducer, useRef, useState, type Dispatch } from "react";
import {
  DISMISS_PRESETS,
  FRESHNESS_LIMIT_MINUTES,
  INITIAL_STATE,
  OTHER_MIN_LENGTH,
  SCENARIOS,
  SIMULATED_NOW,
  canDismiss,
  dismissReason,
  isStale,
  readiness,
  reducer,
  type Action,
  type Decision,
  type ReasonChoice,
  type Reading,
  type ScenarioId,
} from "./domain";

const SCENARIO_ANNOUNCEMENTS: Record<ScenarioId, string> = {
  fresh: "Fresh telemetry scenario. Review recommended: battery health concern detected.",
  stale: "Stale telemetry scenario. Battery data is out of date, so the readiness assessment is withheld.",
};

// Application-level navigation back to Raymond's portfolio; not part of the simulated workflow.
const PORTFOLIO_URL = "https://ayray.github.io/";

const DISCLAIMER =
  "Independent product concept inspired by public information. Simulated data. Not affiliated with Safire.";

export default function App() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [scenarioAnnouncement, setScenarioAnnouncement] = useState("");
  const reading = SCENARIOS[state.scenario];

  const setScenario = (scenario: ScenarioId) => {
    setEvidenceOpen(false);
    setScenarioAnnouncement(SCENARIO_ANNOUNCEMENTS[scenario]);
    dispatch({ type: "set-scenario", scenario });
  };
  const reset = () => {
    setEvidenceOpen(false);
    setScenarioAnnouncement(`Demo reset. ${SCENARIO_ANNOUNCEMENTS.fresh}`);
    dispatch({ type: "reset" });
  };

  return (
    <>
      <PresenterControls scenario={state.scenario} onScenario={setScenario} onReset={reset} />
      <p className="sr-only" aria-live="polite">
        {scenarioAnnouncement}
      </p>

      <header className="appbar">
        <div className="wrap appbar-row">
          <h1>
            Energy Readiness <span>Operator Decision Review</span>
          </h1>
          <div className="appbar-meta">
            <span className="pill">Concept · simulated data</span>
            <span className="clock">
              {SIMULATED_NOW} <span>simulated time</span>
            </span>
            <a className="back-link" href={PORTFOLIO_URL}>
              <span aria-hidden="true">← </span>Back to portfolio
            </a>
          </div>
        </div>
      </header>
      <p className="disclaimer">
        <span className="wrap">{DISCLAIMER}</span>
      </p>

      <main className="wrap">
        <p className="asset">
          <strong>{reading.asset}</strong> · Ground robot · Battery {reading.battery}
        </p>

        <div className="layout">
          <div className="primary">
            <StatusPanel reading={reading} decision={state.decision} />
            <DecisionSection reading={reading} decision={state.decision} dispatch={dispatch} />
            <Evidence reading={reading} open={evidenceOpen} onToggle={() => setEvidenceOpen((o) => !o)} />
          </div>
          <Telemetry reading={reading} />
        </div>
      </main>
    </>
  );
}

function PresenterControls({
  scenario,
  onScenario,
  onReset,
}: {
  scenario: ScenarioId;
  onScenario: (s: ScenarioId) => void;
  onReset: () => void;
}) {
  return (
    <section className="presenter" aria-label="Demo controls">
      <div className="wrap presenter-row">
        <span className="presenter-label">Presenter controls · not part of the concept</span>
        <fieldset className="scenario">
          <legend className="sr-only">Demo scenario</legend>
          {(["fresh", "stale"] as const).map((id) => (
            <label key={id}>
              <input type="radio" name="scenario" value={id} checked={scenario === id} onChange={() => onScenario(id)} />
              {id === "fresh" ? "Fresh telemetry" : "Stale telemetry"}
            </label>
          ))}
        </fieldset>
        <button type="button" className="btn btn-quiet" onClick={onReset}>
          Reset demo
        </button>
      </div>
    </section>
  );
}

function StatusPanel({ reading, decision }: { reading: Reading; decision: Decision }) {
  let tone: string, shape: string, label: string, headline: string, detail: string;

  if (decision.kind === "inspection-requested") {
    tone = "escalated";
    shape = "■";
    label = "Inspection requested";
    headline = "Escalated for review.";
    detail = "Readiness stays unresolved until the review is complete.";
  } else if (decision.kind === "dismissed") {
    tone = "dismissed";
    shape = "✓";
    label = "Concern dismissed: not a deployment authorization";
    headline = "Warning closed.";
    detail = `Follow your normal release procedure for ${reading.asset}.`;
  } else if (isStale(reading)) {
    tone = "stale";
    shape = "◌";
    label = "Cannot assess: data out of date";
    headline = "Current readiness assessment withheld.";
    detail = `The latest battery data is ${reading.ageMinutes} minutes old, so a fresh readiness assessment isn't possible. Get updated telemetry, or follow your local manual check procedure.`;
  } else {
    tone = "review";
    shape = "▲";
    label = "Review recommended";
    headline = "Battery health concern detected\u00a0— review before deployment.";
    detail = "Based on a simulated health flag from the last update. This is not a verified diagnosis.";
  }

  return (
    <section className={`status status-${tone}`} aria-labelledby="status-label">
      <p id="status-label" className="status-label">
        <span aria-hidden="true" className="shape">
          {shape}
        </span>
        {label}
      </p>
      <h2 className="status-headline">{headline}</h2>
      <p className="status-detail">{detail}</p>
    </section>
  );
}

function Telemetry({ reading }: { reading: Reading }) {
  const stale = isStale(reading);

  return (
    <section aria-labelledby="telemetry-heading" className={`telemetry${stale ? " is-historical" : ""}`}>
      <div className="telemetry-head">
        <h2 id="telemetry-heading" className="panel-heading">
          Battery telemetry · {reading.battery}
        </h2>
        <span className={`pill${stale ? " pill-historical" : ""}`}>
          {stale ? `Historical readings · ${reading.ageMinutes} min old` : "Current readings"}
        </span>
      </div>

      <div className="card">
        <p className="card-label">
          Health flag <span className="pill">Mock</span>
        </p>
        {stale ? (
          <p className="card-value">
            Last known: <span aria-hidden="true">▲ </span>
            {reading.healthFlag}
          </p>
        ) : (
          <p className="card-value transition">
            <span className="chip chip-from">{reading.previousHealthFlag}</span>
            <span aria-hidden="true" className="arrow">
              →
            </span>
            <span className="sr-only">changed to</span>
            <span className="chip chip-to">
              <span aria-hidden="true">▲ </span>
              {reading.healthFlag}
            </span>
          </p>
        )}
        <p className="card-note">{stale ? `Reported at ${reading.lastUpdate}.` : "Changed at the last update."}</p>
      </div>

      <div className="card">
        <p className="card-label">State of charge</p>
        <p className="card-value">
          {stale ? "Last known: " : ""}
          {reading.stateOfCharge}%
        </p>
        <div className="meter" aria-hidden="true">
          <span style={{ width: `${reading.stateOfCharge}%` }} />
        </div>
        <p className="card-note">{stale ? `Reported at ${reading.lastUpdate}.` : "Sufficient charge; not the concern."}</p>
      </div>

      <div className="card card-age">
        <p className="card-label">Data age</p>
        <p className="card-value">
          <span aria-hidden="true" className="age-dot">
            {stale ? "◌" : "●"}
          </span>{" "}
          {reading.ageMinutes} min ago
        </p>
        <p className="card-note">
          {stale ? "Stale: older than" : "Fresh: within"} the {FRESHNESS_LIMIT_MINUTES}-minute limit, a proposed concept
          policy. Updated {reading.lastUpdate}.
        </p>
      </div>
    </section>
  );
}

function Evidence({ reading, open, onToggle }: { reading: Reading; open: boolean; onToggle: () => void }) {
  const stale = isStale(reading);
  const content = stale
    ? {
        hint: "Why the assessment is withheld, what the last data showed, and its limits",
        trigger: `Freshness check (proposed concept policy): when the latest battery data is more than ${FRESHNESS_LIMIT_MINUTES} minutes old, the readiness assessment is withheld and the concern can't be dismissed. You can still request an inspection.`,
        establishes: `At ${reading.lastUpdate} (${reading.ageMinutes} min ago), the battery system reported a ${reading.healthFlag} health flag and ${reading.stateOfCharge}% charge.`,
        doesNot: "The battery's current condition. Whether the flag has cleared or worsened. Whether the robot is ready now.",
        limitations: `The ${FRESHNESS_LIMIT_MINUTES}-minute limit is a proposed concept policy that needs customer validation, not a Safire standard.`,
      }
    : {
        hint: "Why this was flagged, what the data shows, and its limits",
        trigger:
          "Review check (proposed concept policy, mock data): when the battery system reports a health flag of Watch or worse, a review is recommended before deployment.",
        establishes: `At ${reading.lastUpdate} (${reading.ageMinutes} min ago), the health flag changed from ${reading.previousHealthFlag} to ${reading.healthFlag}. Charge is ${reading.stateOfCharge}%.`,
        doesNot: "The cause. Whether the battery will fail. How long it will last. That the robot is unsafe.",
        limitations: "The flag and rule are mock data and proposed product policy, not a Safire diagnostic or standard.",
      };

  return (
    <section className="evidence" aria-label="Evidence">
      <button type="button" className="disclosure" aria-expanded={open} aria-controls="evidence-panel" aria-describedby="evidence-hint" onClick={onToggle}>
        <span aria-hidden="true" className="disclosure-icon">
          {open ? "▾" : "▸"}
        </span>
        <span className="disclosure-text">
          <span className="disclosure-title">{open ? "Hide supporting evidence" : "Review supporting evidence"}</span>
          <span className="disclosure-hint" id="evidence-hint" aria-hidden="true">{content.hint}</span>
        </span>
      </button>
      <div id="evidence-panel" className="evidence-panel" hidden={!open}>
        <dl>
          <div className="evidence-row">
            <dt>What triggered this</dt>
            <dd>{content.trigger}</dd>
          </div>
        </dl>
        <div className="evidence-split">
          <dl className="evidence-col evidence-yes">
            <dt>
              <span aria-hidden="true">✓ </span>What this establishes
            </dt>
            <dd>{content.establishes}</dd>
          </dl>
          <dl className="evidence-col evidence-no">
            <dt>
              <span aria-hidden="true">✕ </span>What this does not establish
            </dt>
            <dd>{content.doesNot}</dd>
          </dl>
        </div>
        <dl className="evidence-limits">
          <dt>Limitations</dt>
          <dd>{content.limitations}</dd>
        </dl>
      </div>
    </section>
  );
}

function DecisionSection({
  reading,
  decision,
  dispatch,
}: {
  reading: Reading;
  decision: Decision;
  dispatch: Dispatch<Action>;
}) {
  const outcomeRef = useRef<HTMLHeadingElement>(null);
  const dismissRef = useRef<HTMLButtonElement>(null);
  const previous = useRef(decision.kind);

  useEffect(() => {
    if (decision.kind === "inspection-requested" || decision.kind === "dismissed") outcomeRef.current?.focus();
    if (decision.kind === "none" && previous.current === "dismissing") dismissRef.current?.focus();
    previous.current = decision.kind;
  }, [decision.kind]);

  if (readiness(reading) === "no-concern") return null;

  const announcement =
    decision.kind === "inspection-requested"
      ? "Inspection requested. Escalated for review."
      : decision.kind === "dismissed"
        ? "Concern dismissed. This is not a deployment authorization."
        : "";

  return (
    <section className="decision" aria-labelledby="decision-heading">
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      {decision.kind === "inspection-requested" || decision.kind === "dismissed" ? (
        <>
          <h2 id="decision-heading" className="panel-heading" ref={outcomeRef} tabIndex={-1}>
            Latest decision
          </h2>
          <DecisionRecord decision={decision} reading={reading} />
          <p className="sim-note">Simulated: nothing was sent, and no system or equipment was changed.</p>
        </>
      ) : (
        <>
          <h2 id="decision-heading" className="panel-heading">
            Your decision
          </h2>
          {decision.kind === "dismissing" ? (
            <DismissForm
              onCancel={() => dispatch({ type: "cancel-dismiss" })}
              onConfirm={(reason) => dispatch({ type: "confirm-dismiss", reason })}
            />
          ) : (
            <>
              <div className="actions">
                <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "request-inspection" })}>
                  Request Inspection
                </button>
                <button
                  type="button"
                  ref={dismissRef}
                  className="btn btn-secondary"
                  disabled={!canDismiss(reading)}
                  aria-describedby={canDismiss(reading) ? undefined : "dismiss-blocked"}
                  onClick={() => dispatch({ type: "start-dismiss" })}
                >
                  Dismiss Concern…
                </button>
              </div>
              {canDismiss(reading) ? (
                <p className="help">
                  Requesting an inspection escalates this for review. Dismissing closes the warning with a reason.
                  Neither one authorizes deployment.
                </p>
              ) : (
                <p className="help help-blocked" id="dismiss-blocked">
                  Dismissing needs battery data from the last {FRESHNESS_LIMIT_MINUTES} minutes (a proposed concept
                  policy). You can still request an inspection.
                </p>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

function DecisionRecord({ decision, reading }: { decision: Extract<Decision, { at: string }>; reading: Reading }) {
  // A scenario switch clears the decision, so the current reading is the one decided on.
  const concern = `${isStale(reading) ? "Last known health flag" : "Health flag"} ${reading.healthFlag} (mock) · data ${reading.ageMinutes} min old`;
  const rows: [string, string][] =
    decision.kind === "inspection-requested"
      ? [
          ["Action", "Inspection requested"],
          ["Concern", concern],
          ["Time", `${decision.at} (simulated time)`],
          ["Status", "Open: awaiting review"],
          ...(decision.dataWasStale ? ([["Note", "Requested while battery data was out of date"]] as [string, string][]) : []),
        ]
      : [
          ["Action", "Concern dismissed"],
          ["Concern", concern],
          ["Time", `${decision.at} (simulated time)`],
          ["Reason", decision.reason],
          ["Status", "Closed · not a deployment authorization"],
        ];
  return (
    <dl className="record">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function DismissForm({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: (reason: string) => void }) {
  const [choice, setChoice] = useState<ReasonChoice | null>(null);
  const [otherText, setOtherText] = useState("");
  const reason = dismissReason(choice, otherText);
  const choices: ReasonChoice[] = [...DISMISS_PRESETS, "Other"];
  const otherLength = otherText.trim().length;
  const blocker =
    choice === null
      ? "Choose a reason to confirm."
      : !reason
        ? `Describe the reason in at least ${OTHER_MIN_LENGTH} characters to confirm.`
        : null;

  return (
    <form
      className="dismiss-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (reason) onConfirm(reason);
      }}
    >
      <fieldset>
        <legend>Why are you dismissing this concern? (required)</legend>
        {choices.map((c, i) => (
          <label key={c} className="choice">
            <input type="radio" name="reason" value={c} checked={choice === c} autoFocus={i === 0} onChange={() => setChoice(c)} />
            {c}
          </label>
        ))}
        {choice === "Other" && (
          <label className="other">
            <span>Describe the reason (at least {OTHER_MIN_LENGTH} characters)</span>
            <input type="text" value={otherText} aria-describedby="other-count" onChange={(e) => setOtherText(e.target.value)} />
            <span id="other-count" className={`count${otherLength >= OTHER_MIN_LENGTH ? " count-ok" : ""}`}>
              {otherLength >= OTHER_MIN_LENGTH ? "Minimum length met" : `${otherLength} of ${OTHER_MIN_LENGTH} characters minimum`}
            </span>
          </label>
        )}
      </fieldset>
      <p className="help">Dismissing closes this warning. It does not authorize deployment. Follow your normal release procedure.</p>
      <div className="actions">
        <button type="submit" className="btn btn-primary" aria-disabled={!reason} aria-describedby={blocker ? "confirm-blocker" : undefined}>
          Confirm dismissal
        </button>
        <button type="button" className="btn btn-quiet" onClick={onCancel}>
          Cancel
        </button>
        {blocker && (
          <p className="confirm-blocker" id="confirm-blocker">
            {blocker}
          </p>
        )}
      </div>
    </form>
  );
}
