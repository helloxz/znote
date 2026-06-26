FROM oven/bun:1.3.14-slim
# 创建工作目录为/opt/zmark
WORKDIR /app
# 合并所有 COPY 操作
COPY . ./
# 3. 安装依赖
RUN bun install --production
# 暴露挂载路径为
VOLUME /app/data
# 暴露暴露端口为3080
EXPOSE 3888
# 启动命令为sh run.sh
CMD ["sh", "run.sh"]