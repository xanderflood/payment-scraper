FROM node:12-slim

WORKDIR /src

COPY package.json package.json
COPY yarn.lock yarn.lock
RUN yarn --immutable

COPY bin/ bin/
COPY src/ src/
COPY db/ db/

ENTRYPOINT [ "./bin/run" ]
