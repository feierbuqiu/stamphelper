# 贴票助手（StampHelper）

[English](README.md)

[![CI](https://github.com/feierbuqiu/stamphelper/actions/workflows/ci.yml/badge.svg)](https://github.com/feierbuqiu/stamphelper/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/feierbuqiu/stamphelper)](https://github.com/feierbuqiu/stamphelper/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

贴票助手是一个隐私优先、纯静态的中国邮政邮资计算器和有限库存邮票组合优化器，面向可在普遍服务柜台受理的贴票业务。算法优先寻找邮资完全相等且张数最少的方案；无法精确组合时，再依次最小化超额金额和邮票张数。

**在线版本：** [stamphelper-cn.feierbuqiu.uk](https://stamphelper-cn.feierbuqiu.uk/)

![贴票助手预览图](public/og-postage.png)

## 功能特点

- 覆盖内地、港澳台和国际方向的静态邮资与柜台业务组合。
- 国家或地区支持简体中文、拼音、简拼、英文、ISO 代码、国际区号、常用简称和部分本土拉丁字母名称检索。
- 金额全程使用整数“分”，避免浮点金额误差。
- 支持有限／足量库存、自定义 0.01–200.00 元纪特邮票、精确优先和最少张数优化。
- 求解器运行在 Web Worker；普通快速重算保留旧结果，不再闪烁或跳动。
- 库存、自定义面额和主题只保存在本机 `localStorage` 与 IndexedDB；没有账号、统计分析、数据库或应用后端。
- 支持浅色、深色和跟随系统主题，兼顾移动端、键盘操作和减少动态效果偏好。
- 根据最终静态 HTML 自动生成严格 CSP 和 Cloudflare Pages 防御性响应头。

## 本地运行

要求 Node.js `>=22.13.0` 和 npm：

```bash
git clone https://github.com/feierbuqiu/stamphelper.git
cd stamphelper
npm ci
npm run dev
```

开发地址通常为 `http://localhost:3000`。

## 验证

```bash
npm run lint
npm audit
npm test
npm run pack:inspect
```

测试会重新生成并校验静态数据，完成生产构建和 Cloudflare Pages 暂存，运行邮资公式、求解器、目的地搜索及本机档案测试，并检查 Worker、严格 CSP、安全响应头、深色原生下拉框、更新状态、服务端 HTML 和压缩资源预算。

## 构建与部署

```bash
npm run pages:stage
```

将 `dist/cloudflare-pages/` 作为 Cloudflare Pages 输出目录。暂存脚本会生成 `index.html`、独立 `404.html`、只针对实际存在哈希资源的长期缓存规则，以及 Worker 的精确 JavaScript 类型。不存在的 `/assets/` 地址不会再匹配一年期通配缓存，从结构上避免 SPA 兜底 HTML 污染资源地址。

详细设置和部署后检查见 [部署说明](docs/deployment.md)。

## 项目结构

| 路径 | 用途 |
| --- | --- |
| `app/` | 页面编排、样式和生成后的静态数据 |
| `components/` | 可复用且重视无障碍的界面组件 |
| `lib/` | 邮资规则、目的地搜索、持久化和优化算法 |
| `data/` | 用于重建邮资数据的已审查来源快照 |
| `scripts/` | 数据生成、安全策略、版本检查和 Pages 暂存 |
| `tests/` | 公式、求解器、搜索、持久化、安全、渲染和体积测试 |
| `docs/` | 架构、数据方法、部署、发布和中文技术记录 |

界面层只负责编排状态，业务规则和算法位于不依赖界面框架的模块中。参见 [架构说明](docs/architecture.md) 和 [数据与方法](docs/data-and-methodology.md)。

## 发布物

- [GitHub Releases](https://github.com/feierbuqiu/stamphelper/releases) 提供可直接部署到 Cloudflare Pages 的 ZIP 和校验和。
- GitHub Packages 上的 [`@feierbuqiu/stamphelper`](https://github.com/feierbuqiu/stamphelper/pkgs/npm/stamphelper) 是版本化源码分发包。GitHub npm 注册表即使读取公开包也要求认证。
- 贡献代码或自行构建时，仍建议直接使用本仓库。

## 隐私与安全

邮资参数和库存不会发送到应用服务器。纯前端仍然存在供应链和 DOM 安全边界，因此生产包使用 React 转义、持久化数据校验、零第三方运行时脚本、无 `unsafe-inline`／`unsafe-eval` 的哈希 CSP，以及严格浏览器响应头。

不要把秘密写进前端源码或构建变量：交付给浏览器的内容都应视为公开。安全问题请按 [SECURITY.md](SECURITY.md) 私下报告。

## 数据准确性与声明

资费、邮路和业务可用性是根据公开邮政资料及有记录的第三方对照整理出的版本化快照。邮政系统之间可能存在冲突，实际开办情况也可能随时变化。交寄时请以中国邮政营业系统和柜台最终受理、路向及收费为准。

本项目为独立项目，与中国邮政不存在隶属、授权或背书关系。相关名称和商标归各自权利人所有。

## 参与贡献

欢迎提交改进。发 Issue 或 Pull Request 前请阅读 [贡献指南](CONTRIBUTING.md)、[行为准则](CODE_OF_CONDUCT.md) 和 [支持说明](SUPPORT.md)。

## 许可证

源代码采用 [MIT License](LICENSE)。结构化数据的独立条款见 [DATA_LICENSES.md](DATA_LICENSES.md)，随发布物分发的第三方组件见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。第三方名称和商标仍受各自权利约束。
