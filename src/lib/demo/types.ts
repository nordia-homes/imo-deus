import type { Agency, Contact, Property, Task, UserProfile, Viewing } from "@/lib/types";

export type DemoAgent = Pick<UserProfile, "id" | "name" | "email" | "phone" | "photoUrl" | "role">;

export type DemoAgency = Agency & {
  cityFocus: string;
  positioning: string;
};

export type DemoSessionState = {
  sessionId: string;
  mode: "local-demo";
  createdAt: string;
  lastUpdatedAt: string;
  isDirty: boolean;
  agency: DemoAgency;
  agents: DemoAgent[];
  contacts: Contact[];
  properties: Property[];
  viewings: Viewing[];
  tasks: Task[];
};
