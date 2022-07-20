##
## digiserve/ab-relay
##
## This is our microservice for managing communications with our MCC relay server.
##
## Docker Commands:
## ---------------
## $ docker build -t digiserve/ab-relay:develop .
## $ docker push digiserve/ab-relay:develop
##

ARG BRANCH=master

FROM digiserve/service-cli:${BRANCH}

COPY . /app

WORKDIR /app

RUN npm i -f

WORKDIR /app

CMD [ "node", "--inspect=0.0.0.0:9229", "app.js" ]
