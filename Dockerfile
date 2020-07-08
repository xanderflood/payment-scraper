FROM node:13

WORKDIR /usr/src/app

COPY package*.json ./
COPY *.js ./
RUN npm install

CMD [ "node", "index.js" ]
