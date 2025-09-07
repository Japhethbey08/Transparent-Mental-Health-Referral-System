import { describe, it, expect, beforeEach } from "vitest";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_NEEDS = 101;
const ERR_INVALID_LANGUAGE = 102;
const ERR_INVALID_EXPERTISE = 103;
const ERR_INVALID_PRIORITY = 104;
const ERR_REFERRAL_NOT_FOUND = 106;
const ERR_INVALID_STATUS = 107;
const ERR_VICTIM_NOT_REGISTERED = 110;
const ERR_COUNSELOR_NOT_VERIFIED = 109;
const ERR_MATCHING_FAILED = 111;
const ERR_INVALID_ANONYMITY_LEVEL = 115;
const ERR_INVALID_LOCATION = 116;
const ERR_INVALID_AVAILABILITY = 117;
const ERR_INVALID_REFERRAL_TYPE = 121;
const ERR_INVALID_DURATION = 122;
const ERR_INVALID_COST = 123;
const ERR_INVALID_PAYMENT_STATUS = 124;
const ERR_MAX_REFERRALS_EXCEEDED = 114;
const ERR_STATUS_UPDATE_NOT_ALLOWED = 112;
const ERR_INVALID_UPDATE_REASON = 113;
const ERR_INVALID_FEEDBACK = 119;

interface Referral {
  victimId: string;
  counselorId: string | null;
  status: string;
  createdAt: number;
  needs: string;
  language: string;
  expertise: string;
  priority: number;
  anonymityLevel: number;
  location: string;
  availability: string;
  followupRequired: boolean;
  feedbackScore: number | null;
  emergencyFlag: boolean;
  referralType: string;
  duration: number;
  cost: number;
  paymentStatus: string;
}

interface ReferralUpdate {
  updateStatus: string;
  updateTimestamp: number;
  updater: string;
  updateReason: string;
}

