FROM ubuntu:bionic

RUN apt-get update \
	&& apt-get install -y curl

# Puppeteer is going to install chromium, but doing this
# will make sure all the necessary dependencies are there.
RUN curl -sL https://deb.nodesource.com/setup_14.x | bash - \
	&& curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add - \
	&& echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list \
	&& apt-get update \
	&& apt-get install -y nodejs chromium-browser yarn

COPY package.json .
COPY yarn.lock .
COPY *.js ./
RUN yarn install

RUN groupadd -r pptruser && useradd -r -g pptruser -G audio,video pptruser \
    && mkdir -p /home/pptruser/Downloads \
    && chown -R pptruser:pptruser /home/pptruser
USER pptruser

CMD [ "node", "index.js" ]
