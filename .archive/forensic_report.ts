import * as fs from 'fs';

interface Question {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  topicId: string;
  chapterId: string;
}

interface ManifestEntry {
  original_id: string;
  canonical_id: string;
  current_topic: string;
  target_topic: string;
  action: 'STAY' | 'MOVE' | 'DELETE';
  reason: string;
  text_preview: string;
  is_canonical: boolean;
}

function getHash(q: Question) {
  const text = (q.text || '').trim();
  const options = (q.options || []).map(o => o.trim()).sort().join('|');
  return `${text}@@@${options}`;
}

async function runForensics() {
  const backup = JSON.parse(fs.readFileSync('./prajamandal_backup.json', 'utf8'));
  const manifestData = JSON.parse(fs.readFileSync('./recovery_manifest.json', 'utf8'));
  
  const mcqs: Question[] = backup.mcqs;
  const manifest: ManifestEntry[] = manifestData.manifest;
  
  console.log('--- FORENSIC AUDIT START ---');
  
  // 1. Physical Records
  const totalPhysical = mcqs.length;
  console.log(`Total Physical Records in Backup: ${totalPhysical}`);
  
  // 2. Unique Logical Questions
  const uniqueQuestions = new Map<string, Question[]>();
  mcqs.forEach(q => {
    const hash = getHash(q);
    if (!uniqueQuestions.has(hash)) {
      uniqueQuestions.set(hash, []);
    }
    uniqueQuestions.get(hash)!.push(q);
  });
  console.log(`Total Unique Logical Questions: ${uniqueQuestions.size}`);
  
  // 3. Deletion Breakdown
  const deletions = manifest.filter(m => m.action === 'DELETE');
  const duplicates = deletions.filter(m => m.reason.toLowerCase().includes('duplicate'));
  const orphans = deletions.filter(m => m.reason.toLowerCase().includes('orphan'));
  const others = deletions.filter(m => !m.reason.toLowerCase().includes('duplicate') && !m.reason.toLowerCase().includes('orphan'));
  
  console.log(`Deletion Breakdown (Total ${deletions.length}):`);
  console.log(`- Confirmed Duplicates: ${duplicates.length}`);
  console.log(`- Confirmed Orphans: ${orphans.length}`);
  console.log(`- Others: ${others.length}`);
  
  // 4. Orphan Check
  const orphanCount = orphans.length;
  console.log(`Current Orphan Candidate Count: ${orphanCount}`);
  
  // 5. Moves
  const moves = manifest.filter(m => m.action === 'MOVE');
  console.log(`Total Moves: ${moves.length}`);
  
  // 6. Recoverability Check
  let lostQuestions = 0;
  uniqueQuestions.forEach((records, hash) => {
    const surviving = records.some(r => {
      const m = manifest.find(me => me.original_id === r.id);
      return m && (m.action === 'STAY' || m.action === 'MOVE');
    });
    if (!surviving) {
      lostQuestions++;
      console.log(`CRITICAL: Lost Question! Hash: ${hash.substring(0, 50)}...`);
    }
  });
  console.log(`Questions with zero survivors: ${lostQuestions}`);
  
  // 7. Data for Report
  const moveLog = moves.map(m => ({
    id: m.original_id,
    from: m.current_topic,
    to: m.target_topic
  }));
  
  const deletionLog = deletions.map(m => ({
    id: m.original_id,
    canonical: m.canonical_id,
    reason: m.reason
  }));

  // Identify the "31st Orphan"
  // Previous audit: 31 orphans. Current manifest: 30 orphans + 111 duplicates (total 141 deletions).
  // Wait, if physical was 546 and now 576, that's +30.
  // 576 - 141 (deletions) = 435. Correct.
  // 546 - 111 (duplicates) = 435. Correct.
  // This means the 30 "orphans" ARE the 30 new records discovered in the 546->576 jump.
  // And the 31st orphan from the old audit was actually a duplicate already counted in the 111.
  
  fs.writeFileSync('./forensic_results.json', JSON.stringify({
    totalPhysical,
    uniqueCount: uniqueQuestions.size,
    deletions: {
      total: deletions.length,
      duplicates: duplicates.length,
      orphans: orphans.length,
      others: others.length
    },
    moves: moveLog,
    deletionList: deletionLog,
    recoverability: lostQuestions === 0 ? "PASSED" : "FAILED"
  }, null, 2));
  
  console.log('--- FORENSIC AUDIT COMPLETE ---');
}

runForensics();
