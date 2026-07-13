# RAGPilot

语言：[English](./README.md) | 简体中文

RAGPilot 是一个面向生产场景的开源 AI 知识运营平台，用于把知识接入、检索增强问答、智能体执行、工作流监督和平台治理统一到一个系统中。

它不是一个孤立的聊天演示项目，而是围绕真实业务流程设计的平台型系统。RAGPilot 将知识资产、文档处理、检索诊断、可追溯回答、长流程执行、模型治理和运营控制台组合成一条完整的产品链路。

当前版本已经形成从知识范围选择、内容接入、受治理问答到运行跟进的完整操作闭环。Web 控制台、API、Worker、持久化层、运行时控制、部署资产和发布检查作为同一个版本化产品统一维护。

## 核心能力

- 带引用来源的检索增强问答和持久化会话历史
- 文件资产和 URL 单页内容导入的知识接入能力
- 文档上传、解析、切片、索引、重建、生命周期管理和失败恢复
- 基于队列、重试、谱系追踪和运营跟进的持久化工作流
- 带运行边界、工具约束和治理视图的智能体管理
- 面向租户、工作空间、知识库和成员的多范围治理
- 模型、检索、工具和运行时凭据的统一控制面
- 英文优先的工程结构，并提供简体中文界面支持

## 产品模块

RAGPilot 的可见产品界面保持克制，优先服务核心操作链路：

- `Home`：查看近期对话、文档和智能体概览
- `Chat`：基于知识库进行带来源追溯的问答
- `Documents`：按知识库管理多文件或网页接入、索引和生命周期
- `Agents`：管理受治理的智能体定义、模型和工具绑定、执行入口与复核
- `Admin`：管理租户目录、工作空间、知识库、成员、访问和运行时治理
- `Operations`：查看全局工作流、任务队列、重试、取消和运行详情
- `Settings`：管理个人资料、活动会话和登录密码

## 核心流程

```text
Tenant
-> Workspace
-> Knowledge Base
-> Source Registration
-> Document Ingestion
-> Durable Workflow Execution
-> Retrieval Validation
-> Grounded Chat or Agent Task
-> Operational Follow-up and Governance
```

## 知识接入

RAGPilot 将知识接入视为一个可治理的生命周期：

```text
Source
-> Ingest
-> Parse
-> Chunk
-> Index
-> Retrieve
-> Validate
-> Rebuild or Archive
```

主要能力包括：

- 文档上传和来源登记
- URL 单页内容导入
- 内容解析、标准化、切片和向量化
- 向量索引和关键词索引
- 文档版本、重建、状态跟踪和失败恢复

## 检索与问答

- 结合语义信号和关键词信号的混合检索
- Rerank 和上下文组装
- 回答来源引用和可解释追溯
- 可搜索、可重命名和可删除的持久化会话历史
- 工作空间和知识库级别的知识范围选择
- 对问候等轻量会话意图直接响应，避免无关知识检索

## 智能体与工作流

RAGPilot 中的智能体是受治理的任务执行器，而不是无限制的自治脚本。智能体需要在明确的知识范围、批准的工具、可追踪的步骤和可审查的输出之内运行。

相关能力包括：

- 智能体定义管理
- 长流程任务执行和恢复
- 检索、工具和任务步骤之间的结构化运行交接
- 面向运营人员的重试、取消、谱系和结果审查

## 治理与运行控制

- 租户和工作空间范围隔离
- 成员邀请、激活和访问审查
- 本地目录、密码本地模式、OIDC、SAML 等认证模式边界
- 检索配置和模型端点治理
- 原生工具、HTTP 工具和 MCP 方向集成的工具清单管理
- 运行时凭据、连接器和绑定治理，避免暴露原始密钥

## 技术架构

RAGPilot 使用多服务 monorepo 结构：

```text
RAGPilot/
  apps/
    web/
    api/
    worker/
    mcp-server/
  packages/
    shared-types/
    prompts/
    evals/
  infra/
    docker/
    k8s/
    otel/
```

