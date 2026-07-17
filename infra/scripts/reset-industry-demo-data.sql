BEGIN;

TRUNCATE TABLE
  message_feedback_entries, message_citations, messages, conversations,
  retrieval_evaluations, document_chunk_embeddings, document_chunks,
  document_assets, document_versions, workflow_run_events, workflow_steps,
  workflow_runs, agent_executions, agent_runs, agent_definitions, documents,
  knowledge_bases, workspaces, tenant_memberships, runtime_governance_events,
  mcp_connectors, tool_registrations, model_endpoints, retrieval_profiles, tenants
CASCADE;

DELETE FROM user_sessions
WHERE user_id IN (SELECT id FROM users WHERE display_name = '22332' OR email = 'hmaxbay@gmail.com');
DELETE FROM user_access_events
WHERE user_id IN (SELECT id FROM users WHERE display_name = '22332' OR email = 'hmaxbay@gmail.com')
   OR actor_user_id IN (SELECT id FROM users WHERE display_name = '22332' OR email = 'hmaxbay@gmail.com');
DELETE FROM users WHERE display_name = '22332' OR email = 'hmaxbay@gmail.com';

DO $$
DECLARE
  tenant_id uuid := gen_random_uuid();
  admin_user_id uuid;
  ws_customer uuid := gen_random_uuid();
  ws_people uuid := gen_random_uuid();
  ws_delivery uuid := gen_random_uuid();
  kb_service uuid := gen_random_uuid();
  kb_product uuid := gen_random_uuid();
  kb_people uuid := gen_random_uuid();
  kb_sales uuid := gen_random_uuid();
  kb_delivery uuid := gen_random_uuid();
  retrieval_id uuid := gen_random_uuid();
  model_id uuid := gen_random_uuid();
  mcp_connector_id uuid := gen_random_uuid();
  tool_search uuid := gen_random_uuid();
  tool_docs uuid := gen_random_uuid();
  tool_workflow uuid := gen_random_uuid();
  tool_mcp_ticket uuid := gen_random_uuid();
  doc_id uuid;
  version_id uuid;
  conversation_id uuid;
  run_id uuid;
  conversation_index integer;
