# Digital Bricks 首轮推广包

更新时间：2026-10-12

渠道范围：站点所有者已授权公开发布和常规公开回复；V2EX 因无账号暂停，即刻按站点所有者要求移出本轮分发。

## 核心定位

> 一个给孩子和大人玩的浏览器 3D 数字积木：拖拽就会自动落位和卡接，完成后可保存、二创，并导出无内部接缝的 STL 去 3D 打印；开始搭建无需注册。

家长、老师和创客空间是第一决策人群；孩子是主要使用者。对成人强调“不用学 CAD、无需安装、无需先注册、可以打印”，对孩子强调“马上能搭、作品能分享、能从别人的作品继续创造”。

不要使用 LEGO 品牌、兼容或替代品表述。AI 能力应表述为“让 AI 按公开规则生成 `.legox`，再导入编辑器”，不要暗示站内已经内置生成式 AI。

## 已完成素材

- 横版社交预览：[`../../public/social-preview.png`](../../public/social-preview.png)
- 竖版首发图：[`01-digital-bricks-launch.png`](./01-digital-bricks-launch.png)
- 中文推广落地页：<https://bricks.reactshare.cn/start>
- 英文推广落地页：<https://bricks.reactshare.cn/en/start>
- AI 建模规则：<https://bricks.reactshare.cn/digital-bricks-modeling-skill.md>
- GitHub：<https://github.com/raywill/lego-x>

仓库中的 `marketing/xiaohongshu/` 和 `marketing/xiaohongshu-v2/` 是早期素材；其中部分图片带旧域名。首发只使用本目录中的正式版本。

## 渠道链接

| 渠道 | 可直接使用的链接 |
| --- | --- |
| 小红书 | <https://bricks.reactshare.cn/start?utm_source=xiaohongshu&utm_medium=social&utm_campaign=launch_202610> |
| Three.js Forum | <https://bricks.reactshare.cn/en/start?utm_source=threejs_forum&utm_medium=community&utm_campaign=launch_202610&utm_content=threejs_showcase> |
| OpenAI Showcase | <https://bricks.reactshare.cn/start?utm_source=openai_showcase&utm_medium=directory&utm_campaign=launch_202610> |
| Awesome WebMCP | <https://bricks.reactshare.cn/start?utm_source=awesome_webmcp&utm_medium=directory&utm_campaign=launch_202610> |
| Product Hunt | <https://bricks.reactshare.cn/start?utm_source=product_hunt&utm_medium=launch&utm_campaign=launch_202610> |
| GitHub | <https://bricks.reactshare.cn/start?utm_source=github&utm_medium=referral&utm_campaign=launch_202610> |

## 小红书首发文案

标题：

```text
给孩子做了一个能打印的 3D 积木网站
```

正文：

```text
不用装软件，也不用先学 CAD。

打开网页，从左边拖一块积木进来，它会自己落到格子上；把连接点靠近，还会自动“咔哒”卡住。搭好以后可以：

① 保存成 .legox，下次接着搭
② 导出无内部接缝的 STL 去 3D 打印
③ 发布到作品广场，让朋友从你的作品继续二创
④ 把公开规则交给 AI，让它先生成一个 .legox 草稿，再自己修改

搭建、保存和导出都不需要注册。现在还在很早期，特别想知道小朋友会在哪一步卡住，以及你最希望增加哪种积木。

体验：bricks.reactshare.cn/start

#3D打印 #儿童编程 #STEAM教育 #亲子创作 #独立开发 #数字积木
```

配图顺序：竖版首发图 → 火星车作品图 → 猫耳小屋作品图。第二、三张旧素材不含网址，可以继续使用，但发布前应确认画面与真实积木目录一致。

## V2EX「分享创造」文案（本轮暂停）

标题：

```text
做了一个给小朋友玩的浏览器 3D 数字积木：自动卡接，还能导出 STL 打印
```

正文：

```text
最近把一个浏览器里的 3D 数字积木工具上线了。目标是把第一次 3D 建模的门槛降到“拖一块积木进来”。

它目前支持 35 种原创通用积木、连接点吸附、重力落位、侧面贴合、多选/复制/撤销，以及 .legox 本地文件。导出时用 Manifold 做实体并集，得到没有内部接缝的二进制 STL。开始搭建和导出都不需要账户。

我还把积木目录和放置规则整理成公开的 AI 建模规则：AI 可以按规则生成 .legox 草稿，用户导入后继续在同一套编辑器里调整。站内也有作品广场和保留来源的二创。

在线体验：{V2EX_UTM_LINK}
源码：https://github.com/raywill/lego-x

我最想听三类反馈：触控操作是否顺手、还缺哪类基础零件、实际打印时哪个比例和连接结构最容易出问题。
```

发布时把 `{V2EX_UTM_LINK}` 换成上表中的 V2EX 链接。