## 技术栈

- `Next.js`
- `FastAPI`
- `Temporal`
- `PostgreSQL`
- `pgvector`
- `Elasticsearch`
- `Redis`
- `MinIO`
- `OpenTelemetry`

## 集成层

RAGPilot 包含以下受治理的集成路径：

- `Ollama`
- `vLLM`
- `LlamaIndex` 检索运行通道
- `LangGraph` 智能体运行通道
- `MCP` 兼容的外部工具连接边界

这些集成都位于明确的运行时选择、配置和治理边界之后。

## 本地开发

环境要求：

- Node.js 与 npm
- Python 3.11 或更高版本
- Docker Desktop 或兼容的 Docker Compose 环境
- 使用非确定性模型时，可选配置 Ollama 或 OpenAI 兼容模型端点

1. 复制 `.env.example` 为 `.env`，在共享或生产环境使用前替换开发凭据。
2. 执行 `npm install` 安装仓库依赖。
3. 启动本地稳定模式：

```bash
npm run stable:mode:up
```

RAGPilot 不发布默认生产账号或密码。不同环境需要自行配置认证用户、Secret、模型端点和运行时凭据。

默认本地地址：

- Web: `http://localhost:3001`
- API: `http://localhost:18000`
- Temporal UI: `http://localhost:8081`
- Temporal gRPC: `localhost:7234`
- PostgreSQL: `localhost:5433`
- Redis: `localhost:6380`
- Elasticsearch: `http://localhost:9201`
- MinIO API: `http://localhost:9002`
- MinIO Console: `http://localhost:9003`

完整容器验证：

```bash
npm run compose:up:detached
```

仅检查前端：

```bash
npm install
npm run web:serve
```

## 生产部署

RAGPilot 提供面向生产交付的基础文件。部署方仍需根据自身环境完成安全加固、Secret 管理、备份、可观测数据保留、容量规划和灾难恢复。

- `web`、`api`、`worker` 容器镜像构建文件
- Kubernetes 基线清单：[infra/k8s](./infra/k8s)
- 生产环境变量模板：[.env.production.example](./.env.production.example)
- 发布验证和发布辅助脚本：[infra/scripts](./infra/scripts)

默认生产拓扑：

```text
Ingress
-> Web
-> API
-> Worker
-> PostgreSQL / Redis / MinIO / Elasticsearch / Temporal
```

Kubernetes 部署前需要：

1. 基于 [infra/k8s/secret.example.yaml](./infra/k8s/secret.example.yaml) 准备私有 Secret
2. 替换 `ghcr.io/your-org/ragpilot-api:0.1.0` 等占位镜像
3. 将 [infra/k8s/configmap.yaml](./infra/k8s/configmap.yaml) 指向真实依赖服务
4. 通过 [infra/k8s/kustomization.yaml](./infra/k8s/kustomization.yaml) 应用清单

对公网开放前，应配置可信来源、替换所有模板 Secret、创建认证身份、验证模型端点连通性、执行数据库迁移，并运行发布预检。

## 发布质量

发布门禁覆盖公开文档、Markdown 链接、前端 lint 与类型安全、优化生产构建、API 测试、登录后的核心页面浏览器验收、部署资产和常见密钥泄漏模式，用于确保产品行为、文档与部署配置在正式打标前保持一致。

## 发布检查

RAGPilot 使用统一的发布预检：

```bash
npm run release:status
npm run release:preflight
```

预检会覆盖：

- 公开根文档
- Markdown 链接
- Web 构建
- API 测试
- 公开候选文件集合
- 生产交付资产
- 基础密钥泄漏模式

## 开源文档

- 贡献指南：[CONTRIBUTING.md](./CONTRIBUTING.md)
- 安全策略：[SECURITY.md](./SECURITY.md)
- 更新记录：[CHANGELOG.md](./CHANGELOG.md)

## 开源协议

RAGPilot 使用 [Apache-2.0](./LICENSE) 协议。