class ReferralManagerMock {
  state!: {
    referralCounter: number;
    maxReferrals: number;
    referrals: Map<number, Referral>;
    referralUpdates: Map<number, ReferralUpdate>;
    referralsByVictim: Map<string, number[]>;
  };
  blockHeight = 0;
  caller = "ST1VICTIM";
  userRegistry = new Map<string, { role: string }>();
  counselorVerifier = new Set<string>();
  matchingEngine = new Map<number, boolean>();
  sessionTracker = new Map<number, { start: boolean; complete: boolean }>();

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      referralCounter: 0,
      maxReferrals: 10000,
      referrals: new Map(),
      referralUpdates: new Map(),
      referralsByVictim: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1VICTIM";
    this.userRegistry.set("ST1VICTIM", { role: "victim" });
    this.counselorVerifier.add("ST1COUNSELOR");
    this.matchingEngine = new Map();
    this.sessionTracker = new Map();
  }

  verifyUser(principal: string, role: string): { ok: boolean; value: boolean } {
    const user = this.userRegistry.get(principal);
    return { ok: true, value: user?.role === role };
  }

  verifyCounselor(principal: string): { ok: boolean; value: boolean } {
    return { ok: true, value: this.counselorVerifier.has(principal) };
  }

  logMatch(referralId: number, counselorId: string): { ok: boolean; value: boolean } {
    this.matchingEngine.set(referralId, true);
    return { ok: true, value: true };
  }

  logSessionStart(referralId: number): { ok: boolean; value: boolean } {
    this.sessionTracker.set(referralId, { start: true, complete: false });
    return { ok: true, value: true };
  }

  logSessionComplete(referralId: number): { ok: boolean; value: boolean } {
    const session = this.sessionTracker.get(referralId);
    if (session) session.complete = true;
    return { ok: true, value: true };
  }

  createReferral(
    victimId: string,
    needs: string,
    language: string,
    expertise: string,
    priority: number,
    anonymityLevel: number,
    location: string,
    availability: string,
    followupRequired: boolean,
    emergencyFlag: boolean,
    referralType: string,
    duration: number,
    cost: number,
    paymentStatus: string
  ): { ok: boolean; value: number | number } {
    const nextId = this.state.referralCounter;
    if (nextId >= this.state.maxReferrals) return { ok: false, value: ERR_MAX_REFERRALS_EXCEEDED };
    if (needs.length === 0) return { ok: false, value: ERR_INVALID_NEEDS };
    if (!["english", "spanish", "french", "other"].includes(language)) return { ok: false, value: ERR_INVALID_LANGUAGE };
    if (expertise.length === 0) return { ok: false, value: ERR_INVALID_EXPERTISE };
    if (priority < 1 || priority > 5) return { ok: false, value: ERR_INVALID_PRIORITY };
    if (anonymityLevel < 0 || anonymityLevel > 3) return { ok: false, value: ERR_INVALID_ANONYMITY_LEVEL };
    if (location.length === 0) return { ok: false, value: ERR_INVALID_LOCATION };
    if (availability.length === 0) return { ok: false, value: ERR_INVALID_AVAILABILITY };
    if (!["trauma", "anxiety", "depression", "other"].includes(referralType)) return { ok: false, value: ERR_INVALID_REFERRAL_TYPE };
    if (duration < 15 || duration > 120) return { ok: false, value: ERR_INVALID_DURATION };
    if (cost > 10000) return { ok: false, value: ERR_INVALID_COST };
    if (!["pending", "paid", "waived"].includes(paymentStatus)) return { ok: false, value: ERR_INVALID_PAYMENT_STATUS };
    if (!this.verifyUser(victimId, "victim").value) return { ok: false, value: ERR_VICTIM_NOT_REGISTERED };
    const newReferral: Referral = {
      victimId,
      counselorId: null,
      status: "open",
      createdAt: this.blockHeight,
      needs,
      language,
      expertise,
      priority,
      anonymityLevel,
      location,
      availability,
      followupRequired,
      feedbackScore: null,
      emergencyFlag,
      referralType,
      duration,
      cost,
      paymentStatus,
    };
    this.state.referrals.set(nextId, newReferral);
    const victimList = this.state.referralsByVictim.get(victimId) || [];
    victimList.push(nextId);
    this.state.referralsByVictim.set(victimId, victimList);
    this.state.referralCounter++;
    return { ok: true, value: nextId };
  }

  acceptReferral(referralId: number, counselorId: string): { ok: boolean; value: boolean | number } {
    const referral = this.state.referrals.get(referralId);
    if (!referral) return { ok: false, value: ERR_REFERRAL_NOT_FOUND };
    if (referral.status !== "open") return { ok: false, value: ERR_INVALID_STATUS };
    if (!this.verifyCounselor(counselorId).value) return { ok: false, value: ERR_COUNSELOR_NOT_VERIFIED };
    if (!this.logMatch(referralId, counselorId).value) return { ok: false, value: ERR_MATCHING_FAILED };
    referral.counselorId = counselorId;
    referral.status = "accepted";
    this.state.referralUpdates.set(referralId, {
      updateStatus: "accepted",
      updateTimestamp: this.blockHeight,
      updater: this.caller,
      updateReason: "Counselor accepted the referral",
    });
    return { ok: true, value: true };
  }

  updateReferralStatus(referralId: number, newStatus: string, reason: string): { ok: boolean; value: boolean | number } {
    const referral = this.state.referrals.get(referralId);
    if (!referral) return { ok: false, value: ERR_REFERRAL_NOT_FOUND };
    if (this.caller !== referral.victimId && this.caller !== referral.counselorId) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (!["open", "accepted", "in-progress", "completed", "closed", "rejected"].includes(newStatus)) return { ok: false, value: ERR_INVALID_STATUS };
    if (reason.length === 0) return { ok: false, value: ERR_INVALID_UPDATE_REASON };
    if (referral.status === newStatus) return { ok: false, value: ERR_STATUS_UPDATE_NOT_ALLOWED };
    referral.status = newStatus;
    this.state.referralUpdates.set(referralId, {
      updateStatus: newStatus,
      updateTimestamp: this.blockHeight,
      updater: this.caller,
      updateReason: reason,
    });
    return { ok: true, value: true };
  }

  provideFeedback(referralId: number, score: number): { ok: boolean; value: boolean | number } {
    const referral = this.state.referrals.get(referralId);
    if (!referral) return { ok: false, value: ERR_REFERRAL_NOT_FOUND };
    if (this.caller !== referral.victimId) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (referral.status !== "completed") return { ok: false, value: ERR_INVALID_STATUS };
    if (score < 1 || score > 5) return { ok: false, value: ERR_INVALID_FEEDBACK };
    referral.feedbackScore = score;
    return { ok: true, value: true };
  }

  closeReferral(referralId: number, reason: string): { ok: boolean; value: boolean | number } {
    const referral = this.state.referrals.get(referralId);
    if (!referral) return { ok: false, value: ERR_REFERRAL_NOT_FOUND };
    if (this.caller !== referral.victimId && this.caller !== referral.counselorId) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (referral.status === "closed") return { ok: false, value: ERR_INVALID_STATUS };
    if (reason.length === 0) return { ok: false, value: ERR_INVALID_UPDATE_REASON };
    referral.status = "closed";
    this.state.referralUpdates.set(referralId, {
      updateStatus: "closed",
      updateTimestamp: this.blockHeight,
      updater: this.caller,
      updateReason: reason,
    });
    return { ok: true, value: true };
  }

  rejectReferral(referralId: number, reason: string): { ok: boolean; value: boolean | number } {
    const referral = this.state.referrals.get(referralId);
    if (!referral) return { ok: false, value: ERR_REFERRAL_NOT_FOUND };
    if (this.caller !== referral.counselorId) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (referral.status !== "accepted") return { ok: false, value: ERR_INVALID_STATUS };
    if (reason.length === 0) return { ok: false, value: ERR_INVALID_UPDATE_REASON };
    referral.status = "rejected";
    referral.counselorId = null;
    this.state.referralUpdates.set(referralId, {
      updateStatus: "rejected",
      updateTimestamp: this.blockHeight,
      updater: this.caller,
      updateReason: reason,
    });
    return { ok: true, value: true };
  }

  startSession(referralId: number): { ok: boolean; value: boolean | number } {
    const referral = this.state.referrals.get(referralId);
    if (!referral) return { ok: false, value: ERR_REFERRAL_NOT_FOUND };
    if (referral.status !== "accepted") return { ok: false, value: ERR_INVALID_STATUS };
    if (!referral.counselorId) return { ok: false, value: ERR_COUNSELOR_NOT_VERIFIED };
    if (!this.logSessionStart(referralId).value) return { ok: false, value: ERR_MATCHING_FAILED };
    referral.status = "in-progress";
    return { ok: true, value: true };
  }

  completeSession(referralId: number): { ok: boolean; value: boolean | number } {
    const referral = this.state.referrals.get(referralId);
    if (!referral) return { ok: false, value: ERR_REFERRAL_NOT_FOUND };
    if (referral.status !== "in-progress") return { ok: false, value: ERR_INVALID_STATUS };
    if (!this.logSessionComplete(referralId).value) return { ok: false, value: ERR_MATCHING_FAILED };
    referral.status = "completed";
    return { ok: true, value: true };
  }

  getReferral(id: number): Referral | undefined {
    return this.state.referrals.get(id);
  }
}

