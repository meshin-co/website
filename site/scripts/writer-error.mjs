export class WriterError extends Error {
  constructor(kind, message, { variables = [], status = null, call = null } = {}) {
    super(message);
    this.name = 'WriterError';
    this.kind = kind;
    this.variables = variables;
    this.status = status;
    this.call = call;
  }
}
