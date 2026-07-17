# RAGPilot

语言：[English](./README.md) | 简体中文

[![CI](https://github.com/huangheng-dev/RAGPilot/actions/workflows/ci.yml/badge.svg)](https://github.com/huangheng-dev/RAGPilot/actions/workflows/ci.yml)
[![Release Readiness](https://github.com/huangheng-dev/RAGPilot/actions/workflows/release-readiness.yml/badge.svg)](https://github.com/huangheng-dev/RAGPilot/actions/workflows/release-readiness.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)

RAGPilot 是一个用于构建和运营受治理检索增强生成系统的开源平台，在同一产品中连接知识接入、权限感知混合检索、带引用的 Chat、受约束 Agent、持久化工作流和运行管理。

授权、溯源、可恢复性、评估和可观测性是运行时设计的一部分，而不是后置补充。Web 控制台、API、Worker、持久化模型、部署资产和发布门禁在一个版本化 monorepo 中协同演进。

## 为什么选择 RAGPilot

- **受治理的知识生命周期：** 数据源、文档、不可变版本、Chunk、Embedding、索引状态、同步游标、租约和恢复历史均持久化并可运营。
- **检索内部授权：** 在检索候选集边界执行租户、工作空间、知识库、文档和 Chunk 权限，包括对 Elasticsearch 候选结果进行 PostgreSQL 再授权。
- **受约束的 Agent 执行：** 批准工具、不可变执行快照、部署上限预算、可选 JSON Schema 结果契约、审批、取消、重试和重放均可审计。
- **持久化运行：** Temporal 负责长时间摄取、数据源同步和 Agent 执行状态，后台工作不会隐藏在 HTTP 请求中。
- **可度量质量：** 版本化检索数据集、证据校验、Prompt 绑定、引用、Trace 和发布门禁使运行变更可复核。

## 端到端链路

```text
租户与身份范围
-> 工作空间与知识库
-> 数据源登记
-> 持久化摄取与搜索投影
-> 授权检索与证据校验
-> Grounded Chat 或受约束 Agent 任务
-> 运营复核、恢复与评估
```

## 产品界面

- `Home`：近期活动、当前范围和工作入口
- `Chat`：流式可追溯回答、引用、反馈和会话历史
- `Documents`：文件与单页 Web 接入、数据源、索引、生命周期和恢复
- `Agents`：受治理定义、模型与工具绑定、执行约束、审批和重放
- `Access Control`：租户访问组，以及文档与 Chunk 的用户/组授权
- `Admin`：租户、工作空间、知识库、成员、模型、工具、连接器和检索治理
- `Operations`：工作流与 Agent 执行队列、失败、重试、取消、谱系和诊断
- `Settings`：资料、密码、活动会话和个人安全操作

## 平台能力

### 知识与检索

- 多文件上传和持久化数据源登记
- 版本化 `public_web_v1` 单页同步，支持条件请求状态、数据库租约、Temporal 编排、SSRF 防护和权威删除处理
- 支持文本、结构化数据、PDF、DOCX、XLSX 和图片格式的解析与标准化
- 面向扫描 PDF 和受支持独立图片的受治理 OCR
- pgvector 语义召回、Elasticsearch BM25 召回和 PostgreSQL 词法降级
- 受治理融合、Rerank、上下文组装和检索诊断
- 在候选检索过程中执行文档与 Chunk 用户/组授权
- 版本化检索评估契约，覆盖排序、隔离、禁止内容、Groundedness、引用、延迟和成本
- 使用实际框架运行时的 Native/LlamaIndex 对比门禁，以及 Native/LangGraph 分支契约门禁

### Chat 与 Prompt 历史

- 可持久化、搜索、重命名和删除的会话
- Ollama 与 OpenAI 兼容运行时的原生 SSE 增量输出
- 明确的完成结果分块降级和断连取消
- 最终消息、引用、反馈、用量证据和流式模式持久化
- 引用按参考文件聚合，并可直接进入所选文档详情
- 默认使用提问语言生成回答，中文问题执行明确的简体中文回答策略
- Chat 与 Agent 历史绑定不可变 Prompt 版本和渲染快照哈希

### Agent、工具与工作流

- 持久化 Agent 定义、范围化启动、持久化执行和评估摘要
- 原生、HTTP 和 MCP 工具统一经过策略执行运行时
- 受部署策略上限约束的工具调用、运行时间和输出大小预算
- 不可变 Agent 定义与允许工具沙箱快照
- 可选 JSON Schema 终态结果校验
- 持久化审批、取消、重试、重放谱系和重放指纹
- 工作流运行、步骤、事件、备注、队列指标和运营恢复操作

### 身份、治理与可观测性

- 后端签发 Session、本地密码认证、邀请激活、密码修改/重置和会话撤销
- 租户成员、角色能力、工作空间/知识库范围、访问组和访问事件历史
- 租户级平台 API Key，支持密钥仅展示一次、仅存哈希、权限范围、到期、撤销、使用记录和审计事件
- 加密运行时凭据，以及受治理的模型、检索、工具和 MCP 记录
- 基于 Redis 的跨实例模型与 MCP 并发/频率限制
- W3C Trace Context 跨 API、Temporal、Worker、检索、模型、Agent、工具、MCP、Embedding 和 Elasticsearch 传播
- 隐私安全结构化日志、指标、Trace、仪表盘和告警基线

## 运行栈与集成

核心运行组件：

| 组件 | 职责 |
| --- | --- |
| Next.js | Web 产品和运营界面 |
| FastAPI | HTTP 契约、授权和领域编排 |
| PostgreSQL / pgvector | 业务事实源和语义检索 |
| Temporal | 持久化工作流与 Agent 执行历史 |
| Elasticsearch | 可重建词法/搜索投影和 BM25 召回 |
| Redis | 分布式运行限制和临时协调 |
| MinIO | 原始和派生文档资产 |
| OpenTelemetry 栈 | 关联日志、指标、Trace 和诊断 |

已启用集成路径：

- 原生 Ollama Chat
- OpenAI 兼容 Chat 与 Embedding，包括受治理的 vLLM 兼容端点
- Streamable HTTP MCP 客户端发现、工具映射和 Agent 调用
- 通过范围化 API 权限提供知识搜索、文档检查和工作流检查的只读 `stdio` MCP 服务

框架集成路径：

- `LlamaIndex` 接收已经过权限过滤的原生候选结果，执行官方相似度与长上下文处理，再通过 PostgreSQL 策略复核最终 Chunk，并记录对比证据
- `LangGraph` 在 Temporal 持久化 Agent 执行内部运行有类型约束的文档接入与工作流恢复决策图，记录分支、校验结果和节点耗时

检索与 Agent 默认均为 `native`，但“依赖可用”不等于“运行时启用”。知识库实际生效的 Retrieval Profile 持久化选择 `native` 或 `llamaindex_pilot` 及其处理策略；Agent 定义持久化选择 `native` 或 `langgraph_pilot` 及其版本，每次执行保存不可变运行快照。环境变量只为旧记录或未分配策略提供部署级降级值。生产全能力镜像安装两种适配器，运行时治理会在策略启用前检查 API 与 Agent Worker 是否具备一致能力。

## 适用范围与部署边界

- 内置 Web 连接器按数据源同步一个公开页面，其定位不是全站爬虫
- OCR 面向扫描 PDF 和列出的独立图片格式，复杂版面和表格重建效果取决于具体格式
- 项目包含本地密码认证；选择外部身份提供商的部署需完成并验证回调、声明映射和运营策略
- Kubernetes 清单提供面向生产的交付基线，仍需配置环境专属镜像、Secret、依赖并完成验证
- 其他 Rerank 和框架路径只有在版本化评估证明收益后才会提升为默认能力

准确实现状态见[项目现状](./docs/product/project-snapshot.md)，长期架构规则见[项目蓝图](./docs/product/project-blueprint.md)，优先演进方向见[路线图](./docs/planning/roadmap.md)。

## 本地开发

环境要求：

- Node.js 20 或更高版本及 npm
- Python 3.10 或更高版本
- Docker Desktop 或兼容的 Docker Compose 环境
- 执行非确定性模型时，可选配置 Ollama 或 OpenAI 兼容端点

1. 复制 `.env.example` 为 `.env`，并在共享环境使用前替换开发凭据。
2. 安装仓库依赖：

```bash
npm install
```

3. 启动本地稳定模式：

```bash
npm run stable:mode:up
```

稳定模式将基础依赖保留在 Docker 中，通过托管宿主进程运行 Web 和 API。RAGPilot 不发布通用生产账号或密码；身份、Secret、模型端点和运行时凭据由各环境自行配置。

默认本地地址可通过 `.env` 调整：

- Web：`http://localhost:3000`
- API：`http://localhost:8000`
- Temporal UI：`http://localhost:8080`
- Temporal gRPC：`localhost:7233`
- PostgreSQL：`localhost:5432`
- Redis：`localhost:6379`
- Elasticsearch：`http://localhost:9200`
- MinIO API：`http://localhost:9000`
- MinIO Console：`http://localhost:9001`

以上是仓库默认值。如果宿主端口已被其他程序占用，只需在 `.env` 中覆盖对应的 `RAGPILOT_*_PORT`；容器内部服务端口保持不变。

完整容器验证：

```bash
npm run compose:up:detached
```

详细安装、迁移、验证和故障排查说明见 [Local Development Runbook](./docs/runbooks/local-development.md)。

## 生产部署

RAGPilot 提供面向生产交付的基线：

- Web、API、Document Worker 和 Agent Worker 的可复现生产容器定义：提交 Node/Python 依赖锁并按摘要固定基础镜像
- PR 镜像构建，以及由版本标签触发的多架构 GHCR 发布、SBOM、来源证明和 Cosign 无密钥签名
- 包含数据库迁移 Job、探针、资源、Ingress、滚动更新/中断/拓扑控制、受限运行身份和外部 Secret 集成的 Kubernetes 清单
- [`.env.production.example`](./.env.production.example) 生产环境模板
- OpenTelemetry、Prometheus、Tempo、Grafana、仪表盘和告警配置
- 版本化容量契约及受保护的 staging 执行工作流，以及 [`infra/scripts`](./infra/scripts) 下的发布、备份恢复、可靠性和推送辅助脚本

部署方仍需选择并闭环身份模式，提供真实镜像与 Secret，配置可信来源和托管依赖，验证迁移和模型连通性，并在目标环境完成备份恢复、容量、遥测保留、事件响应和灾难恢复演练。

参见 [Kubernetes Deployment Baseline](./infra/k8s/README.md) 和 [Production Reliability Runbook](./docs/runbooks/production-reliability.md)。

## 发布流程

正式打标或发布前运行统一门禁：

```bash
npm run release:status
npm run release:preflight
```

预检覆盖：

- 公开文档和 Markdown 链接
- Web lint、类型安全和生产构建
- Node 生产依赖策略
- Python 解析锁与容器依赖锁同步性
- API、Worker 测试和迁移完整性
- 确定性与真实数据库检索回归门禁
- MCP 构建和协议测试
- 覆盖登录、范围化上传、Temporal 摄取、检索、流式 Chat、引用、反馈持久化、会话安全和双语控件的浏览器 E2E
- 发布镜像配置、公开交付资产和常见密钥泄漏模式

API 路由和 ORM 数据表文档还会与实际 FastAPI、SQLAlchemy 契约进行自动核对。

## 文档

除中文技术文档入口外，以下技术与治理文档目前以英文正文为权威版本。

- [技术文档](./docs/README.zh-CN.md)
- [项目现状](./docs/product/project-snapshot.md)
- [项目蓝图](./docs/product/project-blueprint.md)
- [系统概览](./docs/architecture/system-overview.md)
- [API 概览](./docs/api/api-outline.md)
- [路线图](./docs/planning/roadmap.md)
- [贡献指南](./CONTRIBUTING.md)
- [安全策略](./SECURITY.md)
- [更新记录](./CHANGELOG.md)

## 开源协议

RAGPilot 使用 [Apache-2.0](./LICENSE) 协议。
