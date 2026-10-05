# 数字积木（Digital Bricks）

一个面向儿童的浏览器 3D 拼搭 MVP。核心操作是：拖入积木，让凸点 `●` 靠近凹槽 `○`，自动对齐并卡接。

> 这是原创的数字积木尺寸与连接系统，不声明兼容任何实体积木品牌。

## 运行

```bash
npm install
npm run dev
```

生产构建和测试：

```bash
npm run build
npm test
```

## 已实现

- 25 种数据驱动的通用积木，内部单位为毫米
- 基于显式连接器和四元数对齐的吸附引擎
- 吸附预览会把预测姿态下所有实际接触的目标连接点标成蓝色
- 方角 block；顶部凸点只辅助建模，不进入打印文件
- 基础砖四侧带逻辑贴面点，靠近时会自动贴平
- 松手后按确定性重力落到最高承托面，吸附成功时仍以卡接为优先
- 拖动时用深色接触面、落位幽灵和下落引导线预告最终位置
- 预览落点时提供幅度受限的智能视角辅助，不会抢走手动镜头控制
- 自由放置、拖动、90° 旋转、复制、删除
- 撤销/重做及键盘快捷键
- 本机保存/读取（`localStorage`）
- 通过 Manifold 实体并集生成无内部接缝的二进制 STL
- 打印区域、悬浮与基础悬垂提醒
- 顶视、正视、侧视、默认视角，以及轨道旋转/缩放/平移

## 主要结构

- `src/bricks/`：积木目录与程序化几何
- `src/editor/snapping/`：独立吸附引擎
- `src/editor/gravity/`：独立重力落位与接触面预测
- `src/store/`：Zustand 编辑器状态和历史
- `src/export/`：STL 几何合并与导出
- `src/components/`：积木篮、场景、工具条与警告界面

项目只保存积木定义 ID、位置、旋转与连接关系；连接器的世界坐标始终由定义和实例变换实时推导。

## 账户与作品社区（TiDB Cloud Starter）

社区功能使用 Vercel TypeScript Functions、Better Auth Passkey 和 TiDB Cloud Starter。未登录时，浏览器端建模、`localStorage`、`.legox` 文件和 STL 导出仍可独立使用。

首次配置环境变量（不要把真实凭证提交到 Git）：

```bash
cp .env.example .env.local
# 在 .env.local 填写 TiDB Starter 的 DATABASE_URL、BETTER_AUTH_SECRET、ACCOUNT_CONTEXT_SECRET
npm run db:migrate
npm run dev
```

部署到 Vercel 时，在项目的加密环境变量中配置同样的数据库和密钥，并将 `BETTER_AUTH_URL` 设为生产域名、`WEBAUTHN_RP_ID` 设为该域名。数据库迁移会创建 Better Auth、账户、作品版本、点赞、浏览统计和举报表；生产注册前应先用 `npm run db:migrate` 验证迁移已完成。

社区入口：`/account`（Passkey 与一次性恢复资料）、`/plaza`（作品广场）、`/u/:publicId`（个人空间）、`/w/:workId`（作品详情）。
