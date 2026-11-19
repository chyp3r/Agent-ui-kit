# One image definition for everything: build context is the repository root.
#
#   docker compose --profile test run --rm check         typecheck + tests + build + clean gate
#   docker build --target web   -t agent-kit:web   .     the starter, served by nginx
#   docker build --target mock  -t agent-kit:mock  .     the backend-free mock server

FROM node:22-alpine AS deps
WORKDIR /app
# Manifests first: a source edit does not reinstall dependencies.
COPY package.json package-lock.json .npmrc ./
COPY packages/core/package.json packages/core/
COPY packages/react/package.json packages/react/
COPY packages/mock/package.json packages/mock/
COPY apps/starter/package.json apps/starter/
RUN npm ci

FROM deps AS source
COPY . .

# Run, not built: the container's exit code is the verdict (types, tests, the production
# build and the domain-clean gate), the same on any machine.
FROM source AS check
CMD ["npm", "run", "check"]

FROM source AS build
RUN npm run build

FROM nginx:1.27-alpine AS web
# nginx fills ${API_UPSTREAM} from the environment when the container starts.
ENV API_UPSTREAM=http://mock:18100
COPY deploy/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/apps/starter/dist /usr/share/nginx/html
EXPOSE 80

FROM node:22-alpine AS mock
WORKDIR /app
# The mock server only imports types from core, which Node strips: no build, no deps.
COPY packages/mock/package.json packages/mock/package.json
COPY packages/mock/src packages/mock/src
ENV PORT=18100
EXPOSE 18100
CMD ["node", "--experimental-strip-types", "--no-warnings", "packages/mock/src/cli.ts"]
