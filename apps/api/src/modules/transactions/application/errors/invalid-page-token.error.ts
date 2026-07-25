export class InvalidPageTokenError extends Error {
  constructor() {
    super('The page token is invalid');
    this.name = 'InvalidPageTokenError';
  }
}

export class InvalidGeneratedPageTokenError extends Error {
  constructor() {
    super('A valid page token could not be generated');
    this.name = 'InvalidGeneratedPageTokenError';
  }
}
