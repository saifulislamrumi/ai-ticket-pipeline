export class ZodValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ZodValidationError';
  }
}
