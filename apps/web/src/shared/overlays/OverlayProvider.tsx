import { useCallback, useMemo, useState, type ReactNode } from 'react';

import { OverlayContext } from './OverlayContext';
import type {
  OverlayEntry,
  OverlayHandle,
  OpenOverlayOptions,
  ProgrammaticOverlayRequest,
} from './overlay-types';

const descendantIds = (
  entries: readonly OverlayEntry[],
  ownerId: string,
): ReadonlySet<string> => {
  const ids = new Set<string>([ownerId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const entry of entries) {
      if (
        entry.ownerId !== undefined &&
        ids.has(entry.ownerId) &&
        !ids.has(entry.id)
      ) {
        ids.add(entry.id);
        changed = true;
      }
    }
  }
  return ids;
};

export const OverlayProvider = ({
  children,
}: {
  readonly children: ReactNode;
}) => {
  const [entries, setEntries] = useState<readonly OverlayEntry[]>([]);
  const [controlledIds, setControlledIds] = useState<readonly string[]>([]);

  const openOverlay = useCallback(
    (
      request: ProgrammaticOverlayRequest,
      options: OpenOverlayOptions = {},
    ): OverlayHandle => {
      const handle = { id: crypto.randomUUID() };
      setEntries((current) => [
        ...current,
        {
          id: handle.id,
          request,
          lifecycle: 'open',
          ...(options.ownerId === undefined
            ? {}
            : { ownerId: options.ownerId }),
        },
      ]);
      return handle;
    },
    [],
  );

  const closeOverlay = useCallback((handle: OverlayHandle | string) => {
    const id = typeof handle === 'string' ? handle : handle.id;
    setEntries((current) => {
      const closing = descendantIds(current, id);
      return current.map((entry) =>
        closing.has(entry.id) ? { ...entry, lifecycle: 'closing' } : entry,
      );
    });
  }, []);

  const removeOverlay = useCallback((handle: OverlayHandle | string) => {
    const id = typeof handle === 'string' ? handle : handle.id;
    setEntries((current) => {
      const removed = descendantIds(current, id);
      return current.filter((entry) => !removed.has(entry.id));
    });
  }, []);

  const registerControlledOverlay = useCallback((id: string) => {
    setControlledIds((current) =>
      current.includes(id) ? current : [...current, id],
    );
    return () => {
      setEntries((current) => {
        const removed = descendantIds(current, id);
        return current.filter((entry) => !removed.has(entry.id));
      });
      setControlledIds((current) =>
        current.filter((controlledId) => controlledId !== id),
      );
    };
  }, []);

  const stack = useMemo(
    () => [...controlledIds, ...entries.map(({ id }) => id)],
    [controlledIds, entries],
  );

  const value = useMemo(
    () => ({
      entries,
      openOverlay,
      closeOverlay,
      removeOverlay,
      registerControlledOverlay,
      getLayer: (id: string) => {
        const index = stack.indexOf(id);
        const depth = Math.max(0, index);
        return {
          depth,
          isTopmost: index !== -1 && index === stack.length - 1,
        };
      },
    }),
    [
      closeOverlay,
      entries,
      openOverlay,
      registerControlledOverlay,
      removeOverlay,
      stack,
    ],
  );

  return (
    <OverlayContext.Provider value={value}>{children}</OverlayContext.Provider>
  );
};
