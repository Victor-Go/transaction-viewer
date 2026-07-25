export type LogBindings = Readonly<Record<string, unknown>>;

export interface Logger {
  debug(bindings: LogBindings, message?: string): void;
  info(bindings: LogBindings, message?: string): void;
  warn(bindings: LogBindings, message?: string): void;
  error(bindings: LogBindings, message?: string): void;
  child(bindings: LogBindings): Logger;
}

export const NOOP_LOGGER: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  child: () => NOOP_LOGGER,
};
