FROM node:18-alpine

WORKDIR /app

# copy package files and install only server deps
COPY package.json package-lock.json* ./
RUN npm install --production

# copy server files
COPY server ./server

ENV PORT=5000
EXPOSE 5000

CMD ["node", "server/index.js"]
