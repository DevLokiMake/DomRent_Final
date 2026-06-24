FROM node:18

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --omit=dev
RUN npx prisma generate

COPY . .

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
