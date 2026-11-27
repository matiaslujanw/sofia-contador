"use client";

import { createContext, useContext } from "react";
import type { ColumnMapping, ImportKind } from "@/lib/imports";
import type { Company, Document, Period, WorkspaceState } from "@/lib/workspace/model";
import type { Section, Selection } from "@/lib/workspace/routes";
import type { Command } from "@/lib/workspace/validation";

export type Context = {
  state: WorkspaceState;
  company?: Company;
  period?: Period;
  month: string;
  today: string;
  mode: "auth" | "demo";
  canEdit: boolean;
  locale: string;
  href: (section: Section, override?: Partial<Selection>, extra?: Record<string, string>) => string;
  mutate: (command: Command, success?: string) => Promise<{ id?: string }>;
  upload: (category: string, file: File) => Promise<void>;
  download: (document: Document) => Promise<void>;
  readDocument: (document: Document) => Promise<File>;
  currentDocuments: () => Promise<Document[]>;
  confirmImport: (input: { file: File; kind: ImportKind; mapping: ColumnMapping; decimal: "auto" | "comma" | "point" }) => Promise<{ row_count: number; duplicate_count: number; reused: boolean }>;
};

export const WorkspaceContext = createContext<Context | null>(null);

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("WorkspaceContext no disponible");
  return context;
}
