async function testChecks() {
  const headers = {
    "User-Agent": "Antigravity-Diagnostic",
    "Accept": "application/vnd.github+json",
  };

  const shas = ["0db863d", "d775123", "f20cef6", "087f768", "0b2b80e", "0c99dfa", "d46488e", "b50faec"];
  
  console.log("--- 1. CHECK RUNS ---");
  for (const sha of shas) {
    const res = await fetch(`https://api.github.com/repos/Chamalka-heshi/SC-FrostHeaven/commits/${sha}/check-runs`, { headers });
    const data = await res.json();
    console.log(`\n=== Commit ${sha} Check Runs (HTTP ${res.status}) ===`);
    if (data.check_runs && data.check_runs.length > 0) {
      data.check_runs.forEach((c: any) => {
        console.log(`  - Name: ${c.name}`);
        console.log(`    Status: ${c.status}, Conclusion: ${c.conclusion}`);
        console.log(`    Started: ${c.started_at}, Completed: ${c.completed_at}`);
        console.log(`    Output Title: ${c.output?.title}`);
        console.log(`    Output Summary: ${c.output?.summary}`);
        console.log(`    App Name: ${c.app?.name}`);
        console.log(`    HTML URL: ${c.html_url}`);
      });
    } else {
      console.log("  No check runs or:", data.message || "empty");
    }
  }

  console.log("\n--- 2. COMMIT STATUSES ---");
  for (const sha of shas) {
    const res = await fetch(`https://api.github.com/repos/Chamalka-heshi/SC-FrostHeaven/commits/${sha}/statuses`, { headers });
    const data = await res.json();
    console.log(`\n=== Commit ${sha} Statuses (HTTP ${res.status}) ===`);
    if (Array.isArray(data) && data.length > 0) {
      data.forEach((s: any) => {
        console.log(`  - Context: ${s.context}`);
        console.log(`    State: ${s.state}, Description: ${s.description}`);
        console.log(`    Created: ${s.created_at}, Target: ${s.target_url}`);
      });
    } else {
      console.log("  No status records or:", data.message || "empty");
    }
  }
  console.log("\n--- 3. PULL REQUESTS ---");
  const pullsRes = await fetch(`https://api.github.com/repos/Chamalka-heshi/SC-FrostHeaven/pulls?state=all`, { headers });
  const pulls = await pullsRes.json();
  console.log("Pulls count:", Array.isArray(pulls) ? pulls.length : pulls);
  if (Array.isArray(pulls)) {
    pulls.forEach((p: any) => {
      console.log(`  - PR #${p.number}: "${p.title}" (State: ${p.state}, Head SHA: ${p.head?.sha}, Base: ${p.base?.ref})`);
    });
  }

  console.log("\n--- 4. WORKFLOW RUNS ---");
  const actRes = await fetch(`https://api.github.com/repos/Chamalka-heshi/SC-FrostHeaven/actions/runs`, { headers });
  const act = await actRes.json();
  console.log("Total actions:", act.total_count);
  if (act.workflow_runs) {
    act.workflow_runs.slice(0, 10).forEach((w: any) => {
      console.log(`  - Run #${w.run_number} (${w.name}): ${w.event} on ${w.head_branch} (${w.head_sha?.slice(0, 7)}) -> Status: ${w.status}, Conclusion: ${w.conclusion}`);
    });
  }
}

testChecks().catch(console.error);
