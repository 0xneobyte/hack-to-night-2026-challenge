FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm ci

COPY . .

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000

CMD ["npm", "run", "dev"]
