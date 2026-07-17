export function hasDisplayScore(...values: readonly (number | null | undefined)[]) {
  return values.some((value) => typeof value === "number" && Number.isFinite(value));
}

export function providerPhasePresentation(phase: string | null | undefined) {
  if (!phase || phase.toUpperCase() === "UNKNOWN") return "Phase not supplied";
  return sentenceCase(phase);
}

export function providerActionPresentation(action: string | null | undefined) {
  if (!action || action.toLowerCase() === "unknown") return "Action not classified";
  if (action === "game_finalised") return "Full time";
  if (action === "score_changed") return "Score update";
  return sentenceCase(action);
}

function sentenceCase(value: string) {
  const readable = value.replaceAll("_", " ").toLowerCase();
  return readable.charAt(0).toUpperCase() + readable.slice(1);
}

export function observationPresentation(
  input: Readonly<{
    homeTeam: string;
    awayTeam: string;
    participant1IsHome: boolean;
    participant1Goals: number | null;
    participant2Goals: number | null;
    phase: string;
    action: string;
    finalised: boolean;
    authoritative: boolean;
    sequence?: number;
  }>,
) {
  const homeGoals = input.participant1IsHome ? input.participant1Goals : input.participant2Goals;
  const awayGoals = input.participant1IsHome ? input.participant2Goals : input.participant1Goals;
  const score = hasDisplayScore(homeGoals, awayGoals)
    ? `${input.homeTeam} ${homeGoals ?? "–"}–${awayGoals ?? "–"} ${input.awayTeam}`
    : `${input.homeTeam} vs ${input.awayTeam}`;
  const action = providerActionPresentation(input.action);
  const usefulAction = action !== "Action not classified" ? action : null;
  const phase = providerPhasePresentation(input.phase);
  const usefulPhase = phase !== "Phase not supplied" ? phase : null;
  return {
    title: input.authoritative
      ? "Authoritative final observation"
      : input.sequence === 963
        ? "Later non-authoritative update"
        : input.finalised
          ? "Final observation"
          : "Stored match update",
    fanLabel: input.finalised ? "Full time" : (usefulAction ?? usefulPhase ?? "Match update"),
    score,
    authorityLabel: input.authoritative ? "Verified final update" : null,
    technicalSummary: input.authoritative
      ? `${usefulAction ?? usefulPhase ?? "Match update"} · ${score}`
      : `${phase} · ${action.charAt(0).toLowerCase()}${action.slice(1)} · score values ${homeGoals ?? "–"}–${awayGoals ?? "–"}`,
  };
}
