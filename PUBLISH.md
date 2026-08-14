# Publish Guide — dsh-usage-billing

把 `dsh-usage-billing` 发布到 DSH 插件社区的完整清单。

## 0. 本地验证

```bash
node --check lib/index.js
node --check lib/client.js
npm pack --dry-run   # 检查 tarball 内容
```

## 1. 创建 GitHub 仓库

1. 打开 https://github.com/new
2. 仓库名：**`dsh-usage-billing`**
3. 描述（中英均可）：
   - EN: `Usage and cost statistics for DeepSeek Harness: peak/off-peak pricing after 2026-08-17, per-session breakdown, charts and a floating summary panel.`
   - ZH: `DeepSeek Harness 用量与消费统计插件：8/17 调价前后峰谷计费、按会话明细、图表与悬浮汇总面板。`
4. **添加 topic `dsh-plugin`**（右侧 Topics 栏——社区索引按此聚合），可选再添加：`deepseek-harness`、`plugin`、`usage-stats`、`billing`。
5. License：MIT。不要勾选 UI 上的 README/.gitignore（仓库里已有）。
6. 建好后把仓库地址写进 `package.json` 的 `repository` 字段再提交一次。

## 2. 推送

```bash
cd dsh-usage-billing
git init -b main
git add -A
git commit -m "feat: dsh-usage-billing — DeepSeek 用量与消费统计插件

- llm/stream 全量监听 + 会话日志历史回填（含会话标题）
- 2026-08-17 调价前后峰谷分段计费（北京时间）
- 主界面「用量」悬浮汇总面板 + 输入框下方当前会话用量
- 设置页详细面板：分段占比 / 14 天柱状图 / 会话 Top 8 / 最近调用
- usage_stats 模型工具、JSON 统计路由、.dsh-usage-billing.json 持久化
- MIT license"
git branch -M main
git remote add origin https://github.com/<your-name>/dsh-usage-billing.git
git push -u origin main
```

## 3. 发布到 npm（可选）

包名无需 scope（社区惯例即无 scope 裸名）：

```bash
npm login
npm publish
```

> 若裸名 `dsh-usage-billing` 已被占用，改用 `dsh-usage-billing-<后缀>`，
> 并同步修改 package.json、cordis.patch.yml 行与 lib/client.js 的模块 id。

## 4. 用户安装（README 同步宣传）

- **方式 A（官方 profile 机制，推荐）**：`dsh plugin --profile web add dsh-usage-billing`
  （或本地路径）——安装并登记到 `dsh.profile.bundles`，启动即自动挂载（`dsh.bundle.patch` 机制）。
- **方式 B（用户补丁）**：把 `cordis.patch.yml` 内容加入 `%USERPROFILE%\.dsh\cordis.patch.yml`。
- **发布成品必须包含 `cordis.patch.yml`**（包内声明了 `dsh.bundle.patch`，漏打包会导致挂载行缺失）。
- ⚠ 不要把插件塞进 `npm-cache\_npx`，也不要改官方 bundle（`@deepseek-ai/dsh-web-app` 等）
  ——npm reify 重建缓存会留下悬空 Junction，导致 `ERR_MODULE_NOT_FOUND` 启动失败。
