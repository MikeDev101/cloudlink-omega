# Backend
CloudLink Omega is built using Chi and Gorilla Websockets.

## Basics
All API endpoints use `application/json` or `text/plain` types. See documentation for endpoints.

Use this directory to build the server binary (use `go build .`).

Configuration is done via an environment variables file. See `.env.example`
for a template.

## Database
This backend code was designed with a MariaDB server in mind, but should be compatible with any
standard SQL server. Tables will be auto-generated on first launch.

## Documentation
See https://github.com/MikeDev101/cloudlink-omega/wiki
