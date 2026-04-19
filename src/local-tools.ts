import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { executeLocalTool } from "./local-api";

const listFilesSchema = Type.Object({
  path: Type.Optional(Type.String({ description: "Path relatif dari project root. Kosong untuk root." })),
});

const readSchema = Type.Object({
  path: Type.String({ description: "Path file relatif dari project root." }),
});

const writeSchema = Type.Object({
  path: Type.String({ description: "Path file relatif dari project root." }),
  content: Type.String({ description: "Konten lengkap yang akan ditulis ke file." }),
});

const editSchema = Type.Object({
  path: Type.String({ description: "Path file relatif dari project root." }),
  edits: Type.Array(
    Type.Object({
      oldText: Type.String({ description: "Potongan teks lama (harus match persis)." }),
      newText: Type.String({ description: "Potongan teks pengganti." }),
    }),
    { minItems: 1 },
  ),
});

const bashSchema = Type.Object({
  command: Type.String({ description: "Perintah bash yang dijalankan dari project root." }),
  timeout: Type.Optional(Type.Number({ minimum: 1, maximum: 180 })),
});

export const createLocalTools = (projectPath: string): AgentTool<any>[] => {
  const listFilesTool: AgentTool<typeof listFilesSchema, { path: string; entries: string[] }> = {
    name: "list_files",
    label: "List Files",
    description: "List file dan folder di path project saat ini.",
    parameters: listFilesSchema,
    execute: async (_toolCallId, args) => {
      return executeLocalTool<typeof args, { path: string; entries: string[] }>({
        tool: "list_files",
        args,
        projectPath,
      });
    },
  };

  const readTool: AgentTool<typeof readSchema, { path: string; lineCount: number; truncated: boolean }> = {
    name: "read",
    label: "Read File",
    description: "Baca isi file teks dari project lokal.",
    parameters: readSchema,
    execute: async (_toolCallId, args) => {
      return executeLocalTool<typeof args, { path: string; lineCount: number; truncated: boolean }>({
        tool: "read",
        args,
        projectPath,
      });
    },
  };

  const writeTool: AgentTool<typeof writeSchema, { path: string; bytes: number }> = {
    name: "write",
    label: "Write File",
    description: "Tulis/overwrite file di project lokal.",
    parameters: writeSchema,
    execute: async (_toolCallId, args) => {
      return executeLocalTool<typeof args, { path: string; bytes: number }>({
        tool: "write",
        args,
        projectPath,
      });
    },
  };

  const editTool: AgentTool<typeof editSchema, { path: string; appliedEdits: number }> = {
    name: "edit",
    label: "Edit File",
    description: "Edit file dengan exact text replacement.",
    parameters: editSchema,
    execute: async (_toolCallId, args) => {
      return executeLocalTool<typeof args, { path: string; appliedEdits: number }>({
        tool: "edit",
        args,
        projectPath,
      });
    },
  };

  const bashTool: AgentTool<typeof bashSchema, { exitCode: number; timedOut: boolean }> = {
    name: "bash",
    label: "Run Bash",
    description: "Jalankan perintah bash di project lokal.",
    parameters: bashSchema,
    execute: async (_toolCallId, args) => {
      return executeLocalTool<typeof args, { exitCode: number; timedOut: boolean }>({
        tool: "bash",
        args,
        projectPath,
      });
    },
  };

  return [listFilesTool, readTool, writeTool, editTool, bashTool];
};
