import { runDueFollowups } from "@/lib/workflow";

const results = await runDueFollowups();
console.log(JSON.stringify({ boundary: "local_worker", manualTrigger: true, results }, null, 2));
