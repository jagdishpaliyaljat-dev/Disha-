import { describe, it, expect, beforeEach } from "vitest";
import { 
  ROLE_CONFIGS, 
  DEFAULT_ROLE_PERMISSIONS, 
  getStaffRole, 
  isStaffUser, 
  isSuperAdminRole, 
  hasPermission,
  canManageStaff,
  canApproveQuestions,
  canPublishQuestions,
  canEditCurriculum,
  canViewSupportDesk
} from "../src/utils/rbac";
import { 
  fetchStaffMembers, 
  inviteStaffMember, 
  updateStaffRoleAndPermissions, 
  updateStaffStatus, 
  revokeStaffAccess, 
  fetchStaffAuditLogs,
  getCachedStaffMembers,
  setCachedStaffMembers,
  getCachedStaffInvitations,
  setCachedStaffInvitations,
  getCachedStaffAuditLogs,
  setCachedStaffAuditLogs
} from "../src/utils/staffManagementService";
import { 
  fetchReviewQueueQuestions, 
  submitQuestionForReview, 
  approveQuestion, 
  rejectQuestion, 
  publishQuestion, 
  bulkApproveQuestions,
  getCachedReviewQuestions,
  setCachedReviewQuestions
} from "../src/utils/questionReviewService";
import { UserProfile, Question } from "../src/types";

const superAdminProfile: UserProfile = {
  id: "9a821db5-5257-42b2-af8a-7f9369b7937f",
  email: "jagdishpaliyaljat@gmail.com",
  name: "Jagdish Paliyal",
  role: "super_admin",
  staffRole: "super_admin",
  status: "active",
  createdAt: new Date().toISOString(),
};

const smeTeacherProfile: UserProfile = {
  id: "sme-user-123",
  email: "teacher@disha2020.in",
  name: "Teacher User",
  role: "sme_teacher",
  staffRole: "sme_teacher",
  status: "active",
  createdAt: new Date().toISOString(),
};

const reviewerProfile: UserProfile = {
  id: "reviewer-user-456",
  email: "reviewer@disha2020.in",
  name: "Reviewer User",
  role: "content_reviewer",
  staffRole: "content_reviewer",
  status: "active",
  createdAt: new Date().toISOString(),
};

const supportProfile: UserProfile = {
  id: "support-user-789",
  email: "support@disha2020.in",
  name: "Support User",
  role: "support_agent",
  staffRole: "support_agent",
  status: "active",
  createdAt: new Date().toISOString(),
};

const studentProfile: UserProfile = {
  id: "student-user-000",
  email: "aspirant@gmail.com",
  name: "Student Aspirant",
  role: "student",
  status: "active",
  createdAt: new Date().toISOString(),
};

const suspendedStaffProfile: UserProfile = {
  id: "suspended-staff-999",
  email: "suspended@disha2020.in",
  name: "Suspended Reviewer",
  role: "content_reviewer",
  staffRole: "content_reviewer",
  staffStatus: "suspended",
  status: "suspended",
  createdAt: new Date().toISOString(),
};

