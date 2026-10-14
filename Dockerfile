# syntax=docker/dockerfile:1
ARG NODE_IMAGE=node:24-bookworm-slim
ARG NODE_BUILD_IMAGE=node:24-bookworm
# The maintained full Debian build image includes OpenSSL/CA/build tools for Prisma.
# Runtime stays slim and uses the JS PostgreSQL adapter, not a Rust query engine.
FROM ${NODE_BUILD_IMAGE} AS dependencies
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json .npmrc ./
# Optional corporate/cloud CA secret is mounted for this RUN only, never copied.
# Docker's predefined proxy args can be supplied without persisting them in layers.
RUN --mount=type=cache,target=/tmp/truck-dispatch-npm-cache \
    --mount=type=secret,id=build_ca,target=/run/secrets/build-ca.pem \
    if [ -f /run/secrets/build-ca.pem ]; then NODE_EXTRA_CA_CERTS=/run/secrets/build-ca.pem npm ci; else npm ci; fi

FROM dependencies AS builder
COPY --chown=node:node . .
# Only the approved public origin is a build input. Never pass DB/auth/mail secrets.
ARG PUBLIC_SITE_URL
ENV PUBLIC_SITE_URL=${PUBLIC_SITE_URL}
ENV NEXT_OUTPUT_STANDALONE=1
RUN npm run build \
    && mkdir -p /runtime/.next /runtime/deploy \
    && cp -r .next/standalone/. /runtime/ \
    && cp -r .next/static /runtime/.next/static \
    && cp -r public /runtime/public \
    && cp deploy/check-runtime.mjs deploy/app-entrypoint.mjs deploy/healthcheck.mjs /runtime/deploy/ \
    && node -e "require('fs').writeFileSync('/runtime/build-public-origin.txt',process.env.PUBLIC_SITE_URL || '')" \
    && mkdir -p /runtime/.next/cache \
    && chown -R node:node /runtime \
    && mkdir -p /ops-runtime/app/src/lib /ops-runtime/app/scripts /ops-runtime/app/deploy \
    && cp -r node_modules prisma /ops-runtime/app/ \
    && cp -r src/generated /ops-runtime/app/src/ \
    && cp src/lib/validation.ts src/lib/lead-options.ts /ops-runtime/app/src/lib/ \
    && cp scripts/bootstrap-admin.ts scripts/prune-security.ts /ops-runtime/app/scripts/ \
    && cp deploy/check-runtime.mjs /ops-runtime/app/deploy/ \
    && cp package.json package-lock.json .npmrc prisma.config.ts tsconfig.json /ops-runtime/app/ \
    && cp --parents /usr/bin/openssl /usr/lib/*-linux-gnu/libssl.so.3 \
        /usr/lib/*-linux-gnu/libcrypto.so.3 /etc/ssl/certs/ca-certificates.crt /ops-runtime/ \
    && chmod -R a+rX /ops-runtime/app

# One-off trusted operator tools; never exposed as the web application.
# Only the operator scripts/client/dependencies and matching Debian OpenSSL files.
# Avoid shipping the full build distribution and its compiled application again.
FROM ${NODE_IMAGE} AS ops
WORKDIR /app
COPY --from=builder /ops-runtime/ /
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 NPM_CONFIG_CACHE=/tmp/northlane-ops-npm
USER node
CMD ["npm", "run", "db:deploy"]

FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /runtime/ ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD ["node", "deploy/healthcheck.mjs"]
ENTRYPOINT ["node", "deploy/app-entrypoint.mjs"]
