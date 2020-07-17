FROM node:lts-alpine3.11
RUN apk add chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true
ENV CHROMIUM_PATH /usr/bin/chromium-browser
RUN mkdir -p /home/node/draw.io-export /files
WORKDIR /home/node/draw.io-export
COPY . .
RUN npm install
VOLUME ["/files"]
ENTRYPOINT ["sh", "convert.sh"]
