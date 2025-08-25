import { describe, expect, it, vi, beforeEach } from "vitest";

// Interfaces for type safety
interface ClarityResponse<T> {
  ok: boolean;
  value: T | number; // number for error codes
}

interface Batch {
  manufacturer: string;
  batchHash: Uint8Array;
  createdAt: number;
  expiryDate: number;
  productName: string;
  ingredients: string[];
  metadata: string;
  active: boolean;
}

interface Verification {
  verifiedBy: string;
  verificationTime: number;
  notes: string;
}

interface ContractState {
  batches: Map<number, Batch>;
  batchVerifications: Map<number, Verification>;
  batchCounter: number;
  paused: boolean;
  admin: string;
}

// Mock contract implementation
class BatchCreationMock {
  private state: ContractState = {
    batches: new Map(),
    batchVerifications: new Map(),
    batchCounter: 0,
    paused: false,
    admin: "deployer",
  };

  private ERR_UNAUTHORIZED = 100;
  private ERR_INVALID_HASH = 101;
  private ERR_INVALID_PARAM = 102;
  private ERR_PAUSED = 103;
  private ERR_ALREADY_EXISTS = 104;
  private ERR_NOT_MANUFACTURER = 105;
  private ERR_INVALID_BATCH_ID = 106;
  private ERR_METADATA_TOO_LONG = 107;
  private ERR_INVALID_EXPIRY = 108;
  private MAX_METADATA_LEN = 500;
  private MAX_INGREDIENTS = 10;

  // Mock manufacturer check (replace with UserRegistry integration in production)
  private isManufacturer(caller: string): boolean {
    return caller === "manufacturer";
  }

