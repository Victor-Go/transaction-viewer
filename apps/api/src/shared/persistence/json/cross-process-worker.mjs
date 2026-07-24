/* global console, process */

import { JsonFileDatabase } from './json-file-database.ts';

const [filePath, iterationsValue] = process.argv.slice(2);
const iterations = Number(iterationsValue);

const schema = {
  schemaVersion: 1,
  parse(input) {
    if (
      typeof input !== 'object' ||
      input === null ||
      input.metadata?.schemaVersion !== 1 ||
      !Array.isArray(input.collections?.counters)
    ) {
      throw new Error('invalid counter document');
    }
    return input;
  },
};

const database = new JsonFileDatabase({ filePath, schema });

process.on('message', async (message) => {
  if (message?.type !== 'start') {
    return;
  }

  try {
    for (let index = 0; index < iterations; index += 1) {
      await database.updateWhere(
        'counters',
        (counter) => counter.id === 'shared',
        (counter) => ({ ...counter, value: counter.value + 1 }),
      );
    }
    process.send?.({ type: 'done' });
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
    process.disconnect();
  }
});

process.send?.({ type: 'ready' });
