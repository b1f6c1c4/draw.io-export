FROM node:lts-alpine3.18
RUN apk add chromium
WORKDIR /home/node/draw.io-export
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true
ENV CHROMIUM_PATH /usr/bin/chromium-browser
COPY package*.json ./
RUN npm ci --only=production
COPY . .
VOLUME ["/files"]
ENTRYPOINT ["/home/node/draw.io-export/entrypoint.sh"]
