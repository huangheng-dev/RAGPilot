# RAGPilot 文档索引

语言：[English](./README.md) | 简体中文

## 目的

这个索引用于定义 RAGPilot 稳定的项目文档结构，并为贡献者和运维人员提供随代码版本化维护的权威文档入口。

目标是：

- 保持 Markdown 文件组织清晰
- 保持文件夹名称稳定
- 让新增文档有明确归属
- 防止产品方向和实现说明分散

文档权威边界保持精简：

- `product/project-blueprint.md` 负责目标架构和长期边界
- `product/project-snapshot.md` 负责当前已实现事实
- `planning/roadmap.md` 负责尚未完成的工作

发布规则：

- 根目录 Markdown 文件提供项目概览、贡献、安全和发布记录入口
- `docs/` 是随代码一同版本化和评审的公开技术文档层
- 敏感或组织专属内容只能放入 Git 忽略的 `docs/internal/` 或 `docs/private/` 目录

## 文件夹结构

```text
docs/
  api/
  architecture/
  planning/
  product/
  runbooks/
```

## 当前文档集合

### `docs/product`

用于：

- 产品方向
- 范围边界
- 实施阶段
- 产品决策参考

当前文件：

- `project-blueprint.md`
- `project-snapshot.md`

### `docs/architecture`

用于：

- 仓库结构
- 命名规则
- 系统设计
- 数据模型方向

当前文件：

- `naming-conventions.md`
- `platform-data-model.md`
- `repository-structure.md`
- `system-overview.md`

### `docs/api`

用于：

- HTTP API 概览
- 接口分组参考
- 契约级摘要
- 面向集成的 API 说明

当前文件：

- `api-outline.md`

### `docs/planning`

用于：

- 路线图
- 近期交付优先级
- 阶段进度追踪
- 推进顺序说明

当前文件：

- `roadmap.md`

### `docs/runbooks`

用于：

- 本地启动
- 运维流程
- 维护说明
- 故障排查

当前文件：

- `local-development.md`
- `production-reliability.md`

## 当前覆盖范围

当前文档集合按不同权威层级覆盖 RAGPilot 实时平台：

- 已交付的 Home、Chat、Documents、Agents、Access Control、Operations、Settings、Admin、Login 和兼容 Workspace 界面；
- 租户、工作空间、知识库、数据源、文档、访问控制、检索、Chat、工作流、Agent、模型、工具、MCP、Prompt 和 API Key 契约；
- 持久化摄取、增量数据源同步、搜索投影、Agent 执行、审批、取消、重试和重放行为；
- Docker、Kubernetes、可观测性、迁移、本地开发、可靠性和发布验证流程；
- 目标架构、已实现行为和尚未完成工作的明确分工。

根目录 README 是公开介绍，不是第二份技术规格。路由和数据表清单通过自动测试与代码保持一致。

## Markdown 命名规则

所有 Markdown 文件应遵循：

- 使用小写
- 使用 `kebab-case`
- 使用明确名称
- 尽量保持领域优先命名
- 根目录和文件夹级 `README` 语言索引文件是唯一命名例外

推荐模式：

- `<domain>-blueprint.md`
- `<domain>-reference.md`
- `<domain>-overview.md`
- `<domain>-structure.md`
- `<scope>-development.md`

避免：

- `notes.md`
- `misc.md`
- `temp.md`
- `draft.md`
- `new-file.md`

## 文档决策规则

新增 Markdown 文件前：

1. 判断它属于产品、架构、API、规划还是 runbook
2. 放到正确文件夹
3. 使用清晰的 `kebab-case` 文件名
4. 当它成为稳定文档后，从上级索引或 README 中链接它

## 建议阅读顺序

最快理解整个项目，建议从这里开始：

1. [Project Snapshot](./product/project-snapshot.md)
2. [Project Blueprint](./product/project-blueprint.md)
3. [Roadmap](./planning/roadmap.md)
4. [System Overview](./architecture/system-overview.md)
5. [API Outline](./api/api-outline.md)
6. [Platform Data Model](./architecture/platform-data-model.md)
7. [Local Development Runbook](./runbooks/local-development.md)
8. [Production Reliability Runbook](./runbooks/production-reliability.md)

查看系统边界时阅读：

- [Repository Structure](./architecture/repository-structure.md)
- [Naming Conventions](./architecture/naming-conventions.md)
