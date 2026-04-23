'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { DemoSessionState } from "@/lib/demo/types";
import type { Contact, Property, Task, Viewing } from "@/lib/types";
import {
  initializeDemoSessionState,
  persistDemoSessionState,
  resetDemoSessionState,
} from "@/lib/demo/session";

type DemoSessionContextType = {
  state: DemoSessionState | null;
  isLoading: boolean;
  resetSession: () => void;
  saveContact: (contact: Contact) => void;
  deleteContact: (contactId: string) => void;
  saveProperty: (property: Property) => void;
  deleteProperty: (propertyId: string) => void;
  saveViewing: (viewing: Viewing) => void;
  deleteViewing: (viewingId: string) => void;
  saveTask: (task: Task) => void;
  deleteTask: (taskId: string) => void;
};

const DemoSessionContext = createContext<DemoSessionContextType | undefined>(undefined);

function withUpdatedMetadata(state: DemoSessionState) {
  return {
    ...state,
    isDirty: true,
    lastUpdatedAt: new Date().toISOString(),
  };
}

function upsertById<T extends { id: string }>(items: T[], nextItem: T) {
  const existingIndex = items.findIndex((item) => item.id === nextItem.id);
  if (existingIndex === -1) {
    return [nextItem, ...items];
  }

  return items.map((item) => (item.id === nextItem.id ? nextItem : item));
}

export function DemoSessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DemoSessionState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initialized = initializeDemoSessionState();
    setState(initialized);
    setIsLoading(false);
  }, []);

  const value = useMemo<DemoSessionContextType>(
    () => ({
      state,
      isLoading,
      resetSession: () => {
        const next = resetDemoSessionState();
        setState(next);
      },
      saveContact: (contact) => {
        setState((current) =>
          current
            ? withUpdatedMetadata({
                ...current,
                contacts: upsertById(current.contacts, contact),
              })
            : current
        );
      },
      deleteContact: (contactId) => {
        setState((current) =>
          current
            ? withUpdatedMetadata({
                ...current,
                contacts: current.contacts.filter((item) => item.id !== contactId),
              })
            : current
        );
      },
      saveProperty: (property) => {
        setState((current) =>
          current
            ? withUpdatedMetadata({
                ...current,
                properties: upsertById(current.properties, property),
              })
            : current
        );
      },
      deleteProperty: (propertyId) => {
        setState((current) =>
          current
            ? withUpdatedMetadata({
                ...current,
                properties: current.properties.filter((item) => item.id !== propertyId),
              })
            : current
        );
      },
      saveViewing: (viewing) => {
        setState((current) =>
          current
            ? withUpdatedMetadata({
                ...current,
                viewings: upsertById(current.viewings, viewing),
              })
            : current
        );
      },
      deleteViewing: (viewingId) => {
        setState((current) =>
          current
            ? withUpdatedMetadata({
                ...current,
                viewings: current.viewings.filter((item) => item.id !== viewingId),
              })
            : current
        );
      },
      saveTask: (task) => {
        setState((current) =>
          current
            ? withUpdatedMetadata({
                ...current,
                tasks: upsertById(current.tasks, task),
              })
            : current
        );
      },
      deleteTask: (taskId) => {
        setState((current) =>
          current
            ? withUpdatedMetadata({
                ...current,
                tasks: current.tasks.filter((item) => item.id !== taskId),
              })
            : current
        );
      },
    }),
    [state, isLoading]
  );

  useEffect(() => {
    if (!state) return;
    persistDemoSessionState(state);
  }, [state]);

  return <DemoSessionContext.Provider value={value}>{children}</DemoSessionContext.Provider>;
}

export function useDemoSession() {
  const context = useContext(DemoSessionContext);
  if (!context) {
    throw new Error("useDemoSession must be used inside DemoSessionProvider.");
  }

  return context;
}
