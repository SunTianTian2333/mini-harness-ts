export type UserHarnessEvent = {
  type: "user";
  query: string;
};

export type BackgroundHarnessEvent = {
  type: "background";
};

export type HarnessEvent = UserHarnessEvent | BackgroundHarnessEvent;
