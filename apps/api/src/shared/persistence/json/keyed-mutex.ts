import path from 'node:path';

type Work<T> = () => T | PromiseLike<T>;

export class KeyedMutex {
  readonly #tails = new Map<string, Promise<void>>();

  get activeKeyCount(): number {
    return this.#tails.size;
  }

  async runExclusive<T>(filePath: string, work: Work<T>): Promise<T> {
    const key = path.normalize(path.resolve(filePath));
    const previous = this.#tails.get(key) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.then(() => gate);

    this.#tails.set(key, tail);
    await previous;

    try {
      return await work();
    } finally {
      release();
      if (this.#tails.get(key) === tail) {
        this.#tails.delete(key);
      }
    }
  }
}
