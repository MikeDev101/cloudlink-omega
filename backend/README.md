# Backend
CloudLink Omega utilizes net/http for it's API. 

## Basics
All requests are either `text/plain` or `application/json`.

Use this directory to build the server binary (use `go build .`).

Configuration is done via an environment variables file. See `.env.example`
for a template.

You will need to build `./docs` with Swagger before running. 

If you want a quick-and-dirty test, I've included a prebuilt
Ubuntu x64 binary; Simply run `./clomega`.

## Database
This backend code was designed with a MariaDB server in mind.

Before starting the server, you will need to generate the CL Omega
tables and procedures in the DB. The commands needed to generate
these are in `init.sql`.

Afterwards, point to a MariaDB server in an `.env` file (see `.env.example`).

## Documentation
This API utilizes Swagger to generate documentation.

You will need to prepare a local install of Swagger before building `./docs`.
Once Swagger is installed, navigate to this directory and run `swag init`.
Documentation will be built and present on `http://localhost:8080/docs`.