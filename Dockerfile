FROM dhi.io/node:26-alpine-sfw-dev AS build
WORKDIR /app/relay

# Leverage cacheing by installing dependencies first
COPY package.json package-lock.json ./
# npm ci is new version of --frozen-lockfile
RUN npm ci
# copy src
COPY . ./
# run the build command to build out dist/
RUN [ "npm", "run", "build" ]

FROM dhi.io/node:26-alpine-sfw-dev AS development
WORKDIR /app/relay

# Install dependencies again for development, if not cached
COPY package.json package-lock.json ./
# npm ci is new version of --frozen-lockfile
RUN npm ci
# copy src
COPY . ./

# start dev server
CMD [ "npm", "run", "dev" ]

FROM dhi.io/node:26-alpine-sfw-dev AS production
WORKDIR /app/relay
# copy over the built dist bundle
COPY --from=build /app/relay/dist ./

# start runner / listener
CMD [ "node", "bundle.min.js" ]