describe("Enterprise RBAC & Role-Based Access Control", () => {

  it("correctly identifies staff roles and configurations", () => {
    expect(getStaffRole(superAdminProfile)).toBe("super_admin");
    expect(getStaffRole(smeTeacherProfile)).toBe("sme_teacher");
    expect(getStaffRole(reviewerProfile)).toBe("content_reviewer");
    expect(getStaffRole(supportProfile)).toBe("support_agent");
    expect(getStaffRole(studentProfile)).toBe("student");

    expect(isStaffUser(superAdminProfile)).toBe(true);
    expect(isStaffUser(smeTeacherProfile)).toBe(true);
    expect(isStaffUser(reviewerProfile)).toBe(true);
    expect(isStaffUser(supportProfile)).toBe(true);
    expect(isStaffUser(studentProfile)).toBe(false);
    expect(isStaffUser(suspendedStaffProfile)).toBe(false); // Suspended staff blocked
  });

  it("enforces granular permissions matrix for Super Admin", () => {
    expect(isSuperAdminRole(superAdminProfile)).toBe(true);
    expect(canManageStaff(superAdminProfile)).toBe(true);
    expect(canApproveQuestions(superAdminProfile)).toBe(true);
    expect(canPublishQuestions(superAdminProfile)).toBe(true);
    expect(canEditCurriculum(superAdminProfile)).toBe(true);
    expect(hasPermission(superAdminProfile, "database", "manage")).toBe(true);
    expect(hasPermission(superAdminProfile, "system_settings", "manage")).toBe(true);
  });

  it("enforces granular permissions matrix for SME / Teacher", () => {
    expect(canEditCurriculum(smeTeacherProfile)).toBe(true);
    expect(hasPermission(smeTeacherProfile, "questions", "create")).toBe(true);
    expect(hasPermission(smeTeacherProfile, "questions", "edit")).toBe(true);
    expect(hasPermission(smeTeacherProfile, "question_approval", "view")).toBe(true);

    // SME cannot approve/publish or manage staff or database
    expect(canApproveQuestions(smeTeacherProfile)).toBe(false);
    expect(canPublishQuestions(smeTeacherProfile)).toBe(false);
    expect(canManageStaff(smeTeacherProfile)).toBe(false);
    expect(hasPermission(smeTeacherProfile, "database", "view")).toBe(false);
    expect(hasPermission(smeTeacherProfile, "system_settings", "manage")).toBe(false);
  });

  it("enforces granular permissions matrix for Content Reviewer", () => {
    expect(canApproveQuestions(reviewerProfile)).toBe(true);
    expect(canPublishQuestions(reviewerProfile)).toBe(true);
    expect(hasPermission(reviewerProfile, "question_approval", "approve")).toBe(true);
    expect(hasPermission(reviewerProfile, "questions", "edit")).toBe(true);

    // Reviewer cannot manage staff or system settings
    expect(canManageStaff(reviewerProfile)).toBe(false);
    expect(hasPermission(reviewerProfile, "system_settings", "manage")).toBe(false);
    expect(hasPermission(reviewerProfile, "database", "view")).toBe(false);
  });

  it("enforces granular permissions matrix for Support Agent", () => {
    expect(canViewSupportDesk(supportProfile)).toBe(true);
    expect(hasPermission(supportProfile, "support", "manage")).toBe(true);
    expect(hasPermission(supportProfile, "users", "view")).toBe(true);

    // Support agent cannot edit curriculum or approve questions
    expect(canEditCurriculum(supportProfile)).toBe(false);
    expect(canApproveQuestions(supportProfile)).toBe(false);
    expect(canPublishQuestions(supportProfile)).toBe(false);
    expect(canManageStaff(supportProfile)).toBe(false);
  });

  it("immediately denies all capabilities for suspended accounts", () => {
    expect(hasPermission(suspendedStaffProfile, "questions", "view")).toBe(false);
    expect(canApproveQuestions(suspendedStaffProfile)).toBe(false);
    expect(canPublishQuestions(suspendedStaffProfile)).toBe(false);
  });
});

describe("Staff Management Service & Lifecycle", { timeout: 25000 }, () => {
  beforeEach(() => {
    // Reset seed cache
    setCachedStaffMembers([]);
    setCachedStaffInvitations([]);
    setCachedStaffAuditLogs([]);
  });

  it("initializes with default seed staff directory", async () => {
    const { staff } = await fetchStaffMembers();
    expect(staff.length).toBeGreaterThan(0);
    const superAdmin = staff.find(s => s.role === "super_admin");
    expect(superAdmin).toBeDefined();
    expect(superAdmin?.email).toBe("jagdishpaliyaljat@gmail.com");
  });

  it("allows inviting a new staff member and records audit log", async () => {
    const { invitation, staffMember } = await inviteStaffMember({
      email: "new.sme@disha2020.in",
      name: "New SME Expert",
      role: "sme_teacher",
      assignedSubjects: ["Economics", "History"],
    });

    expect(invitation.email).toBe("new.sme@disha2020.in");
    expect(invitation.status).toBe("pending");
    expect(invitation.token).toBeDefined();

    expect(staffMember.name).toBe("New SME Expert");
    expect(staffMember.role).toBe("sme_teacher");
    expect(staffMember.status).toBe("invited");
    expect(staffMember.assignedSubjects).toContain("Economics");

    // Verify audit log was recorded
    const logs = await fetchStaffAuditLogs();
    const inviteLog = logs.find(l => l.action === "invite_staff");
    expect(inviteLog).toBeDefined();
    expect(inviteLog?.resourceType).toBe("staff");
  });

  it("updates staff member role and assigned subjects", async () => {
    const { staffMember } = await inviteStaffMember({
      email: "promoted.staff@disha2020.in",
      name: "Promoted Staff",
      role: "support_agent",
    });

    const updated = await updateStaffRoleAndPermissions(
      staffMember.id,
      "content_reviewer",
      DEFAULT_ROLE_PERMISSIONS.content_reviewer,
      ["All Subjects"]
    );

    expect(updated.role).toBe("content_reviewer");
    expect(updated.assignedSubjects).toEqual(["All Subjects"]);

    const logs = await fetchStaffAuditLogs();
    const roleLog = logs.find(l => l.action === "update_staff_role");
    expect(roleLog).toBeDefined();
  });

  it("suspends and reactivates a staff member", async () => {
    const { staffMember } = await inviteStaffMember({
      email: "temp.staff@disha2020.in",
      name: "Temporary Staff",
      role: "sme_teacher",
    });

    // Suspend
    const suspended = await updateStaffStatus(staffMember.id, "suspended", "Audit hold");
    expect(suspended.status).toBe("suspended");

    // Reactivate
    const reactivated = await updateStaffStatus(staffMember.id, "active", "Audit cleared");
    expect(reactivated.status).toBe("active");
  });

  it("revokes staff access cleanly", async () => {
    const { staffMember } = await inviteStaffMember({
      email: "remove.me@disha2020.in",
      name: "To Remove",
      role: "support_agent",
    });

    await revokeStaffAccess(staffMember.id);
    const { staff } = await fetchStaffMembers();
    expect(staff.find(s => s.id === staffMember.id)).toBeUndefined();
  });
});

