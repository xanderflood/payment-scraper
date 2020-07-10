FROM ubuntu:bionic

RUN apt-get update \
	&& apt-get install -y curl yarn

# Puppeteer is going to install chromium, but doing this
# will make sure all the necessary dependencies are there.
RUN curl -sL https://deb.nodesource.com/setup_14.x | bash - \
	&& apt-get install -y nodejs chromium-browser

COPY package.json .
COPY yarn.lock .
COPY *.js ./
RUN yarn install

CMD [ "node", "index.js" ]

# FROM zenika/alpine-chrome:81-with-puppeteer

# Install latest chrome dev package and fonts to support major charsets (Chinese, Japanese, Arabic, Hebrew, Thai and a few others)
# Note: this installs the necessary libs to make the bundled version of Chromium that Puppeteer
# installs, work.
# RUN apt-get update \
#     && apt-get install -y wget gnupg \
#     && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
#     && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
#     && apt-get update \
#     && apt-get install -y google-chrome-unstable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf \
#       --no-install-recommends \
#     && rm -rf /var/lib/apt/lists/*

# WORKDIR /usr/src/app

# COPY package*.json ./
# COPY *.js ./
# RUN npm install

# RUN groupadd -r pptruser && useradd -r -g pptruser -G audio,video pptruser \
#     && mkdir -p /home/pptruser/Downloads \
#     && chown -R pptruser:pptruser /home/pptruser
# USER pptruser

# CMD [ "node", "index.js" ]

#
#
#
#
#
# TODO start building an ubuntu image and installing everything from APT?
#
#
#
#
#
