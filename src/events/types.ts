export type UserHarnessEvent = {
  type: "user";
  query: string;
};

export type BackgroundHarnessEvent = {
  type: "background";
};

export type CronHarnessEvent = {
  type: "cron";
  jobId: string;
  prompt: string;
};

export type HarnessEvent = UserHarnessEvent | BackgroundHarnessEvent | CronHarnessEvent;
