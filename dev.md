## 版本发布流程

1. 执行`bash build_frontend.sh`编译前端文件
2. 修改`src/api/info.ts`中的版本信息
3. 执行`bun output`
4. 执行`bash sync.sh`同步，然后提交到Github
5. Jenkins手动构建Dcoker镜像


### 数据迁移

```bash
# 生产迁移脚本
bunx drizzle-kit generate
bunx drizzle-kit migrate
# 本地开发使用
bunx drizzle-kit push
```