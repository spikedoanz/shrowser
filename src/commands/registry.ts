import type { CommandDef, CommandFn } from "./types.ts";

const commands = new Map<string, CommandDef>();

export const register = (name: string, description: string, execute: CommandFn): void => {
  commands.set(name, { name, description, execute });
};

export const lookup = (name: string): CommandDef | undefined => commands.get(name);

export const all = (): readonly CommandDef[] => [...commands.values()];
