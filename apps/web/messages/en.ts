const en = {
  shell: {
    nav: {
      home: "Home",
      chat: "Chat",
      documents: "Documents",
      workflows: "Workflows",
      agents: "Agents",
    },
    languagePlaceholder: "Language",
    languages: {
      en: "English",
      zhCN: "Simplified Chinese",
    },
    userMenu: {
      title: "Local Operator",
      subtitle: "English-first open-source workspace",
      home: "Home",
      workspace: "Workspace",
      operations: "Operations",
      admin: "Admin Console",
      accessControl: "Access Control",
      settings: "System Settings",
      signIn: "Sign In",
      signOut: "Sign Out",
      rolePrefix: "Role:",
      currentTenant: "Current organization",
      memberships: "Memberships",
      noMemberships: "No tenant memberships yet.",
    },
    actions: {
      openRepository: "Open GitHub repository",
    },
  },
  accessControl: {
    title: "Retrieval Access Control",
    description: "Manage tenant groups and enforce document or Chunk visibility in the retrieval path.",
    fields: {
      tenant: "Tenant", groupName: "Group name", groupSlug: "Group slug", description: "Description",
      member: "Select an active tenant member", document: "Document", chunk: "Chunk", resourceId: "Resource UUID",
      group: "Group", user: "User", grantSubject: "Select a grant subject"
    },
    groups: { title: "Access groups", description: "Tenant-scoped reader groups used by retrieval ACLs.", empty: "No access groups yet." },
    members: { title: "Group members", description: "Only active tenant members can be added.", selectGroup: "Select a group to manage members.", empty: "This group has no members." },
    policy: { title: "Resource policy", description: "Load a document or Chunk UUID and replace its server-enforced read policy.", noGrants: "No explicit read grants." },
    scope: { tenant: "Tenant readable", inherit: "Inherit document policy", restricted: "Restricted" },
    actions: { createGroup: "Create group", add: "Add", remove: "Remove", loadPolicy: "Load policy", addGrant: "Add grant", savePolicy: "Save policy" },
    status: { loadFailed: "Access control data could not be loaded.", saveFailed: "Access control change failed.", groupCreated: "Access group created.", memberAdded: "Group member added.", memberRemoved: "Group member removed.", policyLoadFailed: "Resource policy could not be loaded.", policySaved: "Resource policy saved and is active for retrieval." }
  },
  agents: {
    access: {
      editable: "Editable",
      readOnly: "Read-only",
    },
    title: "Agents",
    header: {
      eyebrow: "Agent Studio",
      title: "Agent design workspace",
      description:
        "Define agent configurations, tool access boundaries, and execution control policies in alignment with the built RAGPilot platform surfaces.",
    },
    status: {
      loading: "Loading agent definitions...",
      ready: "Agent design workspace ready.",
      restored: "Loaded {count} agent definitions.",
      migrated:
        "Upgraded {count} standard agent drafts to the current product copy.",
      seeded: "Initialized {count} standard agent drafts.",
      restoreFailed: "Agent definition loading failed.",
      noTenants:
        "No tenants are provisioned yet. Create a tenant before defining agents.",
      refreshing: "Refreshing agent definitions...",
      refreshed: "Refreshed {count} agent definitions.",
      created: "New agent draft created.",
      createFailed: "Creating the agent draft failed.",
      duplicated: "{name} duplicated into a new draft.",
      deleted: "{name} removed from the agent workspace.",
      bulkDeleted: "Deleted {count} agents.",
      deleteFailed: "Deleting the agent draft failed.",
      saved: "{name} saved.",
      activated: "{name} promoted to active runtime.",
      paused: "{name} paused for controlled review.",
      returnedToDraft: "{name} moved back to draft.",
      saveFailed: "Saving the agent draft failed.",
      launchRecorded: "Launch recorded for {surface}.",
      launchFailed: "Agent launch recording failed.",
      launchHistoryFailed: "Agent run history failed to load.",
      executionQueued: "Agent execution queued.",
      executionCompleted: "Agent execution completed.",
      executionFailed: "Agent execution failed.",
      executionCancelled: "Agent execution cancelled.",
      executionCancelFailed: "Agent execution could not be cancelled.",
      executionBlocked: "Only active, runtime-ready agents can be executed.",
      executionHistoryFailed: "Agent execution history failed to load.",
      validationFailed: "Agent name and slug are required.",
      activationBlocked:
        "Active agents must have a valid model, an allowed scope, and at least one connected tool before they can be saved.",
      runtimeLaunchBlocked:
        "Only active, runtime-ready agents can be launched into delivery surfaces.",
      lastUpdated: "Last updated {value}",
    },
    actions: {
      refresh: "Refresh",
      refreshing: "Refreshing...",
      launching: "Launching...",
      execute: "Execute Agent",
      executing: "Executing...",
      newDraft: "New Agent",
      duplicate: "Duplicate",
      saveDraft: "Save Draft",
      activate: "Activate",
      pause: "Pause",
      moveToDraft: "Move to Draft",
      delete: "Delete",
      openChat: "Open Chat",
      openDocuments: "Open Documents",
      openOperations: "Open Operations",
      openAdmin: "Open Admin",
    },
    confirm: {
      delete:
        "Delete {name}? This removes the persisted agent definition for the current tenant.",
      bulkDelete:
        "Delete the {count} selected agents? This action cannot be undone.",
    },
    metrics: {
      totalDrafts: "Total drafts",
      activeDrafts: "Active drafts",
      toolEnabledDrafts: "Tool-enabled drafts",
      scopedDrafts: "Scoped drafts",
      noScope: "No scope",
    },
    executionPackets: {
      title: "Execution packets",
      description:
        "Bundle definition readiness, runtime routing, governance posture, and surface delivery into one formal control layer.",
      statuses: {
        attention: "Attention",
        review: "Review",
        healthy: "Healthy",
      },
      notSelected: "No agent selected",
      scopePending: "Scope pending",
      modelInherited: "Inherited model strategy",
      readiness: {
        title: "Readiness packet",
        metric: "Ready definitions",
        readyDetail: "{name} currently satisfies the minimum runtime posture.",
        reviewDetail:
          "{name} still has {count} readiness issues to resolve before clean runtime delivery.",
        emptyDetail:
          "Select an agent to inspect runtime readiness and governance posture.",
        primaryAction: "Open definition review",
        secondaryAdmin: "Open admin overview",
        secondaryOperations: "Open operations",
      },
      delivery: {
        title: "Delivery packet",
        metric: "Resolved delivery scope",
        readyDetail: "This definition can already hand off into {destination}.",
        emptyDetail:
          "No runtime destination is available yet. Scope and mode need to be aligned first.",
        primaryAction: "Open delivery route",
        secondaryChat: "Open chat",
        secondaryDocuments: "Open documents",
      },
      runtime: {
        title: "Runtime packet",
        metric: "Connected capabilities",
        detail:
          "{count} connected capabilities are available. Runtime model: {model}.",
        emptyDetail:
          "Select an agent to inspect runtime capabilities and the resolved model path.",
        primaryAction: "Open runtime surface",
        secondaryOperations: "Open operations",
        secondaryAdmin: "Open admin",
      },
      retrieval: {
        title: "Retrieval packet",
        metric: "Resolved retrieval posture",
        readyDetail:
          "{profile} is currently aligned to the selected knowledge scope.",
        missingDetail:
          "The selected scope ({scope}) still needs a governed retrieval posture before clean runtime delivery.",
        disabledDetail:
          "{profile} is currently disabled and should be remediated before runtime delivery continues.",
        emptyDetail:
          "Select a grounded or document-intake definition to inspect retrieval governance posture.",
        primaryAction: "Review retrieval governance",
        primaryMissingAction: "Review default fallback",
        secondarySettings: "Open settings",
        secondaryDefinitions: "Open active definitions",
      },
      governance: {
        title: "Governance packet",
        metric: "Resolved model posture",
        activeDetail:
          "{active} active definitions are currently visible out of {total} total definitions in this tenant scope.",
        emptyDetail:
          "No active agent definitions are currently visible in this tenant scope.",
        primaryAction: "Open governance review",
        secondaryDefinitions: "Open active definitions",
        secondaryAccess: "Open access review",
      },
    },
    releaseBoard: {
      title: "Release board",
      description:
        "Review whether the selected definition is complete enough to move from design into a governed runtime lane.",
      definition: {
        title: "Definition baseline",
        metric: "Completed definition fields",
        readyDetail:
          "Name, slug, objective, and operating instructions are all present for this definition.",
        reviewDetail:
          "{count} required definition fields still need to be completed before clean rollout.",
        emptyDetail:
          "Select an agent definition to inspect its release completeness.",
        action: "Open definition",
      },
      scope: {
        title: "Scope alignment",
        metric: "Resolved scope",
        readyDetail: "The selected definition already resolves to {scope}.",
        reviewDetail:
          "This runtime lane still needs an explicit workspace and knowledge scope before release.",
        optionalDetail:
          "This runtime lane can launch without a knowledge scope, but should still stay inside tenant governance.",
        emptyDetail: "Select an agent definition to inspect scope resolution.",
        notRequiredValue: "Scope optional",
        action: "Open scoped surface",
      },
      retrieval: {
        title: "Retrieval posture",
        metric: "Resolved retrieval profile",
        readyDetail:
          "{profile} is already available for governed retrieval in this lane.",
        missingDetail:
          "This lane still needs a valid governed retrieval profile before release.",
        disabledDetail:
          "{profile} is disabled and should be remediated before release.",
        notRequiredDetail:
          "This lane does not require a retrieval profile to move forward.",
        emptyDetail:
          "Select a definition to inspect retrieval-governance posture.",
        action: "Open retrieval governance",
        actionSettings: "Open retrieval settings",
      },
      runtime: {
        title: "Runtime readiness",
        metric: "Resolved runtime model",
        readyDetail:
          "{model} is available through {provider}, and connected capabilities are already present.",
        reviewDetail:
          "{model} is resolved, but the runtime still needs connected capabilities before delivery.",
        emptyRuntimeDetail:
          "No runtime model is currently resolved for this definition.",
        emptyDetail: "Select an agent definition to inspect runtime readiness.",
        action: "Open runtime lane",
      },
      governance: {
        title: "Governance handoff",
        metric: "Pending governance items",
        healthyDetail:
          "Governance posture is stable. Current definition status: {status}.",
        reviewDetail:
          "{count} bound tool registrations are disabled and need governance cleanup.",
        pendingDetail:
          "{count} registered tools still sit behind an approval boundary.",
        emptyDetail:
          "Select an agent definition to inspect governance handoff.",
        action: "Open governance",
      },
    },
    architecture: {
      title: "Agent operating lanes",
      description:
        "Map agent drafts into the built RAGPilot runtime surfaces so chat, document intake, recovery, and governance stay inside one platform path.",
      lane: "Operating lane",
      openLane: "Open lane",
      groundedChat: {
        title: "Grounded chat lane",
        description:
          "{total} grounded-chat drafts are currently staged for citation-backed answers and thread delivery.",
        value: "{active} active of {total}",
      },
      documentIntake: {
        title: "Document intake lane",
        description:
          "{total} document-intake drafts are aligned to ingestion follow-up and document supervision.",
        value: "{active} active of {total}",
      },
      workflowRecovery: {
        title: "Workflow recovery lane",
        description:
          "{total} workflow-recovery drafts are positioned for failed-run triage and controlled retry handling.",
        value: "{active} active of {total}",
      },
      governance: {
        title: "Governance review lane",
        description:
          "{ready} drafts already satisfy the minimum scope, tool, and activation posture for runtime rollout.",
        value: "{count} need governance review",
      },
    },
    filters: {
      scopeTitle: "Agent scope",
      filterTitle: "Agent filters",
      tenantScope: "Select tenant scope",
      status: "Definition status",
      mode: "Execution mode",
      readiness: "Readiness posture",
      issue: "Governance issue",
      modelEndpoint: "Runtime model",
      modelProvider: "Model provider",
      toolRegistration: "Registered tool",
      allStatuses: "All statuses",
      allModes: "All modes",
      allReadiness: "All readiness",
      allIssues: "All issues",
      allModelEndpoints: "All runtime models",
      allModelProviders: "All model providers",
      allToolRegistrations: "All registered tools",
      searchPlaceholder: "Search agents",
    },
    governance: {
      title: "Governance issue lanes",
      description:
        "Turn scope, model, and tool failures into direct list filters so runtime cleanup can move through a narrower operator queue.",
      issueDescription: "{count} drafts currently match this governance issue.",
      filterIssue: "Filter agents",
    },
    directory: {
      title: "Agent directory",
      description: "Tenant-scoped inventory for persisted agent definitions.",
      count: "{count} drafts",
      empty:
        "No agent drafts exist yet. Create one to define an agent configuration.",
      noObjective:
        "Add a business objective so this draft has a clear operating purpose.",
      toolCount: "{count} tools",
      lastUpdated: "Updated {value}",
      selectedCount: "{count} selected",
      clearSelection: "Clear selection",
      deleteSelected: "Delete selected",
      selectAgent: "Select {name}",
      selectPage: "Select agents on this page",
      agent: "Agent",
      status: "Status",
      mode: "Execution mode",
      scope: "Knowledge scope",
      updated: "Updated",
    },
    editor: {
      title: "Selected agent draft",
      detailTitle: "Agent details",
      description:
        "Define configuration, execution scope, and control policy before enabling runtime delivery.",
      empty: "Select or create an agent draft to edit its configuration.",
      newAgentName: "New Agent Draft",
      name: "Agent name",
      slug: "Agent slug",
      mode: "Execution mode",
      status: "Draft status",
      modelStrategy: "Model strategy",
      runtimeModel: "Runtime model endpoint",
      runtimeModelInherited: "Inherit from strategy",
      runtimeModelBound: "Model bound",
      workspaceScope: "Workspace scope",
      knowledgeBaseScope: "Knowledge scope",
      scopePreview: "Scope preview",
      objective: "Objective",
      instructions: "Operating instructions",
      tools: "Connected tools",
      toolHint:
        "Only the explicitly approved surfaces below should be available to this agent.",
      registeredTools: "Registered tools",
      registeredToolsHint:
        "Bind persisted tool registrations that the future runtime can invoke for this agent.",
      noRegisteredTools:
        "No enabled tool registrations are available yet. Add them in Settings first.",
      namePlaceholder: "Agent name",
      slugPlaceholder: "agent-slug",
      scopePlaceholder: "Select a knowledge base",
      unscoped: "Unscoped",
      objectivePlaceholder:
        "Describe the business outcome this agent is expected to deliver.",
      instructionsPlaceholder:
        "Define the operating policy, escalation rules, and output behavior for this agent.",
    },
    modes: {
      grounded_chat: "Grounded chat",
      document_intake: "Document intake",
      workflow_recovery: "Workflow recovery",
    },
    statuses: {
      draft: "Draft",
      active: "Active",
      paused: "Paused",
    },
    modelStrategies: {
      local_reserved: "Local model reserved",
      remote_reserved: "Remote model reserved",
      hybrid_reserved: "Hybrid routing reserved",
    },
    tools: {
      chat: "Chat",
      documents: "Documents",
      operations: "Operations",
      admin: "Admin",
    },
    connectivity: {
      title: "Connected surfaces",
      description:
        "The surfaces below already exist in RAGPilot and can serve as the operational base for future agent delivery.",
      enabled: "Enabled",
      disabled: "Disabled",
      openSurface: "Open Surface",
      chatDescription:
        "Grounded chat for citation review, thread history, and scoped Q&A.",
      documentsDescription:
        "Document registry for ingestion state, document detail, and reindex actions.",
      operationsDescription:
        "Workflow supervision for queues, retries, and failure recovery.",
      adminDescription:
        "Governance surface for scope review, publication control, and lifecycle actions.",
    },
    delivery: {
      title: "Runtime handoff",
      description:
        "Route the selected agent into the most relevant built surface while keeping tenant and scope context intact.",
      selectedAgentTitle: "Selected definition",
      selectedAgentDescription:
        "{mode} is currently in {status} and ready for routed handoff review.",
      recommendedChat: "Recommended destination: grounded chat",
      recommendedDocuments: "Recommended destination: document operations",
      recommendedOperations: "Recommended destination: workflow operations",
      chatReady:
        "This grounded-chat agent is already scoped to {scope} and can enter the live chat surface directly.",
      documentsReady:
        "This document-intake agent is already scoped to {scope} and can open the document operations surface directly.",
      operationsReady:
        "This workflow-recovery agent should enter the failed-run operations queue first.",
      scopeRequired:
        "Assign a workspace and knowledge base scope so the handoff can stay grounded in live resources.",
      noRecommendation: "No delivery route available yet",
      selectAgent: "Select an agent to unlock a mode-aware runtime handoff.",
      openRecommendation: "Open recommended surface",
      registeredToolCount: "{count} registered tools",
      runtimePacket: "Runtime packet",
      launchPrompts: "Launch prompts",
      launchPromptsDescription:
        "Use these mode-aware prompts to enter the chat surface with a ready-to-run operator brief.",
      primarySurface: "Primary surface",
      secondarySurface: "Secondary surface",
      tertiarySurface: "Tertiary surface",
      openPrimary: "Open primary",
      openSecondary: "Open secondary",
      openTertiary: "Open tertiary",
      openInChat: "Open in chat",
      primaryChatDescription:
        "Start in grounded chat with the current scope and a suggested operator prompt already loaded.",
      primaryDocumentsDescription:
        "Open the document registry first so intake work, failed files, and reindex actions stay in one lane.",
      primaryOperationsDescription:
        "Enter workflow operations first to inspect failed runs, retry lineage, and queue pressure before returning elsewhere.",
      secondaryChatDescription:
        "Use chat for a concise operator brief after the current runtime lane is stable.",
      secondaryDocumentsDescription:
        "Open documents to inspect the current knowledge-base state and source readiness before retrieval begins.",
      tertiaryDocumentsDescription:
        "Use the document registry as a follow-up lane when workflow recovery depends on source-level cleanup.",
      tertiaryOperationsDescription:
        "Open workflow operations when runtime health needs queue supervision or retry follow-up.",
      checkScopeReady: "Scope ready: {scope}",
      checkScopeMissing:
        "Scope missing: assign a workspace and knowledge base before runtime launch.",
      checkModelReady: "Runtime model ready: {name}",
      checkModelInherited: "Runtime model inherits from the current strategy.",
      checkToolsReady:
        "{count} connected capabilities available for execution.",
      checkToolsMissing:
        "No connected capabilities are available yet. Bind tools before autonomous execution.",
      runtimeTaskPending: "Pending",
      runtimeTaskNoObjective:
        "No formal business objective has been attached to this agent yet.",
      runtimeTaskNoPrompt:
        "No launch prompt is available yet for this handoff.",
      runtimeTaskScopeNotRequired:
        "Scope is not required for the recovery lane.",
      runtimeTaskCapabilitiesValue: "{count} connected capabilities",
      runtimeTaskOpenPrimary: "Open runtime route",
      runtimeTaskOpenOperations: "Open operations",
      runtimeTaskOpenAdmin: "Open governance",
      runtimeTaskFields: {
        mode: "Mode",
        target: "Target surface",
        scope: "Resolved scope",
        model: "Runtime model",
        capabilities: "Connected capabilities",
        objective: "Business objective",
        prompt: "Launch prompt",
      },
    },
    dependencies: {
      title: "Runtime dependencies",
      description:
        "Inspect the resolved model contract and the exact registered tools that will be carried into future runtime execution.",
      resolvedModelTitle: "Resolved model contract",
      noResolvedModel: "No resolved model endpoint",
      modelRuntimeReady: "Runtime ready",
      modelRuntimeNeedsReview: "Runtime needs review",
      modelRuntimeIssues: {
        missing_base_url:
          "This model endpoint still needs a base URL before runtime execution should depend on it.",
        missing_credential_hint:
          "This model endpoint still needs an environment credential hint before runtime execution should depend on it.",
        managed_reserved:
          "This model endpoint still depends on a managed reserved credential mode, so it is not runtime-ready yet.",
      },
      modelProvider: "Provider: {value}",
      modelCapabilities: "Capabilities: {value}",
      modelStrategy: "Strategy: {value}",
      providerLaneTitle: "Provider lane posture",
      providerLaneMetrics: {
        runtimeReady: "Runtime-ready endpoints",
        activeAgents: "Active agents",
        attentionAgents: "Attention agents",
      },
      providerLaneBaseUrlHint: "Expected base URL pattern: {value}",
      providerLaneBaseUrlRequired:
        "This provider still requires an explicit base URL before operators should rely on it.",
      providerLaneBaseUrlNotRequired:
        "This provider does not require a base URL.",
      openModelSettings: "Open model settings",
      openProviderAttention: "Open runtime attention",
      retrievalProfileTitle: "Resolved retrieval profile",
      noRetrievalProfile: "No retrieval profile resolved",
      noRetrievalProfileDescription:
        "No governed retrieval profile is available for the current knowledge scope yet.",
      retrievalProfileDescription:
        "{source} profile with {mode} mode and Top K {topK}.",
      retrievalMode: "Mode: {value}",
      retrievalTopK: "Top K: {value}",
      retrievalProfileSources: {
        knowledge_base: "Knowledge-base binding",
        platform_default: "Platform default",
      },
      registeredToolsTitle: "Registered tool bindings",
      registeredToolsCount: "{count} bound tools",
      noRegisteredTools:
        "No persisted registered tools are currently bound to this definition.",
      requiresApproval: "Approval required",
      directReady: "Directly available",
      disabledBinding: "Binding disabled",
    },
    runs: {
      title: "Run history",
      description:
        "Persisted launch history for the current tenant or selected definition, so runtime handoffs become traceable instead of transient.",
      count: "{count} recorded runs",
      refresh: "Refresh run history",
      latestTitle: "Latest launch",
      latestTimestamp: "Last recorded at {value}",
      noLatest: "No launch has been recorded yet.",
      empty: "No agent runs have been recorded for the current scope yet.",
      filters: {
        surface: "Target surface",
        allSurfaces: "All surfaces",
        source: "Launch source",
        allSources: "All sources",
        status: "Run status",
        allStatuses: "All statuses",
      },
      noPrompt: "No launch prompt was attached to this run.",
      noHandoffIntent: "General handoff",
      openRoute: "Open recorded route",
      latestPacket: {
        title: "Latest handoff packet",
        emptyDetail:
          "No runtime handoff has been recorded yet. Launch the selected definition into a built surface first.",
        emptyObjective:
          "No delivery objective is attached yet because no recorded handoff exists.",
        launchedDetail:
          "The latest handoff is still active on {surface}. Continue there before opening a new operator lane.",
        completedDetail:
          "The latest handoff into {surface} completed. Re-enter the recorded route or move back into governance closure.",
        failedDetail:
          "The latest handoff into {surface} failed. Reopen the recorded route or return to the governed definition before retrying.",
        cancelledDetail:
          "The latest handoff into {surface} was cancelled. Review the route context before launching again.",
        openDefinitions: "Open definition",
        openSettings: "Open governance details",
        openAdmin: "Open admin",
        fields: {
          status: "Run status",
          surface: "Target surface",
          source: "Launch source",
          intent: "Handoff intent",
          scope: "Scope",
        },
      },
      metrics: {
        total: "Total runs",
        chat: "Chat launches",
        documents: "Document launches",
        operations: "Operations launches",
        admin: "Admin launches",
      },
      sources: {
        agentsConsole: "Agents console",
        workspace: "Workspace",
        home: "Home",
        admin: "Admin",
        operations: "Operations",
      },
      statuses: {
        launched: "Launched",
        completed: "Completed",
        failed: "Failed",
        cancelled: "Cancelled",
      },
    },
    mcpMapping: {
      open: "Configure MCP mapping",
      title: "MCP tool mapping",
      description:
        "Discover a connector's remote tools and map one to a governed tool registration.",
      registration: "Tool registration",
      connector: "MCP connector",
      remoteTool: "Remote tool",
      remoteToolPlaceholder: "Discover and select a tool",
      discover: "Discover remote tools",
      discovering: "Discovering...",
      discoveryFailed: "Remote tool discovery failed.",
      save: "Save mapping",
      saveFailed: "MCP tool mapping could not be saved.",
    },
    executions: {
      title: "Execution tasks",
      description:
        "Turn the selected agent definition into an actual execution task with recorded status, generated summary, and follow-up actions.",
      count: "{count} execution tasks",
      refresh: "Refresh executions",
      retry: "Retry execution",
      retrying: "Retrying...",
      replay: "Replay execution",
      replaying: "Replaying...",
      replayQueued: "A governed replay was queued.",
      replayFailed: "The execution could not be replayed.",
      cancel: "Cancel execution",
      cancelling: "Cancelling...",
      latestTitle: "Latest execution",
      latestTimestamp: "Last executed at {value}",
      noLatest: "No execution task has been recorded yet.",
      empty: "No execution tasks have been recorded for the current scope yet.",
      unknownAgent: "Unknown agent definition",
      pendingSummary:
        "Execution is still processing or waiting for a terminal result.",
      executionInput: "Execution input",
      answerPreview: "Answer preview",
      policy: {
        title: "Advanced execution constraints",
        description:
          "Optionally narrow deployment-owned limits and validate the complete result payload against a JSON Schema. Blank values inherit service defaults.",
        maxToolCalls: "Maximum tool calls",
        maxRuntimeSeconds: "Maximum runtime (seconds)",
        maxOutputBytes: "Maximum result bytes",
        deploymentDefault: "Deployment default",
        outputSchema: "Result JSON Schema (optional)",
        outputSchemaPlaceholder:
          '{"type":"object","required":["answer_preview"]}',
        invalidSchema: "The result schema must be a valid JSON object.",
        sandboxBoundary:
          "Sandbox: no shell or filesystem access; outbound access is limited to the tools snapshotted for this execution.",
        toolBudget: "≤ {value} tool calls",
        runtimeBudget: "≤ {value}s runtime",
        outputBudget: "≤ {value} bytes",
        schemaBound: "Schema validated",
        replayOf: "Replay of {value}",
      },
      latestPacket: {
        title: "Latest execution packet",
        emptyDetail:
          "No execution task has been recorded yet. Execute the selected runtime-ready definition to create a governed result trail.",
        emptyObjective:
          "No execution objective is attached yet because no result has been recorded.",
        emptyPrompt: "No execution input is attached yet.",
        completedDetail:
          "The latest execution completed and already exposes follow-up actions back into the built product surfaces.",
        failedDetail:
          "The latest execution failed. Use the follow-up actions below to recover runtime, evidence, or downstream handoff.",
        runningDetail:
          "The latest execution is still running. Stay on the governed result trail until the output and follow-up posture settle.",
        awaitingApprovalDetail:
          "The latest execution is paused at a governed tool approval boundary.",
        queuedDetail:
          "The latest execution is queued. Re-open the governed follow-up surface once runtime starts producing output.",
        cancelledDetail:
          "The latest execution was cancelled. Review the runtime lane and reopen the right built surface before retrying.",
        openDefinitions: "Open definition",
        openSettings: "Open settings",
        fields: {
          status: "Execution status",
          stage: "Runtime stage",
          scope: "Scope",
          outputs: "Outputs",
          followUps: "Follow-up actions",
        },
      },
      runtimeBinding: "Runtime binding",
      runtimeEngine: "Runtime {value}",
      configuredRuntimeEngine: "Configured {value}",
      configuredRuntimeModel: "Configured model {value}",
      runtimeFallback: "Native fallback",
      runtimeWorkflow: "Workflow {value}",
      runtimeBindingGoverned: "Governed endpoint",
      runtimeBindingDefault: "Service default",
      runtimeTrace: "Runtime trace",
      durationSeconds: "{value}s",
      outputCount: "{count} outputs",
      followUpCount: "{count} follow-up actions",
      toolTraceCount: "{count} tool traces",
      runtimeFallbackReasonWithTarget:
        "{reason}. Execution fell back to {target}.",
      runtimeFallbackTargets: {
        default_model_endpoint: "the platform default model endpoint",
        settings: "the service default runtime",
      },
      runtimeFallbackReasons: {
        configured_model_endpoint_missing:
          "Configured model endpoint could not be resolved",
        model_endpoint_disabled: "Configured model endpoint is disabled",
        model_endpoint_missing_chat_capability:
          "Configured model endpoint does not support chat generation",
        model_endpoint_not_runtime_ready:
          "Configured model endpoint is enabled, but its runtime configuration is incomplete",
        model_endpoint_unsupported_credential_mode:
          "Configured model endpoint uses an unsupported credential posture",
        model_endpoint_unavailable:
          "Configured model endpoint is currently unavailable",
        unknown: "Configured model endpoint required a runtime fallback",
      },
      followUpTitle: "Next actions",
      stageLabels: {
        queued_for_execution: "Queued for execution",
        running_execution: "Execution in progress",
        waiting_for_approval: "Waiting for approval",
        grounded_answer_ready: "Grounded answer ready",
        intake_review_ready: "Intake review ready",
        recovery_brief_ready: "Recovery brief ready",
        execution_failed: "Execution failed",
        execution_completed: "Execution completed",
      },
      outputKinds: {
        answer_preview: "Answer preview",
        retrieval_evidence: "Evidence coverage",
        document_intake: "Document intake",
        workflow_recovery: "Workflow recovery",
        tool_runtime: "Tool runtime",
      },
      outputStatuses: {
        ready: "Ready",
        attention: "Attention",
        pending: "Pending",
      },
      retrievalResults: "{count} retrieved chunks",
      evidenceSources: "Evidence sources",
      unknownSourceDocument: "Untitled source document",
      chunkIndex: "Chunk {value}",
      score: "Score {value}",
      triggerSource: "Source: {source}",
      updatedAt: "Updated {value}",
      structuredActions: {
        review_model_runtime: "Review model runtime",
        review_tool_approval: "Review tool approval",
        review_disabled_tool: "Review disabled tool",
        review_reserved_mcp_tool: "Review MCP boundary",
        review_mcp_connector_integration: "Review MCP connector integration",
        review_tool_endpoint: "Review tool endpoint",
        review_tool_runtime: "Review tool runtime",
        review_retrieval_profile: "Review retrieval profile",
        resume_grounded_chat: "Resume grounded chat",
        review_evidence: "Review evidence coverage",
        recover_missing_evidence: "Inspect ingestion recovery",
        review_failed_documents: "Review failed documents",
        review_active_intake: "Review active intake",
        inspect_workflow_recovery: "Inspect workflow recovery",
        triage_failed_workflows: "Triage failed workflows",
        inspect_retry_lineage: "Inspect retry lineage",
        return_to_documents: "Return to documents",
      },
      metrics: {
        total: "Total executions",
        queued: "Queued",
        running: "Running",
        awaitingApproval: "Awaiting approval",
        completed: "Completed",
        failed: "Failed",
      },
      filters: {
        status: "Execution status",
        allStatuses: "All execution statuses",
      },
      statuses: {
        queued: "Queued",
        running: "Running",
        awaiting_approval: "Awaiting approval",
        completed: "Completed",
        failed: "Failed",
        cancelled: "Cancelled",
      },
      toolRuntime: {
        title: "Tool runtime",
        empty: "No bound tool traces were recorded for this execution.",
        traces: "{count} traces",
        completed: "{count} completed",
        blocked: "{count} blocked",
        failed: "{count} failed",
        reserved: "{count} reserved",
        unavailable: "{count} unavailable",
        skipped: "{count} skipped",
        attempts: "{count} attempts",
        httpStatus: "HTTP {status}",
        statuses: {
          completed: "Completed",
          blocked: "Blocked",
          reserved: "Reserved",
          unavailable: "Unavailable",
          failed: "Failed",
          skipped: "Skipped",
        },
      },
    },
    runbook: {
      title: "Operator runbook",
      description:
        "Use a mode-aware operating sequence so launch, escalation, and governance closure stay on the built platform path.",
      empty:
        "Select an agent definition to generate a mode-aware operator runbook.",
      stepLabel: "Step {value}",
      actions: {
        openDocuments: "Open Documents",
        openChat: "Open Chat",
        openOperations: "Open Operations",
        openAccess: "Open Access",
      },
      groundedChat: {
        scopeTitle: "Verify grounded scope",
        scopeReady:
          "The grounded-chat lane already resolves to {scope}. Review the scoped documents before answering live questions.",
        scopeMissing:
          "This grounded-chat lane still needs an explicit workspace and knowledge scope before live delivery.",
        launchTitle: "Launch the answer lane",
        launchDetail:
          "Enter the chat surface with the current launch prompt so the operator starts from a formal, citation-aware brief.",
        closureTitle: "Close the governance loop",
        closureDetail:
          "{count} approval-gated registered tools still need to be reviewed before broader rollout.",
      },
      documentIntake: {
        intakeTitle: "Inspect the intake lane",
        intakeDetail:
          "Start in the document surface so ingestion state, reindex needs, and source quality signals stay visible.",
        recoveryTitle: "Escalate exceptions into operations",
        recoveryDetail:
          "Move failed or risky intake cases into workflow operations once source-level inspection is complete.",
        briefingTitle: "Prepare the operator brief",
        briefingDetail:
          "Open chat with a mode-aware prompt to summarize the intake state and the next execution priorities.",
      },
      workflowRecovery: {
        triageTitle: "Triage failed runs",
        triageDetail:
          "Start in workflow operations and rank failed runs before deciding which retry chains deserve intervention first.",
        cleanupTitle: "Confirm source cleanup",
        cleanupDetail:
          "Review failed or risky source material in the document surface before sending recovery back into runtime.",
        approvalTitle: "Confirm governance approval",
        approvalDetail:
          "{count} approval-gated registered tools remain in the governance path for this recovery lane.",
      },
    },
    guardrails: {
      title: "Execution guardrails",
      description:
        "Runtime activation should only proceed after scope, policy, and governance controls are explicitly defined.",
      retrievalTitle: "Retrieval boundary",
      retrievalReady:
        "This draft already names a retrieval scope: {scope}, using {profile}.",
      retrievalMissing:
        "Define a knowledge scope before enabling autonomous retrieval behavior.",
      executionTitle: "Execution path",
      executionReady: "{mode} is selected with {toolCount} connected tools.",
      executionMissing: "Choose an execution mode before promoting this draft.",
      governanceTitle: "Governance posture",
      governanceReady: "Current posture: {status} with {strategy}.",
      governanceMissing:
        "Define status and model strategy before formal rollout.",
    },
    readiness: {
      ready: "Ready",
      attention: "Needs review",
      issueLabels: {
        model_missing: "Missing model",
        model_disabled: "Disabled model",
        model_runtime_unconfigured: "Unconfigured model runtime",
        retrieval_profile_missing: "Missing retrieval profile",
        retrieval_profile_disabled: "Disabled retrieval profile",
        scope_missing: "Missing scope",
        scope_invalid: "Invalid scope",
        tools_missing: "Missing tools",
        tool_registration_disabled: "Disabled tool registration",
        tool_approval_required: "Approval-bound tool",
        tool_mcp_reserved: "Reserved MCP tool",
        tool_mcp_integration_pending: "Pending MCP connector integration",
      },
      issues: {
        model_missing: "No runtime model is available",
        model_disabled: "Bound model endpoint is disabled",
        model_runtime_unconfigured:
          "Bound model endpoint is enabled, but its runtime configuration is incomplete",
        retrieval_profile_missing:
          "No governed retrieval profile resolves for the scoped knowledge base",
        retrieval_profile_disabled:
          "The scoped knowledge base is bound to a disabled retrieval profile",
        scope_missing: "Knowledge scope is missing",
        scope_invalid: "Knowledge scope no longer resolves",
        tools_missing: "No connected tools are available",
        tool_registration_disabled:
          "{count} bound tool registrations are disabled",
        tool_approval_required:
          "{count} bound tool registrations still require governance approval",
        tool_mcp_reserved:
          "{count} bound reserved MCP tools still need a governed connector assignment",
        tool_mcp_integration_pending:
          "{count} bound reserved MCP tools are waiting for connector runtime closure",
      },
    },
    seed: {
      knowledgeCopilotName: "Knowledge Assistant",
      knowledgeCopilotObjective:
        "Support grounded knowledge questions and maintain citation quality for the default handbook scope.",
      knowledgeCopilotInstructions:
        "Use only grounded retrieval, keep answers concise, cite relevant source chunks, and escalate whenever no reliable evidence is available.",
      documentReviewerName: "Document Intake Assistant",
      documentReviewerObjective:
        "Review newly indexed content, flag weak metadata, and coordinate reindex follow-up through document operations.",
      documentReviewerInstructions:
        "Inspect ingestion state first, summarize indexing health, and hand off any failures to workflow operations instead of guessing root causes.",
      workflowResponderName: "Workflow Recovery Coordinator",
      workflowResponderObjective:
        "Track failed document-ingestion runs and prepare operator-ready recovery steps before retrying execution.",
      workflowResponderInstructions:
        "Stay focused on failed queues, review retry lineage, and require explicit governance confirmation before any destructive action.",
    },
  },
  operations: {
    access: {
      retryEnabled: "Retry enabled",
      readOnly: "Read-only retries",
    },
    title: "Operations",
    navigation: {
      overview: "Overview",
      queue: "Task queue",
      detail: "Run details",
    },
    header: {
      eyebrow: "Execution Control",
      title: "Operations console",
      description:
        "Supervise tenant-level workflow execution, review failure queues, and trigger controlled retries without dropping back into the broader workspace surface.",
    },
    status: {
      loading: "Loading operations console...",
      ready: "Operations console ready.",
      refreshing: "Refreshing tenant operations...",
      loaded: "Loaded {count} workflow runs for the current tenant scope.",
      failed: "Operations console failed to load.",
      noTenants:
        "No tenants are provisioned yet. Create a tenant before supervising operations.",
      detailFailed: "Workflow run detail failed to load.",
      retrying: "Queueing workflow retry...",
      retryQueued: "Workflow retry queued.",
      retryQueuedFocused:
        "Workflow retry queued and the operations console is now focused on the retry lane.",
      retryFailed: "Workflow retry failed.",
      savingWorkflowNotes: "Saving workflow notes...",
      workflowNotesSaved: "Workflow notes saved.",
      workflowNotesSaveFailed: "Workflow notes failed to save.",
      lastRefreshed: "Last refreshed {value}",
    },
    actions: {
      refresh: "Refresh",
      openAgents: "Open Agents",
      openAdmin: "Open Admin",
      openQueue: "Open Queue",
      retryRun: "Retry Run",
      openWorkspaceRun: "Open In Workspace",
      openSubject: "Open Subject",
    },
    metrics: {
      total: "Total runs",
      totalHint:
        "All workflow runs currently recorded for the selected tenant.",
      active: "Active runs",
      activeHint:
        "Queued and running execution that still needs operator awareness.",
      failed: "Failed runs",
      failedHint:
        "Runs that currently require investigation or a controlled retry path.",
      activeAgents: "Active agents",
      agentsHint:
        "Enabled agent definitions available to support operational recovery.",
    },
    lanes: {
      title: "Execution lanes",
      description:
        "Use stable execution lanes to move between overall supervision, failed recovery, retry volume, and queue pressure.",
      overview: "Overview",
      overviewDescription:
        "All tenant workflow volume in one supervisory lane.",
      failed: "Failed runs",
      failedDescription:
        "Directly focus the failed-run queue that needs human recovery.",
      retries: "Retry queue",
      retriesDescription:
        "Inspect runs that were already re-issued from earlier failures.",
      pressure: "Queue pressure",
      pressureDescription:
        "Watch the active queue where accepted work is waiting to execute.",
    },
    scope: {
      title: "Execution scope",
      description:
        "Operations works at tenant level while staying connected to the current agent and workspace inventory.",
      currentTenant: "Current tenant",
      notAvailable: "Not available",
      recoveryAgent: "Recovery agent",
      selectRecoveryAgent: "Select recovery agent",
      workspaces: "{count} workspaces",
      agentDrafts: "{count} agents",
      toolEnabledAgents: "{count} tool-enabled",
    },
    filters: {
      tenant: "Select tenant",
      status: "Workflow status",
      retryMode: "Retry mode",
      allStatuses: "All statuses",
      allRetries: "All runs",
      originals: "Original runs",
      retries: "Retry runs",
      searchPlaceholder: "Search by subject, workflow id, or failure context",
    },
    queues: {
      queued: "Queued",
      running: "Running",
      failed: "Failed",
      retries: "Retries",
      completed: "Completed",
      pending: "Pending",
    },
    statusSummary: {
      title: "Run status summary",
    },
    directory: {
      title: "Workflow directory",
      description:
        "Recent workflow execution across the selected tenant, tuned for triage and follow-up.",
      empty: "No workflow runs match the current filters.",
      retryRun: "Retry run",
      noError: "No blocking error message has been recorded for this run.",
      updatedAt: "Updated {value}",
    },
    focus: {
      title: "Execution focus",
      description:
        "Keep the selected run, retry posture, and platform handoff decisions in one place.",
      selectedRun: "Selected run",
      notSelected: "No run selected",
      selectHint:
        "Choose a workflow run to inspect runtime detail and retry posture.",
      guardrail: "Retry guardrail",
      retryReady: "This run is currently eligible for a controlled retry.",
      retryBlocked: "Retry is not currently available for the selected run.",
      nextStep: "Next step",
      nextStepFailed:
        "This failed run should stay in the recovery lane until the blocking cause is understood and the source scope is checked.",
      nextStepCompleted:
        "This run completed successfully. Continue in workspace chat or document review to validate downstream retrieval readiness.",
      nextStepActive:
        "This run is still active. Keep it inside workflow supervision until queue pressure and step progress are clear.",
      nextStepEmpty:
        "Select a workflow run to unlock the next-step handoff actions.",
      openChatFollowUp: "Open chat follow-up",
      openWorkflowFollowUp: "Open workflow follow-up",
      openSubjectFollowUp: "Open subject follow-up",
    },
    detail: {
      title: "Workflow detail",
      description: "Step-level execution detail for the selected workflow run.",
      empty:
        "Select a workflow run to inspect step detail, runtime timing, and workspace follow-up links.",
      recoveryGuidance: "Recovery guidance",
      recommendedAction: "Recommended action",
      followUpReason: "Follow-up reason",
      startedAt: "Started at",
      duration: "Duration",
      workspace: "Workspace",
      knowledgeBase: "Knowledge base",
      retryOf: "Retry of",
      temporalWorkflowId: "Temporal workflow id",
      operatorNotes: "Operator notes",
      operatorNotesDescription:
        "Capture the operator decision, retry guardrail, or source-context finding that should stay attached to this run.",
      operatorNotesPlaceholder:
        "Add a durable operator note for this workflow run...",
      operatorNotesEmpty:
        "No operator notes are saved for this workflow run yet.",
      operatorNotesSaved: "Operator notes are attached to this workflow run.",
      saveOperatorNotes: "Save notes",
      savingOperatorNotes: "Saving notes...",
      steps: "Execution steps",
      noSteps: "No execution steps are currently recorded.",
      attemptCount: "{count} attempts",
      notAvailable: "n/a",
    },
    recoveryAgents: {
      title: "Recovery agents",
      description:
        "Active workflow-recovery agents available for this tenant's failed-run supervision path.",
      activeCount: "Active recovery agents",
      activeReady:
        "These agents can be reviewed or launched before operators re-enter the failed queue.",
      activeEmpty:
        "No active workflow-recovery agents are currently available in this tenant scope.",
      runtimePacket: "Runtime packet",
      noObjective:
        "No explicit recovery objective is attached to this agent yet.",
      scopeReady: "Scoped to {scope}",
      scopeMissing: "No scoped knowledge boundary is attached yet.",
      launchPrompt: "Recovery launch prompt",
      openRecoveryBrief: "Open recovery brief",
      openScopedDocuments: "Open scoped documents",
      selectedAgent: "Focused agent {name}",
      unscoped: "Unscoped",
      noAgents: "No active workflow-recovery agents are available yet.",
      openDefinition: "Open definition",
      openRecommended: "Open recommended surface",
      openRuntimeSettings: "Open runtime settings",
      openImpactedDefinitions: "Open impacted definitions",
      disabledModel: "Disabled model {name}",
      unconfiguredModel: "Runtime setup required for {name}",
      disabledTool: "Disabled tool {name}",
      reservedMcpTool: "Reserved MCP tool {name}",
      pendingMcpTool: "Pending MCP connector {name}",
      disabledRetrieval: "Disabled retrieval {name}",
      approvalTool: "Approval tool {name}",
      lastToolPreview: "Latest tool preview: {status} · {value}",
      lastConnectorPreview: "Latest connector preview: {status} · {value}",
      providerLane: "Provider lane",
      providerUnknown: "Unknown provider",
      providerLaneReady:
        "{runtimeReady} runtime-ready endpoints, {activeAgents} active agents, {attentionAgents} still under attention.",
      openAgents: "Open recovery agents",
      openFailedQueue: "Open failed queue",
    },
    runtimeTaskPacket: {
      title: "Runtime task packet",
      description:
        "Promote the current recovery handoff into one governed task packet before leaving the operations surface.",
      emptyTitle: "No active runtime task",
      emptyDetail:
        "Select a workflow run or recovery agent to build the next runtime task packet.",
      monitoringDetail:
        "Queued, running, or retry traffic is still active in this scope. Keep operations supervision in focus before leaving the lane.",
      intakeDetail:
        "No active recovery run needs attention right now. Return to document intake and wait for the next execution to enter supervision.",
      activeDetail:
        "Keep the selected execution inside supervised workflow follow-up until queue posture and retry eligibility are clear.",
      completedDetail:
        "This execution finished and can now be validated in downstream grounded chat or document review.",
      failedDetail:
        "This recovery-sensitive execution should stay attached to its workflow and source context before another retry is attempted.",
      agentOnlyDetail:
        "A recovery agent is selected, but no workflow run is focused yet. Keep governance, prompts, and scope ready.",
      noObjective: "No formal recovery objective is attached yet.",
      noPrompt: "No recovery launch prompt is available yet.",
      pending: "Pending",
      primaryAction: "Open runtime route",
      secondaryQueue: "Open execution lane",
      secondaryDocuments: "Open documents",
      secondaryGovernance: "Open governance",
      statuses: {
        attention: "Attention",
        ready: "Ready",
        review: "Review",
      },
      targets: {
        chat: "Grounded chat",
        documents: "Document intake",
        workflows: "Workflow follow-up",
      },
      fields: {
        target: "Target surface",
        runStatus: "Run status",
        subject: "Selected subject",
        workspace: "Workspace",
        knowledgeBase: "Knowledge base",
        objective: "Recovery objective",
        prompt: "Recovery prompt",
      },
    },
    agentRuntime: {
      title: "Operations runtime observability",
      description:
        "Keep recorded agent launches that entered the operations surface visible alongside recovery, queue, and governance follow-up.",
      openAgents: "Open agents",
      totalRuns: "Operations launches",
      selectedAgent: "Focused recovery agent",
      noSelectedAgent: "Not selected",
      latestLaunchLabel: "Latest operations launch",
      latestLaunch: "Latest launch {value}",
      noLatestLaunch: "No operations launch has been recorded yet.",
      sourceMix: "Launch source mix",
      noSourceMix:
        "No operations launches are available yet for source analysis.",
      recentRuns: "Recent operations launches",
      empty:
        "No recorded agent launches have entered the operations surface in the current scope yet.",
      unknownAgent: "Unknown agent definition",
    },
    agentExecutions: {
      title: "Recovery execution tasks",
      total: "Execution tasks",
      completed: "Completed tasks",
      failed: "Failed tasks",
      openRuntimeSettings: "Open runtime settings",
      openImpactedAgents: "Open impacted agents",
      pending:
        "Execution is still processing or waiting for the final summary.",
      empty:
        "No workflow-recovery execution tasks are visible in the current scope yet.",
    },
    executionPackets: {
      title: "Execution packets",
      description:
        "Move the current tenant straight into recovery, retry supervision, runtime handoff, or workspace follow-up without rebuilding context.",
      statuses: {
        attention: "Attention",
        review: "Review",
        healthy: "Healthy",
      },
      recovery: {
        title: "Recovery packet",
        metric: "Recovery runs in scope",
        failedDetail:
          "{count} workflow recovery runs currently need active handling in this tenant scope.",
        healthyDetail:
          "No workflow recovery pressure is visible right now for this tenant.",
        primaryAction: "Open recovery lane",
        secondaryDocuments: "Open failed documents",
        secondaryAdmin: "Open governance",
      },
      retry: {
        title: "Retry packet",
        metric: "Retry runs in scope",
        readyDetail:
          "{count} retry runs are already active and should be supervised as a separate recovery queue.",
        emptyDetail:
          "No retry runs are currently visible in this tenant scope.",
        primaryAction: "Open retry lane",
        secondaryQueued: "Open queued lane",
        secondaryRunning: "Open running lane",
      },
      agent: {
        title: "Agent handoff packet",
        metric: "Scoped recovery agents",
        readyDetail:
          "{scopedCount} of {totalCount} active recovery agents already have scoped runtime boundaries.",
        emptyDetail:
          "No active recovery agents are currently available for this tenant scope.",
        primaryAction: "Open recovery handoff",
        secondaryDefinitions: "Open agent definitions",
        secondaryBrief: "Open recovery brief",
      },
      governance: {
        title: "Governance packet",
        metric: "Selected recovery owner",
        readyDetail:
          "{name} is already aligned with a scoped recovery route and can stay linked to governance follow-up.",
        pendingDetail:
          "{count} active recovery agents are visible, but governance still needs to close the scope and access posture cleanly.",
        emptyDetail:
          "No active recovery agents are currently available to hand into governance follow-up.",
        unassigned: "No recovery owner selected",
        primaryAction: "Open governance handoff",
        secondaryDefinitions: "Open recovery definitions",
        secondaryAccess: "Open access review",
      },
      followUp: {
        title: "Workspace follow-up packet",
        metric: "Selected execution subject",
        completedDetail:
          "The selected run completed. Continue in workspace surfaces to confirm downstream retrieval readiness.",
        failedDetail:
          "The selected run failed. Follow the workflow and subject surfaces together before attempting another retry.",
        activeDetail:
          "The selected run is still active. Keep supervision and workspace follow-up aligned until execution settles.",
        emptyDetail:
          "Select a workflow run before handing the current execution back into workspace surfaces.",
        notSelected: "No run selected",
        primaryAction: "Open workspace handoff",
        secondaryWorkspace: "Open workflow surface",
        secondarySubject: "Open subject surface",
      },
    },
  },
  settings: {
    title: "System settings",
    navigation: {
      profile: "Profile",
      sessions: "Sessions",
      security: "Security",
    },
    security: {
      title: "Security",
      description:
        "Update the current account password and keep account access secure.",
      accountStatus: "Account status",
      verified: "Verified",
      signedOut: "Signed out",
      activeSessions: "Active sessions",
      recentFailedSignIns: "Recent failed sign-ins",
      credentials: "Sign-in credentials",
      passwordManaged:
        "Your authentication mode supports password changes. Rotate it periodically and avoid password reuse.",
      externallyManaged:
        "This account is managed by an external or passwordless identity provider.",
      currentSignIn: "Current sign-in",
      role: "Role",
      lastSignedIn: "Last signed in",
      sessionExpires: "Session expires",
      manageSessions: "Manage all sessions",
    },
    header: {
      eyebrow: "Operator Settings",
      title: "Session and platform settings",
      description:
        "Keep local operator access, governance entry points, and repository links in one place without inventing settings that do not exist yet.",
    },
    sections: {
      sessionTitle: "Profile",
      sessionDescription:
        "Manage the current account's basic information, contact details, and organization memberships.",
      roleTitle: "Experience and access",
      roleDescription:
        "Adjust language, appearance, and pending access posture for this local operator environment.",
      accessTitle: "Access activity",
      accessDescription:
        "Recent sign-in and membership governance events scoped to the current signed-in member.",
      platformTitle: "Platform links",
      platformDescription:
        "Fast paths into the built control surfaces, local API, and repository.",
    },
    fields: {
      name: "Display name",
      noActiveSession: "No active session",
      email: "Email",
      role: "Role",
      roleManaged:
        "Role is managed by the member directory and current access policy.",
      directoryLinked: "Linked to persisted member directory",
      memberships: "Organizations",
      noMemberships:
        "No persisted tenant memberships are linked to this session yet.",
      password: "Password",
      passwordHint:
        "Rotate the sign-in password for this member without leaving the current session.",
      membershipAccess: "Membership access",
      membershipAccessReady: "Ready",
      membershipAccessBlocked: "Blocked",
      membershipAccessBootstrap: "Bootstrap",
      membershipAccessReadyDescription:
        "At least one active tenant membership is available for this session.",
      membershipAccessBlockedDescription:
        "This session is tied only to invited or suspended tenant memberships and should not stay signed in.",
      membershipAccessBootstrapDescription:
        "No tenant memberships are linked yet, so this session remains in bootstrap mode.",
      pendingRole: "Pending session role",
      adminAccess: "Admin access",
      adminAllowed: "Available",
      adminDenied: "Not available",
      language: "Language mode",
      languageValue:
        "English remains the default product language while Simplified Chinese stays available for operators.",
      theme: "Appearance",
      themeLight: "Light mode",
      themeDark: "Dark mode",
      themeValue:
        "The selected appearance is applied across the current browser session.",
      apiBaseUrl: "API base URL",
      retrievalEngine: "Retrieval engine",
      retrievalEngineHint:
        "Current grounded retrieval path reported by the API health contract.",
      agentRuntimeEngine: "Agent runtime engine",
      agentRuntimeEngineHint:
        "Current agent-execution orchestration boundary reported by the API health contract.",
      chatProvider: "Chat provider",
      chatProviderHint:
        "The active provider that grounded chat and agent runtime bindings resolve into by default.",
      chatModel: "Chat model",
      chatModelHint:
        "The default model name currently exposed by the API health contract.",
      optionalRuntimes: "Optional runtimes",
      optionalRuntimesHint:
        "Tracks whether the current API environment can actually load the pilot technology paths.",
      runtimeReady: "Ready",
      runtimePending: "Pending install",
      runtimeUnavailable: "Unavailable",
    },
    status: {
      profileSaved: "Profile updated.",
      profileSaveFailed: "Profile save failed.",
      profileSaveUnavailable:
        "A valid signed-in member session is required before the profile can be updated.",
      passwordChanged: "Password updated.",
      passwordChangeFailed: "Password update failed.",
      passwordConfirmationMismatch:
        "New password and confirmation do not match.",
      passwordChangeUnavailable:
        "Password management is not available for the current sign-in mode.",
      accessEventsFailed: "Access activity could not be loaded.",
      activeSessionsFailed: "Active sessions could not be loaded.",
      sessionRefreshFailed: "Session refresh failed.",
      runtimeHealthFailed: "Runtime health could not be loaded.",
    },
    actions: {
      saveProfile: "Save profile",
      savingProfile: "Saving...",
      changePassword: "Change Password",
      refreshSession: "Refresh Session",
      refreshingSession: "Refreshing session...",
      refreshSessions: "Refresh Sessions",
      refreshingSessions: "Refreshing sessions...",
      refreshActivity: "Refresh Activity",
      refreshingActivity: "Refreshing...",
      revokeSession: "Revoke",
      revokingSession: "Revoking...",
      openHome: "Open Home",
      openChat: "Open Chat",
      openAdmin: "Open Admin",
      openRepository: "Open Repository",
      signOut: "Sign Out",
    },
    activity: {
      latestEvent: "Latest event",
      lastSignIn: "Last sign-in",
      loadedLoginEvents: "{count} recent sign-in events loaded",
      noLoginEvents: "No sign-in events recorded yet.",
      directoryState: "Directory state",
      directoryUser: "Directory member",
      localSession: "Local session",
      localOnly:
        "Persisted access activity appears after signing in through the member directory.",
      scopedToCurrentUser:
        "Only the current signed-in member can see this event feed.",
      eventFeed: "Recent access events",
      filter: "Event filter",
      allEvents: "All events",
      search: "Search activity",
      searchPlaceholder: "Search by actor, tenant, event, or reason",
      empty: "No access events have been recorded for this member yet.",
      notAvailable: "Not available",
      noTenant: "Platform scope",
      noActor: "System",
      issuedBy: "Issued by",
      membershipStatus: "Membership",
      loginMode: "Login mode",
      revocationScope: "Revocation scope",
      revocationScopeSelf: "Self service",
      revocationScopeAdmin: "Administrator action",
      sessionId: "Session ID",
      signOutReason: "Current member signed out from Settings.",
      currentSessionRevokeReason:
        "Current member revoked the active session from Settings.",
      otherSessionRevokeReason:
        "Current member revoked another active session from Settings.",
      invitationIssueCount: "Invitation issues",
      reason: "Reason",
      loginModeBootstrap: "Initial bootstrap",
      loginModeDirectory: "Directory sign-in",
      loginModeInvitationActivation: "Invitation activation",
    },
    sessions: {
      title: "Session management",
      description:
        "Review the current account's sign-in status and recent security activity, and manage active device sessions.",
      current: "Current",
      other: "Other session",
      startedAt: "Started",
      expiresAt: "Expires",
      deviceLabel: "Device",
      ipAddress: "IP",
      loading: "Loading active sessions...",
      loadMore: "Load more",
      empty:
        "No active backend sessions are visible for this member right now.",
      summary: {
        total: "Active sessions",
        totalHint:
          "All backend sessions still valid for this signed-in member.",
        other: "Other sessions",
        otherHint: "Additional sessions beyond the current browser session.",
        expiring: "Expiring soon",
        expiringHint: "Sessions that will expire within the next 24 hours.",
        currentExpiry: "Current expiry",
        currentExpiryHint:
          "When the current browser-backed session will need renewal.",
        devices: "Devices",
        devicesHint:
          "Distinct device labels seen across active backend sessions.",
        ips: "IPs",
        ipsHint:
          "Distinct source IP addresses still represented by active sessions.",
      },
    },
    passwordDialog: {
      title: "Change password",
      description: "Update the password used by the current signed-in member.",
      currentPassword: "Current password",
      currentPasswordPlaceholder: "Enter current password",
      newPassword: "New password",
      newPasswordPlaceholder: "Enter a new password of at least 8 characters",
      confirmPassword: "Confirm password",
      confirmPasswordPlaceholder: "Re-enter new password",
      cancel: "Cancel",
      submit: "Update Password",
      saving: "Updating...",
    },
    posture: {
      activeMemberships: "Active memberships",
      activeMembershipsHint:
        "Tenant memberships currently able to open protected operator routes.",
      invitedMemberships: "Invited memberships",
      invitedMembershipsHint:
        "Tenant memberships that still depend on invitation activation.",
      recentFailedSignIns: "Failed sign-ins",
      recentFailedSignInsHint:
        "Failed sign-in attempts recorded inside the active review window.",
      failedInvitationActivations: "Failed invitation activations",
      failedInvitationActivationsHint:
        "Invitation activation attempts that failed inside the active review window.",
      expiringInvitations: "Invitation risk",
      expiringInvitationsHint:
        "Invitations already expired or expiring within the next 72 hours.",
      sensitiveEvents: "Sensitive events",
      sensitiveEventsHint:
        "Recent revocations, suspensions, and membership removals visible to the current member.",
    },
    governance: {
      title: "Runtime governance",
      description:
        "Persisted model endpoints, tool registrations, and retrieval profiles that future chat, agent, and execution lanes can build on.",
      overview: {
        title: "Governance focus",
        loading: "Loading governed runtime overview...",
        empty: "No governed runtime issues are visible right now.",
        applying: "Applying...",
        primaryFocus: "Primary focus",
        lastPreview: "Last preview: {status}",
        metrics: {
          attentionItems: "Attention items",
          reviewItems: "Review items",
          governedDefaultModels: "Governed defaults",
          approvalTools: "Approval tools",
          pendingMcpTools: "Pending MCP tools",
          blockedConnectors: "Blocked connectors",
        },
        reasons: {
          stable:
            "Governed runtime posture is currently stable across models, tools, and connectors.",
          unconfigured_model_endpoint:
            "One or more enabled model endpoints still need runtime configuration before delivery stays fully governed.",
          disabled_bound_model_endpoint:
            "At least one bound model endpoint is disabled and should be restored before delivery continues.",
          approval_required_tool:
            "A bound tool still sits behind an approval boundary and should be reviewed before operators rely on it.",
          mcp_integration_pending_tool:
            "A reserved MCP tool is still waiting for connector handoff and should be completed before runtime rollout expands.",
          integration_blocked_connector:
            "At least one MCP connector is blocking downstream tool delivery and should be remediated first.",
        },
      },
      returnToValidation: "Return to validation",
      counts:
        "{models} models / {tools} tools / {retrievalProfiles} retrieval profiles",
      loaded: "Loaded {models} model endpoints and {tools} tool registrations.",
      loading: "Loading runtime governance...",
      ready: "Runtime governance is ready.",
      loadFailed: "Runtime governance could not be loaded.",
      validationFailed: "Required governance fields are missing.",
      readOnly: "Read only",
      save: "Save",
      delete: "Delete",
      updatedAt: "Updated {value}",
      unsaved: "Unsaved draft",
      empty: "Not configured",
      enabled: "Enabled",
      disabled: "Disabled",
      boundAgents: "{count} agent bindings",
      boundKnowledgeBases: "{count} knowledge-base bindings",
      deleteBlockedBadge: "In use",
      deleteBlockedInUse:
        "This governed runtime resource is still in use. Remove the active bindings before deleting it.",
      followUpMetric: "Follow-up focus",
      metrics: {
        modelEndpoints: "Model endpoints",
        defaultModel: "Default model",
        enabledTools: "Enabled tools",
        retrievalProfiles: "Retrieval profiles",
        adminApproval: "Approval tools",
      },
      posture: {
        disabledBoundModels: "Disabled bound models",
        disabledBoundModelsHint:
          "Model endpoints that are disabled but still attached to agent definitions.",
        disabledBoundTools: "Disabled bound tools",
        disabledBoundToolsHint:
          "Tool registrations that are disabled while still referenced by agent definitions.",
        approvalGatedTools: "Approval-gated tools",
        approvalGatedToolsHint:
          "Registered tools that still stay behind an explicit approval boundary.",
        unboundEnabledRuntime: "Unbound enabled runtime",
        unboundEnabledRuntimeHint:
          "Enabled models and tools that are available but not yet bound into agent delivery.",
        quickActions: "Governance follow-up",
        quickActionsDescription:
          "Move from runtime resource posture into the agent and admin surfaces that can resolve the next issue.",
        issueActions: "Issue filters",
        openAttentionAgents: "Open attention agents",
        openAdminOverview: "Open admin overview",
        openActiveAgents: "Open active agents",
      },
      events: {
        title: "Recent runtime governance events",
        description:
          "The latest persisted governance actions across models, tools, MCP connectors, and retrieval profiles.",
        empty: "No runtime governance events have been recorded yet.",
        systemActor: "System actor",
        resources: {
          modelEndpoint: "Model endpoint",
          toolRegistration: "Tool registration",
          mcpConnector: "MCP connector",
          retrievalProfile: "Retrieval profile",
        },
      },
    },
    models: {
      title: "Model endpoints",
      description:
        "Register provider-facing endpoints and keep the product-ready model contract explicit.",
      governance: {
        runtimeReady: "Runtime-ready endpoints",
        disabledBound: "{count} disabled bound endpoints",
        localOllama: "Ollama endpoints",
        localVllm: "{count} vLLM endpoints",
        missingBaseUrl: "Missing base URL",
        envCredential: "{count} environment-credential endpoints",
        governedDefault: "Governed default route",
        settingsFallbackExposed:
          "Settings fallback is currently carrying the default chat path.",
        settingsFallbackCovered:
          "A runtime-ready governed default is covering the default chat path.",
      },
      compatibility: {
        title: "Provider compatibility",
        description:
          "Review the governed runtime contract for each provider before expanding local or private model coverage.",
        postureStatuses: {
          ready: "Ready",
          attention: "Needs review",
          setup_required: "Setup required",
        },
        runtimeReadyEndpoints: "Runtime-ready endpoints",
        activeAgents: "Active agents",
        attentionAgents: "Attention agents",
        baseUrl: "Base URL",
        baseUrlRequired: "Required",
        baseUrlNotRequired: "Not required",
        baseUrlRequiredHint: "Required, for example {value}",
        credentials: "Credential modes",
        preview: "Live preview",
        previewAvailable: "Available",
        previewUnavailable: "Unavailable",
        openProviderModels: "Open provider models",
        openRuntimeAttention: "Open runtime attention",
        routingStyles: {
          builtin: "Built-in",
          native_http: "Native HTTP",
          openai_compatible: "OpenAI-compatible",
        },
      },
      filters: {
        all: "All models",
        allProviders: "All providers",
        runtimeReady: "Runtime ready",
        disabledBound: "Disabled bound",
        missingBaseUrl: "Missing base URL",
        managedReserved: "Managed reserved",
        empty: "No model endpoints match the current governance filter.",
      },
      new: "New model",
      newOllama: "New Ollama",
      newVllm: "New vLLM",
      empty: "No model endpoints registered yet.",
      createdDraft: "New model endpoint draft created.",
      createdOllamaDraft: "New Ollama model endpoint draft created.",
      createdVllmDraft: "New vLLM model endpoint draft created.",
      saved: "{name} saved.",
      saveFailed: "Model endpoint save failed.",
      preview: "Validate endpoint",
      previewing: "Validating...",
      previewTitle: "Endpoint validation",
      previewHint:
        "Run a live preview to verify that this model endpoint can answer a minimal chat request.",
      previewEmpty:
        "Run validation to inspect the current provider response and runtime metadata.",
      previewLoaded: "{name} validation loaded.",
      previewFailed: "Model endpoint validation failed.",
      previewSaveFirst: "Save this model endpoint before running validation.",
      previewRequestMeta: "Request metadata",
      previewResponseMeta: "Response metadata",
      previewStatuses: {
        completed: "Completed",
        blocked: "Blocked",
        failed: "Failed",
      },
      deleteConfirm: "Delete model endpoint {name}?",
      deleted: "{name} deleted.",
      deleteFailed: "Model endpoint delete failed.",
      governanceActionFailed: "Model endpoint governance action failed.",
      default: "Default",
      name: "Name",
      slug: "Slug",
      provider: "Provider",
      modelName: "Model name",
      baseUrl: "Base URL",
      ollamaHint:
        "RAGPilot calls Ollama through its native /api/chat interface. Use a base URL such as http://127.0.0.1:11434.",
      vllmHint:
        "RAGPilot calls vLLM through its OpenAI-compatible /v1/chat/completions interface. Use a base URL such as http://127.0.0.1:8001/v1.",
      credentialMode: "Credential mode",
      credentialKeyHint: "Credential key hint",
      capabilities: "Capabilities",
      notes: "Operator notes",
      providers: {
        deterministic: "Deterministic",
        openai_compatible: "OpenAI-compatible",
        ollama: "Ollama",
        ollama_reserved: "Ollama",
        vllm: "vLLM",
        vllm_reserved: "vLLM",
      },
      credentialModes: {
        none: "No credential",
        environment: "Environment variable",
        managed_reserved: "Managed reserved",
      },
      actions: {
        enable: "Enable endpoint",
        disable: "Disable endpoint",
        promoteDefault: "Promote default",
      },
      openBoundAgents: "Open affected agents",
      openImpactedAgents: "Open disabled-model agents",
      capabilityLabels: {
        chat: "Chat",
        embeddings: "Embeddings",
      },
    },
    tools: {
      title: "Tool registrations",
      description:
        "Track callable tools before future agent runtime and MCP expansion starts consuming them.",
      governance: {
        nativeTools: "Native tools",
        httpTools: "HTTP tools",
        mcpReservedTools: "MCP reserved",
        approvalRequired: "Approval required",
        httpMissingEndpoints: "{count} missing endpoint URLs",
        mcpBoundAgents: "{count} bound reserved tools",
        integrationPending: "{count} integration-pending",
        connectorConfigured: "{count} connector-configured",
        connectorUnhealthy: "{count} connector-unhealthy",
        runtimeReady: "{count} runtime-ready",
      },
      filters: {
        all: "All tools",
        approvalRequired: "Approval required",
        disabled: "Disabled",
        missingEndpoint: "Missing endpoint",
        boundMcp: "Bound MCP",
        integrationPending: "Integration pending",
        connectorConfigured: "Connector configured",
        connectorUnhealthy: "Connector unhealthy",
        empty: "No tool registrations match the current governance filter.",
      },
      new: "New tool",
      empty: "No tool registrations exist yet.",
      createdDraft: "New tool registration draft created.",
      saved: "{name} saved.",
      saveFailed: "Tool registration save failed.",
      deleteConfirm: "Delete tool registration {name}?",
      deleted: "{name} deleted.",
      deleteFailed: "Tool registration delete failed.",
      name: "Name",
      slug: "Slug",
      transport: "Transport",
      surface: "Surface",
      endpointUrl: "Endpoint URL",
      connectorReference: "Connector reference",
      connectorReferencePlaceholder: "mcp.browser.primary",
      connectorReferenceHint:
        "Store the future MCP connector identifier or routing key for this reserved tool.",
      noConnectorReference: "No connector reference",
      connectorConfiguredBadge: "Connector configured",
      capabilities: "Capabilities",
      descriptionField: "Description",
      adminApproval: "Requires admin approval",
      adminApprovalHint: "This tool should stay behind an approval boundary.",
      directUseHint:
        "This tool can be invoked directly once the runtime allows it.",
      governanceActions: {
        title: "Governance actions",
        description:
          "Apply direct runtime-governance actions without editing the full registration form.",
        disable: "Disable tool",
        enable: "Enable tool",
        requireApproval: "Require approval",
        allowDirectUse: "Allow direct use",
        quarantine: "Quarantine tool",
        disabledApplied: "{name} disabled.",
        enabledApplied: "{name} enabled.",
        approvalApplied: "{name} now requires admin approval.",
        directUseApplied: "{name} now allows direct use.",
        quarantineApplied: "{name} quarantined.",
        reviewBoundaryApplied: "{name} moved into MCP boundary review.",
        readyBoundaryApplied: "{name} marked ready for MCP integration.",
        quarantineBoundaryApplied: "{name} quarantined at the MCP boundary.",
        connectorRequired:
          "Configure a connector reference before moving this reserved MCP tool into integration-ready state.",
        applyFailed: "Tool governance action failed.",
      },
      preview: "Preview tool",
      previewing: "Previewing...",
      previewTitle: "Tool preview",
      previewEmpty:
        "Run a preview to inspect the current tool response and runtime trace.",
      previewLoaded: "{name} preview loaded.",
      previewFailed: "Tool preview failed.",
      previewAttempts: "{count} attempts",
      previewHttpStatus: "HTTP {status}",
      previewTimeout: "{seconds}s timeout",
      previewRequestMeta: "Request metadata",
      previewResponseMeta: "Response metadata",
      previewScopeMissing:
        "A tenant scope is required before this tool can be previewed.",
      previewTenantReady: "A tenant scope is available for runtime preview.",
      auditTitle: "Runtime audit",
      auditTraceTitle: "Recent tool runtime traces",
      auditScopeMissing:
        "A tenant scope is required before runtime audit can be reviewed.",
      auditTenantReady:
        "Recent governed tool traces are available for this tenant scope.",
      auditEmpty:
        "No recent tool runtime traces match the current audit filter.",
      auditActions: {
        openToolSettings: "Open tool settings",
        openBoundAgents: "Open bound agents",
        openApprovalAgents: "Open approval queue",
        openImpactedAgents: "Open disabled-tool agents",
        reviewReservedTransport: "Review reserved MCP boundary",
        reviewIntegrationPending: "Review pending MCP integration",
        reviewToolRuntime: "Review runtime configuration",
      },
      auditFilters: {
        all: "All traces",
        failed: "Failed",
        blocked: "Blocked",
        reserved: "Reserved",
        unavailable: "Unavailable",
      },
      mcpWorklist: {
        title: "MCP boundary worklist",
        ready:
          "{count} bound reserved tools with {traces} recent reserved traces are ready for boundary review.",
        scopeMissing:
          "A tenant scope is required before the MCP boundary queue can be reviewed.",
        total: "{count} reserved tools",
        bound: "{count} bound agents",
        reviewing: "{count} reviewing",
        readyForIntegration: "{count} integration-ready",
        quarantined: "{count} quarantined",
        reservedTraces: "{count} reserved traces",
        noRecentTrace:
          "No recent reserved runtime trace has been recorded for this boundary yet.",
        empty:
          "No reserved MCP boundary tools need review in the current tenant scope.",
        statuses: {
          reviewing: "Reviewing",
          quarantined: "Quarantined",
          ready_for_integration: "Ready for integration",
        },
        actions: {
          review: "Move to review",
          ready: "Mark integration-ready",
          quarantine: "Quarantine boundary",
        },
      },
      previewStatuses: {
        completed: "Completed",
        blocked: "Blocked",
        reserved: "Reserved",
        unavailable: "Unavailable",
        failed: "Failed",
        skipped: "Skipped",
      },
      transports: {
        native: "Native",
        http: "HTTP",
        mcp_reserved: "MCP reserved",
      },
      surfaces: {
        chat: "Chat",
        documents: "Documents",
        operations: "Operations",
        admin: "Admin",
        agents: "Agents",
      },
      openBoundAgents: "Open affected agents",
      openImpactedAgents: "Open disabled-tool agents",
      openApprovalAgents: "Open approval-bound agents",
      linkedConnectorTitle: "Linked connector",
      openLinkedConnector: "Open linked connector",
      runtimePacket: {
        title: "Tool runtime packet",
        statusAttention: "Attention",
        statusReview: "Review",
        healthyDetail:
          "This tool currently looks stable enough to stay in the governed runtime inventory.",
        disabledDetail:
          "Disabled traces are blocking active runtime usage and should move straight into affected-agent cleanup.",
        approvalDetail:
          "Approval-gated traces are active, so the approval boundary should be reviewed before broader rollout.",
        reservedDetail:
          "Reserved MCP traces still need connector-side runtime closure before this tool can move forward cleanly.",
        integrationPendingDetail:
          "This tool already points at a connector but still has pending MCP runtime follow-up to close.",
        failedDetail:
          "Recent failed traces suggest the runtime configuration should be reviewed before operators keep depending on this tool.",
        metricReady: "Runtime ready",
        metricDisabled: "{count} disabled traces",
        metricApproval: "{count} approval traces",
        metricReserved: "{count} reserved MCP traces",
        metricIntegrationPending: "{count} pending MCP traces",
        metricFailed: "{count} failed traces",
        primaryOpenSettings: "Open runtime settings",
        primaryOpenImpactedAgents: "Open impacted agents",
        primaryOpenApprovalAgents: "Open approval agents",
      },
    },
    mcpConnectors: {
      title: "MCP connectors",
      description:
        "Manage connector assets before reserved MCP tools move into real runtime attachment.",
      new: "New connector",
      preview: "Preview connector",
      previewing: "Previewing connector...",
      previewTitle: "Connector runtime preview",
      previewEmpty:
        "Run a connector preview to inspect current reachability and transport metadata.",
      previewFailed: "MCP connector preview failed.",
      empty: "No MCP connectors exist yet.",
      createdDraft: "New MCP connector draft created.",
      saved: "{name} saved.",
      saveFailed: "MCP connector save failed.",
      deleteConfirm: "Delete MCP connector {name}?",
      deleted: "{name} deleted.",
      deleteFailed: "MCP connector delete failed.",
      governanceActionFailed: "MCP connector governance action failed.",
      name: "Name",
      slug: "Slug",
      connectorType: "Connector type",
      authMode: "Auth mode",
      baseUrl: "Base URL",
      credentialKeyHint: "Credential key hint",
      notes: "Notes",
      filters: {
        all: "All connectors",
        referenced: "Referenced",
        integrationBlocked: "Integration blocked",
        runtimeReady: "Runtime ready",
        missingBaseUrl: "Missing base URL",
        managedReserved: "Managed reserved",
        empty: "No MCP connectors match the current governance filter.",
      },
      governance: {
        total: "Connector assets",
        referenced: "{count} referenced",
        runtimeReadyLabel: "Runtime ready",
        integrationReady: "{count} integration-ready references",
        integrationBlockedLabel: "Integration blocked",
        missingBaseUrlLabel: "Missing base URL",
        missingCredentialHint: "{count} missing credential hints",
        managedReserved: "{count} managed reserved",
        enabled: "{count} enabled",
      },
      types: {
        streamable_http: "Streamable HTTP",
        sse: "SSE",
        managed_reserved: "Managed reserved",
      },
      authModes: {
        none: "No credential",
        environment: "Environment variable",
        managed_reserved: "Managed reserved",
      },
      previewStatuses: {
        completed: "Completed",
        blocked: "Blocked",
        failed: "Failed",
      },
      previewRequestMeta: "Request metadata",
      previewResponseMeta: "Response metadata",
      runtimePacket: {
        title: "Connector runtime packet",
        statusAttention: "Attention",
        statusReview: "Review",
        healthyDetail:
          "This connector is registered and can continue through the governed MCP delivery path.",
        configurationDetail:
          "This connector still needs basic runtime configuration before it can safely carry reserved MCP tools.",
        reservedDetail:
          "Reserved MCP agents still depend on this connector relationship being cleared through boundary governance.",
        pendingDetail:
          "Pending MCP agents are already waiting on this connector relationship to move into real runtime attachment.",
        metricReady: "{count} linked tools",
        metricConfiguration: "Configuration required",
        metricReserved: "{count} reserved agents",
        metricPending: "{count} pending agents",
        primaryOpenLinkedTools: "Open linked tools",
        primaryPreviewConnector: "Preview connector",
      },
      followUp: {
        referencedTools: "Referenced tools",
        boundTools: "Bound tools",
        activeAgents: "Active agents",
        integrationPendingAgents: "Pending agents",
        linkedToolsTitle: "Linked tools",
        openLinkedTools: "Open linked tools",
        openBoundAgents: "Open affected agents",
        openPendingAgents: "Open pending agents",
        openReservedAgents: "Open reserved agents",
      },
      actions: {
        enable: "Enable connector",
        disable: "Disable connector",
      },
    },
    retrievalProfiles: {
      title: "Retrieval profiles",
      description:
        "Define governed retrieval behavior that knowledge bases, grounded chat, and agent execution previews can resolve at runtime.",
      new: "New profile",
      empty: "No retrieval profiles exist yet.",
      createdDraft: "New retrieval profile draft created.",
      saved: "{name} saved.",
      saveFailed: "Retrieval profile save failed.",
      deleteConfirm: "Delete retrieval profile {name}?",
      deleted: "{name} deleted.",
      deleteFailed: "Retrieval profile delete failed.",
      governanceActionFailed: "Retrieval profile governance action failed.",
      default: "Default",
      name: "Name",
      slug: "Slug",
      mode: "Retrieval mode",
      topK: "Top K",
      vectorWeight: "Vector weight",
      lexicalWeight: "Lexical weight",
      hybridOverlapBonus: "Overlap bonus",
      notes: "Operator notes",
      openBoundKnowledgeBases: "Open affected knowledge bases",
      openBoundAgents: "Open affected agents",
      openImpactedAgents: "Open disabled-profile agents",
      modes: {
        hybrid: "Hybrid",
        vector: "Vector",
        lexical: "Lexical",
      },
      actions: {
        enable: "Enable profile",
        disable: "Disable profile",
        promoteDefault: "Promote default",
      },
    },
    eventTypes: {
      signInSucceeded: "Sign-in succeeded",
      signOutSucceeded: "Sign-out succeeded",
      sessionRevoked: "Session revoked",
      invitationIssued: "Invitation issued",
      invitationActivated: "Invitation activated",
      invitationRevoked: "Invitation revoked",
      membershipActive: "Membership activated",
      membershipSuspended: "Membership suspended",
      membershipDeleted: "Membership removed",
    },
  },
  home: {
    title: "Home | RAGPilot",
    welcome: {
      title: "Welcome back, {name}",
      fallbackName: "operator",
      description:
        "Resume your grounded chat, document operations, and agent work from here.",
    },
    entry: {
      eyebrow: "Internal access",
      title: "RAGPilot internal entry",
      description:
        "This deployment is intended for internal operators. Use the local sign-in flow to enter the console.",
      openLogin: "Open Sign In",
      openConsole: "Open Console",
      sessionActive: "Local session active",
      loginHint:
        "Use the sign-in entry to create a local session before opening protected surfaces.",
    },
    hero: {
      eyebrow: "Open-source AI knowledge platform",
      title:
        "The production-facing entry point for knowledge and agent operations.",
      description:
        "RAGPilot unifies grounded chat, document operations, agent design, and platform governance in one professional operating surface.",
      openChat: "Open Chat",
      openDocuments: "Open Documents",
      openWorkflows: "Open Workflows",
      openOperations: "Open Operations",
      openIntake: "Open intake lane",
      openMonitoring: "Open monitoring",
      openRecovery: "Open recovery",
      openValidation: "Open grounded validation",
      resumeValidation: "Resume validation",
      reviewEvidence: "Review source evidence",
      openAdmin: "Open Admin",
      openAgents: "Open Agents",
      currentScope: "Current operating scope",
      currentScopeDescription:
        "The home surface follows the active tenant, workspace, and knowledge base while remaining a platform entry point rather than a second admin console.",
      metricsTitle: "Platform footprint",
    },
    status: {
      loading: "Loading platform home...",
      refreshingDirectory: "Refreshing platform directory...",
      refreshingScope: "Refreshing platform scope...",
      scopedRefreshed: "Scoped platform overview refreshed.",
      failed: "Home overview failed to load.",
      scopedFailed: "Scoped home overview failed to load.",
      noTenants: "No tenants have been provisioned yet.",
      loaded:
        "Loaded {tenantCount} tenants, {workspaceCount} workspaces, and {knowledgeBaseCount} knowledge bases.",
    },
    scope: {
      title: "Live scope selection",
      description:
        "Keep the home surface concise while reflecting the tenant, workspace, and knowledge base you are actively operating.",
      notAvailable: "Not available",
      selectTenant: "Select tenant",
      selectWorkspace: "Select workspace",
      selectKnowledgeBase: "Select knowledge base",
      refresh: "Refresh",
      refreshing: "Refreshing...",
      tenant: "Tenant",
      workspace: "Workspace",
      knowledgeBase: "Knowledge Base",
      liveScope: "Live scope",
      liveScopeDescription:
        "This scope drives the platform counts, status signals, and operating context shown on the home surface.",
    },
    metrics: {
      tenants: "Tenants",
      workspaces: "Workspaces",
      knowledgeBases: "Knowledge Bases",
      messages: "Messages",
      agentRuns: "Agent runs",
    },
    overview: {
      chats: "Chats",
      documents: "Documents",
      agents: "Agents",
      nextStep: "Next step",
      viewMore: "View more",
      emptyChats: "No chat threads are available in the current scope yet.",
      emptyDocuments: "No documents are available in the current scope yet.",
      emptyAgents: "No active agents are available in the current scope yet.",
      messageCount: "{count} messages",
      noAgentObjective:
        "No business objective has been recorded for this agent yet.",
    },
    architecture: {
      title: "Operating architecture",
      description:
        "Follow the actual RAGPilot business path from governance and knowledge preparation into execution, grounded answers, and future automation.",
      stage: "Stage {index}",
      openStage: "Open stage",
      govern: {
        title: "Govern",
        description:
          "{tenantCount} tenants and {workspaceCount} workspaces are currently under platform control.",
        value: "{count} knowledge scopes",
      },
      knowledge: {
        title: "Prepare knowledge",
        description:
          "{count} documents are registered in the active knowledge scope.",
        value: "{count} retrieval-ready",
      },
      ingest: {
        title: "Run ingestion",
        description:
          "{count} documents are currently in active processing lanes.",
        value: "{count} failed runs",
      },
      answer: {
        title: "Ground answers",
        description:
          "{count} persisted conversations are currently available in the active workspace.",
        value: "{count} messages stored",
      },
      extend: {
        title: "Extend with agents",
        description:
          "{count} tool-enabled agent definitions are available for runtime handoff.",
        value: "{count} active agents",
      },
    },
    commandCenter: {
      title: "Command packets",
      description:
        "Use the current tenant and knowledge scope to enter the next real operating lane instead of starting from scratch on every surface.",
      recovery: {
        title: "Recovery packet",
        metric: "Open recovery items",
        healthyDetail:
          "No failed workflows or failed documents are currently pressuring the active scope.",
        attentionDetail:
          "{workflowCount} failed workflows and {documentCount} failed documents currently need follow-up in the active scope.",
        primaryFailedWorkflows: "Open failed workflows",
        primaryOperations: "Open operations",
        secondaryFailedDocuments: "Review failed documents",
        secondaryDocuments: "Open documents",
      },
      retrieval: {
        title: "Retrieval packet",
        metric: "Retrieval-ready documents",
        validationMetric: "Validation state",
        readyDetail:
          "{count} documents are ready to support grounded answers in the active knowledge scope.",
        validatedDetail:
          "{count} retrieval-ready documents have already cleared live validation and can continue into grounded chat.",
        reviewDetail:
          "{count} retrieval-ready documents are available, but the latest validation pass still needs operator review before chat becomes the default lane.",
        blockedDetail:
          "The latest validation pass did not clear grounded chat. Review source evidence or ingestion state before reopening the answer lane.",
        pendingDetail:
          "No retrieval-ready documents are visible yet. Continue intake and indexing before depending on grounded answers.",
        unresolvedDetail:
          "Resolve a knowledge-base scope first so retrieval readiness stays tied to a real asset boundary.",
        primaryChat: "Open grounded chat",
        primaryDocuments: "Open documents",
        secondaryDocuments: "Inspect document lane",
        secondaryOperations: "Inspect workflow lane",
      },
      agents: {
        title: "Agent packet",
        metric: "Active runtime agents",
        readyDetail:
          "{name} is the clearest active runtime handoff for the current home scope.",
        pendingDetail:
          "{name} is active, but the leading handoff still needs cleaner scope alignment before launch.",
        emptyDetail:
          "No active agents are available in the current tenant scope yet.",
        primaryRecommended: "Open recommended handoff",
        primaryDefinition: "Open agent definition",
        primaryAgents: "Open agents",
        secondaryDefinition: "Review definition",
        secondaryAdmin: "Open governance",
      },
      governance: {
        title: "Governance packet",
        metric: "Runtime attention agents",
        attentionDetail:
          "{count} active agents still need runtime governance follow-up before clean delivery.",
        reviewDetail:
          "{count} registered tools still remain behind an approval boundary.",
        healthyDetail:
          "Runtime governance posture is stable for the current tenant scope.",
        primaryAttentionAgents: "Open attention agents",
        primarySettings: "Open settings",
        secondaryAdmin: "Open admin",
        secondaryActiveAgents: "Open active agents",
      },
    },
    core: {
      title: "Core workspace entry",
      description:
        "Home only keeps the three primary product lanes so you can move straight into chat, documents, or workflows.",
      flowStateEmpty: "Empty",
      flowStatePending: "Pending",
      flowStateMonitoring: "Monitoring",
      flowStateRecovery: "Recovery",
      flowStateReady: "Ready",
      flowStateActive: "Active",
      chatsTitle: "Chats",
      chatsMetric: "Conversation count",
      chatsDetail:
        "{messageCount} messages persisted. Latest activity {activity}.",
      chatsScopePending:
        "Select a live knowledge scope first so grounded chat can open on the right tenant, workspace, and knowledge base.",
      chatsDocumentsPending:
        "Grounded chat is waiting for retrieval-ready documents. Finish intake first, then return here to validate cited answers.",
      chatsReadyToStart:
        "The knowledge scope is ready. Start the first grounded thread and use citations to validate the current source set.",
      documentsTitle: "Documents",
      documentsMetric: "Document count",
      documentsDetail:
        "{total} documents in scope, {ready} ready, {failed} failed.",
      documentsEmpty:
        "No documents are registered in the current knowledge scope yet. Open documents first and ingest the initial source set.",
      documentsRecovery:
        "{failed} documents still need recovery before this scope is fully reliable for grounded answers.",
      documentsMonitoring:
        "{active} documents are still moving through ingestion or indexing. Keep the intake lane open until processing settles.",
      documentsReady:
        "{ready} documents are retrieval-ready in the current scope and can now support grounded validation.",
      workflowsTitle: "Workflows",
      workflowsMetric: "Workflow count",
      workflowsDetail:
        "{total} runs in scope, {active} active, {failed} failed, {cancelled} cancelled.",
      workflowsEmpty:
        "No workflow runs have been recorded in the current scope yet. Workflow supervision will become active as soon as document intake starts moving.",
      workflowsRecovery:
        "{failed} failed runs and {cancelled} cancelled runs still need closure before this operator lane is stable again.",
      workflowsMonitoring:
        "{active} active, {queued} queued, and {running} running workflow lanes are still in motion for the current scope.",
      workflowsReady:
        "{total} completed workflow runs already provide a stable validation lane for the current scope.",
      executionOutputCount: "{count} outputs",
      executionFollowUpCount: "{count} follow-up actions",
      noActivity: "No activity yet",
    },
    runtime: {
      title: "Model runtime attention",
      description:
        "Keep runtime provider closure visible on the product entry surface whenever the default lane or the selected tenant still needs model follow-up.",
      openSettings: "Open model settings",
      openAgents: "Open impacted agents",
      providerAttentionTitle: "{provider} runtime lane needs closure",
      providerAttentionDetail:
        "{runtimeReady} runtime-ready endpoints, {activeAgents} active agents, {attentionAgents} active agents still under attention.",
      defaultAttentionTitle: "Default runtime lane needs closure",
      defaultAttentionDetail:
        "No runtime-ready default model endpoint is currently exposed for the platform entry path.",
      defaultReadyLabel: "Runtime-ready defaults",
      defaultReadyHint:
        "Platform-wide default model endpoints ready for execution.",
      tenantAttentionLabel: "Tenant runtime attention",
      tenantAttentionHint:
        "Active agents in the selected tenant still bound to incomplete model runtime lanes.",
      statusAttention: "Attention",
    },
    capabilities: {
      title: "Core platform surfaces",
      description:
        "The home page stays focused. Each capability below opens the formal built surface instead of repeating administrative workflows.",
      openSurface: "Open Surface",
      chatDescription:
        "Grounded chat with persisted conversations and citation-aware responses.",
      documentsDescription:
        "Document ingestion, indexing state, and retrieval-ready asset review.",
      agentsDescription:
        "Agent design, tool access configuration, and execution control.",
      adminDescription:
        "Tenant governance, publication control, and platform administration.",
    },
    platform: {
      title: "Platform status",
      description:
        "High-level signals only, sufficient to understand platform readiness without turning home into a full operations dashboard.",
      api: "API connection",
      apiHealthy:
        "The local API is reachable and the home surface is reading live platform data.",
      apiAttention:
        "The local API needs attention before the platform home can stay reliable.",
      scope: "Scope readiness",
      scopeHealthy:
        "A tenant and workspace are currently resolved for platform entry.",
      scopePending:
        "Select a tenant and workspace to activate the full home scope.",
      retrieval: "Retrieval surface",
      retrievalHealthy:
        "{count} indexed documents are visible in the active knowledge scope.",
      retrievalValidated:
        "{count} indexed documents are live-validated for grounded chat in the active knowledge scope.",
      retrievalReview:
        "Retrieval evidence is available, but the latest validation posture is still {status}.",
      retrievalBlocked:
        "The latest validation posture is blocking grounded chat until source evidence is reviewed.",
      retrievalPending:
        "No knowledge base is currently resolved for retrieval signals.",
      agents: "Agent lane",
      agentHealthy:
        "{count} active agents are available in the active tenant scope.",
      agentPending:
        "No active agents are configured in the current tenant scope yet.",
      workflows: "Workflow lane",
      workflowHealthy:
        "No failed workflow pressure is visible in the active tenant scope.",
      workflowAttention: "{count} failed workflow runs currently need review.",
      statuses: {
        healthy: "Healthy",
        attention: "Attention",
        pending: "Pending",
      },
    },
    signals: {
      title: "Live signals",
      description:
        "A concise live readout from the current scope to keep the platform home connected to operational activity.",
      latestConversation: "Latest conversation",
      latestConversationDetail: "Latest activity {value}",
      noConversation: "No persisted conversations yet",
      noConversationDetail:
        "Start a grounded chat thread to surface the first conversation signal.",
      openConversation: "Open Conversation",
      failedDocuments: "Failed documents",
      noFailedDocuments:
        "No failed documents in the active knowledge base scope.",
      failedWorkflows: "Recovery workflows",
      noFailedWorkflows: "No failed workflow runs in the active tenant scope.",
      agentRuns: "Agent runtime",
      agentRunsDetail: "{count} launches recorded, latest at {value}",
      noAgentRuns:
        "No agent launches have been recorded in the active tenant scope yet.",
    },
    agentTelemetry: {
      title: "Agent runtime activity",
      description:
        "Follow the latest recorded agent launches from the current tenant scope without opening the full agent console.",
      openAgents: "Open agents",
      latestLaunch: "Latest launch {value}",
      noLatestLaunch: "No recorded launch yet.",
      recentRuns: "Recent launches",
      empty:
        "No agent runtime launches are visible in the current tenant scope yet.",
      unknownAgent: "Unknown agent definition",
      metricsTotalHint: "All recorded launches in the current tenant scope.",
      metricsChatHint: "Launches that routed into the grounded chat surface.",
      metricsDocumentsHint:
        "Launches that routed into the document operations surface.",
    },
    agentExecutions: {
      title: "Execution task activity",
      description:
        "Keep recent agent execution results and bound tool traces visible from the current tenant home scope.",
      openOperations: "Open operations",
      openExecutionRoute: "Open execution route",
      recentExecutions: "Recent execution tasks",
      latestExecution: "Latest execution {value}",
      noLatestExecution: "No execution has been recorded yet.",
      unknownAgent: "Unknown agent definition",
      pending:
        "Execution is still processing or waiting for the final summary.",
      empty: "No agent executions are visible in the current tenant scope yet.",
      metrics: {
        total: "Execution tasks",
        totalHint: "Recorded execution tasks in the current tenant scope.",
        completed: "Completed tasks",
        completedHint:
          "Execution tasks that already produced a final runtime result.",
        failed: "Failed tasks",
      },
    },
    runtimeGovernance: {
      title: "Runtime governance",
      description:
        "Review scoped model and tool governance pressure from home before diving into admin or agent delivery surfaces.",
      openAttentionAgents: "Open attention agents",
      openSettings: "Open settings",
      openAdmin: "Open admin",
      openActiveAgents: "Open active agents",
      signals: "Governance signals",
      actions: "Follow-up actions",
      actionsDescription:
        "Use the built governance surfaces to resolve scope, model, and tool pressure without rebuilding context by hand.",
      metrics: {
        attentionAgents: "Attention agents",
        attentionAgentsHint:
          "Active agents in the current tenant scope that still need scope, retrieval, model, or tool cleanup.",
        disabledBoundModels: "Disabled bound models",
        disabledBoundModelsHint:
          "Model endpoints disabled while still connected to active agents.",
        disabledBoundTools: "Disabled bound tools",
        disabledBoundToolsHint:
          "Tool registrations disabled while still connected to active agents.",
        approvalGatedTools: "Approval-gated tools",
        approvalGatedToolsHint:
          "Registered tools that still remain behind an admin approval boundary.",
      },
      signalValues: {
        activeAgentsWithoutScope: "{count} active agents without scope",
        missingModelBindings: "{count} missing model bindings",
        disabledModelBindings: "{count} disabled model bindings",
        missingRetrievalBindings: "{count} missing retrieval bindings",
        disabledRetrievalBindings: "{count} disabled retrieval bindings",
        disabledToolBindings: "{count} disabled tool bindings",
      },
    },
    activity: {
      title: "Recent document activity",
      description:
        "Stay close to the latest indexed or changed documents in the active knowledge scope.",
      openAllDocuments: "Open all documents",
      versionSummary: "Version {version} · {chunks} chunks",
      updatedAt: "Updated {value}",
      workflowState: "Workflow {value}",
      openDocument: "Open document",
      empty:
        "No recent documents are visible in the active knowledge scope yet.",
    },
    workflowLane: {
      title: "Workflow queue snapshot",
      description:
        "Recent execution updates for the active tenant without leaving the home overview.",
      openOperations: "Open operations",
      unlabeledSubject: "Unlabeled workflow subject",
      updatedAt: "Updated {value}",
      noError: "No blocking error message is recorded for this run.",
      openRun: "Open run",
      empty: "No workflow runs are visible in the active tenant scope yet.",
    },
    agentLane: {
      title: "Active agents",
      description:
        "The currently enabled agent definitions that can be handed into built operator surfaces.",
      openAgents: "Open agents",
      noObjective:
        "No business objective has been recorded for this active agent yet.",
      scoped: "{count} tools enabled · scoped",
      unscoped: "{count} tools enabled · scope still open",
      runtimePrompt: "Runtime prompt",
      scopeResolved: "Scoped launch ready",
      scopeMissing: "Scope mapping still missing",
      runtimeMode: "Mode {value}",
      connectedCapabilities: "{count} connected capabilities",
      recommendedSurface: "Recommended {value}",
      targets: {
        chat: "chat surface",
        documents: "document surface",
        workflows: "workflow surface",
      },
      openDefinition: "Open definition",
      openRecommended: "Open recommended surface",
      openBrief: "Open launch brief",
      inspectDocuments: "Inspect documents",
      openOperations: "Open operations",
      empty: "No active agents are available in the current tenant scope yet.",
    },
    retrievalInspector: {
      title: "Retrieval diagnostics",
      description:
        "Run a live hybrid retrieval check against the active knowledge base before validating grounded answers or escalation routes.",
      queryTitle: "Inspect retrieval results",
      queryDescription:
        "Submit a real question and review the exact chunks the current retrieval pipeline would surface.",
      queryLabel: "Query text",
      queryPlaceholder:
        "Ask about a policy, document section, workflow, or product fact",
      topKLabel: "Top K",
      run: "Run retrieval",
      compare: "Compare engines",
      comparing: "Comparing...",
      running: "Running...",
      openChat: "Open in chat",
      reviewEvidence: "Review source evidence",
      openDocument: "Open document",
      askWithThisQuery: "Ask this in chat",
      statusTitle: "Retrieval status",
      statusIdle: "Ready to inspect the active knowledge scope.",
      statusRunning: "Running live hybrid retrieval...",
      compareStatusRunning:
        "Comparing live retrieval output across native and llamaindex_pilot...",
      statusLoaded: "Loaded {count} retrieval results.",
      compareStatusLoaded:
        "Comparison loaded with {shared} shared ranked chunks.",
      validationReady:
        "{count} retrieval hits are ready to support grounded validation in chat.",
      validationEmpty:
        "This validation query returned no evidence. Review the source lane before continuing.",
      statusEmpty:
        "No retrieval results matched this query in the active knowledge scope.",
      statusFailed: "Retrieval diagnostics failed.",
      scopeRequired:
        "Select a tenant, workspace, and knowledge base first so retrieval diagnostics stay attached to a real scope.",
      waiting:
        "Run a retrieval query to inspect ranked chunks, scoring signals, and the resulting document path.",
      noResults: "No ranked chunks were returned for this query.",
      resultCount: "{count} results",
      compareResultCount: "{baseline} vs {candidate} results",
      compareShared: "{count} shared",
      compareBaselineOnly: "{count} native only",
      compareCandidateOnly: "{count} llamaindex only",
      topResultMatches: "Top result matches",
      topResultDiffers: "Top result differs",
      recentEvaluationsTitle: "Recent evaluations",
      recentEvaluationsEmpty:
        "No persisted retrieval evaluations exist in the current scope yet.",
      selectedEvaluationTitle: "Selected evaluation",
      selectedEvaluationDescription:
        "Re-open one persisted evaluation as a direct follow-up packet for governance, replay, or grounded validation.",
      selectedEvaluationEmpty:
        "Select a recent evaluation to inspect its saved follow-up context.",
      selectedEvaluationNoSources:
        "No source documents were preserved for this evaluation.",
      tuningCandidatesTitle: "Tuning candidates",
      tuningCandidatesEmpty:
        "No repeated review candidates exist in the current scope yet.",
      queryCount: "{count} queries",
      evaluationCount: "{count} evaluations",
      summaryEvaluations: "{count} evaluations",
      summaryReady: "{count} ready",
      summaryReview: "{count} review",
      summaryHold: "{count} hold",
      summaryFailed: "{count} failed",
      summaryEmpty: "{count} empty",
      recommendedNextStep: "Recommended next step",
      reviewSourceScope: "Review source scope",
      reviewRetrievalProfile: "Review retrieval profile",
      inspectAgain: "Inspect again",
      compareAgain: "Compare again",
      openKnowledgeBaseGovernance: "Open knowledge base governance",
      openRetrievalGovernance: "Open retrieval governance",
      sourceDocumentsTitle: "Source documents",
      openSourceDocument: "Open {title}",
      recommendationAligned: "Aligned",
      recommendationReview: "Review candidate",
      recommendationHold: "Hold candidate",
      baselineEngine: "Baseline engine",
      candidateEngine: "Candidate engine",
      engineLabel: "Engine {value}",
      retrievalProfile: "Profile {value}",
      profileSource: "Source {value}",
      retrievalMode: "Mode {value}",
      effectiveTopK: "Effective Top K {value}",
      embeddingModel: "Embedding {value}",
      sourceRank: "Source #{rank}",
      score: "score {score}",
      vectorScore: "vector {score}",
      lexicalScore: "lexical {score}",
      lexicalNormalizedScore: "lexical normalized {score}",
      tokenCount: "{count} tokens",
      chunkLabel: "Chunk {index}",
    },
    resources: {
      openDocuments: "Open Documents",
    },
  },
  admin: {
    access: {
      fullAccess: "Full access",
      readOnly: "Read-only governance",
    },
    title: "Admin",
    header: {
      eyebrow: "Governance command",
      title: "Platform administration",
      description:
        "Review tenant scope, workspace lifecycle, knowledge publication state, and platform supervision from one control plane.",
    },
    status: {
      loading: "Loading governance directory...",
      refreshing: "Refreshing governance directory...",
      failed: "Governance directory failed to load.",
      lastRefreshed: "Last refreshed {value}",
      waitingForRefresh: "Waiting for first refresh.",
      noTenants: "No tenants provisioned yet.",
      loaded:
        "Loaded {tenantCount} tenants, {userCount} members, {workspaceCount} workspaces, {knowledgeBaseCount} knowledge bases, and live chat activity metrics for the active scope.",
      archiveWorkspace: "Archiving workspace scope...",
      restoreWorkspace: "Restoring workspace scope...",
      workspaceArchived: "Workspace {name} archived.",
      workspaceRestored: "Workspace {name} restored.",
      workspaceActionFailed: "Workspace lifecycle action failed.",
      publishKnowledgeBase: "Publishing knowledge base...",
      moveKnowledgeBaseToDraft: "Moving knowledge base to draft...",
      knowledgeBasePublished: "Knowledge base {name} published.",
      knowledgeBaseDraft: "Knowledge base {name} moved to draft.",
      knowledgeBaseActionFailed: "Knowledge base publication action failed.",
      creatingMember: "Creating member...",
      memberCreated: "Member {name} created.",
      memberCreationFailed: "Member creation failed.",
      updatingMember: "Updating member...",
      memberUpdated: "Member {name} updated.",
      memberUpdateFailed: "Member update failed.",
      memberPasswordResetting: "Resetting member password...",
      memberPasswordReset: "Password reset for {name}.",
      memberPasswordResetFailed: "Member password reset failed.",
      invitingMemberToTenant: "Sending tenant invitation...",
      memberInvitedToTenant: "Tenant invitation queued for {name}.",
      memberAddFailed: "Member tenant assignment failed.",
      activatingMemberAccount: "Activating member account...",
      deactivatingMember: "Deactivating member account...",
      memberActivated: "Member account activated for {name}.",
      memberDeactivated: "Member account deactivated for {name}.",
      memberAccountUpdateFailed: "Member account update failed.",
      issuingInvitationCode: "Issuing invitation code...",
      invitationCodeIssued: "Invitation code issued for {name}.",
      invitationCodeIssueFailed: "Invitation code could not be issued.",
      revokingInvitationCode: "Revoking invitation code...",
      invitationCodeRevoked: "Invitation code revoked for {name}.",
      invitationCodeRevokeFailed: "Invitation code could not be revoked.",
      activatingMembership: "Activating membership...",
      suspendingMembership: "Suspending membership...",
      membershipActivated: "Membership activated for {name}.",
      membershipSuspended: "Membership suspended for {name}.",
      membershipUpdateFailed: "Membership update failed.",
      removingMembership: "Removing membership from tenant scope...",
      membershipRemoved: "Membership removed for {name}.",
      membershipRemoveFailed: "Membership removal failed.",
      memberSessionRevoked: "Member session revoked.",
      memberSessionRevokeFailed: "Member session revocation failed.",
    },
    filters: {
      tenantScope: "Select organization scope",
      search:
        "Search organizations, workspaces, knowledge bases, or retrieval profiles",
      workspaceLifecycle: "Workspace lifecycle",
      knowledgePublication: "Knowledge publication",
      retrievalProfile: "Retrieval profile",
      allTenants: "All organizations",
      allWorkspaces: "All workspaces",
      activeOnly: "Active only",
      archivedOnly: "Archived only",
      allKnowledgeBases: "All knowledge bases",
      allRetrievalProfiles: "All retrieval profiles",
      defaultFallbackRetrievalProfile: "Platform default fallback",
      disabledAssignedRetrievalProfile: "Disabled profile assignments",
      publishedOnly: "Published only",
      draftOnly: "Draft only",
      returnToValidation: "Return to validation",
      refreshDirectory: "Refresh directory",
      refreshingDirectory: "Refreshing...",
      resourceFilters: "Resource filters",
      memberFilters: "Member filters",
    },
    actions: {
      edit: "Edit",
      createTenant: "Create Organization",
      createWorkspace: "Create Workspace",
      createKnowledgeBase: "Create Knowledge Base",
      createMember: "Create Member",
      saveMember: "Save Member",
      resetMemberPassword: "Reset Password",
      resettingMemberPassword: "Resetting...",
      archive: "Archive",
      archiving: "Archiving...",
      restore: "Restore",
      restoring: "Restoring...",
      publish: "Publish",
      publishing: "Publishing...",
      moveToDraft: "Move to draft",
      unpublishing: "Unpublishing...",
      addToTenant: "Add to tenant",
      addingToTenant: "Adding...",
      inviteToTenant: "Invite to tenant",
      invitingToTenant: "Inviting...",
      removeFromTenant: "Remove from tenant",
      removing: "Removing...",
      deactivate: "Deactivate",
      deactivating: "Deactivating...",
      activate: "Activate",
      activating: "Activating...",
      activateInvite: "Activate invite",
      showInvitationCode: "Show invite code",
      regenerateInvitationCode: "Regenerate code",
      revokeInvitationCode: "Revoke code",
      revokingInvitationCode: "Revoking...",
      issuingInvitationCode: "Issuing code...",
      suspend: "Suspend",
      suspending: "Suspending...",
    },
    metrics: {
      managedTenants: "Managed tenants",
      managedTenantsHint: "Tenant governance in current scope",
      activeWorkspaces: "Active workspaces",
      activeWorkspacesHint: "Operational workspaces currently visible",
      publishedKnowledgeBases: "Published knowledge bases",
      publishedKnowledgeBasesHint:
        "Retrieval-ready published knowledge surfaces",
      activeAgents: "Active agents",
      activeAgentsHint:
        "Enabled agent definitions available to support governed operations",
      pendingControls: "Pending controls",
      pendingControlsHint: "Review items that need operator attention",
      openScope: "Open scope",
    },
    resourceActions: {
      title: "Resource actions",
      description:
        "Create tenants, workspaces, and knowledge bases from the admin surface without leaving governance scope.",
    },
    sections: {
      title: "Governance architecture",
      description:
        "Separate platform administration into admin overview, resource management, members and access, and AI runtime configuration.",
      overview: "Admin overview",
      overviewDescription:
        "Cross-tenant governance signals, watchlists, and platform chat activity.",
      directory: "Resource management",
      directoryDescription:
        "Tenant inventory, knowledge governance, and agent scope review.",
      access: "Members & access",
      accessDescription:
        "Member directory, invitation lifecycle, and recent access auditing.",
      runtime: "AI runtime configuration",
      runtimeDescription:
        "Models, tools, MCP connectors, and retrieval profiles.",
      security: "Security",
      securityDescription:
        "Invitation hygiene, dormant-account review, and sensitive governance events.",
    },
    runtimeResources: {
      title: "AI runtime configuration",
      description:
        "Configure, test, enable, and audit the resources used by governed agents and retrieval.",
      refresh: "Refresh",
      create: "New resource",
      search: "Search by name, slug, or resource ID",
      enabled: "Enabled",
      disabled: "Disabled",
      default: "Default",
      edit: "Edit",
      test: "Test",
      testConnection: "Test connection",
      moreActions: "More actions",
      enable: "Enable",
      disable: "Disable",
      makeDefault: "Make default",
      empty: "No resources match this view.",
      createTitle: "Create runtime resource",
      editTitle: "Edit runtime resource",
      cancel: "Cancel",
      save: "Save",
      saving: "Saving...",
      saved: "Runtime resource saved.",
      loading: "Loading current resources...",
      loadFailed: "Runtime resources could not be loaded.",
      saveFailed: "Runtime resource could not be saved.",
      selectTenant: "Select one tenant before testing a tool.",
      previewComplete: "Runtime test completed.",
      actionComplete: "Governance action completed.",
      actionFailed: "Governance action failed.",
      disableTitle: "Disable runtime resource",
      disableDescription:
        "Disable {name}? {count} linked objects may be affected, and new requests will no longer use this resource.",
      confirmDisable: "Disable resource",
      deleteTitle: "Delete runtime resource",
      deleteDescription:
        "Delete {name}? Bound resources may reject this action.",
      delete: "Delete",
      deleteFailed: "Runtime resource could not be deleted.",
      kinds: {
        model_endpoint: "Model services",
        tool_registration: "Tools",
        mcp_connector: "MCP connectors",
        retrieval_profile: "Retrieval profiles",
      },
      fields: {
        name: "Name",
        slug: "Slug",
        provider: "Provider",
        modelName: "Model name",
        baseUrl: "Base URL",
        credentialMode: "Credential mode",
        credentialKey: "Credential environment key",
        capabilities: "Capabilities (comma separated)",
        transport: "Transport",
        surface: "Surface",
        endpointUrl: "Endpoint URL",
        connectorReference: "Connector reference",
        connectorType: "Connector type",
        authMode: "Authentication mode",
        retrievalMode: "Retrieval mode",
        notes: "Notes / description",
        approval: "Requires administrator approval",
        top_k: "Top K",
        vector_weight: "Vector weight",
        lexical_weight: "Lexical weight",
        hybrid_overlap_bonus: "Overlap bonus",
      },
    },
    overviewLanes: {
      title: "Control-plane lanes",
      description:
        "Use the overview surface to branch into the specific governance lane that matches the current operational question.",
      openLane: "Open lane",
      directory: {
        title: "Directory lane",
        description:
          "{workspaceCount} workspaces and {knowledgeBaseCount} knowledge bases are visible in the current governance scope.",
        value: "{agentCount} governed agents",
      },
      access: {
        title: "Access lane",
        description:
          "{memberCount} persisted members are currently visible inside the selected admin scope.",
        value: "{invitedCount} invitations pending",
      },
      security: {
        title: "Security lane",
        description:
          "{eventCount} recent access events are currently visible for governance review.",
        value: "{count} posture items need review",
      },
    },
    accessSummary: {
      title: "Access posture",
      description: "Current member-access posture for the active admin scope.",
      totalMembers: "Visible members",
      totalMembersHint:
        "Persisted members visible in the current governance scope.",
      invitedMemberships: "Invited memberships",
      invitedMembershipsHint:
        "Tenant invitations that still need member activation.",
      suspendedMemberships: "Suspended memberships",
      suspendedMembershipsHint:
        "Tenant relationships currently held out of active access.",
      auditEvents: "Recent events",
      auditEventsHint:
        "Access events currently visible in the latest governance window.",
      eventBreakdownTitle: "Audit distribution",
      eventBreakdownDescription:
        "Backend-counted event totals across the selected admin scope, beyond the latest visible event list.",
      eventBreakdownEmpty:
        "No access-event distribution is available in this scope yet.",
      openAuditSlice: "Open audit slice",
    },
    securitySummary: {
      title: "Security posture",
      description:
        "Review dormant accounts, invitation timing, and sensitive governance activity without leaving the admin scope.",
      activeAccounts: "Active accounts",
      activeAccountsHint:
        "Persisted directory accounts currently able to authenticate.",
      dormantAccounts: "Dormant accounts",
      dormantAccountsHint:
        "Active accounts with no sign-in or no sign-in in the last 30 days.",
      expiringInvitations: "Invitation risk",
      expiringInvitationsHint:
        "Invitations already expired or approaching expiration within 72 hours.",
      failedSignIns: "Failed sign-ins",
      failedSignInsHint:
        "Failed sign-in attempts recorded inside the active lockout review window.",
    },
    securityWatch: {
      title: "Security review queue",
      description:
        "Prioritize invitation and account conditions that may block onboarding or require governance follow-up.",
      expiredInvitations: "Expired invitations",
      expiredInvitationsDetail:
        "{count} invited memberships already passed their activation window.",
      expiredInvitationsHealthy:
        "No invited memberships are already past their activation window.",
      expiringInvitations: "Expiring invitations",
      expiringInvitationsDetail:
        "{count} invited memberships will expire within the next 72 hours.",
      expiringInvitationsHealthy:
        "No invitations are about to expire in the next 72 hours.",
      dormantAccounts: "Dormant accounts",
      dormantAccountsDetail:
        "{count} active accounts have not signed in recently enough for healthy operational posture.",
      dormantAccountsHealthy:
        "Active accounts in scope still show recent sign-in posture.",
      failedSignInPressure: "Failed sign-in pressure",
      failedSignInPressureDetail:
        "{count} members are currently hitting the failed sign-in lockout threshold.",
      failedSignInPressureHealthy:
        "No members are currently under failed sign-in lockout pressure.",
      invitationActivationPressure: "Invitation activation pressure",
      invitationActivationPressureDetail:
        "{count} invited members recently failed invitation activation and may need onboarding follow-up.",
      invitationActivationPressureHealthy:
        "No recent invitation activation failures need follow-up in the current scope.",
      sessionSpreadPressure: "Session spread pressure",
      sessionSpreadPressureDetail:
        "{count} members currently exceed the reviewed session or device spread threshold.",
      sessionSpreadPressureHealthy:
        "No members currently exceed the reviewed session or device spread threshold.",
      suspendedMemberships: "Suspended memberships",
      suspendedMembershipsDetail:
        "{count} tenant relationships are currently suspended and may need follow-up.",
      suspendedMembershipsHealthy:
        "No suspended memberships need review in the current scope.",
      reviewInvitations: "Review invitations",
      reviewAccounts: "Review accounts",
      reviewSuspended: "Review suspended",
      reviewFailedSignIns: "Review lockouts",
    },
    currentActorSecurity: {
      title: "Current actor posture",
      description:
        "Keep the signed-in administrator or reviewer visible inside the same security lane so session health and governed access stay connected.",
      accountActive: "Account active",
      accountInactive: "Account inactive",
      lastSignedIn: "Last signed in {value}",
      activeMemberships: "Active memberships",
      invitedMemberships: "Invited memberships",
      suspendedMemberships: "Suspended memberships",
      invitationRisk: "Invitation risk",
      openMember: "Open member",
      openSettings: "Open settings",
      openAccess: "Open access lane",
      notAvailable:
        "The current signed-in actor could not be resolved from the visible directory scope.",
    },
    directory: {
      title: "Organization resource directory",
      description:
        "Manage business resources through their organization, workspace, and knowledge-base hierarchy.",
      results: "{count} results",
      organization: "Organization",
      createOrganization: "Create organization",
      resourceSummary:
        "{workspaces} workspaces · {knowledgeBases} knowledge bases",
      knowledgeBaseSummary: "{count} knowledge bases",
      knowledgeBaseList: "Knowledge bases",
      knowledgeBaseListDescription:
        "Knowledge assets and retrieval policy in this workspace.",
      moreActions: "More actions",
      noKnowledgeBases:
        "No knowledge bases in this workspace match the current filters.",
      noWorkspacesInOrganization:
        "No workspaces in this organization match the current filters. Create one from the action above.",
      noOrganizations:
        "No organization resources match the current scope and filters.",
      tenant: "Tenant",
      workspace: "Workspace",
      lifecycle: "Lifecycle",
      knowledgeBases: "Knowledge Bases",
      actionsColumn: "Actions",
      unknownTenant: "Unknown tenant",
      notAvailable: "n/a",
      active: "Active",
      archived: "Archived",
      openChat: "Open chat",
      noWorkspaces: "No workspaces match the current scope and search filters.",
    },
    governance: {
      title: "Knowledge base governance",
      description:
        "Publication state and tenant alignment for visible knowledge assets.",
      knowledgeBase: "Knowledge Base",
      workspace: "Workspace",
      publication: "Publication",
      tenant: "Tenant",
      actionsColumn: "Actions",
      unknownWorkspace: "Unknown workspace",
      unknownTenant: "Unknown tenant",
      published: "Published",
      draft: "Draft",
      noKnowledgeBases:
        "No knowledge bases match the current scope and search filters.",
    },
    agents: {
      title: "Agent governance",
      description:
        "Review persisted agent definitions alongside tenant governance and route them into the right operational surface.",
      agent: "Agent",
      tenant: "Tenant",
      mode: "Mode",
      status: "Status",
      scope: "Scope",
      tools: "Tools",
      actionsColumn: "Actions",
      unscoped: "Unscoped",
      openAgent: "Open agent",
      openOperations: "Open operations",
      noAgents: "No agent definitions match the current governance filters.",
    },
    members: {
      title: "Member directory",
      description:
        "View member coverage across tenants and manage the active tenant membership boundary from admin scope.",
      member: "Member",
      memberships: "Memberships",
      account: "Account",
      actionsColumn: "Actions",
      relationshipFilter: "Membership status",
      accountFilter: "Account status",
      allRelationships: "All relationships",
      allAccounts: "All accounts",
      activeMembership: "active",
      invitedMembership: "invited",
      suspendedMembership: "suspended",
      unassigned: "Unassigned",
      activeAccount: "Active account",
      inactiveAccount: "Inactive account",
      createdAt: "Created {value}",
      lastSignedInAt: "Last signed in {value}",
      scopeRequired: "Select tenant scope",
      noMembers:
        "No members match the current governance scope and search filters.",
      createTitle: "Create member",
      createDescription:
        "Create a persisted member record and optionally attach the initial tenant membership from the admin surface.",
      editTitle: "Edit member",
      editDescription:
        "Update the persisted member profile and account state without leaving the admin scope.",
      passwordResetTitle: "Password reset",
      passwordResetDescription:
        "Issue a new sign-in password for this member when the backend is running in password-managed local sign-in mode.",
      passwordResetNewPassword: "New password",
      passwordResetNewPasswordPlaceholder: "Enter a new password",
      passwordResetConfirmPassword: "Confirm password",
      passwordResetConfirmPasswordPlaceholder: "Re-enter the new password",
      passwordResetReason: "Reset note",
      passwordResetReasonPlaceholder: "Optional governance note for this reset",
      passwordResetValidation:
        "Enter and confirm the replacement password before resetting it.",
      passwordResetMismatch:
        "The replacement password and confirmation do not match.",
      displayName: "Display name",
      displayNamePlaceholder: "Workspace Operator",
      email: "Email",
      emailPlaceholder: "operator@ragpilot.local",
      role: "Role",
      invitationCode: "Invitation code",
      invitationIssuedAt: "Issued {value}",
      invitationIssuedBy: "Issued by {value}",
      invitationIssueCount: "Issued {value} times",
      invitationExpiresAt: "Expires {value}",
      invitationExpired: "Expired",
      accessPostureTitle: "Access posture",
      accessPostureDescription:
        "Review the selected member's latest access activity, membership pressure, and session posture before changing directory state.",
      accessPostureEmpty:
        "Access posture is not available for this member yet.",
      accessEventsTitle: "Member access events",
      accessEventsDescription:
        "Inspect the selected member's recent sign-in, invitation, membership, and session-governance events from the same admin workflow.",
      accessEventsSearch: "Search activity",
      accessEventsSearchPlaceholder:
        "Search by actor, tenant, event, or reason",
      accessEventsEmpty:
        "No recent access events are visible for this member right now.",
      accessEventAt: "Recorded",
      auditEventsSuffix: "audit events",
      sessionsTitle: "Member sessions",
      sessionsDescription:
        "Review backend sessions for this member and revoke stale access without leaving the directory workflow.",
      sessionsExpiringHint: "{count} expiring within 24 hours",
      sessionsCurrent: "Current session",
      sessionsOther: "Other session",
      sessionsStartedAt: "Started",
      sessionsExpiresAt: "Expires",
      sessionsDeviceLabel: "Device",
      sessionsIpAddress: "IP",
      sessionsEmpty:
        "No active backend sessions are visible for this member right now.",
      sessionsLoadFailed: "Member sessions could not be loaded.",
      sessionSummary: {
        total: "Active sessions",
        other: "Other sessions",
        expiring: "Expiring soon",
        currentExpiry: "Current expiry",
        devices: "Devices",
        ips: "IPs",
      },
      activationQueue: {
        title: "Pending activation queue",
        description:
          "Bring invited members into the foreground so issuance, activation, and revocation can be completed from one access-control lane.",
        empty: "No invited members are waiting in the current access scope.",
        notIssued: "Not issued yet",
      },
      initialTenant: "Initial tenant",
      noInitialTenant: "No initial tenant",
      initialMembershipStatus: "Initial membership status",
    },
    audit: {
      title: "Recent access events",
      description:
        "Latest member sign-in and invitation governance activity in the selected admin scope.",
      openMember: "Open member",
      filter: "Event type",
      allEvents: "All events",
      empty: "No access events have been recorded in this scope yet.",
      actor: "Actor {value}",
      defaultSessionRevokeReason: "Session revoked from Admin Console.",
      revocationScope: "Revocation scope {value}",
      revocationScopeSelf: "Self service",
      revocationScopeAdmin: "Administrator action",
      reasonLabel: "Governance note",
      eventTypes: {
        signInFailed: "Sign-in failed",
        signInSucceeded: "Sign-in succeeded",
        invitationActivationFailed: "Invitation activation failed",
        signOutSucceeded: "Sign-out succeeded",
        sessionRevoked: "Session revoked",
        passwordChanged: "Password changed",
        passwordReset: "Password reset",
        invitationIssued: "Invitation issued",
        invitationActivated: "Invitation activated",
        invitationRevoked: "Invitation revoked",
        membershipActive: "Membership activated",
        membershipSuspended: "Membership suspended",
        membershipDeleted: "Membership removed",
      },
    },
    scopePanel: {
      title: "Active admin scope",
      description:
        "Current admin filter is backed by the live tenant directory.",
      tenantScope: "Tenant scope",
      allTenants: "All tenants",
      unknownTenant: "Unknown tenant",
      visibleInventory: "Visible inventory",
      inventoryCounts:
        "{workspaceCount} workspaces · {knowledgeBaseCount} knowledge bases",
      searchResults: "Search results",
      query: "Query: {value}",
      noDirectorySearch: "No directory search applied",
      lifecycleFilters: "Lifecycle filters",
      allWorkspaces: "All workspaces",
      activeWorkspaces: "Active workspaces",
      archivedWorkspaces: "Archived workspaces",
      allKnowledgeBases: "All knowledge bases",
      allRetrievalProfiles: "All retrieval profiles",
      defaultFallbackRetrievalProfile: "Platform default fallback",
      disabledAssignedRetrievalProfile: "Disabled profile assignments",
      retrievalProfileAllDescription:
        "Knowledge-base governance is not currently narrowed by retrieval posture.",
      retrievalProfileFilteredDescription:
        "Knowledge-base governance is currently narrowed to one effective retrieval posture.",
      publishedKnowledgeBases: "Published knowledge bases",
      draftKnowledgeBases: "Draft knowledge bases",
      primaryRoute: "Primary route",
      noScopedWorkspace: "No scoped workspace",
      noScopedKnowledgeBase: "No scoped knowledge base",
      failedDocuments: "Failed documents",
      failedWorkflows: "Recovery workflows",
    },
    chatScope: {
      title: "Chat activity scope",
      description:
        "Tenant-scoped persisted chat activity across the selected governance tenant scope.",
      conversations: "Conversations",
      activeConversationThreads: "{count} active conversation threads",
      messages: "Messages",
      latestActivity: "Latest activity {value}",
      noChatActivity: "No persisted chat activity in this scope yet.",
      openScopedChatWorkspace: "Open scoped chat workspace",
    },
    agentRuntime: {
      title: "Agent runtime observability",
      description:
        "Track recorded agent launches across the current governance scope so runtime usage stays visible to the admin console.",
      openAgents: "Open agents",
      latestLaunch: "Latest launch {value}",
      noLatestLaunch: "No recorded launch yet.",
      tenantBreakdown: "Tenant runtime breakdown",
      tenantRunCount: "{count} launches",
      noTenantRuns:
        "No tenant runtime activity is visible in the current governance scope.",
      recentRuns: "Recent recorded launches",
      empty:
        "No recorded agent launches are visible in the current governance scope yet.",
      unknownAgent: "Unknown agent definition",
      metrics: {
        totalHint:
          "Combined recorded launches across the selected governance scope.",
        chatHint: "Recorded launches that entered the chat surface.",
        documentsHint: "Recorded launches that entered document operations.",
      },
    },
    agentExecutions: {
      title: "Execution trace observability",
      description:
        "Bring cross-tenant agent execution results and bound tool traces into the admin overview before jumping into agents or operations.",
      openOperations: "Open operations",
      openAgents: "Open agents",
      openExecutionRoute: "Open execution route",
      tenantBreakdown: "Tenant execution breakdown",
      tenantExecutionCount: "{count} executions",
      tenantCompletedCount: "{count} completed",
      tenantFailedCount: "{count} failed",
      latestExecution: "Latest execution {value}",
      noLatestExecution: "No execution has been recorded yet.",
      noTenantExecutions:
        "No execution activity is visible in the current governance scope.",
      recentExecutions: "Recent execution traces",
      empty:
        "No agent executions are visible in the current governance scope yet.",
      metrics: {
        total: "Execution tasks",
        totalHint:
          "Combined execution tasks across the selected governance scope.",
        completed: "Completed tasks",
        completedHint:
          "Execution tasks that already produced a final result payload.",
        failed: "Failed tasks",
      },
    },
    workflowRuntime: {
      title: "Execution pressure observability",
      description:
        "Aggregate cross-tenant workflow pressure from the governance view and jump directly into failed recovery, queue supervision, or workflow follow-up.",
      openOperations: "Open operations",
      pressureSignals: "Governance pressure signals",
      tenantsWithFailures: "Tenants with failures",
      tenantsWithQueuePressure: "Tenants with queue pressure",
      tenantsWithRetries: "Tenants with retries",
      tenantBreakdown: "Tenant execution breakdown",
      failedRunCount: "{count} recovery runs",
      queuePressureCount: "{count} queued or running",
      retryRunCount: "{count} retry runs",
      openFailedLane: "Open recovery lane",
      openQueueLane: "Open queue lane",
      openWorkflowSurface: "Open workflow surface",
      noTenantPressure:
        "No execution pressure is visible in the current governance scope.",
      metrics: {
        failed: "Recovery runs",
        failedHint:
          "Failed or cancelled workflow runs that still need recovery handling in the current governance scope.",
        queued: "Queued runs",
        queuedHint: "Workflow runs currently waiting on execution capacity.",
        running: "Running runs",
        runningHint: "Workflow runs still in active execution.",
        retries: "Retry runs",
        retriesHint: "Workflow runs already routed into retry supervision.",
      },
    },
    documentRuntime: {
      title: "Document intake pressure",
      description:
        "Aggregate cross-tenant document intake, failure, and completion posture from governance and jump directly into failed documents, document surfaces, or operations.",
      openDocuments: "Open documents",
      openOperations: "Open operations",
      pressureSignals: "Intake pressure signals",
      tenantsWithFailures: "Tenants with failed documents",
      tenantsWithActiveIntake: "Tenants with active intake",
      tenantBreakdown: "Tenant document breakdown",
      failedDocumentCount: "{count} failed documents",
      activeDocumentCount: "{count} in intake",
      knowledgeBaseCount: "{count} knowledge bases",
      openFailedDocuments: "Open failed documents",
      noTenantPressure:
        "No document intake pressure is visible in the current governance scope.",
      metrics: {
        failed: "Failed documents",
        failedHint:
          "Failed documents that still need recovery handling in the current governance scope.",
        active: "Documents in intake",
        activeHint: "Documents still being parsed, chunked, or indexed.",
        completed: "Completed documents",
        completedHint:
          "Documents already completed and ready for downstream retrieval use.",
        total: "Total documents",
        totalHint:
          "All documents currently registered in the governance scope.",
      },
    },
    runtimeGovernance: {
      title: "Runtime governance posture",
      description:
        "Track model and tool governance pressure alongside agent delivery readiness so runtime control stays visible inside admin.",
      signals: "Governance signals",
      quickActions: "Governance actions",
      quickActionsDescription:
        "Jump directly into the active agent scope or runtime-resource manager to resolve model, tool, and scope issues.",
      issueActions: "Issue filters",
      activeAgentsWithoutScope: "Active agents without scope",
      missingModelBindings: "Missing model bindings",
      disabledModelBindings: "Disabled model bindings",
      unconfiguredModelBindings: "Unconfigured model runtimes",
      missingRetrievalBindings: "Missing retrieval bindings",
      disabledRetrievalBindings: "Disabled retrieval bindings",
      disabledToolBindings: "Disabled tool bindings",
      disabledRetrievalAssignments:
        "Knowledge bases on disabled retrieval profiles",
      explicitRetrievalBindings:
        "Knowledge bases with explicit retrieval bindings",
      providerLanes: "Provider lanes",
      providerMetrics: {
        runtimeReady: "Runtime-ready",
        activeAgents: "Active agents",
        attentionAgents: "Attention agents",
        previewFailures: "Preview failures",
      },
      providerPreviewStatus: "Last preview {status} at {value}",
      providerPreviewEmpty:
        "No recent preview has been recorded for this provider lane.",
      openProviderModels: "Open provider models",
      openAttentionAgents: "Open attention agents",
      openSettings: "Open runtime resource",
      openActiveAgents: "Open active agents",
      openDefaultFallbackKnowledgeBases:
        "Open default-fallback knowledge bases",
      openDisabledRetrievalAssignments: "Open disabled retrieval assignments",
      metrics: {
        attentionAgents: "Attention agents",
        attentionAgentsHint:
          "Active agents with scope, retrieval, model, or tool governance issues in the current admin scope.",
        disabledBoundModels: "Disabled bound models",
        disabledBoundModelsHint:
          "Model endpoints disabled while still connected to agent definitions.",
        disabledBoundTools: "Disabled bound tools",
        disabledBoundToolsHint:
          "Tool registrations disabled while still connected to agent definitions.",
        approvalGatedTools: "Approval-gated tools",
        approvalGatedToolsHint:
          "Registered tools that still require explicit admin approval.",
        disabledBoundRetrievalProfiles: "Disabled bound retrieval profiles",
        disabledBoundRetrievalProfilesHint:
          "Retrieval profiles disabled while still assigned to governed knowledge bases.",
        defaultFallbackKnowledgeBases: "Default-fallback knowledge bases",
        defaultFallbackKnowledgeBasesHint:
          "Knowledge bases still inheriting the platform default retrieval profile.",
      },
    },
    runtimeQueue: {
      title: "Runtime governance queue",
      description:
        "Pull model runtime gaps, approval queues, MCP integration, and recent governance changes into one lighter admin worklist.",
      refresh: "Refresh queue",
      worklistTitle: "Open queue",
      eventsTitle: "Recent changes",
      emptyWorklist:
        "No queued runtime-governance follow-up is visible right now.",
      emptyEvents: "No recent runtime-governance change is visible right now.",
      systemActor: "System",
      boundAgents: "{count} bound agents",
      integrationReadyTools: "{count} integration-ready tools",
      lastModelPreview: "Latest model preview {status} · {value}",
      lastToolPreview: "Latest tool preview {status} · {value}",
      lastConnectorPreview: "Latest connector preview {status} · {value}",
      previewFailures: "{count} preview failures",
      filters: {
        category: "Category",
        severity: "Severity",
        resource: "Resource",
        action: "Action",
        actor: "Actor",
        searchPlaceholder:
          "Search runtime items, providers, connectors, or actions",
        allCategories: "All categories",
        allSeverities: "All severities",
        allResources: "All resources",
        allActions: "All actions",
        allActors: "All actors",
      },
      metrics: {
        total: "Queued items",
        unconfiguredModels: "Unconfigured models",
        disabledBoundModels: "Disabled bound models",
        approvalRequiredTools: "Approval tools",
        integrationPendingTools: "Pending MCP tools",
        blockedConnectors: "Blocked connectors",
      },
      categories: {
        unconfiguredModelEndpoint: "Unconfigured model endpoint",
        disabledBoundModelEndpoint: "Disabled bound model endpoint",
        approvalRequiredTool: "Approval required tool",
        mcpIntegrationPendingTool: "MCP integration pending tool",
        integrationBlockedConnector: "Blocked MCP connector",
      },
      actions: {
        completeModelRuntime: "Complete model runtime",
        restoreModelRuntime: "Restore model runtime",
        enableModelEndpoint: "Enable model endpoint",
        enableToolRegistration: "Enable tool registration",
        allowDirectToolUse: "Allow direct tool use",
        readyMcpIntegration: "Mark MCP integration ready",
        enableMcpConnector: "Enable MCP connector",
        restoreConnectorRuntime: "Restore connector runtime",
        reviewToolBoundary: "Review tool boundary",
        completeMcpIntegration: "Complete MCP integration",
        openSettings: "Open governance details",
        openAgents: "Open agents",
        applyFailed: "Runtime governance action failed.",
      },
    },
    retrievalProfiles: {
      title: "Retrieval profile governance",
      description:
        "Review each retrieval posture as a governed asset, including where it is assigned and where platform-default fallback is still carrying scope.",
      reviewKnowledgeBases: "Review knowledge bases",
      openDefaultFallback: "Open default fallback",
      metrics: {
        assignedKnowledgeBases: "Assigned knowledge bases",
        workspaceCoverage: "{count} governed workspaces",
        defaultFallbackCoverage: "Default fallback coverage",
        publicationMix: "{published} published · {draft} draft",
      },
      status: {
        disabledAssigned:
          "This retrieval profile is disabled while still assigned to {count} knowledge bases.",
        defaultFallback:
          "This profile is currently serving as the default fallback for {count} knowledge bases.",
        unused:
          "This retrieval profile is configured but not yet bound inside the current admin scope.",
        healthyAssigned:
          "This retrieval profile is actively assigned to {count} knowledge bases in the current admin scope.",
      },
    },
    tenantChat: {
      title: "Tenant chat activity",
      description:
        "Rank tenants by persisted chat activity so governance can spot real operator usage.",
      messages: "{count} messages",
      conversations: "{count} conversations",
      active: "{count} active",
      workspaces: "{count} workspaces",
      latestActivity: "Latest activity {value}",
      noChatActivity: "No persisted chat activity yet.",
      openTenantChat: "Open tenant chat",
      failedDocs: "Failed docs",
      failedWorkflows: "Recovery workflows",
      governance: "Governance",
      noTenantActivity:
        "No tenant activity is visible in the current governance scope.",
    },
    chatSignals: {
      title: "Chat signals",
      description:
        "Simple governance signals derived from the current tenant chat activity snapshot.",
      mostActiveTenant: "Most active tenant",
      noTenantActivity: "No tenant activity",
      activeTenantDetail:
        "{messageCount} messages across {conversationCount} conversations",
      noPersistedMessages:
        "No persisted messages are visible in this scope yet.",
      openTenantChat: "Open tenant chat",
      staleChatTenants: "Stale chat tenants",
      staleChatDetail:
        "No recent chat activity in the last 7 days, or no recorded activity yet.",
      reviewChatScope: "Review chat scope",
      idleConversationScope: "Idle conversation scope",
      idleConversationDetail:
        "Tenants with conversation records but no currently active threads.",
      inspectIdleScope: "Inspect idle scope",
    },
    watchlist: {
      title: "Governance watchlist",
      description:
        "Items that deserve operator attention in the current scope.",
      attention: "attention",
      review: "review",
      healthy: "healthy",
      workspaceLifecycleReview: "Workspace lifecycle review",
      workspaceLifecycleReviewDetail:
        "{count} archived workspaces should be reviewed against retention policy.",
      workspaceLifecycleHealthy: "All visible workspaces remain active.",
      reviewArchived: "Review archived",
      workflowRecoveryPressure: "Workflow recovery pressure",
      workflowRecoveryPressureDetail:
        "{count} workflow recovery runs across {tenantCount} tenants still need governance follow-up.",
      workflowRecoveryHealthy:
        "No failed workflow recovery pressure is visible in the current governance scope.",
      reviewWorkflowPressure: "Review recovery pressure",
      documentRecoveryPressure: "Document recovery pressure",
      documentRecoveryPressureDetail:
        "{count} failed documents across {tenantCount} tenants still need intake recovery follow-up.",
      documentIntakePressureDetail:
        "{count} documents across {tenantCount} tenants are still moving through intake and should remain under supervision.",
      documentRecoveryHealthy:
        "No document intake or recovery pressure is visible in the current governance scope.",
      reviewDocumentPressure: "Review document pressure",
      knowledgePublicationGate: "Knowledge publication gate",
      knowledgePublicationDetail:
        "{count} knowledge bases remain in draft state.",
      knowledgePublicationHealthy: "All visible knowledge bases are published.",
      reviewDrafts: "Review drafts",
      publishedRetrievalSurface: "Published retrieval surface",
      publishedRetrievalDetail:
        "{count} published knowledge bases are available to operators.",
      publishedRetrievalEmpty:
        "No published knowledge bases are visible in this scope.",
      viewPublished: "View published",
      retrievalGovernancePressure: "Retrieval governance pressure",
      retrievalGovernanceDisabledDetail:
        "{count} knowledge bases are still assigned to disabled retrieval profiles.",
      retrievalGovernanceDefaultFallbackDetail:
        "{count} knowledge bases still rely on the platform default retrieval profile.",
      retrievalGovernanceHealthy:
        "Retrieval-profile assignment looks stable in the current scope.",
      reviewRetrievalGovernance: "Review retrieval governance",
      runtimeGovernancePressure: "Runtime governance pressure",
      runtimeGovernancePressureDetail:
        "{count} active agent bindings currently point at disabled runtime resources.",
      runtimeGovernanceMissingRetrievalDetail:
        "{count} active agent scopes currently resolve without a valid governed retrieval profile.",
      runtimeGovernanceApprovalDetail:
        "{count} registered tools still sit behind an approval boundary.",
      runtimeGovernanceHealthy:
        "Runtime governance bindings look stable in the current scope.",
      reviewRuntimeGovernance: "Review runtime governance",
      agentGovernanceGate: "Agent governance gate",
      agentGovernanceDetail:
        "{count} active agents are missing a scoped knowledge boundary.",
      agentDraftDetail:
        "{count} agent drafts are still pending governance review.",
      agentGovernanceHealthy:
        "Visible agents have scope coverage or remain intentionally paused.",
      reviewAgents: "Review agents",
      memberActivationQueue: "Member activation queue",
      memberActivationQueueDetail:
        "{count} invited tenant memberships still need activation.",
      memberActivationQueueHealthy:
        "No invited memberships are waiting for activation.",
      reviewInvitations: "Review invitations",
    },
    executionPackets: {
      title: "Execution packets",
      description:
        "Bundle the next governance action into recovery, publication, runtime, and access packets without rebuilding scope by hand.",
      scopePendingValue: "Scope mapping pending",
      recovery: {
        title: "Recovery packet",
        metric: "Primary recovery scope",
        readyDetail:
          "Failed-document and failed-workflow recovery can launch directly from {workspace} and {knowledgeBase}.",
        pendingDetail:
          "Select or resolve a primary workspace and knowledge base before routing failed queues into runtime recovery lanes.",
        primaryAction: "Open failed workflows",
        secondaryFailedDocs: "Open failed documents",
        secondaryOperations: "Open recovery lane",
      },
      publication: {
        title: "Publication packet",
        metric: "Draft knowledge bases",
        draftDetail:
          "{count} knowledge bases are still in draft and should be reviewed before wider operator use.",
        healthyDetail:
          "Visible knowledge bases are already published for governed retrieval use.",
        primaryAction: "Review draft knowledge bases",
        secondaryPublished: "Open published knowledge bases",
        secondaryDocuments: "Open document registry",
      },
      runtime: {
        title: "Runtime handoff packet",
        metric: "Scoped runtime routes",
        readyDetail:
          "{count} active agents already have scope-ready runtime handoff routes out of {total} active definitions.",
        pendingDetail:
          "{total} active agents are visible, but their scope resolution still needs governance review before clean runtime handoff.",
        emptyDetail:
          "No active agents are currently visible for runtime handoff in this governance scope.",
        primaryAction: "Open runtime handoff",
        secondaryDefinitions: "Open agent definitions",
        secondaryOperations: "Open operations overview",
      },
      recoveryRuntime: {
        title: "Recovery runtime packet",
        metric: "Scoped recovery routes",
        readyDetail:
          "{count} recovery agents already have scope-ready routes out of {total} visible recovery definitions.",
        pendingDetail:
          "{total} recovery agents are visible, but their scope resolution still needs governance cleanup before clean runtime recovery.",
        emptyDetail:
          "No recovery agents are currently visible for runtime recovery in this governance scope.",
        primaryAction: "Open recovery runtime",
        secondaryDefinitions: "Open recovery definitions",
        secondaryOperations: "Open failed operations",
      },
      access: {
        title: "Access activation packet",
        metric: "Invited memberships",
        pendingDetail:
          "{count} invited memberships still need activation before those members can fully enter governed routes.",
        healthyDetail:
          "No invited memberships are waiting for activation in the current governance scope.",
        primaryAction: "Review invited members",
        secondarySecurity: "Open security review",
        secondaryMembers: "Open member access",
      },
    },
    runtimeRoutes: {
      title: "Governance to runtime",
      description:
        "Move directly from governance review into the built execution surfaces for active agents.",
      scopeReady: "Scope ready",
      scopePending: "Scope pending",
      retrievalMissing: "Retrieval review",
      retrievalDisabled: "Retrieval blocked",
      noObjective:
        "No business objective is attached to this active agent yet.",
      scopeLabel: "Scope {value}",
      scopeUnbound: "unbound",
      resolvedWorkspace: "Workspace {value}",
      resolvedKnowledgeBase: "Knowledge base {value}",
      retrievalProfile: "Retrieval {value}",
      retrievalMissingDetail:
        "This runtime route still needs a valid governed retrieval profile before it should launch.",
      retrievalDisabledDetail:
        "{profile} is disabled and should be remediated before this runtime route launches.",
      launchPrompt: "Launch prompt",
      openRecommended: "Open recommended route",
      openSecondary: "Open secondary route",
      openDefinition: "Open definition",
      openRetrievalGovernance: "Open retrieval governance",
      openRetrievalSettings: "Open retrieval settings",
      empty:
        "No active agents are available for runtime handoff in the current governance scope.",
    },
    runtimeTaskPacket: {
      title: "Runtime task packet",
      description:
        "Promote the next active agent handoff into one governed packet before opening execution surfaces.",
      emptyTitle: "No active runtime task",
      emptyDetail:
        "No active agent is currently ready to be promoted from governance into runtime execution.",
      readyDetail:
        "This handoff can move directly into {surface} with the current tenant and knowledge context.",
      scopeReviewDetail:
        "Review the runtime scope before sending this handoff into {surface}.",
      retrievalMissingDetail:
        "Review retrieval governance before sending this handoff into {surface}.",
      retrievalDisabledDetail:
        "{profile} is currently disabled and should be remediated before this handoff is launched.",
      primaryAction: "Open runtime route",
      secondaryRoute: "Open supporting route",
      secondaryDefinition: "Open definition",
      secondaryAccess: "Open access review",
      noPrompt: "No launch prompt is attached to this runtime handoff yet.",
      pending: "Pending resolution",
      unresolved: "Not resolved",
      unbound: "Unbound",
      statuses: {
        ready: "Ready",
        review: "Review",
      },
      targets: {
        chat: "Chat surface",
        documents: "Document surface",
        operations: "Workflow operations",
      },
      fields: {
        mode: "Mode",
        target: "Target surface",
        scope: "Scope label",
        workspace: "Workspace",
        knowledgeBase: "Knowledge base",
        objective: "Business objective",
        prompt: "Launch prompt",
      },
    },
  },
  auth: {
    title: "Sign In",
    eyebrow: "RAGPilot",
    badge: "Local Access",
    heading: "Sign in",
    description: "Use your directory account to enter the console.",
    hero: {
      eyebrow: "Operator Access",
      title: "Secure knowledge operations access",
      description:
        "Open RAGPilot through the directory-backed access layer and keep operator, governance, and workflow supervision inside one controlled console path.",
      groundedChatTitle: "Grounded chat",
      groundedChatDescription:
        "Persist citation-backed answers against the active knowledge base scope.",
      documentOpsTitle: "Document operations",
      documentOpsDescription:
        "Upload, reindex, inspect versions, and follow document activity from one surface.",
      workflowTitle: "Durable workflows",
      workflowDescription:
        "Track ingestion execution, retries, and failure recovery through stable operational lanes.",
      directoryTitle: "Directory-backed access",
      directoryDescription:
        "Session posture, tenant memberships, and invitation activation now resolve from persisted records.",
      accessPosture: "Access posture",
      sessionRouting: "Session routing",
      bootstrapOpen: "Initial administrator bootstrap is still open.",
      bootstrapClosed:
        "Directory bootstrap is already sealed and invitation-based access is active.",
      returnTo: "Return target {value}",
    },
    submit: "Sign in",
    submitting: "Signing in...",
    localModeTitle: "Local session",
    localModeDescription:
      "This browser still stores the local session, but role and tenant access now follow the persisted directory record.",
    fields: {
      profile: "Sign-in profile",
      displayName: "Display name",
      displayNamePlaceholder: "Workspace Operator",
      email: "Email",
      emailPlaceholder: "Enter your email address",
      password: "Password",
      passwordPlaceholder: "Enter your password",
      invitationToken: "Invitation code",
      invitationTokenPlaceholder: "RP-AB12CD34",
    },
    profiles: {
      admin: "Admin",
      operator: "User",
    },
    roles: {
      superAdmin: "Super Admin",
      operator: "Operator",
      reviewer: "Reviewer",
    },
    bootstrap: {
      firstAdmin: "First sign-in will become the initial Super Admin",
    },
    modes: {
      directory_local: "Directory local sign-in",
      password_local: "Password sign-in",
      oidc: "OIDC sign-in",
      saml: "SAML sign-in",
    },
    modeFacts: {
      directory: "Directory governed",
      invitation: "Invitation activation",
    },
    invitation: {
      title: "Invitation ready",
      description:
        "This member is still in an invited state. Activate the invited tenant access before entering the protected console.",
      activate: "Activate invited access",
      activating: "Activating invited access...",
    },
    providerManaged: {
      title: "Provider-managed sign-in",
      description:
        "This environment is configured for redirected identity-provider access. The local member form is intentionally unavailable in this mode.",
      defaultProvider: "Identity provider",
      continue: "Continue with {provider}",
      unavailable:
        "The redirected sign-in entry is not configured yet. Contact an administrator.",
    },
    assessment: {
      title: "Directory access posture",
      checking: "Checking",
      bootstrap: "Bootstrap",
      signIn: "Sign in",
      activateInvitation: "Activate invitation",
      contactAdmin: "Contact admin",
      bootstrapAvailable:
        "The directory is still empty. This sign-in can become the initial platform administrator.",
      ready:
        "This member already has directory-backed access and can continue into the protected console.",
      invited:
        "This member still depends on invitation activation before protected routes can open.",
      inactiveAccount:
        "This member account is inactive and needs administrator action before sign-in.",
      inactiveMembership:
        "This member exists, but no active tenant membership is available yet.",
      notFound: "No persisted directory record matches this email yet.",
      activeMemberships: "{count} active",
      invitedMemberships: "{count} invited",
      suspendedMemberships: "{count} suspended",
      invitationRisk: "{count} invitation risks",
    },
    errors: {
      requiredFields: "Display name and email are required.",
      invalidCredentials: "Email or password is incorrect.",
      passwordRequired: "Enter the password before continuing.",
      signInRateLimited: "Too many failed sign-in attempts. Try again shortly.",
      noInvitedMemberships: "No invited memberships are available to activate.",
      invalidInvitationToken: "Invitation code is not valid for this member.",
      expiredInvitationToken:
        "Invitation code has expired. Ask an administrator to issue a new one.",
      directorySyncFailed: "Directory sync failed during sign-in.",
      providerManagedOnly:
        "This environment requires provider-managed sign-in. The local member form is disabled for the current authentication mode.",
      inactiveAccount:
        "This member account is inactive. Ask an administrator to reactivate it before signing in.",
      invitedMembership:
        "This member only has invited tenant access right now. Activate the invitation to continue.",
      invitationTokenRequired:
        "Enter the invitation code before activating tenant access.",
      inactiveMembership:
        "This member does not currently have an active tenant membership. Ask an administrator to activate a tenant assignment before signing in.",
      sessionInactiveAccount:
        "Your previous session was closed because the directory account is now inactive.",
      sessionInactiveMembership:
        "Your previous session was closed because no active tenant membership is currently available.",
      sessionRevoked:
        "Your previous session was revoked. Sign in again after the access change is resolved.",
      sessionMissingDirectoryUser:
        "Your previous session could not be restored from the persisted member directory.",
    },
    guard: {
      restoringTitle: "Restoring local session",
      restoringDescription:
        "Checking the browser session before opening protected operator routes.",
      restoringStatus: "Restoring saved operator session...",
      redirectingTitle: "Redirecting to sign in",
      redirectingDescription:
        "This route is protected. We are sending you to sign in first.",
      redirectingStatus: "Redirecting to sign-in...",
      unauthorizedPageTitle: "Access Restricted | RAGPilot",
      unauthorizedTitle: "Access restricted",
      unauthorizedDescription:
        "Your current local session does not have permission to open this operator surface. Use an allowed role or continue from the workspace.",
      unauthorizedRole: "Current local role: {role}",
    },
  },
  workspace: {
    title: "Workspace | RAGPilot",
    routePage: {
      chat: {
        browserTitle: "Chat | RAGPilot",
        eyebrow: "Grounded Chat",
        title: "Knowledge chat console",
        description:
          "Ask scoped questions, review citations, and continue persisted conversations against the active knowledge base.",
      },
      documents: {
        browserTitle: "Documents | RAGPilot",
        eyebrow: "Document Operations",
        title: "Document registry and ingestion controls",
        description:
          "Track ingestion state, manage document lifecycle, and inspect retrieval-ready assets inside the active knowledge base.",
      },
      operations: {
        browserTitle: "Operations | RAGPilot",
        eyebrow: "Workflow Operations",
        title: "Workflow supervision and recovery",
        description:
          "Inspect durable execution runs, isolate failed queues, and recover document-ingestion workflows from one route.",
      },
    },
    routePanel: {
      chat: "Chat readiness",
      documents: "Document readiness",
      operations: "Operations readiness",
    },
    runtimeTaskPacket: {
      primaryOpenRecommended: "Open recommended surface",
      primaryReturn: "Return to source surface",
      secondarySource: "Open source surface",
      secondaryAgent: "Open agent definition",
      secondaryGovernance: "Open governance",
      pending: "Pending",
      noPrompt:
        "No launch prompt is currently attached to this workspace handoff.",
      default: {
        title: "{name} operator flow",
        actions: {
          openIntake: "Open intake lane",
          openMonitoring: "Open workflow monitoring",
          openRecovery: "Open recovery lane",
          openValidation: "Open grounded validation",
          resumeValidation: "Resume grounded validation",
          openEvidenceReview: "Review source evidence",
        },
        details: {
          intake:
            "Upload the first source document into the active knowledge base before grounded validation begins.",
          monitoring:
            "{count} in-flight ingestion or workflow items still need operator monitoring before the loop can close.",
          recovery:
            "{count} failed document or workflow items need recovery before the active scope is considered healthy.",
          validation:
            "{count} retrieval-ready documents are available. Continue in chat to validate grounded answers with citations.",
          validationReady:
            "{count} retrieval-ready documents are validated against live evidence. Continue in chat and confirm the cited answer stays stable.",
          validationReview:
            "{count} retrieval-ready documents are available, but the latest validation pass still needs operator review before broad rollout.",
          validationBlocked:
            "The latest validation pass did not clear grounded chat. Review the source evidence or ingestion chain before asking more cited questions.",
        },
        objectives: {
          intake:
            "Land the first document in the active knowledge base and establish retrieval-ready assets.",
          monitoring:
            "Keep the active ingestion lane visible until queued and running work settles.",
          recovery:
            "Resolve failed document or workflow states before broadening downstream usage.",
          validation:
            "Use grounded chat to confirm the active knowledge base now answers with citations.",
          validationReady:
            "Use grounded chat to confirm the validated knowledge base still answers with stable citations.",
          validationReview:
            "Review the latest validation pass, then decide whether the active scope is ready for wider grounded use.",
          validationBlocked:
            "Recover source evidence quality before reopening grounded validation in chat.",
        },
      },
      statuses: {
        attention: "Attention",
        ready: "Ready",
        review: "Review",
      },
      intents: {
        general: "General workspace continuation",
        agent_brief: "Agent brief handoff",
        grounded_validation: "Grounded validation",
        document_recovery: "Document recovery",
        workflow_recovery: "Workflow recovery",
      },
      details: {
        general:
          "Continue the current operator path from {source} while keeping scope and runtime context aligned.",
        agent_brief:
          "Use the incoming agent brief and current scope to continue operator execution without rebuilding context.",
        grounded_validation:
          "Validate downstream retrieval quality in grounded chat before closing the execution loop.",
        document_recovery:
          "Inspect source document state, indexing health, and workflow lineage together before reissuing work.",
        workflow_recovery:
          "Keep the selected run, retry posture, and execution context aligned until recovery is settled.",
      },
      objectives: {
        general: "Continue the current workspace task inside the active scope.",
        agent_brief:
          "Use the current agent brief to continue scoped execution.",
        grounded_validation:
          "Confirm that completed execution produced retrieval-ready knowledge behavior.",
        document_recovery:
          "Resolve source-level issues before the next indexing or retry attempt.",
        workflow_recovery:
          "Stabilize the failed or active workflow before broadening execution.",
      },
      fields: {
        currentSurface: "Current surface",
        source: "Source surface",
        sourceRoute: "Source route",
        intent: "Handoff intent",
        scope: "Scope",
        subject: "Current subject",
        readyDocuments: "Ready documents",
        activeWorkflows: "Active workflows",
        failedWorkflows: "Recovery workflows",
        conversations: "Conversations",
        validation: "Validation state",
        validatedHits: "Validated hits",
        objective: "Execution objective",
        prompt: "Working prompt",
      },
    },
    runtimeRunbook: {
      title: "Execution runbook",
      description:
        "Use the incoming handoff intent to keep the next actions on a consistent platform path.",
      metrics: {
        target: "Target surface",
        scope: "Scope",
        subject: "Current subject",
        owner: "Current owner",
        validation: "Validation state",
      },
      actions: {
        openRecommended: "Open recommended surface",
        openDocuments: "Open documents",
        openChat: "Open chat",
        openWorkflowLane: "Open workflow lane",
        openGovernance: "Open governance",
        openAgent: "Open agent",
        returnToSource: "Return to source",
      },
      mainFlow: {
        ingestTitle: "Ingest the active source set",
        ingestDetail:
          "Keep document intake in one lane so new uploads, reindex actions, and source checks stay grounded in the same scope.",
        uploadFollowUp: "Continue intake review",
        monitorTitle: "Monitor execution health",
        monitorFailureDetail:
          "A recovery queue is present. Review workflow pressure and recovery state before reopening validation.",
        monitorActiveDetail:
          "Some ingestion work is still running. Stay on workflow supervision until the active queue settles.",
        monitorHealthyDetail:
          "No active failures are blocking the current scope. Workflow supervision can now be treated as a checkpoint instead of a blocker.",
        reviewFailedDocuments: "Review failed documents",
        reviewExecutionQueue: "Review execution queue",
        validateTitle: "Validate grounded answers",
        validateReadyDetail:
          "Retrieval-ready knowledge is available. Use chat to confirm answers, citations, and operator confidence before closing the loop.",
        validatePendingDetail:
          "Grounded validation should wait until at least one document completes ingestion and indexing.",
        validateReviewDetail:
          "The latest validation pass found evidence, but the scope still needs operator review before this becomes the default grounded lane.",
        validateBlockedDetail:
          "The latest validation pass did not support grounded chat. Inspect source evidence and execution health before reopening answer validation.",
        reviewReadySources: "Review ready sources",
      },
      agentBrief: {
        alignSurfaceTitle: "Align the runtime surface",
        alignSurfaceDetail:
          "Move into the most appropriate built surface before the operator starts making manual decisions.",
        checkScopeTitle: "Check the scoped assets",
        checkScopeDetail:
          "Inspect the current document lane so the active workspace scope stays grounded in visible source state.",
        closeLoopTitle: "Keep the definition linked",
        closeLoopDetail:
          "Return to the agent or governance surface before broadening rollout or changing the execution posture.",
      },
      groundedValidation: {
        validateAnswerTitle: "Validate the grounded answer lane",
        validateAnswerDetail:
          "Use chat to confirm that the completed execution produces retrieval-ready answers and citations.",
        validateAnswerReviewDetail:
          "The latest validation pass returned evidence, but the result still needs review before this answer lane is treated as stable.",
        validateAnswerBlockedDetail:
          "Grounded validation is blocked by the latest evidence check. Reopen document review before continuing cited answers.",
        validateAnswerPendingDetail:
          "No completed retrieval validation is attached yet. Run or resume validation before relying on grounded answers.",
        inspectSourcesTitle: "Inspect the supporting sources",
        inspectSourcesDetail:
          "Open the document surface to confirm the source assets, versions, and retrieval context behind the answer.",
        inspectSourcesBlockedDetail:
          "Inspect the source assets and latest ingestion output first so the failed validation signal can be traced back to concrete evidence state.",
        closeLoopTitle: "Close the operator loop",
        closeLoopDetail:
          "Bring the validated outcome back to governance so the downstream behavior is formally reviewed.",
        closeLoopPendingDetail:
          "Keep this validation loop on chat or documents until the evidence posture is ready for formal governance review.",
      },
      documentRecovery: {
        inspectDocumentTitle: "Inspect the failed document lane",
        inspectDocumentDetail:
          "Review the selected document, indexing state, and source readiness before reissuing work.",
        reviewLineageTitle: "Review workflow lineage",
        reviewLineageDetail:
          "Follow the workflow surface to understand retries, blocking steps, and execution posture around this document.",
        briefAgentTitle: "Prepare the next operator brief",
        briefAgentDetail:
          "Use chat or the current agent definition to summarize recovery posture before further intervention.",
      },
      workflowRecovery: {
        stabilizeTitle: "Stabilize the workflow lane",
        stabilizeDetail:
          "Keep the selected run under workflow supervision until the blocking state and retry posture are explicit.",
        inspectDocumentTitle: "Inspect the affected source",
        inspectDocumentDetail:
          "Open the document lane to compare the failed run with the underlying source object and knowledge scope.",
        closeLoopTitle: "Close the governance loop",
        closeLoopDetail:
          "Return the recovery path to governance once the current owner, scope, and access posture are clear.",
      },
    },
    status: {
      loading: "Loading workspace state...",
      readyForKnowledgeBase: "Workspace ready for {name}.",
      contextSwitched:
        "Context switched to {name}. Upload a document and ask your first question.",
      agentContextActivated: "Agent context switched to {name}.",
      agentContextActivatedForView: "Agent {name} is now active in {view}.",
      executingRecommendedAgent:
        "Running {name} for the current workspace context...",
      agentExecutionCompletedForDocuments:
        "{name} finished its intake review. Documents is now focused on the next follow-up lane.",
      agentExecutionCompletedForWorkflows:
        "{name} finished its recovery review. Workflows is now focused on the next supervision lane.",
      recommendedAgentExecutionFailed:
        "The recommended agent execution failed.",
      loadingConversations: "Workspace ready. Loading conversations...",
      initializationFailed: "Workspace initialization failed.",
      documentIndexedReady: "Document indexed and ready for grounded chat.",
      permanentlyDeletingDocument: "Permanently deleting document...",
      documentPermanentlyDeleted: "Document permanently deleted.",
      documentPermanentDeleteFailed: "Permanent document deletion failed.",
      documentWorkflowOpenedInOperations:
        "Document workflow needs recovery. Operations is now focused on the affected run.",
      documentWorkflowMonitoring:
        "Document workflow remains in {status}. Operations is now focused on the active run.",
      workflowFinishedWithStatus:
        "Document workflow finished with status: {status}.",
      uploadFailed: "Document upload failed.",
      someUploadFilesRejected:
        "Some files were not added because their format is unsupported or they exceed 25 MB.",
      switchingContext: "Switching workspace context...",
      contextSwitchFailed: "Workspace context switch failed.",
      creatingTenant: "Creating tenant...",
      tenantCreated: "Tenant {name} created. Create a workspace to continue.",
      tenantCreationFailed: "Tenant creation failed.",
      creatingWorkspace: "Creating workspace...",
      workspaceCreated:
        "Workspace {name} created. Create a knowledge base to start using it.",
      workspaceCreationFailed: "Workspace creation failed.",
      creatingKnowledgeBase: "Creating knowledge base...",
      knowledgeBaseCreated: "Knowledge base {name} created and selected.",
      knowledgeBaseCreationFailed: "Knowledge base creation failed.",
      updatingTenant: "Updating tenant...",
      tenantUpdated: "Tenant updated to {name}.",
      tenantUpdateFailed: "Tenant update failed.",
      updatingWorkspace: "Updating workspace...",
      workspaceUpdated: "Workspace updated to {name}.",
      workspaceUpdateFailed: "Workspace update failed.",
      updatingKnowledgeBase: "Updating knowledge base...",
      knowledgeBaseUpdated: "Knowledge base updated to {name}.",
      knowledgeBaseUpdateFailed: "Knowledge base update failed.",
      archivingWorkspace: "Archiving workspace...",
      restoringWorkspace: "Restoring workspace...",
      workspaceArchived: "Workspace {name} archived.",
      workspaceRestored: "Workspace {name} restored.",
      workspaceLifecycleUpdateFailed: "Workspace lifecycle update failed.",
      publishingKnowledgeBase: "Publishing knowledge base...",
      movingKnowledgeBaseToDraft: "Moving knowledge base to draft...",
      knowledgeBasePublished: "Knowledge base {name} published.",
      knowledgeBaseMovedToDraft: "Knowledge base {name} moved back to draft.",
      knowledgeBasePublicationUpdateFailed:
        "Knowledge base publication update failed.",
      savingConversationTitle: "Saving conversation title...",
      conversationRenamed: "Conversation renamed to {title}.",
      conversationRenameFailed: "Conversation rename failed.",
      creatingConversation: "Creating a new conversation...",
      conversationCreated: "Conversation {title} created.",
      conversationCreationFailed: "Conversation creation failed.",
      conversationsLoadMoreFailed: "More conversations could not be loaded.",
      deletingConversation: "Deleting conversation...",
      conversationDeleted: "Deleted {title}.",
      conversationDeletionFailed: "Conversation deletion failed.",
      refreshingWorkspaceData: "Refreshing workspace data...",
      workspaceDataRefreshed: "Workspace data refreshed.",
      workspaceRefreshFailed: "Workspace refresh failed.",
      generatingGroundedReply: "Generating a grounded reply...",
      groundedAnswerReady: "Grounded answer ready.",
      groundedAnswerReadyWithAgent:
        "Grounded answer ready through agent {name}.",
      questionFailed: "Question failed.",
      messageFeedbackSavedHelpful: "Answer marked as helpful.",
      messageFeedbackSavedReview: "Answer flagged for review.",
      messageFeedbackFailed: "Saving answer feedback failed.",
      uploadingAndStartingIngestion:
        "Uploading document and starting ingestion...",
      importingWebPageAndStartingIngestion:
        "Importing web page and starting ingestion...",
      retrievalQueryPreparedInChat:
        "Retrieval query loaded into chat composer.",
      sourceChunkLoadedInChat:
        "Source chunk {index} loaded in the chat sidebar.",
      sourceDocumentLoadedInChat: "Source document loaded in the chat sidebar.",
      sourceChunkOpenedInDocuments:
        "Source chunk {index} opened in document operations.",
      sourceDocumentOpenedInDocuments:
        "Source document opened in document operations.",
      documentVersionLoaded: "Document version loaded.",
      documentVersionLoadingFailed: "Document version loading failed.",
      documentActivityLoadFailed: "Document activity failed to load.",
      startingDocumentReindex: "Starting document reindex...",
      restoringSelectedDocument: "Restoring selected document...",
      deletingSelectedDocument: "Deleting selected document...",
      webImportFailed: "Web page import failed.",
      queueingReindexSelectedDocuments:
        "Queueing reindex for {count} selected documents...",
      restoringSelectedDocuments: "Restoring {count} selected documents...",
      recommendationPrompts: {
        documentReady:
          "Use {title} as the primary source and explain the retrieval-ready facts with citations.",
        workflowCompleted:
          "Summarize the completed execution for {label} and explain what became ready downstream.",
        workflowInProgress:
          "Review the in-progress execution for {label} and tell me what should be checked next.",
        agentObjective: "Build the next operator brief around agent {name}.",
      },
      deletingSelectedDocuments: "Deleting {count} selected documents...",
      documentActionPartial:
        "{successCount} documents {actionResult}. {failureCount} failed.",
      documentDeleteCompleted:
        "{count} documents deleted from the active knowledge base.",
      documentRestoreCompleted:
        "{count} documents restored to the active knowledge base.",
      documentReindexCompleted: "{count} documents queued for reindex.",
      documentActionFailed: "Document operation failed.",
      documentDeleteFailed: "Document delete failed.",
      documentRestoreFailed: "Document restore failed.",
      documentReindexFailed: "Document reindex failed.",
      workflowRetryUnavailable: "Workflow retry is unavailable.",
      retryingWorkflow: "Retrying failed workflow run...",
      cancellingWorkflow: "Cancelling workflow run...",
      workflowRetryQueued: "Workflow retry queued.",
      workflowRetryQueuedMonitoring:
        "Workflow retry queued. Workflow supervision is now focused on the retry run.",
      workflowRetryFinished: "Workflow retry finished with status: {status}.",
      workflowRetryFailed: "Workflow retry failed.",
      workflowCancelFinished: "Workflow run cancelled.",
      workflowCancelFailed: "Workflow cancellation failed.",
      savingWorkflowNotes: "Saving workflow notes...",
      workflowNotesSaved: "Workflow notes saved.",
      workflowNotesSaveFailed: "Workflow notes failed to save.",
      conversationDraftTitle: "New Conversation {timestamp}",
      operationsLoadFailed: "Workspace operations failed to load.",
      deepLinkApplyFailed: "Workspace deep link failed to apply.",
      messagesLoadFailed: "Messages failed to load.",
      documentDetailLoadFailed: "Document detail failed to load.",
      relatedWorkflowRunsLoadFailed: "Related workflow runs failed to load.",
      workflowRunDetailLoadFailed: "Workflow run detail failed to load.",
      workflowLineageLoadFailed: "Workflow lineage failed to load.",
      feedbackValidationPrepared:
        "Feedback candidate loaded into retrieval validation.",
      feedbackComparisonPrepared:
        "Feedback candidate loaded into retrieval comparison.",
    },
    retrievalInspector: {
      title: "Retrieval diagnostics",
      description:
        "Run live retrieval checks against the active knowledge base and move directly into grounded chat or document review.",
      filtersTitle: "Evaluation filters",
      filtersDescription:
        "Narrow persisted retrieval evaluations and tuning candidates by mode, validation status, or query text.",
      modeFilterLabel: "Evaluation mode",
      followUpFilterLabel: "Follow-up status",
      statusFilterLabel: "Validation status",
      queryFilterLabel: "Query filter",
      queryFilterPlaceholder: "Filter saved evaluation queries...",
      filterAllModes: "All modes",
      filterAllFollowUpStatuses: "All follow-up statuses",
      filterAllStatuses: "All statuses",
      filterStatusReady: "Ready",
      filterStatusReview: "Review",
      filterStatusHold: "Hold",
      filterStatusEmpty: "Empty",
      filterStatusFailed: "Failed",
      followUpPending: "Pending",
      followUpResolved: "Resolved",
      followUpUpdating: "Updating...",
      markFollowUpResolved: "Mark handled",
      reopenFollowUp: "Reopen follow-up",
      resolveCandidate: "Resolve candidate",
      reopenCandidate: "Reopen candidate",
      followUpUpdateFailed: "Follow-up status update failed.",
      followUpResolvedToast: "Evaluation follow-up marked resolved.",
      followUpReopenedToast: "Evaluation follow-up reopened.",
      candidateResolvedToast: "Candidate queue marked resolved.",
      candidateReopenedToast: "Candidate queue reopened.",
      queryTitle: "Validate retrieval behavior",
      queryDescription:
        "Test the exact query path the operator is about to use before closing the execution loop.",
      quickFillTitle: "Quick fill",
      queryLabel: "Query",
      queryPlaceholder:
        "Ask a retrieval-focused question for the active scope...",
      topKLabel: "Top K",
      run: "Run diagnostics",
      compare: "Compare engines",
      comparing: "Comparing...",
      running: "Running...",
      openChat: "Open in chat",
      openDocument: "Open document",
      askWithThisQuery: "Ask with this query",
      statusTitle: "Diagnostics status",
      statusIdle: "Ready to run retrieval diagnostics for the active scope.",
      statusRunning:
        "Retrieval diagnostics are running against the active knowledge base.",
      compareStatusRunning:
        "Comparing live retrieval output across native and llamaindex_pilot.",
      statusLoaded: "{count} retrieval results loaded for review.",
      compareStatusLoaded:
        "Comparison loaded with {shared} shared ranked chunks.",
      statusEmpty: "No retrieval results matched the current query.",
      statusFailed: "Retrieval diagnostics failed.",
      scopeRequired:
        "Select a tenant, workspace, and knowledge base before running retrieval diagnostics.",
      waiting:
        "Run a retrieval diagnostic query to inspect live matching chunks.",
      noResults: "The active query returned no matching chunks.",
      resultCount: "{count} results",
      compareResultCount: "{baseline} vs {candidate} results",
      compareShared: "{count} shared",
      compareBaselineOnly: "{count} native only",
      compareCandidateOnly: "{count} llamaindex only",
      topResultMatches: "Top result matches",
      topResultDiffers: "Top result differs",
      recentEvaluationsTitle: "Recent evaluations",
      recentEvaluationsEmpty:
        "No persisted retrieval evaluations exist in the current scope yet.",
      selectedEvaluationTitle: "Selected evaluation",
      selectedEvaluationDescription:
        "Re-open one persisted evaluation as a direct follow-up packet for governance, replay, or grounded validation.",
      selectedEvaluationEmpty:
        "Select a recent evaluation to inspect its saved follow-up context.",
      selectedEvaluationNoSources:
        "No source documents were preserved for this evaluation.",
      tuningCandidatesTitle: "Tuning candidates",
      tuningCandidatesEmpty:
        "No repeated review candidates exist in the current scope yet.",
      queryCount: "{count} queries",
      evaluationCount: "{count} evaluations",
      summaryEvaluations: "{count} evaluations",
      summaryReady: "{count} ready",
      summaryReview: "{count} review",
      summaryHold: "{count} hold",
      summaryFailed: "{count} failed",
      summaryEmpty: "{count} empty",
      summaryFollowUpPending: "{count} pending",
      summaryFollowUpResolved: "{count} resolved",
      recommendedNextStep: "Recommended next step",
      inspectAgain: "Inspect again",
      compareAgain: "Compare again",
      openKnowledgeBaseGovernance: "Open knowledge base governance",
      openRetrievalGovernance: "Open retrieval governance",
      sourceDocumentsTitle: "Source documents",
      openSourceDocument: "Open {title}",
      recommendationAligned: "Aligned",
      recommendationReview: "Review candidate",
      recommendationHold: "Hold candidate",
      baselineEngine: "Baseline engine",
      candidateEngine: "Candidate engine",
      engineLabel: "Engine: {value}",
      retrievalProfile: "Profile: {value}",
      profileSource: "Source: {value}",
      retrievalMode: "Mode: {value}",
      effectiveTopK: "Effective Top K: {value}",
      embeddingModel: "Embedding: {value}",
      sourceRank: "Rank #{rank}",
      score: "Score {score}",
      vectorScore: "Vector {score}",
      lexicalScore: "Lexical {score}",
      lexicalNormalizedScore: "Lexical normalized {score}",
      tokenCount: "{count} tokens",
      chunkLabel: "Chunk #{index}",
      suggestions: {
        composer: "Composer draft",
        latestUserQuestion: "Latest user question",
        selectedDocument: "Selected document title",
        agentObjective: "Active agent objective",
      },
    },
    agentRecommendations: {
      "document-ready-for-grounded-chat":
        "This document is retrieval-ready, so a grounded chat agent is the best next operator path.",
      "document-needs-intake":
        "This document still needs ingestion follow-up, so an intake-oriented agent is the strongest fit.",
      "document-needs-recovery":
        "This document is in a failed state, so a recovery-oriented agent should take over next.",
      "workflow-completed":
        "This workflow already completed, so the next best handoff is a grounded chat agent.",
      "workflow-in-progress":
        "This workflow is still moving, so an intake-oriented agent is best positioned to continue execution follow-up.",
      "workflow-failed":
        "This workflow failed, so a recovery-oriented agent is the clearest next owner.",
    },
    sharedRecommendations: {
      score: "Score {count}",
      scopeMatched: "Scope matched",
      scopeReview: "Scope review",
      capabilities: "{count} capabilities",
      targets: {
        chat: "Chat surface",
        documents: "Document surface",
        workflows: "Workflow surface",
      },
    },
    sharedExecutionPacket: {
      title: "Execution packet",
      subject: "Subject",
      currentState: "Current state",
      currentSurface: "Current surface",
      recommendedSurface: "Recommended surface",
      noRecommendedSurface: "No recommended surface",
      scopePosture: "Scope posture",
      scopeMatched: "Scope aligned",
      scopeReview: "Scope review required",
      scopeUnavailable: "Scope not resolved",
      capabilities: "{count} connected capabilities",
      capabilitiesUnavailable: "Capabilities not resolved",
      tones: {
        healthy: "Healthy",
        review: "Review",
        attention: "Attention",
      },
    },
    errors: {
      selectedTenantNotResolved: "Selected tenant could not be resolved.",
      selectedTenantNoWorkspaces: "Selected tenant has no workspaces yet.",
      selectedWorkspaceNoKnowledgeBases:
        "Selected workspace has no knowledge bases yet.",
      tenantNameSlugRequired: "Tenant name and slug are required.",
      workspaceNameSlugRequired: "Workspace name and slug are required.",
      knowledgeBaseNameSlugRequired:
        "Knowledge base name and slug are required.",
      conversationTitleRequired: "Conversation title is required.",
    },
    confirm: {
      deleteConversation:
        "Delete {title}? This removes its persisted messages and citations.",
      deleteSelectedDocument:
        "Soft delete the selected document from this knowledge base?",
      deleteDocument:
        "Delete {title} from this knowledge base? The document can be restored later.",
      reindexDocument: "Rebuild the search index for {title}?",
      restoreDocument: "Restore {title} to the active document list?",
      permanentDeleteDocument:
        "Permanently delete {title} and its stored file, versions, chunks, and vectors? This cannot be undone.",
      permanentDeleteLabel: "Enter the document title to confirm",
      permanentDeleteHint:
        "The title must match exactly. Documents referenced by answer citations cannot be permanently deleted.",
      deleteSelectedDocuments:
        "Soft delete {count} selected documents from this knowledge base?",
      reindexSelectedDocuments:
        "Rebuild the search index for {count} selected documents?",
      restoreSelectedDocuments:
        "Restore {count} selected documents to the active document list?",
    },
    pageHeader: {
      eyebrow: "Operator workspace",
      title: "Knowledge operations workspace",
      description:
        "Grounded chat, document ingestion, and workflow supervision now run inside one unified control surface.",
    },
    pagination: {
      showing: "Showing {start}-{end} of {total}",
      previous: "Previous",
      page: "Page {current} / {total}",
      next: "Next",
    },
    headerBar: {
      groundedChat: "Grounded Chat",
      documentOperations: "Document Operations",
      workflowOperations: "Workflow Operations",
      tenant: "Tenant",
      workspace: "Workspace",
      knowledgeBase: "knowledge-base",
      agentHandoff: "Agent {name}",
      launchedFrom: "Launched from {surface}",
      returnTo: "Back to {surface}",
      sources: {
        home: "Home",
        admin: "Admin",
        operations: "Operations",
        agents: "Agents",
        workspace: "Workspace",
      },
      searchConversations: "Search conversations",
      startConversationPlaceholder: "Start a new conversation",
      noMatchingConversations: "No conversations match the current search.",
      noConversations: "No persisted conversations yet.",
      newConversation: "New Conversation",
      addDocument: "Add document",
      uploadTarget: "Upload to",
      knowledgeScope: "Knowledge scope",
      chooseKnowledgeScope: "Choose knowledge scope",
      chooseKnowledgeScopeDescription:
        "Switch the current workspace and knowledge base. This selector does not create or edit resources.",
      workspaceLabel: "Workspace",
      knowledgeBaseLabel: "Knowledge base",
      knowledgeBaseHint:
        "The document list, upload target, and retrieval scope follow the selected knowledge base.",
      done: "Done",
      documentFilters: "Document filters",
      dropFiles: "Choose multiple files or drop them here",
      uploadFile: "Upload file",
      uploadSelectedFiles: "Upload {count} files",
      removeFile: "Remove file",
      webUrl: "Web page URL",
      uploadingFile: "Uploading...",
      uploadProgress: "Upload progress: {progress}%",
      renameTitle: "Rename Title",
      deletingConversation: "Deleting...",
      deleteConversation: "Delete Conversation",
      conversationActions: "Conversation actions",
      conversations: "conversations",
      loadingMoreConversations: "Loading more conversations...",
      active: "active",
      messages: "messages",
      conversationTitlePlaceholder: "Enter a conversation title",
      savingTitle: "Saving...",
      saveTitle: "Save Title",
      cancel: "Cancel",
      runtimePacket: "Runtime packet",
      runtimeAligned:
        "The current workspace surface matches the attached agent mode.",
      runtimeRedirect: "The attached agent is better aligned with {surface}.",
      connectedCapabilities: "{count} connected capabilities",
      validation: "Retrieval validation",
      validationHits: "{count} hits",
      objective: "Objective:",
      objectiveMissing:
        "No explicit objective is attached to the active runtime.",
      openRecommendedSurface: "Open Recommended Surface",
      openDefinition: "Open Definition",
      hideControls: "Hide Controls",
      contextControls: "Context Controls",
      refreshWorkspace: "Refresh Workspace",
      documentSearch: "Search documents",
      webImportTitlePlaceholder: "Document title (optional)",
      importPage: "Import page",
      filters: {
        all: "All",
        allStatuses: "All statuses",
        allSources: "All sources",
        allLifecycles: "All lifecycles",
        completed: "Completed",
        running: "Running",
        failed: "Failed",
        pending: "Pending",
        file: "File",
        web: "Web page",
        other: "Other",
        active: "Active",
        deleted: "Deleted",
        updatedDesc: "Recently updated",
        createdDesc: "Newest created",
        createdAsc: "Oldest created",
        titleAsc: "Title A-Z",
        titleDesc: "Title Z-A",
        statusPriority: "Status priority",
      },
    },
    sharedAgentContext: {
      aligned: "Surface aligned",
      review: "Review routing",
      connectedCapabilities: "{count} connected capabilities",
      objective: "Objective:",
      objectiveMissing:
        "No explicit objective is attached to this agent context.",
      openDefinition: "Open Definition",
    },
    chatView: {
      workspaceConversations: "Workspace conversations",
      activeInScope: "{count} active in current workspace scope",
      flowStateEmpty: "No knowledge ready",
      flowStateRecovery: "Recovery first",
      flowStateReview: "Review evidence",
      flowStateReady: "Ready to validate",
      flowStateConversation: "Conversation setup",
      flowStateEmptyTitle: "Grounded chat is waiting for indexed knowledge.",
      flowStateEmptyDescription:
        "Open documents first, ingest source material, and return to chat only after the knowledge base has retrieval-ready content.",
      flowStateRecoveryTitle:
        "Recovery work still needs to close before this chat lane is trustworthy.",
      flowStateRecoveryDescription:
        "A failed or cancelled workflow is still attached to this scope. Clear the workflow lane first, then return here for grounded validation.",
      flowStateReviewTitle:
        "The latest retrieval posture still needs review before final grounded answers.",
      flowStateReviewDescription:
        "Inspect the source documents or workflow evidence first, then rerun validation so chat answers are based on stable citations.",
      flowStateReadyTitle:
        "This chat scope is ready to validate grounded answers.",
      flowStateReadyDescription:
        "Use the suggested validation prompt or start a fresh thread now that the selected knowledge scope has usable retrieval context.",
      flowStateValidatedTitle:
        "This chat scope is validated and ready for direct grounded answers.",
      flowStateValidatedDescription:
        "Recent retrieval validation already passed in this scope. Continue asking scoped questions while keeping citations and source review close at hand.",
      flowStateConversationTitle:
        "The chat lane is ready, but the active conversation has not started yet.",
      flowStateConversationDescription:
        "Create the next grounded thread from this scope, then move through cited answers without leaving the current workspace context.",
      workspaceMessages: "Workspace messages",
      latestActivity: "Latest activity {timestamp}",
      noPersistedActivity: "No persisted activity yet",
      currentThread: "Current thread",
      userAssistantSplit: "{userCount} user · {assistantCount} assistant",
      currentActivity: "Current activity",
      noReplies: "No replies yet",
      startedAt: "Started {timestamp}",
      startConversationToPersist: "Start the conversation to persist activity",
      conversationStream: "Conversation Stream",
      groundedResponseConsole: "Grounded response console",
      attentionTitle: "Chat context needs attention.",
      refreshWorkspace: "Refresh workspace",
      openContextControls: "Open context controls",
      loadingConversationHistory: "Loading conversation history...",
      noConversationSelected: "No conversation is selected.",
      noConversationSelectedDescription:
        "Start a new chat thread for the current knowledge base, then ask a grounded question to persist a real conversation with citations.",
      streamPlaceholderNoConversation:
        "Use the flow state above to start the next grounded thread. The stream will populate after the first persisted turn.",
      startConversation: "Start conversation",
      firstTurnReady: "This conversation is ready for its first grounded turn.",
      firstTurnReadyDescription:
        "Ask a question against the selected knowledge base. RAGPilot will retrieve evidence, generate an answer, and persist both messages with citations.",
      streamPlaceholderFirstTurn:
        "The active thread is still empty. Use the flow state above to start validation or ask the first grounded question for this scope.",
      noIndexedDocumentsWarning:
        "No indexed documents are available in this knowledge base yet. Upload content first so grounded answers have retrieval context.",
      citations: "Citations",
      citationCount: "{count} citations",
      runtimeDetails: "Runtime details",
      reviewContext: "Review context",
      sourcesCount: "{count} sources",
      sourceRank: "Source #{rank}",
      score: "score {score}",
      retrievalMethod: "method {method}",
      vectorScore: "vector {score}",
      lexicalScore: "lexical {score}",
      lexicalNormalizedScore: "lexical norm {score}",
      hybridMethod: "hybrid",
      vectorMethod: "vector",
      lexicalMethod: "lexical",
      unscored: "unscored",
      chunkIndex: "Chunk {index}",
      retrievalEngine: "Engine {value}",
      runtimeModelBadge: "Runtime {model}",
      runtimeSource: "Source {source}",
      runtimeEndpoint: "Endpoint {value}",
      runtimeFallbackBadge: "Fallback applied",
      runtimeSources: {
        model_endpoint: "model endpoint",
        agent_definition: "agent definition",
        settings: "service default",
        settings_fallback: "settings fallback",
      },
      answerReviewQueue: "Answer review",
      answerReviewTitle: "Answer feedback queue",
      feedbackPendingMetric: "Pending follow-up",
      feedbackResolvedMetric: "Resolved follow-up",
      feedbackHelpful: "Mark helpful",
      feedbackReview: "Needs review",
      answerDetails: "Answer details",
      openDiagnostics: "Diagnostics",
      diagnosticsTitle: "Chat diagnostics and review",
      closeDiagnostics: "Close diagnostics",
      copyAnswer: "Copy answer",
      answerCopied: "Copied",
      closeAnswerDetails: "Close answer details",
      detailRetrievalEngine: "Retrieval engine",
      detailModel: "Model",
      detailProvider: "Provider",
      detailEndpoint: "Model endpoint",
      detailRuntimeSource: "Runtime source",
      detailApiBase: "API base URL",
      noRuntimeDetails: "No runtime details were recorded for this answer.",
      noCitations: "No citations were recorded for this answer.",
      feedbackSubmitting: "Saving...",
      feedbackSubmittedHelpful: "Helpful",
      feedbackSubmittedReview: "Flagged",
      feedbackCount: "{count} feedback",
      feedbackQueueEmpty:
        "No answer feedback needs follow-up in the current scope.",
      feedbackNoExcerpt:
        "No persisted answer excerpt is available for this feedback item.",
      feedbackSourceQuestion: "Source question",
      followUpPending: "Pending",
      followUpResolved: "Resolved",
      resolveFollowUp: "Resolve follow-up",
      reopenFollowUp: "Reopen follow-up",
      tuningCandidatesTitle: "Retrieval candidates",
      tuningCandidatesEmpty:
        "No repeated retrieval candidates are waiting in the current scope.",
      candidatePendingMetric: "Pending queries",
      candidateResolvedMetric: "Resolved queries",
      resolveCandidate: "Resolve candidate",
      reopenCandidate: "Reopen candidate",
      evaluationModes: {
        inspect: "Inspect",
        compare: "Compare",
      },
      feedbackAnswerQuality: "Answer {value}",
      feedbackCitationQuality: "Citations {value}",
      openFeedbackThread: "Open thread",
      feedbackAnswerQualities: {
        helpful: "helpful",
        partially_helpful: "partial",
        not_helpful: "not helpful",
      },
      feedbackCitationQualities: {
        grounded: "grounded",
        partial: "partial",
        broken: "broken",
      },
      citationWithoutQuote: "Citation stored without a quote preview.",
      inspectSource: "Inspect source",
      openDocumentView: "Open document view",
      askKnowledgeBase: "Ask the selected knowledge base",
      askKnowledgeBaseDescription:
        "Responses are grounded with pgvector retrieval and persisted with citations for review.",
      validationTitle: "Retrieval validation posture",
      validationPendingDescription:
        "Run one focused retrieval check before sending the final grounded question so this scope is validated against real evidence first.",
      validationUseSuggestedQuery: "Use suggested validation query",
      validationQuery: "Query {value}",
      validationResultCount: "{count} validated hits",
      validationEngine: "Baseline {value}",
      validationCandidateEngine: "Candidate {value}",
      validationProfile: "Profile {value}",
      validationModes: {
        inspect: "Single-engine check",
        compare: "Engine comparison",
      },
      validationStatuses: {
        pending: "Pending validation",
        ready: "Validation ready",
        review: "Needs review",
        hold: "Hold rollout",
        empty: "No evidence found",
        failed: "Validation failed",
      },
      retrievalIntelligenceTitle: "Retrieval intelligence",
      retrievalIntelligenceEvaluations: "Evaluations",
      retrievalIntelligenceQueries: "Queries",
      retrievalIntelligencePending: "Pending follow-up",
      retrievalIntelligencePrimaryQuery: "Priority query {value}",
      retrievalIntelligenceStatuses: {
        stable: "Stable",
        review: "Review",
        hold: "Hold",
      },
      startOrSelectConversation:
        "Start or select a conversation to begin grounded chat...",
      welcomeTitle: "What would you like to know?",
      welcomeDescription:
        "Ask against the current knowledge base. A conversation will be created when you send the first message.",
      welcomePlaceholder: "Ask a question...",
      uploadContentBeforeAsk:
        "Upload indexed content before asking a grounded question...",
      askGroundedQuestion:
        "Ask a grounded question about the indexed content...",
      scopeLimitedTo: "Scope is limited to {scope}.",
      defaultScope: "workspace",
      agentHandoff: "Agent Handoff",
      agentHandoffTitle: "{name} is attached to this workspace session.",
      groundedAgentDescription:
        "This agent is aligned with grounded Q&A on the selected knowledge base. Use this chat surface for cited answers, then jump into documents or workflows only when the evidence needs follow-up.",
      intakeAgentDescription:
        "This agent is optimized for document intake. Use documents to upload, inspect, and reindex source content before returning here for grounded answers.",
      recoveryAgentDescription:
        "This agent is focused on recovery work. Review failed or retrying workflow runs first, then return to chat once the knowledge-base state is healthy again.",
      agentScope: "Scope {scope}",
      openDocumentsSurface: "Open Documents",
      openWorkflowSurface: "Open Workflows",
      answeringAsAgent: "Answering as {name}",
      agentObjective: "Agent objective:",
      agentObjectiveMissing:
        "No explicit agent objective is attached to the current chat runtime.",
      generating: "Generating...",
      sendQuestion: "Send Question",
      documentSignals: "Document Signals",
      indexedDocuments: "Indexed Documents",
      noIndexedDocuments: "No indexed documents yet.",
      ingestionStatus: "ingestion {status}",
      indexingStatus: "indexing {status}",
      selectDocumentToInspect:
        "Select a document to inspect its metadata and chunks.",
      selectWorkflowToInspect:
        "Select a workflow run to inspect execution details.",
      workflowStepsAppear:
        "Step records will appear here once the workflow runs.",
      noWorkflowRuns: "No workflow runs yet.",
      workflowRuns: "Workflow Runs",
    },
    documentsView: {
      dataSources: {
        title: "Data sources",
        description: "Durable connector identities, incremental cursors, and recent synchronization state for this knowledge base.",
        add: "Add web source",
        create: "Create source",
        createTitle: "Add public web data source",
        refresh: "Refresh",
        empty: "No durable data sources are connected to this knowledge base.",
        name: "Source name",
        url: "Public URL",
        urlHint: "Only public HTTP(S) pages are accepted. Private, local, credentialed, and unsafe redirect destinations are blocked.",
        sync: "Sync now",
        syncing: "Syncing...",
        neverRun: "No synchronization run yet",
        runSummary: "{changed} changed · {unchanged} unchanged · {deleted} deleted",
        loadFailed: "Data sources could not be loaded.",
        createFailed: "Data source could not be created.",
        syncFailed: "Data-source synchronization could not be started.",
        status: {
          never_synced: "Never synced",
          syncing: "Syncing",
          completed: "Completed",
          failed: "Failed"
        }
      },
      documents: "Documents",
      documentDetails: "Document details",
      closeDocumentDetails: "Close document details",
      closeWorkflowDetails: "Close workflow details",
      documentsDescription: "Indexed assets in the active knowledge base.",
      addDocument: "Add document",
      flowStateEmpty: "Empty registry",
      flowStateRecovery: "Recovery lane",
      flowStateMonitoring: "Monitoring lane",
      flowStateReady: "Ready for validation",
      completed: "Completed",
      completedDescription: "Documents ready for knowledge retrieval.",
      inProgress: "In Progress",
      inProgressDescription: "Active ingestion or indexing work.",
      needsAttention: "Needs Attention",
      needsAttentionDescription: "Documents with failed processing state.",
      agentHandoff: "Agent Handoff",
      agentHandoffTitle: "{name} is attached to this document surface.",
      groundedAgentDescription:
        "This agent answers from indexed knowledge. Complete document processing here, then return to chat for grounded responses with citations.",
      intakeAgentDescription:
        "This agent owns document intake. Keep the registry, failed queue, and version inspection close together before handing content to chat.",
      recoveryAgentDescription:
        "This agent is focused on failed ingestion and retries. Use the failed queue and workflow supervision together so recovery work stays in one operational lane.",
      agentScope: "Scope {scope}",
      openChatSurface: "Open Chat",
      openWorkflowSurface: "Open Workflows",
      showFailedQueue: "Show Failed Queue",
      emptyRegistryTitle:
        "No documents are registered in this knowledge base yet.",
      emptyRegistryDescription:
        "Open the context controls to upload the first source file, then return here to inspect chunks, retries, and retrieval readiness.",
      recoveryStateTitle:
        "Some documents still need recovery before chat can trust this scope.",
      recoveryStateDescription:
        "Keep failed documents and their workflow runs in the same operating lane, clear the blocked items first, then return to grounded validation.",
      monitoringStateTitle:
        "Document processing is still moving through ingestion and indexing.",
      monitoringStateDescription:
        "Stay close to workflow supervision until the active uploads settle. When processing completes, return to chat for grounded validation.",
      validationStateTitle:
        "The document lane is ready to validate grounded answers.",
      validationStateDescription:
        "Use chat to confirm citations against the latest indexed sources, or open workflow supervision if you want to review the last execution path first.",
      openContextControls: "Open context controls",
      uploadFollowUpBadge: "Upload follow-up",
      uploadFollowUpTitle: "{title} received",
      uploadFollowUpReady:
        "This document is ready for validation. Continue in grounded chat and confirm the cited answer is stable.",
      uploadFollowUpFailed:
        "This document hit a blocked execution path. Inspect the workflow run before continuing recovery work.",
      uploadFollowUpMonitoring:
        "This document is still moving through execution. Keep workflow supervision open until the state settles.",
      uploadInspectRun: "Inspect upload run",
      uploadOpenChat: "Validate in chat",
      uploadOpenWorkflows: "Open workflow supervision",
      uploadDismiss: "Dismiss",
      selectDocumentToInspect:
        "Select a document from the registry to inspect it.",
      selectDocumentOrWorkflow:
        "Select a document or workflow run to inspect processing details.",
      retryHelp:
        "Retry failed ingestion after confirming the source document still exists and the failure cause has been addressed.",
      relatedWorkflow: "Related Workflow",
      backToDocument: "Back to document details",
      noDocumentActivity: "No activity recorded for the selected document.",
      noRelatedWorkflowRuns:
        "No workflow runs recorded yet for the selected document.",
      relatedWorkflowRuns: "Related Workflow Runs",
    },
    workflowsView: {
      workflowRuns: "Workflow Runs",
      workflowRunsDescription: "Tracked automation runs in the active tenant.",
      flowStateEmpty: "No active queue",
      flowStateRecovery: "Recovery queue",
      flowStateMonitoring: "Execution in motion",
      flowStateReady: "Ready for validation",
      active: "Active",
      activeDescription: "Pending, queued, or currently running work.",
      queued: "Queued",
      queuedDescription: "Runs that are accepted and waiting to be executed.",
      running: "Running",
      runningDescription:
        "Runs that already started execution and are still in progress.",
      retryRuns: "Retry runs",
      retryRunsDescription:
        "Runs created from earlier failed execution attempts.",
      completed: "Completed",
      completedDescription: "Runs that reached a successful terminal state.",
      failed: "Failed",
      failedDescription: "Runs that still need intervention or retry.",
      agentHandoff: "Agent Handoff",
      agentHandoffTitle: "{name} is attached to this workflow surface.",
      groundedAgentDescription:
        "This agent is primarily chat-oriented. Use workflow supervision here when retrieval quality depends on document ingestion health, then return to grounded chat.",
      intakeAgentDescription:
        "This agent is intake-oriented. Use this surface to watch ingestion progress, inspect failed runs, and confirm that documents are ready before handoff.",
      recoveryAgentDescription:
        "This agent is recovery-oriented. Stay in this lane to clear failed runs, monitor retries, and return the workspace to a healthy state.",
      agentScope: "Scope {scope}",
      openChatSurface: "Open Chat",
      failureLane: "Failure lane",
      failureLaneDescription:
        "Runs that still need human intervention in the current tenant scope.",
      retryLane: "Retry lane",
      retryLaneDescription:
        "Retry volume already issued from earlier failed execution attempts.",
      pressureLane: "Queue pressure",
      pressureLaneDescription:
        "Combined queued and running work that is still in motion.",
      supervision: "Workflow supervision",
      supervisionTitle:
        "Route the current scope into the right execution queue.",
      supervisionDescription:
        "Jump straight into failed runs, active processing, or back to document operations without resetting the active tenant and knowledge-base scope.",
      failedRuns: "Failed runs",
      priorityQueue: "Priority queue",
      queuedRuns: "Queued runs",
      retryQueue: "Retry queue",
      clearFilters: "Clear filters",
      openDocuments: "Open documents",
      openContextControls: "Open context controls",
      emptyQueueTitle: "No workflow runs exist in the current scope yet.",
      emptyQueueDescription:
        "Start from document intake first. Workflow supervision becomes useful as soon as uploads, indexing, or retries begin to move.",
      recoveryStateTitle:
        "Workflow recovery is the current priority in this scope.",
      recoveryStateDescription:
        "One or more runs still need intervention, retry, or cancellation review. Clear the failure lane first, then return to documents or chat.",
      monitoringStateTitle:
        "Execution is still active across queued or running workflow lanes.",
      monitoringStateDescription:
        "Keep the active queue in view until the current runs settle. Once the lane stabilizes, continue into chat validation or document review.",
      healthyQueueTitle: "The workflow lane is currently stable.",
      healthyQueueDescription:
        "No failed or active runs are blocking this scope right now. Continue in chat to validate grounded answers, or return to documents for source review.",
      selectWorkflowToInspect: "Select a workflow run to inspect its timeline.",
      retryHelp:
        "Retry is only available for failed document-ingestion runs whose source document is still active in the current knowledge base.",
    },
    sidebar: {
      closeContextControls: "Close context controls",
      contextControls: "Context Controls",
      contextControlsDescription:
        "Manage tenant, workspace, knowledge base, and ingestion operations from one drawer.",
      loadingTenant: "Loading tenant",
      waitingTenantScope: "Waiting for tenant scope",
      loadingWorkspace: "Loading workspace",
      waitingWorkspaceScope: "Waiting for workspace scope",
      loadingKnowledgeBase: "Loading knowledge base",
      waitingKnowledgeScope: "Waiting for knowledge scope",
      archivedWorkspace: "Archived Workspace",
      activeWorkspace: "Active Workspace",
      publishedKb: "Published KB",
      draftKb: "Draft KB",
      edit: "Edit",
      new: "New",
      selectTenant: "Select tenant",
      selectWorkspace: "Select workspace",
      selectKnowledgeBase: "Select knowledge base",
      archived: "Archived",
      active: "Active",
      working: "Working...",
      unarchive: "Unarchive",
      archive: "Archive",
      published: "Published",
      draft: "Draft",
      moveToDraft: "Move to Draft",
      publish: "Publish",
      documentIngestion: "Document Ingestion",
      supportedFormats: "TXT / MD / HTML / CSV / JSON / PDF / DOCX / XLSX",
      chooseFile:
        "Choose a text, Markdown, HTML, CSV, JSON, PDF, DOCX, or XLSX file to index",
      indexingDocument: "Indexing document...",
      uploadAndIndex: "Upload and Index",
      webImportTitle: "Single-page Web Import",
      webImportUrlPlaceholder: "https://example.com/reference-page",
      webImportDocumentTitlePlaceholder: "Optional document title",
      importWebPage: "Import Web Page",
      importingWebPage: "Importing web page...",
      demoWorkspaceDescription:
        "Local workspace for grounded chat and document operations.",
      demoKnowledgeBaseDescription:
        "Default knowledge base for the local operator workspace.",
      sectionTenant: "Tenant",
      sectionWorkspace: "Workspace",
      sectionKnowledgeBase: "Knowledge Base",
      modal: {
        cancel: "Cancel",
        saving: "Saving...",
        creating: "Creating...",
        tenantEditDescription:
          "Update the tenant profile without losing your place in the operator drawer.",
        tenantEditTitle: "Edit Tenant",
        tenantName: "Tenant name",
        tenantSlug: "Tenant slug",
        tenantSlugHint: "Used in workspace URLs and stable scope references.",
        tenantNamePlaceholder: "Tenant name",
        tenantSlugPlaceholder: "tenant-slug",
        saveTenant: "Save Tenant",
        tenantCreateDescription:
          "Create a new tenant scope in a focused modal instead of expanding the drawer layout.",
        tenantCreateTitle: "Create Tenant",
        createTenant: "Create Tenant",
        workspaceEditDescription:
          "Edit the workspace profile in a modal so the drawer stays readable.",
        workspaceEditTitle: "Edit Workspace",
        workspaceName: "Workspace name",
        workspaceSlug: "Workspace slug",
        workspaceSlugHint: "Used in workspace URLs and admin deep links.",
        workspaceDescription: "Workspace description",
        workspaceDescriptionHint:
          "Shown across operator and governance surfaces.",
        workspaceNamePlaceholder: "Workspace name",
        workspaceSlugPlaceholder: "workspace-slug",
        workspaceDescriptionPlaceholder: "Workspace description",
        saveWorkspace: "Save Workspace",
        workspaceCreateDescription:
          "Create a new workspace in a dedicated modal instead of expanding the surrounding controls.",
        workspaceCreateTitle: "Create Workspace",
        createWorkspace: "Create Workspace",
        knowledgeBaseEditDescription:
          "Edit the knowledge base without pushing the rest of the drawer content out of view.",
        knowledgeBaseEditTitle: "Edit Knowledge Base",
        knowledgeBaseName: "Knowledge base name",
        knowledgeBaseSlug: "Knowledge base slug",
        knowledgeBaseSlugHint:
          "Used in retrieval scope URLs and citations review flows.",
        knowledgeBaseDescription: "Knowledge base description",
        knowledgeBaseDescriptionHint:
          "Shown in operator scope summaries and governance listings.",
        knowledgeBaseRetrievalProfile: "Retrieval profile",
        knowledgeBaseRetrievalProfileHint:
          "Bind this knowledge base to a governed retrieval profile for chat, diagnostics, and agent execution.",
        knowledgeBaseRetrievalProfileDefault: "Default retrieval profile",
        knowledgeBaseNamePlaceholder: "Knowledge base name",
        knowledgeBaseSlugPlaceholder: "knowledge-base-slug",
        knowledgeBaseDescriptionPlaceholder: "Knowledge base description",
        saveKnowledgeBase: "Save Knowledge Base",
        knowledgeBaseCreateDescription:
          "Create a new knowledge base in a focused modal flow.",
        knowledgeBaseCreateTitle: "Create Knowledge Base",
        createKnowledgeBase: "Create Knowledge Base",
      },
    },
    registry: {
      title: "Document Registry",
      description:
        "Search, filter, and inspect document processing state for the active knowledge base.",
      activeAgent: "Agent {name}",
      agentScope: "Scope {scope}",
      searchPlaceholder: "Search title or source URI",
      lifecycle: "Lifecycle",
      lifecycleActive: "Active only",
      lifecycleDeleted: "Deleted only",
      lifecycleAll: "All documents",
      status: "Status",
      allStatuses: "All statuses",
      sourceType: "Source type",
      allSources: "All sources",
      sourceFile: "File",
      sourceWeb: "Web page",
      sourceOther: "Other",
      completed: "Completed",
      running: "Running",
      queued: "Queued",
      failed: "Failed",
      pending: "Pending",
      sortDocuments: "Sort documents",
      recentlyUpdated: "Recently updated",
      recentlyCreated: "Recently created",
      oldestCreated: "Oldest created",
      titleAsc: "Title A-Z",
      titleDesc: "Title Z-A",
      statusPriority: "Status priority",
      selectedCount: "{count} selected",
      selectPage: "Select page",
      clearSelection: "Clear selection",
      reindexSelected: "Reindex selected",
      restoreSelected: "Restore selected",
      deleteSelected: "Delete selected",
      openFailedQueue: "Failed queue",
      openWorkflowSupervision: "Workflow supervision",
      selectAllAria: "Select all documents on page",
      document: "Document",
      ingestion: "Document ingestion",
      indexing: "Document indexing",
      latestProcessing: "Latest processing",
      source: "Source",
      updated: "Updated",
      deletedBadge: "Deleted",
      parserPending: "parser pending",
      noVersionYet: "No version yet",
      workflowFallback: "workflow",
      noWorkflowRecorded: "No workflow recorded",
      noDocumentsMatch: "No documents match the current filters.",
    },
    selectedDocument: {
      selectedDocument: "Selected Document",
      recommendedAgents: "Recommended Agents",
      recommendedAgentsDescription:
        "Switch directly into a better-matched agent context for the current document state.",
      switchAgent: "Switch Agent",
      activateInChat: "Activate in Chat",
      activateInDocuments: "Activate in Documents",
      activateInWorkflows: "Activate in Workflows",
      noAssetMetadata: "No asset metadata",
      reindex: "Reindex",
      restore: "Restore",
      delete: "Delete",
      permanentDelete: "Permanently delete",
      openChat: "Open chat",
      parser: "Parser",
      pending: "pending",
      version: "Version",
      chunks: "Chunks",
      notAvailable: "n/a",
      chunkCount: "Chunk Count",
      assetSize: "Asset Size",
      processingHealth: "Processing Health",
      documentIngestion: "Document Ingestion",
      documentIndexing: "Document Indexing",
      currentVersionTokens: "Current Version Tokens",
      contentType: "Content Type",
      contentTypes: {
        pdf: "PDF document",
        word: "Word document",
        spreadsheet: "Spreadsheet",
        presentation: "Presentation",
        image: "Image",
        web: "Web page",
        json: "JSON data",
        text: "Text file",
        other: "Other file",
      },
      unknown: "unknown",
      versionState: "Version State",
      latestAttempt: "Latest Attempt",
      latestCompleted: "Latest Completed",
      noCompletedVersion: "No completed version",
      awaitingSuccessfulIngestion: "Awaiting successful ingestion",
      operatorNextStep: "Operator next step",
      operatorNextStepDescription:
        "This document needs follow-up in the failed queue or workflow supervision before it can return to a healthy retrieval state.",
      readyFollowUpTitle: "Validation follow-up",
      readyFollowUpDescription:
        "This document is ready for grounded use. Continue in chat to validate cited answers, or keep workflow supervision close for final operator confirmation.",
      intakeFollowUpTitle: "Intake follow-up",
      intakeFollowUpDescription:
        "This document is still moving through ingestion or indexing. Stay close to the latest run until parsing and workflow state settle.",
      continueInChat: "Continue in Chat",
      openFailedQueue: "Open failed queue",
      openWorkflowSupervision: "Open workflow supervision",
      latestWorkflow: "Latest Workflow",
      operatorHandoff: "Operator handoff",
      inspectLatestRun: "Inspect Latest Run",
      noWorkflowRuns: "No workflow runs recorded yet for this document.",
      recentVersions: "Recent Versions",
      parserPendingLower: "parser pending",
      viewingVersion: "Viewing Version",
      openVersion: "Open Version",
      storageLocation: "Storage Location",
      bucket: "Bucket",
      key: "Key",
      matchedCitation: "Matched citation",
      tokens: "{count} tokens",
      metadataPrefix: "metadata:",
      chunksAppearAfterIngestion:
        "Chunks will appear here after ingestion completes.",
      packet: {
        deletedState:
          "This document is currently removed from active retrieval scope.",
        deletedDescription:
          "Restore this document before sending it back into grounded chat or workflow validation.",
        failedState:
          "Recovery work is required before this document can return to healthy retrieval.",
        failedDescription:
          "Route the selected document into failure handling so retries, supervision, and source cleanup stay in one operator path.",
        readyState: "This document is retrieval-ready for grounded answers.",
        readyDescription:
          "The document has completed ingestion and indexing and can now hand off into chat or downstream validation.",
        intakeState:
          "This document is still moving through intake and indexing.",
        intakeDescription:
          "Keep the current document inside the intake lane until parsing, indexing, and workflow follow-up settle.",
      },
    },
    documentActionSummary: {
      summarySuffix: "summary",
      successLine:
        "{successCount} of {requestedCount} documents {actionResult}.",
      failureLine:
        "{failureCount} documents failed and remain selected for follow-up.",
      allSucceeded: "All requested document actions completed successfully.",
      followUpRequired: "Follow-up Required",
      hiddenFailures:
        "{count} more failed documents remain selected for review.",
      workflowFollowUp: "Workflow Follow-up",
      workflowGuidance:
        "Reindex requests have been queued through workflow supervision. Use the workflow view to watch retries, running steps, and final completion state for the active scope.",
      chatFollowUp: "Grounded Chat Follow-up",
      chatGuidance:
        "Once the refreshed document is healthy, return to grounded chat to validate the newly indexed evidence in a cited answer.",
      restoreFollowUp: "Restore Follow-up",
      restoreGuidance:
        "This document is back in the active knowledge-base scope. Re-run the original grounded question to confirm citations are stable again.",
      inspectWorkflowRun: "Inspect workflow run",
      openWorkflowSupervision: "Open workflow supervision",
      openGroundedChat: "Open grounded chat",
      reviewFailedDocuments: "Review failed documents",
      dismiss: "Dismiss",
      requested: "Requested",
      succeeded: "Succeeded",
      failed: "Failed",
      deleted: "deleted",
      restored: "restored",
      queuedForReindex: "queued for reindex",
    },
    selectedWorkflow: {
      selectedWorkflowRun: "Selected Workflow Run",
      recommendedAgents: "Recommended Agents",
      recommendedAgentsDescription:
        "Route this execution run into the agent that best matches the current workflow state.",
      switchAgent: "Switch Agent",
      activateInChat: "Activate in Chat",
      activateInDocuments: "Activate in Documents",
      activateInWorkflows: "Activate in Workflows",
      openDocument: "Open Document",
      openWorkflowSupervision: "Open Workflow Supervision",
      reviewFailedQueue: "Review Failed Queue",
      monitorQueuedRuns: "Monitor Queued Runs",
      monitorRetryQueue: "Monitor Retry Queue",
      continueInChat: "Continue in Chat",
      continueInDocuments: "Continue in Documents",
      failedFollowUpTitle: "Recovery follow-up",
      failedFollowUpDescription:
        "This run still needs operator intervention. Review the failed lane, inspect the source document, then retry after the blocking issue is addressed.",
      activeFollowUpTitle: "Execution follow-up",
      activeFollowUpDescription:
        "This run is still moving through execution. Stay in workflow supervision to watch queue progress, retries, and downstream readiness.",
      completedFollowUpTitle: "Downstream handoff",
      completedFollowUpDescription:
        "This run has completed. Continue into chat or document operations to validate what is now retrieval-ready for the current scope.",
      checkingRetry: "Checking Retry...",
      cancelledFollowUpTitle: "Cancellation follow-up",
      cancelledFollowUpDescription:
        "This run was cancelled before reaching completion. Review the source scope and the runtime context before you relaunch ingestion.",
      cancellingRun: "Cancelling...",
      cancelRun: "Cancel Run",
      retryRun: "Retry Run",
      retryOf: "Retry Of",
      workflowLineage: "Workflow Lineage",
      parentRetrySource: "Parent Retry Source",
      spawnedRetries: "Spawned Retries",
      subject: "Subject",
      steps: "Steps",
      created: "Created",
      updated: "Updated",
      subjectId: "Subject Id",
      subjectLabel: "Subject Label",
      temporalWorkflowId: "Temporal Workflow Id",
      started: "Started",
      completed: "Completed",
      runtime: "Runtime",
      summary: {
        retryDepth: "Retry Depth",
        remainingRetries: "Retry Budget",
        childRetries: "Child Retries",
        failedSteps: "Failed Steps",
        recoveryEvents: "Recovery Events",
        activeRetry: "Active Retry",
        activeRetryRunning: "Active",
        none: "None",
        latestRecoveryActivity: "Latest Recovery Activity",
        latestFailedStep: "Latest Failed Step",
        latestActiveStep: "Latest Active Step",
        latestCompletedStep: "Latest Completed Step",
        highestAttemptStep: "Highest Retry Step",
      },
      unbound: "unbound",
      notStarted: "Not started",
      notCompleted: "Not completed",
      attempt: "attempt {count}",
      runtimeValue: "runtime {value}",
      startedValue: "started {value}",
      completedValue: "completed {value}",
      workflowInput: "Workflow Input",
      operatorNotes: "Operator notes",
      operatorNotesDescription:
        "Capture the operator decision, retry guardrail, or source-context finding that should stay attached to this run.",
      operatorNotesPlaceholder:
        "Add a durable operator note for this workflow run...",
      operatorNotesEmpty:
        "No operator notes are saved for this workflow run yet.",
      operatorNotesSaved: "Operator notes are attached to this workflow run.",
      saveOperatorNotes: "Save Notes",
      savingOperatorNotes: "Saving Notes...",
      failureFocus: {
        title: "Failure Focus",
        step: "Focused step: {value}",
        attempts: "Retry pressure: {value} attempts",
        nextAction: "Suggested next action: {value}",
        categories: {
          sourceDeleted:
            "The source document is no longer active in the knowledge base.",
          sourceMissing:
            "The source document can no longer be resolved from the current scope.",
          parserFailure:
            "The failure is concentrated in document parsing or content preparation.",
          embeddingFailure:
            "The failure is concentrated in embedding or vectorization.",
          indexingFailure:
            "The failure is concentrated in indexing or search write-back.",
          runtimeTimeout: "The workflow looks blocked by a runtime timeout.",
          runtimeCapacity:
            "The workflow looks blocked by model or service capacity pressure.",
          unknown: "The failure needs manual workflow inspection.",
        },
        actions: {
          reviewDocumentSource: "Review document source",
          reviewParserPath: "Review parser path",
          reviewRuntime: "Review runtime health",
          reviewIndexing: "Review indexing path",
          retryWhenReady: "Retry when runtime recovers",
          inspectWorkflow: "Inspect workflow detail",
        },
      },
      events: {
        title: "Recovery Events",
        description:
          "Track the latest operator actions and recovery checkpoints for this workflow run.",
        empty: "No recovery events are attached to this workflow run yet.",
        systemActor: "system",
        retryRequested: "Retry requested",
        retryRequestedDetail:
          "A retry run was requested and routed into {value}.",
        retryRequestedFallback:
          "A retry request was recorded for this workflow run.",
        retryBlocked: "Retry blocked",
        retryBlockedFallback:
          "A retry attempt was blocked for this workflow run.",
        retrySpawned: "Retry spawned",
        retrySpawnedDetail: "This retry run was spawned from {value}.",
        retrySpawnedFallback: "This workflow run was created as a retry.",
        cancelRequested: "Cancellation recorded",
        cancelRequestedFallback:
          "This workflow run was cancelled by an operator.",
        operatorNotesUpdated: "Operator notes updated",
        operatorNotesUpdatedDetail: "Latest note: {value}",
        operatorNotesUpdatedFallback:
          "The operator notes were updated for this workflow run.",
      },
      packet: {
        pendingState: "No workflow execution state is currently attached.",
        pendingDescription:
          "Select a workflow run to assemble a routed execution packet.",
        failedState:
          "This run needs intervention before recovery can continue.",
        failedDescription:
          "Keep the failed run in the recovery lane until the blocking issue is cleared and the next retry path is chosen.",
        activeState:
          "This run is still progressing through the execution lane.",
        activeDescription:
          "Stay close to workflow supervision while queue progress, retries, and downstream readiness are still in motion.",
        completedState:
          "This run has completed and is ready for downstream handoff.",
        completedDescription:
          "Move into chat or document validation to confirm what is now ready in the current scope.",
        cancelledState:
          "This run was cancelled and now needs a clean recovery review.",
        cancelledDescription:
          "Inspect the source scope and runtime context before deciding whether to relaunch ingestion or leave the run closed.",
      },
    },
    recentWorkflowRuns: {
      title: "Recent Workflow Runs",
      operatorNotes: "Operator notes",
      workflowFallback: "workflow",
    },
    workflowTimeline: {
      title: "Workflow Timeline",
      description:
        "Inspect recent automation runs, filter by execution type and status, and trace retries through history.",
      searchPlaceholder: "Search workflow id or subject",
      workflowType: "Workflow type",
      allWorkflowTypes: "All workflow types",
      documentIngestion: "Document ingestion",
      status: "Status",
      allStatuses: "All statuses",
      retryMode: "Retry mode",
      allRetryModes: "All run types",
      retryOnly: "Retry runs only",
      originalOnly: "Original runs only",
      completed: "Completed",
      failed: "Failed",
      cancelled: "Cancelled",
      running: "Running",
      queued: "Queued",
      pending: "Pending",
      sortWorkflows: "Sort workflows",
      recentlyUpdated: "Recently updated",
      recentlyCreated: "Recently created",
      oldestCreated: "Oldest created",
      statusPriority: "Status priority",
      workflowTypeAsc: "Workflow type A-Z",
      retry: "retry",
      subjectValue: "subject {value}",
      unbound: "unbound",
      notAvailable: "n/a",
      retryOf: "retry of {id}",
      completedMarker: "completed",
      noRunsMatch: "No workflow runs match the current filters.",
    },
    documentActivity: {
      title: "Document Activity",
      loading: "Loading document activity...",
      inspectRun: "Inspect Run",
      documentRegistered: "Document Registered",
      versionCreated: "Document Version Created",
      workflowRetryRequested: "Workflow Retry Requested",
      ingestionWorkflowStarted: "Ingestion Workflow Started",
      workflowExecutionStarted: "Workflow Execution Started",
      workflowCompleted: "Workflow Completed",
      workflowFailed: "Workflow Failed",
      workflowCancelled: "Workflow Cancelled",
      retryOf: "retry of {id}",
      versionSnapshot:
        "v{version} · {parser} · {chunkCount} chunks · {tokenCount} tokens",
      versions: "Versions",
      workflowRuns: "Workflow Runs",
      retryRuns: "Retry Runs",
      failedEvents: "Failed Events",
    },
  },
} as const;

export default en;
