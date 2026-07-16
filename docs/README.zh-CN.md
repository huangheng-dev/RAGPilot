# RAGPilot 技术文档

语言：[English](./README.md) | 简体中文

本目录存放随 RAGPilot 代码版本化维护的公开技术文档。根目录 [README](../README.zh-CN.md) 负责介绍产品；这里分别说明已验证行为、长期架构、运营流程和优先演进方向，避免形成互相竞争的事实来源。除已有中文入口外，当前链接的技术与治理正文以英文版本为权威来源；中文标签用于导航，不代表目标文档已经完成全文翻译。

## 文档权威边界

| 文档 | 负责内容 | 不负责内容 |
| --- | --- | --- |
| [项目现状](./product/project-snapshot.md) | 已验证产品行为和当前范围 | 未来优先级或实现历史 |
| [项目蓝图](./product/project-blueprint.md) | 长期产品原则和目标架构 | 当前完成状态 |
| [路线图](./planning/roadmap.md) | 工程演进优先级 | 当前能力事实 |
| [系统概览](./architecture/system-overview.md) | 已落地运行边界和链路 | 产品待办 |
| [API 概览](./api/api-outline.md) | 当前 HTTP 契约分组 | 推测性接口 |
| [平台数据模型](./architecture/platform-data-model.md) | 当前持久化聚合与关系 | 候选数据表 |
| [更新记录](../CHANGELOG.md) | 发布历史和重要变更 | 架构权威定义 |

发布验证会将接口和数据表清单与 FastAPI、SQLAlchemy 契约自动核对。

## 目录说明

| 目录 | 内容 |
| --- | --- |
| `product/` | 产品定位、已验证范围和长期蓝图 |
| `architecture/` | 系统拓扑、数据模型、仓库结构和命名规则 |
| `api/` | 面向集成的 HTTP 契约摘要 |
| `planning/` | 当前工程演进与推进顺序 |
| `runbooks/` | 本地开发、部署验证、运行维护和故障排查 |

敏感或组织专属材料只能放入 Git 忽略的 `docs/internal/` 或 `docs/private/` 目录。

## 阅读路径

快速了解项目：

1. [根目录 README](../README.zh-CN.md)
2. [项目现状](./product/project-snapshot.md)
3. [系统概览](./architecture/system-overview.md)

架构与扩展开发：

1. [项目蓝图](./product/project-blueprint.md)
2. [仓库结构](./architecture/repository-structure.md)
3. [平台数据模型](./architecture/platform-data-model.md)
4. [API 概览](./api/api-outline.md)
5. [命名规范](./architecture/naming-conventions.md)

运行与交付：

1. [本地开发手册](./runbooks/local-development.md)
2. [生产可靠性手册](./runbooks/production-reliability.md)
3. [Kubernetes 部署基线](../infra/k8s/README.md)
4. [路线图](./planning/roadmap.md)

## 维护规则

- 优先更新权威文档，不新建第二份状态或架构说明。
- 已实现行为写入项目现状，优先演进方向写入路线图。
- 代码与验证完成前，不把接口、数据表或能力描述为当前事实。
- 文件名使用小写 `kebab-case`，`README` 只用于目录索引。
- 稳定文档应从本索引或相关上级文档链接。
- 阶段性计划的长期结论合并后，应删除已失效文件。
