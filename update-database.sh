#!/bin/bash

set -e

rm -rf prisma/migrations/ prisma/dev.db
yarn prisma migrate save --experimental --create-db --name="Schema for testing"
yarn prisma migrate up --experimental
yarn prisma generate
