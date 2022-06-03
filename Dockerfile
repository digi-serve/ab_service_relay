##
## digiserve/ab-relay:develop
##
## This is our microservice for managing communications with our MCC relay server.
##
## Docker Commands:
## ---------------
## $ docker build -t digiserve/ab-relay:develop .
## $ docker push digiserve/ab-relay:develop
##

FROM digiserve/service-cli:develop

RUN git clone --recursive https://github.com/Hiro-Nakamura/ab_service_relay.git app && cd app && npm install

WORKDIR /app

CMD [ "node", "--inspect=0.0.0.0:9229", "app.js" ]
