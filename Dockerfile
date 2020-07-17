FROM node:lts-alpine3.11
RUN apk add chromium
WORKDIR /home/node/draw.io-export
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true
ENV CHROMIUM_PATH /usr/bin/chromium-browser
COPY package*.json ./
RUN npm ci --only=production
COPY . .
VOLUME ["/files"]
ENTRYPOINT /usr/bin/find /files -type f -name '*.drawio' -exec ./convert.sh '{}' \;
