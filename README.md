# Hi5Central RMM

Standalone Hi5Central RMM web application.

The RMM frontend is independently built and deployed, while authentication, RMM APIs,
Agent/WebSocket traffic and shared tenancy remain owned by Hi5Central Control Server.

## Development

    npm install
    npm run dev

## Container

    docker build -t hi5central/rmm .

The container serves static assets on port 80. TLS and public routing belong to
Hi5Central Deploy/Gateway.
