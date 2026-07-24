/* global process, setInterval */

import { ProperFileLock } from './file-lock.ts';

const [filePath] = process.argv.slice(2);
const lock = new ProperFileLock();
const handle = await lock.acquire(filePath);

process.send?.({ type: 'locked' });

// Keep both the process and handle alive. The parent deliberately terminates
// this process without permitting normal release.
setInterval(() => {
  handle.assertUsable();
}, 250);