describe("Question Review & Approval Workflow", { timeout: 25000 }, () => {
  beforeEach(() => {
    setCachedReviewQuestions([]);
  });

  it("initializes review queue with seed questions", async () => {
    const queue = await fetchReviewQueueQuestions();
    expect(queue.length).toBeGreaterThan(0);
    expect(queue.some(q => q.approvalStatus === "pending_review")).toBe(true);
  });

  it("submits a newly authored question for review", async () => {
    const draftedQ: Question = {
      id: "test-draft-001",
      topicId: "top-1",
      chapterId: "chap-1",
      text: "What is the primary objective of monetary policy in India?",
      options: ["Price stability with growth", "Direct tax collection", "Import substitution", "Currency printing"],
      correctIndex: 0,
      explanation: "Under the RBI Act, the primary objective is to maintain price stability while keeping in mind the objective of growth.",
    };

    const submitted = await submitQuestionForReview(draftedQ, null, "First draft for Macroeconomics");
    expect(submitted.approvalStatus).toBe("pending_review");
    expect(submitted.reviewNotes).toBe("First draft for Macroeconomics");
    expect(submitted.submittedAt).toBeDefined();

    const pendingQueue = await fetchReviewQueueQuestions({ status: "pending_review" });
    expect(pendingQueue.some(q => q.id === "test-draft-001")).toBe(true);
  });

  it("approves and publishes a pending question", async () => {
    const draftedQ: Question = {
      id: "test-draft-002",
      topicId: "top-1",
      chapterId: "chap-1",
      text: "Which curve represents the trade-off between inflation and unemployment?",
      options: ["Phillips Curve", "Lorenz Curve", "Laffer Curve", "Kuznets Curve"],
      correctIndex: 0,
      explanation: "The Phillips curve represents the inverse relationship between inflation and unemployment in the short run.",
    };

    await submitQuestionForReview(draftedQ);

    const approved = await approveQuestion("test-draft-002", true, reviewerProfile);
    expect(approved.approvalStatus).toBe("published");
    expect(approved.reviewedAt).toBeDefined();

    const publishedQueue = await fetchReviewQueueQuestions({ status: "published" });
    expect(publishedQueue.some(q => q.id === "test-draft-002")).toBe(true);
  });

  it("rejects a question with feedback revision notes", async () => {
    const draftedQ: Question = {
      id: "test-draft-003",
      topicId: "top-1",
      chapterId: "chap-1",
      text: "Draft question with missing details",
      options: ["A", "B", "C", "D"],
      correctIndex: 1,
      explanation: "Short note",
    };

    await submitQuestionForReview(draftedQ);

    const rejected = await rejectQuestion("test-draft-003", "Explanation is too brief and options lack Hindi translation.", reviewerProfile);
    expect(rejected.approvalStatus).toBe("rejected");
    expect(rejected.reviewNotes).toBe("Explanation is too brief and options lack Hindi translation.");

    const rejectedQueue = await fetchReviewQueueQuestions({ status: "rejected" });
    expect(rejectedQueue.some(q => q.id === "test-draft-003")).toBe(true);
  });

  it("supports bulk approval of questions", async () => {
    const q1: Question = {
      id: "bulk-01",
      topicId: "top-1",
      chapterId: "chap-1",
      text: "Bulk Test 1",
      options: ["A", "B", "C", "D"],
      correctIndex: 0,
      explanation: "Exp 1",
    };
    const q2: Question = {
      id: "bulk-02",
      topicId: "top-1",
      chapterId: "chap-1",
      text: "Bulk Test 2",
      options: ["A", "B", "C", "D"],
      correctIndex: 0,
      explanation: "Exp 2",
    };

    await submitQuestionForReview(q1);
    await submitQuestionForReview(q2);

    const result = await bulkApproveQuestions(["bulk-01", "bulk-02"], true, reviewerProfile);
    expect(result.successCount).toBe(2);
    expect(result.failedIds.length).toBe(0);
  });
});
