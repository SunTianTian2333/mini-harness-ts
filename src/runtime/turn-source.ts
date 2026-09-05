export type TurnSource = "user" | "auto";

let currentTurnSource: TurnSource = "user";

export function setTurnSource(source: TurnSource): void {
  currentTurnSource = source;
}

export function getTurnSource(): TurnSource {
  return currentTurnSource;
}