## Three.js Forum Showcase

标题：

```text
Digital Bricks — an open-source R3F construction editor with snapping and printable STL export
```

正文：

```text
Hi everyone,

I’ve just launched **Digital Bricks**, an open-source browser construction editor built with three.js and React Three Fiber. I made it to give children, parents, and makers a simple first step into 3D modeling: drag a part into the scene, let it settle onto the build plate, and bring compatible connectors together to snap.

The editor currently includes:

- 35 procedurally generated generic parts
- explicit connector frames with quaternion-based alignment
- deterministic gravity placement, collision checks, and snap previews
- multi-select, copy, 90° rotation, undo, and redo
- local `.legox` project import/export
- Manifold union into a single watertight binary STL
- a public gallery with source-preserving remixes

Building, local saving, and STL export work in the browser without an account or installation.

**Live demo:** {THREEJS_UTM_LINK}

**Source:** https://github.com/raywill/lego-x

I’d especially value feedback on touch controls and camera assistance while dragging, snapping around rotated or side-facing parts, and the STL workflow for real prints.
```

发布时把 `{THREEJS_UTM_LINK}` 换成上表中的 Three.js Forum 英文链接。推荐标签：`react-three-fiber`、`editor`、`3d-printing`。

## WebMCP 目录条目

```text
Digital Bricks — Child-friendly browser 3D construction studio whose WebMCP tools let an agent list brick types, inspect the visible project, and add bricks to the same canvas a person is editing.
```

- OpenAI Developers Showcase：<https://openai.com/form/showcase-submission/>
- Awesome WebMCP：<https://github.com/webmachinelearning/awesome-webmcp/blob/main/CONTRIBUTING.md>
- WebMCP directory：<https://webmcp.com/>

Showcase 投稿涉及作者身份、图片使用授权和公开展示许可，应由站点所有者复核后提交。WebMCP 仍是实验能力，对外不要表述为“所有浏览器都已支持”。

## 后续渠道

- Three.js Forum Showcase：<https://discourse.threejs.org/c/showcase/7>
- Vercel Community Showcase：<https://community.vercel.com/c/showcase/12>
- 少数派产品自荐：<https://sspai.com/post/40262>
- Product Hunt：<https://www.producthunt.com/launch>
- Peerlist Launchpad：<https://peerlist.io/launchpad>

Hacker News 的 Show HN 规则明确不接受由 AI 生成或改写的投稿文字。若投 HN，作者需要根据真实开发经历亲自重写标题与正文，本推广包不提供可直接粘贴的 HN 文案。

## 第一轮衡量

通过各渠道 UTM 与匿名页面事件先比较：落地页访问、进入搭建页的转场、作品页访问和渠道质量。产品内下一轮再补隐私友好的关键事件：首次放置、首次连接、保存或导出、发布完成、分享和二创发布。

生产环境已经启用独立的匿名推广日志：只记录时间、抽象页面类型、上一页面类型、安全的 UTM 字段和外部来源域名；不记录 IP、Cookie、完整网址、作品编号、浏览器类型或用户标识。查看最近 24 小时的渠道报告：

```bash
ssh root@bricks.reactshare.cn "cd /home/wwwroot/bricks.reactshare.cn && npm run marketing:report -- --since=24h"
```

本轮推广的正式统计起点是 `2026-10-12T13:20:29+08:00`，此前的验收流量已经清空。需要严格从该起点统计时运行：

```bash
ssh root@bricks.reactshare.cn "cd /home/wwwroot/bricks.reactshare.cn && npm run marketing:report -- --from=2026-10-12T13:20:29+08:00"
```

同期产品基线：有效账户 8、已发布作品 5（原创 5、二创 0）、当前点赞 1、累计作品去重日访问 48；当天新增账户、作品、二创和点赞均为 0。渠道事件用来判断访问和初步使用意愿，产品基线用来判断推广是否进一步带来注册、发布、互动和作品阅读。

查看最近 7 天时把 `24h` 改成 `7d`。报告按限定的 UTM 渠道或外部来源网站类别汇总落地页、搭建页、作品广场和作品页的浏览次数，并单独统计 30 分钟内从落地页进入搭建页的转场。`Transition rate` 比较所选时间窗内的转场与落地页事件，不是用户队列转化率或去重用户转化率；低流量时可能超过 100%。刷新或直接打开搭建页不会算作转化。机器人、预览器和常见命令行探测会在写入匿名日志前过滤。

可用 `--from=2026-10-12T13:00:00+08:00` 设置固定推广起点，也可增加 `--source=github`、`--campaign=launch_202610` 或 `--format=json` 进行筛选和导出。报告会自动读取当前日志和压缩后的轮转日志；推广日志每天轮换，保留 30 份。

扩大到 3D 打印社区前，先补一组真实打印成品照片与参数；不要用生成的打印效果图代替真实成品证明。
