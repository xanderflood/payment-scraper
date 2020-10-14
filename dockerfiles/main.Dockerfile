FROM node:12-slim

WORKDIR /src

COPY package.json package.json
COPY yarn.lock yarn.lock
RUN yarn install --production

COPY bin/ bin/
COPY src/ src/

ENTRYPOINT [ "./bin/run" ]
