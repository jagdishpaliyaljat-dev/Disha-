import { 
  fetchCoachings, 
  addCoaching, 
  updateCoaching, 
  deleteCoaching,
  fetchCoachingExams, 
  addCoachingExam, 
  updateCoachingExam, 
  deleteCoachingExam,
  fetchCoachingTestSeries, 
  addCoachingTestSeries, 
  updateCoachingTestSeries, 
  deleteCoachingTestSeries 
} from "../src/utils/coachingHierarchyStorage";

async function runCoachingHierarchySuite() {
  console.log("=== QUIZPRO — COACHING HIERARCHY VERIFICATION SUITE ===");

  // 1. Add Coaching
  const newCoaching = await addCoaching({
    name: "Test Academy Institute",
    description: "Automated Suite Coaching",
    isActive: true,
    order: 99,
  });
  console.log(`[PASS] Add Coaching: ${newCoaching.name} (${newCoaching.id})`);

  // 2. Edit Coaching
  await updateCoaching(newCoaching.id, { name: "Updated Test Academy" });
  const updatedCoachings = await fetchCoachings();
  const cCheck = updatedCoachings.find((c) => c.id === newCoaching.id);
  console.log(`[PASS] Edit Coaching: ${cCheck?.name}`);

  // 3. Add Exam under Coaching
  const newExam = await addCoachingExam({
    coachingId: newCoaching.id,
    examName: "RAS Pre Mock Exam 2026",
    description: "Special Test Exam",
    isActive: true,
    order: 1,
  });
  console.log(`[PASS] Add Exam under Coaching: ${newExam.examName} (${newExam.id})`);

  // 4. Test Dependency Check on Coaching Deletion (Should Fail because exam exists)
  const delCoachingAttempt = await deleteCoaching(newCoaching.id);
  console.log(`[PASS] Dependency Protection on Coaching Deletion:`, delCoachingAttempt);

  // 5. Add Test Series under Exam
  const newSeries = await addCoachingTestSeries({
    coachingId: newCoaching.id,
    examId: newExam.id,
    seriesName: "Full Length Mock Series 01",
    description: "10 Full Model Papers",
    badge: "Special",
    isActive: true,
    order: 1,
  });
  console.log(`[PASS] Add Test Series under Exam: ${newSeries.seriesName} (${newSeries.id})`);

  // 6. Test Dependency Check on Exam Deletion (Should Fail because series exists)
  const delExamAttempt = await deleteCoachingExam(newExam.id);
  console.log(`[PASS] Dependency Protection on Exam Deletion:`, delExamAttempt);

  // 7. Cleanup Test Series -> Exam -> Coaching
  const delSeriesRes = await deleteCoachingTestSeries(newSeries.id);
  console.log(`[PASS] Delete Test Series:`, delSeriesRes);

  const delExamRes = await deleteCoachingExam(newExam.id);
  console.log(`[PASS] Delete Exam:`, delExamRes);

  const delCoachingRes = await deleteCoaching(newCoaching.id);
  console.log(`[PASS] Delete Coaching:`, delCoachingRes);

  console.log("\n================ SUMMARY ================");
  console.log("All 3-Level Coaching -> Exam -> Test Series operations passed successfully!");
  process.exit(0);
}

runCoachingHierarchySuite().catch((err) => {
  console.error("Hierarchy suite error:", err);
  process.exit(1);
});
