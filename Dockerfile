FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npx pkg server/server.js --targets node22-linux-x64 --output inteebuild

FROM alpine:3.20
RUN apk add --no-cache libstdc++ ca-certificates
WORKDIR /app
COPY --from=builder /app/inteebuild .
COPY --from=builder /app/index.html ./index.html
COPY --from=builder /app/about.html ./about.html
COPY --from=builder /app/docs.html ./docs.html
COPY --from=builder /app/developer.html ./developer.html
COPY --from=builder /app/historial.html ./historial.html
COPY --from=builder /app/license.html ./license.html
COPY --from=builder /app/privacy.html ./privacy.html
COPY --from=builder /app/terms.html ./terms.html
COPY --from=builder /app/robots.txt ./robots.txt
COPY --from=builder /app/sitemap.xml ./sitemap.xml
COPY --from=builder /app/css ./css
COPY --from=builder /app/js ./js
COPY --from=builder /app/assets ./assets
COPY --from=builder /app/i18n ./i18n
COPY --from=builder /app/docs ./docs
EXPOSE 8787
ENV PORT=8787
CMD ["./inteebuild"]