describe("ReferralManager", () => {
  let contract: ReferralManagerMock;

  beforeEach(() => {
    contract = new ReferralManagerMock();
  });

  it("creates a valid referral", () => {
    const result = contract.createReferral(
      "ST1VICTIM",
      "Need help with anxiety",
      "english",
      "trauma counseling",
      3,
      1,
      "New York",
      "Evenings",
      true,
      false,
      "anxiety",
      60,
      100,
      "pending"
    );
    expect(result.ok).toBe(true);
    expect(contract.getReferral(0)?.needs).toBe("Need help with anxiety");
  });

  it("rejects invalid needs", () => {
    const result = contract.createReferral(
      "ST1VICTIM",
      "",
      "english",
      "trauma counseling",
      3,
      1,
      "New York",
      "Evenings",
      true,
      false,
      "anxiety",
      60,
      100,
      "pending"
    );
    expect(result).toEqual({ ok: false, value: ERR_INVALID_NEEDS });
  });

  it("rejects invalid language", () => {
    const result = contract.createReferral(
      "ST1VICTIM",
      "Need help",
      "invalid",
      "trauma counseling",
      3,
      1,
      "New York",
      "Evenings",
      true,
      false,
      "anxiety",
      60,
      100,
      "pending"
    );
    expect(result).toEqual({ ok: false, value: ERR_INVALID_LANGUAGE });
  });

  it("rejects unregistered victim", () => {
    contract.userRegistry.delete("ST1VICTIM");
    const result = contract.createReferral(
      "ST1VICTIM",
      "Need help",
      "english",
      "trauma",
      3,
      1,
      "New York",
      "Evenings",
      true,
      false,
      "anxiety",
      60,
      100,
      "pending"
    );
    expect(result).toEqual({ ok: false, value: ERR_VICTIM_NOT_REGISTERED });
  });

  it("accepts a referral", () => {
    contract.createReferral(
      "ST1VICTIM",
      "Need help",
      "english",
      "trauma",
      3,
      1,
      "New York",
      "Evenings",
      true,
      false,
      "anxiety",
      60,
      100,
      "pending"
    );
    const result = contract.acceptReferral(0, "ST1COUNSELOR");
    expect(result.ok).toBe(true);
    expect(contract.getReferral(0)?.status).toBe("accepted");
  });

  it("rejects accept for non-open referral", () => {
    contract.createReferral(
      "ST1VICTIM",
      "Need help",
      "english",
      "trauma",
      3,
      1,
      "New York",
      "Evenings",
      true,
      false,
      "anxiety",
      60,
      100,
      "pending"
    );
    contract.acceptReferral(0, "ST1COUNSELOR");
    const result = contract.acceptReferral(0, "ST1COUNSELOR");
    expect(result).toEqual({ ok: false, value: ERR_INVALID_STATUS });
  });

  it("rejects accept for unverified counselor", () => {
    contract.createReferral(
      "ST1VICTIM",
      "Need help",
      "english",
      "trauma",
      3,
      1,
      "New York",
      "Evenings",
      true,
      false,
      "anxiety",
      60,
      100,
      "pending"
    );
    const result = contract.acceptReferral(0, "ST2INVALID");
    expect(result).toEqual({ ok: false, value: ERR_COUNSELOR_NOT_VERIFIED });
  });

  it("updates referral status", () => {
    contract.createReferral(
      "ST1VICTIM",
      "Need help",
      "english",
      "trauma",
      3,
      1,
      "New York",
      "Evenings",
      true,
      false,
      "anxiety",
      60,
      100,
      "pending"
    );
    const result = contract.updateReferralStatus(0, "in-progress", "Starting now");
    expect(result.ok).toBe(true);
    expect(contract.getReferral(0)?.status).toBe("in-progress");
  });

  it("rejects status update for unauthorized caller", () => {
    contract.createReferral(
      "ST1VICTIM",
      "Need help",
      "english",
      "trauma",
      3,
      1,
      "New York",
      "Evenings",
      true,
      false,
      "anxiety",
      60,
      100,
      "pending"
    );
    contract.caller = "ST3UNAUTH";
    const result = contract.updateReferralStatus(0, "in-progress", "Starting now");
    expect(result).toEqual({ ok: false, value: ERR_NOT_AUTHORIZED });
  });

  it("provides feedback", () => {
    contract.createReferral(
      "ST1VICTIM",
      "Need help",
      "english",
      "trauma",
      3,
      1,
      "New York",
      "Evenings",
      true,
      false,
      "anxiety",
      60,
      100,
      "pending"
    );
    contract.updateReferralStatus(0, "completed", "Done");
    const result = contract.provideFeedback(0, 4);
    expect(result.ok).toBe(true);
    expect(contract.getReferral(0)?.feedbackScore).toBe(4);
  });

  it("rejects feedback for non-completed referral", () => {
    contract.createReferral(
      "ST1VICTIM",
      "Need help",
      "english",
      "trauma",
      3,
      1,
      "New York",
      "Evenings",
      true,
      false,
      "anxiety",
      60,
      100,
      "pending"
    );
    const result = contract.provideFeedback(0, 4);
    expect(result).toEqual({ ok: false, value: ERR_INVALID_STATUS });
  });

  it("closes referral", () => {
    contract.createReferral(
      "ST1VICTIM",
      "Need help",
      "english",
      "trauma",
      3,
      1,
      "New York",
      "Evenings",
      true,
      false,
      "anxiety",
      60,
      100,
      "pending"
    );
    const result = contract.closeReferral(0, "No longer needed");
    expect(result.ok).toBe(true);
    expect(contract.getReferral(0)?.status).toBe("closed");
  });

  it("rejects close for already closed referral", () => {
    contract.createReferral(
      "ST1VICTIM",
      "Need help",
      "english",
      "trauma",
      3,
      1,
      "New York",
      "Evenings",
      true,
      false,
      "anxiety",
      60,
      100,
      "pending"
    );
    contract.closeReferral(0, "No longer needed");
    const result = contract.closeReferral(0, "Again");
    expect(result).toEqual({ ok: false, value: ERR_INVALID_STATUS });
  });

  it("rejects referral", () => {
    contract.createReferral(
      "ST1VICTIM",
      "Need help",
      "english",
      "trauma",
      3,
      1,
      "New York",
      "Evenings",
      true,
      false,
      "anxiety",
      60,
      100,
      "pending"
    );
    contract.acceptReferral(0, "ST1COUNSELOR");
    contract.caller = "ST1COUNSELOR";
    const result = contract.rejectReferral(0, "Unavailable");
    expect(result.ok).toBe(true);
    expect(contract.getReferral(0)?.status).toBe("rejected");
  });

  it("starts session", () => {
    contract.createReferral(
      "ST1VICTIM",
      "Need help",
      "english",
      "trauma",
      3,
      1,
      "New York",
      "Evenings",
      true,
      false,
      "anxiety",
      60,
      100,
      "pending"
    );
    contract.acceptReferral(0, "ST1COUNSELOR");
    const result = contract.startSession(0);
    expect(result.ok).toBe(true);
    expect(contract.getReferral(0)?.status).toBe("in-progress");
  });

  it("completes session", () => {
    contract.createReferral(
      "ST1VICTIM",
      "Need help",
      "english",
      "trauma",
      3,
      1,
      "New York",
      "Evenings",
      true,
      false,
      "anxiety",
      60,
      100,
      "pending"
    );
    contract.acceptReferral(0, "ST1COUNSELOR");
    contract.startSession(0);
    const result = contract.completeSession(0);
    expect(result.ok).toBe(true);
    expect(contract.getReferral(0)?.status).toBe("completed");
  });
});