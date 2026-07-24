const fail = (message: string): never => {
  throw new TypeError(message);
};

const isArrayIndex = (key: string, length: number): boolean => {
  if (!/^(0|[1-9]\d*)$/.test(key)) {
    return false;
  }

  const index = Number(key);
  return Number.isSafeInteger(index) && index >= 0 && index < length;
};

const assertArrayIsJsonSafe = (
  value: readonly unknown[],
  ancestors: Set<object>,
): void => {
  for (const key of Reflect.ownKeys(value)) {
    if (key === 'length') {
      continue;
    }
    if (typeof key !== 'string' || !isArrayIndex(key, value.length)) {
      fail('JSON arrays must not contain non-index properties');
    }

    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !('value' in descriptor)) {
      fail('JSON array entries must be enumerable data properties');
    }
  }

  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) {
      fail('JSON arrays must not contain sparse entries');
    }
    assertJsonSafeValue(value[index], ancestors);
  }
};

const assertPlainObjectIsJsonSafe = (
  value: object,
  ancestors: Set<object>,
): void => {
  if (Object.getPrototypeOf(value) !== Object.prototype) {
    fail('JSON objects must be plain objects');
  }

  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') {
      fail('JSON objects must not contain symbol keys');
    }

    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !('value' in descriptor)) {
      return fail('JSON object properties must be enumerable data properties');
    }
    assertJsonSafeValue(descriptor.value, ancestors);
  }
};

const assertJsonSafeValue = (value: unknown, ancestors: Set<object>): void => {
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'string'
  ) {
    return;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      fail('JSON numbers must be finite');
    }
    return;
  }
  if (typeof value !== 'object') {
    return fail('The value is not representable in JSON');
  }
  if (ancestors.has(value)) {
    return fail('JSON values must not contain cycles');
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      assertArrayIsJsonSafe(value, ancestors);
    } else {
      assertPlainObjectIsJsonSafe(value, ancestors);
    }
  } finally {
    ancestors.delete(value);
  }
};

export const assertJsonSafe = (value: unknown): void => {
  assertJsonSafeValue(value, new Set());
};
