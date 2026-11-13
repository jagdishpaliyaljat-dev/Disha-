import * as fs from 'fs';

async function generateReport() {
  const manifestData = JSON.parse(fs.readFileSync('./recovery_manifest.json', 'utf8'));
  const manifest: any[] = manifestData.manifest;
  
  const deletions = manifest.filter((m: any) => m.action === 'DELETE');
  const duplicates = deletions.filter((m: any) => m.reason.toLowerCase().includes('duplicate'));
  const orphans = deletions.filter((m: any) => m.reason.toLowerCase().includes('orphan'));
  
  console.log(`Total Physical: ${manifest.length}`);
  console.log(`Deletions: ${deletions.length}`);
  console.log(`- Duplicates: ${duplicates.length}`);
  console.log(`- Orphans: ${orphans.length}`);
  
  // Find the 31st orphan logic
  // If we had 31 orphans in previous audit, and now 30 orphans + 111 duplicates.
  // Let's see if any "duplicate" has an ID that looks like an orphan (e.g. from the mcq_ prefix but not in the main set).
  
  const moves = manifest.filter((m: any) => m.action === 'MOVE');
  console.log(`Moves: ${moves.length}`);
  
  const stay = manifest.filter((m: any) => m.action === 'STAY');
  console.log(`Stay: ${stay.length}`);
  
  // Verify MCQ 3
  const mcq3_topic = "topic_1b890441-cad7-4e64-82db-4e9680de9f4b-mcq3"; // Placeholder, need to find actual ID
  // Let's just find records targetted for MCQ3 in manifest summary distribution
  console.log('Target Distribution:', manifestData.summary.topic_distribution_target);
  
  const results = {
    deletion_ids: deletions.map((d: any) => ({ id: d.original_id, canonical: d.canonical_id, reason: d.reason })),
    move_ids: moves.map((m: any) => ({ id: m.original_id, from: m.current_topic, to: m.target_topic })),
    orphan_ids: orphans.map((o: any) => o.original_id)
  };
  
  fs.writeFileSync('./detailed_forensics.json', JSON.stringify(results, null, 2));
}

generateReport();