  createBatch(
    caller: string,
    batchHash: Uint8Array,
    productName: string,
    expiryDate: number,
    ingredients: string[],
    metadata: string
  ): ClarityResponse<number> {
    if (this.state.paused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    if (!this.isManufacturer(caller)) {
      return { ok: false, value: this.ERR_NOT_MANUFACTURER };
    }
    if (batchHash.length !== 32) {
      return { ok: false, value: this.ERR_INVALID_HASH };
    }
    if (productName.length === 0 || ingredients.length === 0 || ingredients.length > this.MAX_INGREDIENTS) {
      return { ok: false, value: this.ERR_INVALID_PARAM };
    }
    if (metadata.length > this.MAX_METADATA_LEN) {
      return { ok: false, value: this.ERR_METADATA_TOO_LONG };
    }
    if (expiryDate <= Date.now()) {
      return { ok: false, value: this.ERR_INVALID_EXPIRY };
    }
    const batchId = this.state.batchCounter + 1;
    if (this.state.batches.has(batchId)) {
      return { ok: false, value: this.ERR_ALREADY_EXISTS };
    }

    this.state.batches.set(batchId, {
      manufacturer: caller,
      batchHash,
      createdAt: Date.now(),
      expiryDate,
      productName,
      ingredients,
      metadata,
      active: true,
    });
    this.state.batchCounter = batchId;
    return { ok: true, value: batchId };
  }

  verifyBatch(caller: string, batchId: number, notes: string): ClarityResponse<boolean> {
    if (this.state.paused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    if (!this.isManufacturer(caller)) {
      return { ok: false, value: this.ERR_NOT_MANUFACTURER };
    }
    if (!this.state.batches.has(batchId)) {
      return { ok: false, value: this.ERR_INVALID_BATCH_ID };
    }
    this.state.batchVerifications.set(batchId, {
      verifiedBy: caller,
      verificationTime: Date.now(),
      notes,
    });
    return { ok: true, value: true };
  }

  deactivateBatch(caller: string, batchId: number): ClarityResponse<boolean> {
    if (this.state.paused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    if (caller !== this.state.admin && !this.isManufacturer(caller)) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    const batch = this.state.batches.get(batchId);
    if (!batch) {
      return { ok: false, value: this.ERR_INVALID_BATCH_ID };
    }
    if (batch.manufacturer !== caller && caller !== this.state.admin) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.batches.set(batchId, { ...batch, active: false });
    return { ok: true, value: true };
  }

  pauseContract(caller: string): ClarityResponse<boolean> {
    if (caller !== this.state.admin) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.paused = true;
    return { ok: true, value: true };
  }

  unpauseContract(caller: string): ClarityResponse<boolean> {
    if (caller !== this.state.admin) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.paused = false;
    return { ok: true, value: true };
  }

  transferAdmin(caller: string, newAdmin: string): ClarityResponse<boolean> {
    if (caller !== this.state.admin) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.admin = newAdmin;
    return { ok: true, value: true };
  }

  getBatchDetails(batchId: number): ClarityResponse<Batch | null> {
    return { ok: true, value: this.state.batches.get(batchId) ?? null };
  }

  getBatchVerification(batchId: number): ClarityResponse<Verification | null> {
    return { ok: true, value: this.state.batchVerifications.get(batchId) ?? null };
  }

  isContractPaused(): ClarityResponse<boolean> {
    return { ok: true, value: this.state.paused };
  }

  getBatchCounter(): ClarityResponse<number> {
    return { ok: true, value: this.state.batchCounter };
  }
}

// Test setup
const accounts = {
  deployer: "deployer",
  manufacturer: "manufacturer",
  nonManufacturer: "user1",
};

describe("BatchCreation Contract", () => {
  let contract: BatchCreationMock;

  beforeEach(() => {
    contract = new BatchCreationMock();
    vi.resetAllMocks();
  });

  it("should create a batch successfully", () => {
    const batchHash = new Uint8Array(32).fill(1);
    const result = contract.createBatch(
      accounts.manufacturer,
      batchHash,
      "Aspirin 500mg",
      Date.now() + 100000,
      ["Aspirin", "Starch"],
      "Lot 123, Factory A"
    );
    expect(result).toEqual({ ok: true, value: 1 });
    const batch = contract.getBatchDetails(1);
    expect(batch).toEqual({
      ok: true,
      value: expect.objectContaining({
        manufacturer: accounts.manufacturer,
        productName: "Aspirin 500mg",
        ingredients: ["Aspirin", "Starch"],
        metadata: "Lot 123, Factory A",
        active: true,
      }),
    });
    expect(contract.getBatchCounter()).toEqual({ ok: true, value: 1 });
  });

  it("should fail to create batch when paused", () => {
    contract.pauseContract(accounts.deployer);
    const batchHash = new Uint8Array(32).fill(1);
    const result = contract.createBatch(
      accounts.manufacturer,
      batchHash,
      "Aspirin 500mg",
      Date.now() + 100000,
      ["Aspirin", "Starch"],
      "Lot 123, Factory A"
    );
    expect(result).toEqual({ ok: false, value: 103 });
  });

  it("should fail to create batch for non-manufacturer", () => {
    const batchHash = new Uint8Array(32).fill(1);
    const result = contract.createBatch(
      accounts.nonManufacturer,
      batchHash,
      "Aspirin 500mg",
      Date.now() + 100000,
      ["Aspirin", "Starch"],
      "Lot 123, Factory A"
    );
    expect(result).toEqual({ ok: false, value: 105 });
  });

  it("should fail to create batch with invalid hash", () => {
    const batchHash = new Uint8Array(31).fill(1); // Too short
    const result = contract.createBatch(
      accounts.manufacturer,
      batchHash,
      "Aspirin 500mg",
      Date.now() + 100000,
      ["Aspirin", "Starch"],
      "Lot 123, Factory A"
    );
    expect(result).toEqual({ ok: false, value: 101 });
  });

  it("should fail to create batch with invalid parameters", () => {
    const batchHash = new Uint8Array(32).fill(1);
    const result = contract.createBatch(
      accounts.manufacturer,
      batchHash,
      "", // Empty product name
      Date.now() + 100000,
      [],
      "Lot 123, Factory A"
    );
    expect(result).toEqual({ ok: false, value: 102 });
  });

  it("should fail to create batch with metadata too long", () => {
    const batchHash = new Uint8Array(32).fill(1);
    const longMetadata = "a".repeat(501);
    const result = contract.createBatch(
      accounts.manufacturer,
      batchHash,
      "Aspirin 500mg",
      Date.now() + 100000,
      ["Aspirin", "Starch"],
      longMetadata
    );
    expect(result).toEqual({ ok: false, value: 107 });
  });

  it("should fail to create batch with past expiry date", () => {
    const batchHash = new Uint8Array(32).fill(1);
    const result = contract.createBatch(
      accounts.manufacturer,
      batchHash,
      "Aspirin 500mg",
      Date.now() - 1000,
      ["Aspirin", "Starch"],
      "Lot 123, Factory A"
    );
    expect(result).toEqual({ ok: false, value: 108 });
  });

  it("should verify a batch successfully", () => {
    const batchHash = new Uint8Array(32).fill(1);
    contract.createBatch(
      accounts.manufacturer,
      batchHash,
      "Aspirin 500mg",
      Date.now() + 100000,
      ["Aspirin", "Starch"],
      "Lot 123, Factory A"
    );
    const result = contract.verifyBatch(accounts.manufacturer, 1, "QA passed");
    expect(result).toEqual({ ok: true, value: true });
    const verification = contract.getBatchVerification(1);
    expect(verification).toEqual({
      ok: true,
      value: expect.objectContaining({
        verifiedBy: accounts.manufacturer,
        notes: "QA passed",
      }),
    });
  });

  it("should fail to verify non-existent batch", () => {
    const result = contract.verifyBatch(accounts.manufacturer, 999, "QA passed");
    expect(result).toEqual({ ok: false, value: 106 });
  });

  it("should deactivate a batch successfully", () => {
    const batchHash = new Uint8Array(32).fill(1);
    contract.createBatch(
      accounts.manufacturer,
      batchHash,
      "Aspirin 500mg",
      Date.now() + 100000,
      ["Aspirin", "Starch"],
      "Lot 123, Factory A"
    );
    const result = contract.deactivateBatch(accounts.manufacturer, 1);
    expect(result).toEqual({ ok: true, value: true });
    const batch = contract.getBatchDetails(1);
    expect(batch).toEqual({
      ok: true,
      value: expect.objectContaining({ active: false }),
    });
  });

  it("should allow admin to pause and unpause contract", () => {
    const pauseResult = contract.pauseContract(accounts.deployer);
    expect(pauseResult).toEqual({ ok: true, value: true });
    expect(contract.isContractPaused()).toEqual({ ok: true, value: true });

    const unpauseResult = contract.unpauseContract(accounts.deployer);
    expect(unpauseResult).toEqual({ ok: true, value: true });
    expect(contract.isContractPaused()).toEqual({ ok: true, value: false });
  });

  it("should allow admin to transfer admin role", () => {
    const result = contract.transferAdmin(accounts.deployer, accounts.manufacturer);
    expect(result).toEqual({ ok: true, value: true });
    const pauseResult = contract.pauseContract(accounts.manufacturer);
    expect(pauseResult).toEqual({ ok: true, value: true });
  });
});