import { runDueFollowups } from "@/lib/workflow";

const results = await runDueFollowups({ manualTrigger: true });
console.log(JSON.stringify({ boundary: "local_worker", manualTrigger: true, results }, null, 2));
