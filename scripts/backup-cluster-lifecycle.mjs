// A failed/timed-out start or stop is ambiguous. Retain files until stop is confirmed.
export class BackupClusterLifecycle {
  mayBeRunning = false;
  constructor(stop) { this.stopImplementation = stop; }
  async initialize(start, prepare) {
    this.mayBeRunning = true;
    try { await start(); return await prepare(); }
    catch (error) {
      try { await this.stop(); }
      catch { throw Error('LOCAL_CLUSTER_STOP_UNVERIFIED_RETAINED'); }
      throw error;
    }
  }
  async stop() {
    if (!this.mayBeRunning) return;
    await this.stopImplementation();
    this.mayBeRunning = false;
  }
  assertRemovable() {
    if (this.mayBeRunning) throw Error('LOCAL_CLUSTER_STOP_UNVERIFIED_RETAINED');
  }
}
