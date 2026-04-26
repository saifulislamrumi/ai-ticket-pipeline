// src/utils/ZodValidationError.ts
export class ZodValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ZodValidationError';
  }
}
