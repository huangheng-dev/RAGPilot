const plannedTools = [
  "web_search",
  "web_fetch",
  "document_lookup",
  "workflow_status",
  "report_generator"
];

console.log("RAGPilot MCP server boundary loaded.");
console.log(
  JSON.stringify(
    {
      status: "reserved_boundary",
      plannedTools
    },
    null,
    2
  )
);
