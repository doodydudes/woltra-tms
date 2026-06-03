FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && \
    node -e " \
      const fs = require('fs'); \
      const p = 'node_modules/@insforge/shared-schemas/package.json'; \
      const pkg = JSON.parse(fs.readFileSync(p, 'utf8')); \
      if (pkg.exports && pkg.exports['.'] && !pkg.exports['.'].require) { \
        pkg.exports['.'].require = './dist/index.js'; \
        fs.writeFileSync(p, JSON.stringify(pkg, null, 2)); \
        console.log('Patched @insforge/shared-schemas exports'); \
      } \
    "
COPY . .
EXPOSE 5000
CMD ["node", "server.js"]