BEGIN
  SELECT id INTO admin_user_id FROM users WHERE role = 'super_admin' ORDER BY created_at LIMIT 1;

  INSERT INTO tenants (id, name, slug) VALUES
    (tenant_id, 'RAGPilot Demo', 'ragpilot-demo');

  INSERT INTO tenant_memberships (tenant_id, user_id, membership_status, activated_at)
  SELECT tenant_id, id, 'active', now() FROM users WHERE is_active = true;

  INSERT INTO retrieval_profiles (id, name, slug, retrieval_mode, top_k, vector_weight, lexical_weight, hybrid_overlap_bonus, is_enabled, is_default, notes)
  VALUES (retrieval_id, '企业知识混合检索', 'enterprise-hybrid-retrieval', 'hybrid', 8, 0.65, 0.35, 0.08, true, true, '面向客服、制度、销售与交付资料的通用混合检索策略。');

  INSERT INTO model_endpoints (id, name, slug, provider_type, model_name, base_url, credential_mode, capabilities_json, is_enabled, is_default, notes)
  VALUES (model_id, '本地企业助手模型', 'local-enterprise-assistant', 'ollama', 'qwen3.5:latest', 'http://host.docker.internal:11434', 'none', '["chat"]', true, true, '用于企业知识问答和智能体任务执行。');

  INSERT INTO mcp_connectors (id, name, slug, connector_type, base_url, auth_mode, notes, is_enabled, governance_status)
  VALUES (
    mcp_connector_id,
    '企业工单 MCP 连接器（示例）',
    'enterprise-ticket-mcp-example',
    'streamable_http',
    'http://host.docker.internal:3100/mcp',
    'none',
    '演示用 Streamable HTTP MCP 配置，默认停用且不代表远端服务已部署。部署兼容服务后，应替换地址并完成审批、预检，再启用连接器和关联工具。',
    false,
    'reviewing'
  );

  INSERT INTO tool_registrations (id, name, slug, transport_type, surface_area, description, capabilities_json, is_enabled) VALUES
    (tool_search, '企业知识检索', 'enterprise-knowledge-search', 'native', 'chat', '检索已发布的企业知识库并返回可引用证据。', '["retrieve","cite"]', true),
    (tool_docs, '文档生命周期管理', 'document-lifecycle-manager', 'native', 'documents', '查看文档状态并发起重新索引。', '["inspect","reindex"]', true),
    (tool_workflow, '运营工作流监督', 'workflow-supervisor', 'native', 'operations', '查看失败任务、运行状态和受控重试。', '["inspect","retry","cancel"]', true);

  INSERT INTO tool_registrations (id, name, slug, transport_type, surface_area, connector_reference, description, capabilities_json, requires_admin_approval, is_enabled)
  VALUES (
    tool_mcp_ticket,
    '企业工单查询（MCP 示例）',
    'enterprise-ticket-search-mcp-example',
    'mcp_reserved',
    'agents',
    'enterprise-ticket-mcp-example',
    '通过示例 MCP 连接器查询工单；远端服务部署并通过治理验证前保持停用。',
    '["ticket.search","ticket.read"]',
    true,
    false
  );

  INSERT INTO workspaces (id, tenant_id, name, slug, description) VALUES
    (ws_customer, tenant_id, '客户运营中心', 'customer-operations', '统一管理产品知识、客服标准和客户问题处理。'),
    (ws_people, tenant_id, '组织与人才中心', 'people-operations', '沉淀员工制度、培训内容与内部办事指南。'),
    (ws_delivery, tenant_id, '销售与交付中心', 'sales-delivery', '覆盖售前方案、合同交接、项目实施和售后服务。');

  INSERT INTO knowledge_bases (id, tenant_id, workspace_id, name, slug, description, publication_status, retrieval_profile_id) VALUES
    (kb_service, tenant_id, ws_customer, '客户服务知识库', 'customer-service', '客服标准、工单分级、服务承诺和投诉升级流程。', 'published', retrieval_id),
    (kb_product, tenant_id, ws_customer, '产品与解决方案', 'products-solutions', '产品能力、套餐说明、部署条件和常见问题。', 'published', retrieval_id),
    (kb_people, tenant_id, ws_people, '员工制度与培训', 'employee-handbook', '入职、考勤、报销、信息安全和岗位培训资料。', 'published', retrieval_id),
    (kb_sales, tenant_id, ws_delivery, '销售赋能资料库', 'sales-enablement', '行业方案、客户案例、报价边界和商机推进方法。', 'published', retrieval_id),
    (kb_delivery, tenant_id, ws_delivery, '项目交付手册', 'delivery-playbook', '项目启动、里程碑、验收、风险和售后交接标准。', 'published', retrieval_id);

  -- Rich, retrieval-ready documents with one chunk each.
  FOREACH doc_id IN ARRAY ARRAY[
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
  ] LOOP
    NULL;
  END LOOP;

  doc_id := gen_random_uuid(); version_id := gen_random_uuid();
  INSERT INTO documents VALUES (doc_id, tenant_id, kb_service, '客户服务分级与响应时限', 's3://enterprise/customer-service-sla.md', 'completed', 'completed', now()-interval '30 days', now()-interval '2 hours', null);
  INSERT INTO document_versions VALUES (version_id, tenant_id, doc_id, 1, md5(doc_id::text), 'markdown', 'completed', now()-interval '30 days', now()-interval '2 hours');
  INSERT INTO document_chunks (tenant_id, document_version_id, chunk_index, content, token_count, metadata_json) VALUES (tenant_id, version_id, 0, '客户问题分为咨询、一般故障、重大故障和安全事件四级。一般咨询应在2个工作小时内首次响应；重大故障需在15分钟内确认并建立专项协同群；安全事件必须立即升级至安全负责人和管理层。', 82, '{"section":"服务等级"}');

  doc_id := gen_random_uuid(); version_id := gen_random_uuid();
  INSERT INTO documents VALUES (doc_id, tenant_id, kb_service, '投诉处理与服务补偿规范', 's3://enterprise/complaint-handling.md', 'completed', 'completed', now()-interval '24 days', now()-interval '1 day', null);
  INSERT INTO document_versions VALUES (version_id, tenant_id, doc_id, 2, md5(doc_id::text), 'markdown', 'completed', now()-interval '24 days', now()-interval '1 day');
  INSERT INTO document_chunks (tenant_id, document_version_id, chunk_index, content, token_count, metadata_json) VALUES (tenant_id, version_id, 0, '投诉受理后先确认事实、影响范围和客户诉求。补偿必须基于服务等级协议和授权额度，不得先行承诺。涉及数据安全、合同违约或媒体风险时，由客户成功负责人联合合规部门处理。', 88, '{"section":"投诉升级"}');

  doc_id := gen_random_uuid(); version_id := gen_random_uuid();
  INSERT INTO documents VALUES (doc_id, tenant_id, kb_product, '企业知识助手产品手册', 's3://enterprise/product-handbook.pdf', 'completed', 'completed', now()-interval '18 days', now()-interval '3 hours', null);
  INSERT INTO document_versions VALUES (version_id, tenant_id, doc_id, 3, md5(doc_id::text), 'pdf', 'completed', now()-interval '18 days', now()-interval '3 hours');
  INSERT INTO document_chunks (tenant_id, document_version_id, chunk_index, content, token_count, metadata_json) VALUES (tenant_id, version_id, 0, '企业知识助手支持文件与网页导入、混合检索、引用回答、智能体执行和工作流监督。标准版适合单团队知识问答，企业版提供多租户治理、模型端点管理、审计和权限控制。', 91, '{"section":"产品概览"}');

  doc_id := gen_random_uuid(); version_id := gen_random_uuid();
  INSERT INTO documents VALUES (doc_id, tenant_id, kb_product, '部署与数据安全常见问题', 'https://docs.example.com/security-faq', 'completed', 'completed', now()-interval '14 days', now()-interval '6 hours', null);
  INSERT INTO document_versions VALUES (version_id, tenant_id, doc_id, 1, md5(doc_id::text), 'web', 'completed', now()-interval '14 days', now()-interval '6 hours');
  INSERT INTO document_chunks (tenant_id, document_version_id, chunk_index, content, token_count, metadata_json) VALUES (tenant_id, version_id, 0, '系统支持私有化部署。文档原文存储在对象存储，结构化元数据保存在 PostgreSQL，向量和关键词索引用于检索。生产环境应启用独立密钥、最小权限、审计日志和定期备份。', 86, '{"section":"安全与部署"}');

  doc_id := gen_random_uuid(); version_id := gen_random_uuid();
  INSERT INTO documents VALUES (doc_id, tenant_id, kb_people, '员工入职与试用期指南', 's3://enterprise/onboarding-guide.docx', 'completed', 'completed', now()-interval '40 days', now()-interval '2 days', null);
  INSERT INTO document_versions VALUES (version_id, tenant_id, doc_id, 1, md5(doc_id::text), 'docx', 'completed', now()-interval '40 days', now()-interval '2 days');
  INSERT INTO document_chunks (tenant_id, document_version_id, chunk_index, content, token_count, metadata_json) VALUES (tenant_id, version_id, 0, '新员工首周完成账号开通、安全培训、岗位目标确认和导师见面。试用期目标由直属主管在入职十个工作日内确认，转正评估包含目标完成度、协作反馈和合规记录。', 78, '{"section":"入职流程"}');

  doc_id := gen_random_uuid(); version_id := gen_random_uuid();
  INSERT INTO documents VALUES (doc_id, tenant_id, kb_people, '差旅与费用报销制度', 's3://enterprise/expense-policy.xlsx', 'completed', 'completed', now()-interval '35 days', now()-interval '4 days', null);
  INSERT INTO document_versions VALUES (version_id, tenant_id, doc_id, 4, md5(doc_id::text), 'xlsx', 'completed', now()-interval '35 days', now()-interval '4 days');
  INSERT INTO document_chunks (tenant_id, document_version_id, chunk_index, content, token_count, metadata_json) VALUES (tenant_id, version_id, 0, '差旅应提前申请并选择协议供应商。报销需在行程结束后十五个自然日内提交，附有效发票和业务说明。超标准住宿、临时改签和客户招待必须补充审批记录。', 80, '{"section":"报销规则"}');

  doc_id := gen_random_uuid(); version_id := gen_random_uuid();
  INSERT INTO documents VALUES (doc_id, tenant_id, kb_sales, '制造业客户数字化方案', 's3://enterprise/manufacturing-solution.pptx', 'completed', 'completed', now()-interval '12 days', now()-interval '8 hours', null);
  INSERT INTO document_versions VALUES (version_id, tenant_id, doc_id, 2, md5(doc_id::text), 'pptx', 'completed', now()-interval '12 days', now()-interval '8 hours');
  INSERT INTO document_chunks (tenant_id, document_version_id, chunk_index, content, token_count, metadata_json) VALUES (tenant_id, version_id, 0, '制造业方案围绕售后知识统一、设备故障排查和服务工单提效展开。项目应先选择高频设备与成熟资料做试点，以回答准确率、首次解决率和平均处理时长作为价值指标。', 84, '{"section":"行业方案"}');

  doc_id := gen_random_uuid(); version_id := gen_random_uuid();
  INSERT INTO documents VALUES (doc_id, tenant_id, kb_sales, '重点客户案例集', 's3://enterprise/customer-cases.pdf', 'completed', 'completed', now()-interval '10 days', now()-interval '1 day', null);
  INSERT INTO document_versions VALUES (version_id, tenant_id, doc_id, 1, md5(doc_id::text), 'pdf', 'completed', now()-interval '10 days', now()-interval '1 day');
  INSERT INTO document_chunks (tenant_id, document_version_id, chunk_index, content, token_count, metadata_json) VALUES (tenant_id, version_id, 0, '某全国服务企业通过统一知识库和引用问答，将新人独立上岗周期从六周缩短至三周，客服首次解决率提升18%。成功关键是知识责任人机制、每月质量复核和失败问题闭环。', 82, '{"section":"客户案例"}');

  doc_id := gen_random_uuid(); version_id := gen_random_uuid();
  INSERT INTO documents VALUES (doc_id, tenant_id, kb_delivery, '项目启动与里程碑模板', 's3://enterprise/project-kickoff.md', 'completed', 'completed', now()-interval '8 days', now()-interval '30 minutes', null);
  INSERT INTO document_versions VALUES (version_id, tenant_id, doc_id, 1, md5(doc_id::text), 'markdown', 'completed', now()-interval '8 days', now()-interval '30 minutes');
  INSERT INTO document_chunks (tenant_id, document_version_id, chunk_index, content, token_count, metadata_json) VALUES (tenant_id, version_id, 0, '项目启动会必须确认目标、范围、角色、里程碑、验收标准和风险升级路径。每个里程碑应有明确交付物、责任人和验收人；范围变化通过变更单评估工期与成本。', 80, '{"section":"项目启动"}');

  doc_id := gen_random_uuid(); version_id := gen_random_uuid();
  INSERT INTO documents VALUES (doc_id, tenant_id, kb_delivery, '上线验收与售后交接清单', 's3://enterprise/go-live-checklist.md', 'running', 'pending', now()-interval '1 day', now()-interval '20 minutes', null);
  INSERT INTO document_versions VALUES (version_id, tenant_id, doc_id, 1, md5(doc_id::text), 'markdown', 'running', now()-interval '1 day', now()-interval '20 minutes');
  INSERT INTO document_chunks (tenant_id, document_version_id, chunk_index, content, token_count, metadata_json) VALUES (tenant_id, version_id, 0, '上线前检查账号权限、数据迁移、备份恢复、监控告警和回滚预案。验收后向售后团队移交系统架构、联系人、已知问题和服务等级。', 69, '{"section":"上线准备"}');

  doc_id := gen_random_uuid(); version_id := gen_random_uuid();
  INSERT INTO documents VALUES (doc_id, tenant_id, kb_delivery, '历史项目风险记录', 's3://enterprise/project-risks.csv', 'failed', 'pending', now()-interval '3 days', now()-interval '5 hours', null);
  INSERT INTO document_versions VALUES (version_id, tenant_id, doc_id, 1, md5(doc_id::text), 'csv', 'failed', now()-interval '3 days', now()-interval '5 hours');

  doc_id := gen_random_uuid();
  INSERT INTO documents VALUES (doc_id, tenant_id, kb_people, '旧版办公用品申请说明', 's3://enterprise/legacy-office-supplies.md', 'completed', 'completed', now()-interval '120 days', now()-interval '60 days', now()-interval '20 days');

  FOR conversation_index IN 1..20 LOOP
    doc_id := gen_random_uuid();
    version_id := gen_random_uuid();
    INSERT INTO documents (id, tenant_id, knowledge_base_id, title, source_uri, ingestion_status, indexing_status, created_at, updated_at)
    VALUES (
      doc_id, tenant_id, kb_service,
      (ARRAY['客服接待标准话术','工单创建与信息采集规范','客户问题优先级判定指南','重大故障应急响应手册','客户投诉受理流程','服务补偿授权标准','客户情绪沟通指南','跨部门问题协同机制','服务升级与管理层通报','客户回访执行规范','服务质量月度复盘模板','高频问题维护指南','客户数据安全事件流程','服务中断公告模板','问题根因分析方法','客户成功交接清单','服务人员值班制度','工单关闭验收标准','客户满意度改进指南','服务知识更新责任制度'])[conversation_index],
      's3://enterprise/customer-service/' || lpad(conversation_index::text, 2, '0') || '-guide.md',
      'completed', 'completed', now() - make_interval(days => 21 - conversation_index), now() - make_interval(hours => conversation_index)
    );
    INSERT INTO document_versions (id, tenant_id, document_id, version_number, content_hash, parser_name, ingestion_status, created_at, updated_at)
    VALUES (version_id, tenant_id, doc_id, 1, md5(doc_id::text), 'markdown', 'completed', now() - make_interval(days => 21 - conversation_index), now() - make_interval(hours => conversation_index));
    INSERT INTO document_chunks (tenant_id, document_version_id, chunk_index, content, token_count, metadata_json)
    VALUES (tenant_id, version_id, 0, '服务人员应确认客户身份、问题现象、影响范围和期望结果，再依据服务等级明确负责人、下一步动作和更新时间。重大故障、数据安全、合同或舆情风险必须立即升级。', 92, jsonb_build_object('section', '客户服务规范'));
  END LOOP;

  -- Conversations and messages across key business scenarios.
  conversation_id := gen_random_uuid();
  INSERT INTO conversations VALUES (conversation_id, tenant_id, ws_customer, kb_service, '重大故障应该如何升级？', admin_user_id, now()-interval '2 days', now()-interval '2 hours');
  INSERT INTO messages (tenant_id, conversation_id, role, content, model_name, created_at) VALUES
    (tenant_id, conversation_id, 'user', '客户反馈生产系统完全不可用，应该如何响应？', null, now()-interval '2 hours 5 minutes'),
    (tenant_id, conversation_id, 'assistant', '这属于重大故障：应在15分钟内确认影响范围，立即建立专项协同群，并同步客户负责人、技术负责人和管理层。处理过程中持续更新恢复进度，恢复后完成复盘。', 'qwen3.5:latest', now()-interval '2 hours');

  conversation_id := gen_random_uuid();
  INSERT INTO conversations VALUES (conversation_id, tenant_id, ws_people, kb_people, '差旅报销需要哪些材料？', admin_user_id, now()-interval '1 day', now()-interval '6 hours');
  INSERT INTO messages (tenant_id, conversation_id, role, content, model_name, created_at) VALUES
    (tenant_id, conversation_id, 'user', '出差回来后多久提交报销，需要什么？', null, now()-interval '6 hours 3 minutes'),
    (tenant_id, conversation_id, 'assistant', '应在行程结束后15个自然日内提交，并附有效发票、业务说明和已批准的差旅申请。若存在超标准住宿或临时改签，还要补充对应审批记录。', 'qwen3.5:latest', now()-interval '6 hours');

  conversation_id := gen_random_uuid();
  INSERT INTO conversations VALUES (conversation_id, tenant_id, ws_delivery, kb_delivery, '项目上线前检查重点', admin_user_id, now()-interval '8 hours', now()-interval '3 hours');
  INSERT INTO messages (tenant_id, conversation_id, role, content, model_name, created_at) VALUES
    (tenant_id, conversation_id, 'user', '下周上线，帮我整理必须确认的事项。', null, now()-interval '3 hours 4 minutes'),
    (tenant_id, conversation_id, 'assistant', '建议按五组核对：账号与权限、数据迁移校验、备份恢复、监控告警、回滚预案；同时明确验收负责人和售后移交清单。', 'qwen3.5:latest', now()-interval '3 hours');

  conversation_id := gen_random_uuid();
  INSERT INTO conversations VALUES (conversation_id, tenant_id, ws_delivery, kb_sales, '制造业客户试点怎么设计？', admin_user_id, now()-interval '5 hours', now()-interval '1 hour');
  INSERT INTO messages (tenant_id, conversation_id, role, content, model_name, created_at) VALUES
    (tenant_id, conversation_id, 'user', '客户希望先做一个月试点，范围怎么控制？', null, now()-interval '1 hour 6 minutes'),
    (tenant_id, conversation_id, 'assistant', '优先选择高频设备和资料成熟的业务线，围绕回答准确率、首次解决率和平均处理时长设定指标。避免首期覆盖全部产品和复杂集成。', 'qwen3.5:latest', now()-interval '1 hour');

  FOR conversation_index IN 1..26 LOOP
    conversation_id := gen_random_uuid();
    INSERT INTO conversations (id, tenant_id, workspace_id, knowledge_base_id, title, created_by_user_id, created_at, updated_at)
    VALUES (
      conversation_id,
      tenant_id,
      CASE conversation_index % 5 WHEN 0 THEN ws_customer WHEN 1 THEN ws_customer WHEN 2 THEN ws_people ELSE ws_delivery END,
      CASE conversation_index % 5 WHEN 0 THEN kb_service WHEN 1 THEN kb_product WHEN 2 THEN kb_people WHEN 3 THEN kb_sales ELSE kb_delivery END,
      CASE conversation_index % 10
        WHEN 0 THEN '客户要求紧急升级应该如何处理？'
        WHEN 1 THEN '产品私有化部署需要哪些条件？'
        WHEN 2 THEN '新员工第一周需要完成什么？'
        WHEN 3 THEN '如何向客户介绍知识助手价值？'
        WHEN 4 THEN '项目范围变更如何审批？'
        WHEN 5 THEN '客户投诉补偿有哪些边界？'
        WHEN 6 THEN '数据安全与权限如何配置？'
        WHEN 7 THEN '费用报销超期应该怎么办？'
        WHEN 8 THEN '销售试点的成功指标是什么？'
        ELSE '上线后如何完成售后交接？'
      END || ' #' || conversation_index,
      admin_user_id,
      now() - make_interval(hours => conversation_index * 3),
      now() - make_interval(hours => conversation_index * 3) + interval '8 minutes'
    );

    INSERT INTO messages (tenant_id, conversation_id, role, content, model_name, created_at) VALUES
      (tenant_id, conversation_id, 'user',
        CASE conversation_index % 10
          WHEN 0 THEN '客户认为问题影响很大并要求管理层介入，应该先做什么？'
          WHEN 1 THEN '客户计划在内网部署，需要提前准备哪些基础设施和安全措施？'
          WHEN 2 THEN '请整理新员工入职首周的关键任务。'
          WHEN 3 THEN '怎样用业务指标说明企业知识助手的价值？'
          WHEN 4 THEN '客户临时增加需求，项目团队应该如何处理？'
          WHEN 5 THEN '客户提出服务补偿时可以直接承诺吗？'
          WHEN 6 THEN '生产环境应该重点配置哪些数据安全能力？'
          WHEN 7 THEN '员工错过十五天报销期限后应该如何补救？'
          WHEN 8 THEN '一个月的销售试点应该关注哪些衡量指标？'
          ELSE '系统上线完成后，需要向售后团队移交哪些内容？'
        END,
        null,
        now() - make_interval(hours => conversation_index * 3)
      ),
      (tenant_id, conversation_id, 'assistant',
        CASE conversation_index % 10
          WHEN 0 THEN '先确认事实、影响范围和客户诉求，再依据事件等级建立协同机制。涉及重大故障、安全或合同风险时，应立即通知对应负责人和管理层。'
          WHEN 1 THEN '需准备容器或 Kubernetes 环境、PostgreSQL、Redis、对象存储、检索服务和模型端点，并落实独立密钥、最小权限、审计日志、备份恢复与网络隔离。'
          WHEN 2 THEN '首周应完成账号开通、安全培训、岗位目标确认、导师见面和必要工具培训；主管应在十个工作日内明确试用期目标。'
          WHEN 3 THEN '建议使用知识维护效率、回答准确率、首次解决率、新人上岗周期和平均处理时长等指标，并在试点前建立可对比的基线。'
          WHEN 4 THEN '新增需求应通过变更单记录，评估对范围、工期、成本和验收的影响，经双方责任人批准后再进入执行计划。'
          WHEN 5 THEN '不能先行承诺。应核对服务等级协议、实际影响和授权额度；涉及合同违约、数据安全或舆情风险时交由客户成功与合规团队联合处理。'
          WHEN 6 THEN '重点配置身份认证、最小权限、传输与存储加密、敏感凭据隔离、审计日志、备份恢复、监控告警和定期权限复核。'
          WHEN 7 THEN '应补充超期原因和直属主管审批，再由财务依据制度判断是否受理；同时确保发票、业务说明和原始差旅申请完整。'
          WHEN 8 THEN '建议关注回答准确率、有效引用率、首次解决率、平均处理时长和用户采用率，试点范围应选择资料成熟且问题高频的业务线。'
          ELSE '应移交系统架构、账号权限、部署配置、联系人、服务等级、监控告警、备份恢复、已知问题和未完成事项，并完成双方签字确认。'
        END,
        'qwen3.5:latest',
        now() - make_interval(hours => conversation_index * 3) + interval '8 minutes'
      );
  END LOOP;

  INSERT INTO agent_definitions (tenant_id, name, slug, agent_mode, agent_status, model_strategy, objective, instructions, knowledge_base_scope, tool_bindings_json, model_endpoint_id, tool_registration_ids_json) VALUES
    (tenant_id,'客户投诉协调员','complaint-coordinator','grounded_chat','active','local_reserved','识别投诉风险并给出分级、升级和补偿建议。','先确认事实与影响，不越权承诺补偿；高风险事项必须升级。','customer-operations/customer-service','["chat","documents"]',model_id,jsonb_build_array(tool_search)),
    (tenant_id,'服务质量分析师','service-quality-analyst','grounded_chat','active','local_reserved','从服务制度中提炼质量标准和改进建议。','回答必须给出适用条件、衡量指标和建议复核动作。','customer-operations/customer-service','["chat"]',model_id,jsonb_build_array(tool_search)),
    (tenant_id,'产品方案顾问','product-solution-advisor','grounded_chat','active','local_reserved','根据客户场景匹配产品能力与部署方案。','区分标准能力和定制需求，不承诺未发布功能。','customer-operations/products-solutions','["chat","documents"]',model_id,jsonb_build_array(tool_search)),
    (tenant_id,'安全问答助手','security-faq-assistant','grounded_chat','paused','local_reserved','回答部署、权限、数据保护和审计相关问题。','安全问题采用保守口径，并提示由安全负责人最终确认。','customer-operations/products-solutions','["chat"]',model_id,jsonb_build_array(tool_search)),
    (tenant_id,'新员工入职助手','onboarding-assistant','grounded_chat','active','local_reserved','指导新员工完成首周任务和试用期准备。','提供步骤清单，不替代直属主管和人力资源审批。','people-operations/employee-handbook','["chat","documents"]',model_id,jsonb_build_array(tool_search)),
    (tenant_id,'费用制度助手','expense-policy-assistant','grounded_chat','active','local_reserved','解答差旅、发票和费用报销问题。','明确时限、材料和例外审批要求。','people-operations/employee-handbook','["chat"]',model_id,jsonb_build_array(tool_search)),
    (tenant_id,'员工培训策划师','employee-training-planner','document_intake','draft','local_reserved','根据岗位知识规划培训主题和学习材料。','先检查资料完整性，再输出分阶段培训计划。','people-operations/employee-handbook','["documents"]',model_id,jsonb_build_array(tool_docs)),
    (tenant_id,'销售提案助手','sales-proposal-assistant','grounded_chat','active','local_reserved','整理客户需求并生成有依据的销售提案框架。','引用产品和案例资料，避免未经授权的价格与交付承诺。','sales-delivery/sales-enablement','["chat","documents"]',model_id,jsonb_build_array(tool_search)),
    (tenant_id,'客户案例检索员','customer-case-researcher','grounded_chat','active','local_reserved','快速匹配行业案例、价值指标和成功条件。','优先选择行业和业务目标相近的案例，并说明差异。','sales-delivery/sales-enablement','["chat"]',model_id,jsonb_build_array(tool_search)),
    (tenant_id,'商机资格评估员','opportunity-qualifier','grounded_chat','draft','local_reserved','评估客户需求、预算、决策链和试点成熟度。','输出事实、缺失信息、风险和下一步验证问题。','sales-delivery/sales-enablement','["chat"]',model_id,jsonb_build_array(tool_search)),
    (tenant_id,'项目启动教练','project-kickoff-coach','grounded_chat','active','local_reserved','帮助项目经理准备启动会、角色和里程碑。','确保目标、范围、责任、验收和升级路径完整。','sales-delivery/delivery-playbook','["chat","documents"]',model_id,jsonb_build_array(tool_search)),
    (tenant_id,'交付风险检查员','delivery-risk-inspector','workflow_recovery','active','local_reserved','识别项目范围、进度、质量和依赖风险。','每项风险必须给出影响、责任人、截止时间和升级条件。','sales-delivery/delivery-playbook','["operations","documents"]',model_id,jsonb_build_array(tool_workflow,tool_docs)),
    (tenant_id,'上线验收助手','go-live-reviewer','document_intake','active','local_reserved','检查上线、验收和售后交接材料是否完整。','按权限、迁移、备份、监控、回滚和移交逐项检查。','sales-delivery/delivery-playbook','["documents","operations"]',model_id,jsonb_build_array(tool_docs,tool_workflow)),
    (tenant_id,'失败任务恢复员','failed-run-recovery-agent','workflow_recovery','active','local_reserved','诊断失败工作流并提出受控恢复步骤。','先识别根因和源数据状态，再决定重试、修复或关闭。','sales-delivery/delivery-playbook','["operations","documents"]',model_id,jsonb_build_array(tool_workflow,tool_docs)),
    (tenant_id,'知识库巡检员','knowledge-base-auditor','document_intake','paused','local_reserved','巡检知识新鲜度、重复内容和索引健康度。','标记过期与冲突内容，提交责任人复核后再更新。','customer-operations/customer-service','["documents","operations"]',model_id,jsonb_build_array(tool_docs,tool_workflow));

  -- Completed, running and failed workflows populate operational lanes.
  run_id := gen_random_uuid();
  INSERT INTO workflow_runs (id, tenant_id, workflow_type, workflow_status, temporal_workflow_id, subject_type, subject_id, input_json, started_at, completed_at, created_at, updated_at, operator_notes) VALUES
    (run_id, tenant_id, 'document_ingestion', 'completed', 'seed-completed-001', 'knowledge_base', kb_product, '{"source":"product handbook"}', now()-interval '3 hours', now()-interval '2 hours 56 minutes', now()-interval '3 hours', now()-interval '2 hours 56 minutes', '产品手册已完成接入和索引。');
  INSERT INTO workflow_steps (tenant_id, workflow_run_id, step_name, step_status, attempt_count, started_at, completed_at) VALUES
    (tenant_id, run_id, 'parse_document', 'completed', 1, now()-interval '3 hours', now()-interval '2 hours 59 minutes'),
    (tenant_id, run_id, 'build_index', 'completed', 1, now()-interval '2 hours 59 minutes', now()-interval '2 hours 56 minutes');

  run_id := gen_random_uuid();
  INSERT INTO workflow_runs (id, tenant_id, workflow_type, workflow_status, temporal_workflow_id, subject_type, subject_id, input_json, started_at, created_at, updated_at, operator_notes) VALUES
    (run_id, tenant_id, 'document_ingestion', 'running', 'seed-running-001', 'knowledge_base', kb_delivery, '{"source":"go-live checklist"}', now()-interval '20 minutes', now()-interval '22 minutes', now()-interval '2 minutes', '正在解析上线验收资料。');
  INSERT INTO workflow_steps (tenant_id, workflow_run_id, step_name, step_status, attempt_count, started_at) VALUES
    (tenant_id, run_id, 'parse_document', 'running', 1, now()-interval '20 minutes'),
    (tenant_id, run_id, 'build_index', 'pending', 0, null);

  run_id := gen_random_uuid();
  INSERT INTO workflow_runs (id, tenant_id, workflow_type, workflow_status, temporal_workflow_id, subject_type, subject_id, input_json, error_message, started_at, completed_at, created_at, updated_at, operator_notes) VALUES
    (run_id, tenant_id, 'document_ingestion', 'failed', 'seed-failed-001', 'knowledge_base', kb_delivery, '{"source":"project risks csv"}', 'CSV 文件存在不一致的列数，请修复第 18 行后重新上传。', now()-interval '5 hours', now()-interval '4 hours 58 minutes', now()-interval '5 hours', now()-interval '4 hours 58 minutes', '等待业务团队修复源文件。');
  INSERT INTO workflow_steps (tenant_id, workflow_run_id, step_name, step_status, attempt_count, error_message, started_at, completed_at) VALUES
    (tenant_id, run_id, 'parse_document', 'failed', 2, '第 18 行字段数量与表头不一致。', now()-interval '5 hours', now()-interval '4 hours 58 minutes');
END $$;

COMMIT;
