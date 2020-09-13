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

WORKDIR /src

COPY package.json package.json
COPY yarn.lock yarn.lock
COPY src/ src/
COPY bin/ bin/
RUN yarn install

RUN groupadd -r pptruser && useradd -r -g pptruser -G audio,video pptruser \
    && mkdir -p /home/pptruser/Downloads \
    && chown -R pptruser:pptruser /home/pptruser
USER pptruser

ENTRYPOINT [ "./bin/run" ]
