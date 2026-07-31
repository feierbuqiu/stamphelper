# 贴票助手：开源前安全与性能审计

> 历史审计快照：记录 2026-07-31 首次公开发布前的检查结果和当时发布物。当前构建、缓存与发布规范以 [`architecture.md`](architecture.md)、[`deployment.md`](deployment.md) 及自动化测试为准。

审计日期：2026-07-31
审计对象：当时的源码、依赖树和 Cloudflare Pages 静态发布目录

## 1. 结论

本轮没有发现可从公网读取的密钥、账号数据、数据库或服务端写接口。已知依赖漏洞从“运行依赖 3 个高危、完整工具链 13 个高危及 2 个低危”降为 `npm audit` 与 `npm audit --omit=dev` 均为 0。生产包不包含源码映射、环境变量、数据库脚手架或第三方运行时脚本。

当前架构的主要风险不是 SQL 注入或传统 CSRF，而是前端 XSS、被篡改的本机存储造成浏览器资源消耗、错误缓存发布物，以及依赖供应链。上述方面均已设置代码约束和自动化发布门槛。此结论是源码／构建审计，不等同于第三方渗透测试，也不能覆盖 Cloudflare 账号被接管、域名劫持、恶意浏览器扩展或用户设备本身已失陷的情况。

## 2. XSS 与脚本注入

- 普通文本和检索内容由 React 转义，没有把国家名、搜索词、面额输入或本机存储内容写入 `innerHTML`。
- 没有 `eval`、`new Function`、`document.write`、内联事件属性或 `javascript:` URL。
- 唯一的 `dangerouslySetInnerHTML` 是不含任何插值的编译期主题启动常量；发布器会针对其最终字节内容生成 SHA-256 CSP 哈希。
- 发布器为最终 HTML 的全部内联脚本和样式逐段计算哈希，CSP 不包含 `unsafe-inline` 或 `unsafe-eval`。脚本、样式、图片、字体、连接和 Web Worker 默认只允许本站资源。
- 外部资料链接为源码常量，并使用 `rel="noopener noreferrer"`。

MDN 说明，静态页面适合使用内容哈希允许特定内联脚本／样式，且应避免 `unsafe-inline`；本站发布器会在每次构建时自动重算，防止页面内容改变后沿用旧哈希：[MDN CSP 指南](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP)。

## 3. CSRF、注入和服务端攻击面

当前发布包没有表单提交端点、登录、会话、数据库、上传、邮件发送、代理请求或任何服务端状态变更。因此：

- 传统 CSRF 没有可攻击的服务端动作；
- SQL／NoSQL 注入没有数据库目标；
- SSRF 没有用户可控的服务器取数入口；
- 命令注入没有服务器命令执行入口；
- 暴力登录、越权和会话固定在当前架构下不适用。

自定义邮票表单仅在浏览器内 `preventDefault` 后修改本机状态。若以后加入 Pages Functions、账号、同步、反馈提交或管理后台，上述结论立即失效，必须重新设计认证、授权、CSRF、CORS、速率限制、审计日志及服务端输入校验。

## 4. 本机持久化与资源滥用

- 设置只保存在 `localStorage` 和 IndexedDB，不上传服务器。
- 旧版本根路径 Cookie 会读取一次并立即过期；以后不再把最多约 3.5 KB 的库存资料附加到 HTML、脚本、字体等每个请求。
- `deviceId` 是随机本机标识，不采集硬件指纹、IP、字体或浏览器特征。
- 恢复数据时限制设备标识长度、主题枚举、面额范围、有限库存上限和自定义面额数量。
- 每台设备最多保存 20 种自定义面额；有限库存最大值等于本站最高金额在 1 分票下可能需要的 2,000,000 枚。被手工篡改的超限数据会被忽略，不送入求解器。

本机存储不是可信安全边界，但攻击者若已经能任意修改同源存储，影响仍局限在该浏览器；严格 CSP 用于降低远程脚本获得这种能力的概率。

## 5. Cloudflare Pages 响应头

最终 `_headers` 自动设置：

- hash-based `Content-Security-Policy`；
- `X-Frame-Options: DENY` 与 `frame-ancestors 'none'`，防止点击劫持；
- `X-Content-Type-Options: nosniff`；
- `Permissions-Policy`，关闭相机、麦克风、定位、支付、USB 等不用的能力；
- `Referrer-Policy: no-referrer`；
- `Strict-Transport-Security`；
- `Cross-Origin-Opener-Policy` 和 `Cross-Origin-Resource-Policy`；
- HTML `max-age=0, must-revalidate`，内容哈希资产一年 `immutable`；
- Worker 精确路径的 `application/javascript` 类型。

