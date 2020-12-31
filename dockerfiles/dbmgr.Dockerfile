FROM local:main

RUN yarn global add sequelize-cli

WORKDIR /src/db

ENTRYPOINT [ "sequelize" ]
