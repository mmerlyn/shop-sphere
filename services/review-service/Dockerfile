FROM node:18-alpine AS builder

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
RUN npm install --legacy-peer-deps
RUN npx prisma generate

COPY . .
RUN npm run build

FROM node:18-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/generated ./dist/generated
COPY --from=builder /app/src/generated ./dist/src/generated

EXPOSE 3007

CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/main"]
