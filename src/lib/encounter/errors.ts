/** Write-path gate validation failure — distinct from unexpected/system errors. */
export class GateAssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GateAssertionError";
    Object.setPrototypeOf(this, GateAssertionError.prototype);
  }
}