Cloudflare 官方说明 `_headers` 会应用于 Pages 静态资源，并建议用它设置 CSP、`DENY`、`nosniff`、权限及缓存策略；本站当前发布包没有 Pages Functions，因此这些规则覆盖实际响应：[Cloudflare Pages Headers](https://developers.cloudflare.com/pages/configuration/headers/)。自动测试还检查单行不超过 Cloudflare 的 2,000 字符限制。

## 6. 依赖与供应链

本轮升级了同一稳定分支内的 Next.js、React、Vite、Cloudflare 插件和构建工具。Next.js 当前包仍固定了已被通告的旧 PostCSS／Sharp 小版本，因此通过 npm `overrides` 使用：

- `postcss 8.5.25`；
- `sharp 0.35.3`。

这些替换已通过生产构建、服务端静态渲染和全部测试。以后 Next.js 自身更新依赖后，应优先移除 overrides 再测试，而不是永久保留。旧的 Next ESLint 预设还引入了有通告的旧 glob 依赖，本轮改为 ESLint 10、TypeScript ESLint 和 React Hooks 的最小直接配置，减少约 170 个开发依赖。

当前结果：

```text
npm audit                 0 vulnerabilities
npm audit --omit=dev      0 vulnerabilities
npm dependency tree       valid
npm audit signatures      331 signatures verified; 109 attestations verified
```

lockfile 仍是可复现安装的唯一依据；开源发布和每次依赖升级前应重新运行 `npm ci`、两个 audit 和完整测试。

## 7. 性能与交互

- 结果卡不再在每次输入后切成加载面板。上一方案保持挂载；只有求解超过 200 ms 才在固定尺寸位置显示“更新中”，因此常规小于 1 ms 的求解不会闪烁或改变卡片高度。
- 45 ms 输入防抖仍保留；新请求会中止仍在运行的旧 Worker。
- 贴票及全部足量边界继续在模块 Worker 中运行，主线程不承担极端动态规划。
- HTML 使用重新验证缓存；内容哈希 JS、CSS、字体和 Worker 使用一年不可变缓存，版本更新自动换 URL。
- 社交预览 PNG 只出现在元数据中，正常打开页面不会主动下载。

当前生产构建指标：

| 项目 | 结果 | 强制预算 |
|---|---:|---:|
| 页面 JS（gzip） | 103,440 B | 120,000 B |
| 清单内全部交互 JS（gzip） | 188,680 B | 220,000 B |
| CSS（gzip） | 9,407 B | 12,000 B |
| Worker | 2,639 B | 20,000 B |
| 静态 HTML | 53,365 B | — |

## 8. 自动验证

当前共 42 项测试，全部通过。除邮资和求解正确性外，发布门槛还验证：

- 深色／浅色桌面原生选项都有明确前景和背景；
- 加载反馈阈值为 200 ms，更新时不以 `pending` 替换整个结果主体；
- Worker 文件存在、内容不是 HTML、客户端确实引用其哈希 URL；
- CSP 哈希与最终 HTML 完全对应，且不含 `unsafe-inline`／`unsafe-eval`；
- 发布包没有源码映射、`.env`、`.git`、`.openai`、数据库目录或本地绝对路径；
- JS／CSS 压缩体积未超过预算。

当前源码、受 Git 跟踪的敏感文件名以及 Git 历史高置信模式扫描均未发现私钥、API Key 或 Client Secret。开源前仍建议由仓库所有者检查提交历史中的个人姓名、域名、截图和业务文档，因为这类隐私内容不一定长得像技术密钥。

## 9. 本次发布物

- ZIP：`贴票助手-Cloudflare-Pages-2026-07-31-深色与安全优化.zip`
- SHA-256：`4B633783FC92212CA77FCC444DF69A33D68E07B1F0774BA53DEBC6DA8EA24704`
- Worker：`assets/stamp-solver.worker-Cq0MD2i2.js`
- ZIP 内部验证：27 个条目；Worker JavaScript、客户端引用、深色选项 CSS、延迟更新 UI、CSP 和敏感残留检查全部通过。

重新部署后仍应从生产域名检查首页 CSP／缓存响应头和新 Worker 的 `Content-Type`。本地 ZIP 正确不能单独证明 Cloudflare 控制台已经上传了这一个版本。
