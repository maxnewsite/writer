# Stage 1: Build the React application
FROM node:20 AS build
WORKDIR /app
COPY package.json package-lock.json ./
# Use ci instead of install for reproducible builds
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Serve the application with Nginx
FROM nginx:stable-alpine
# Copy the built assets from the build stage
COPY --from=build /app/dist /usr/share/nginx/html
# Copy the nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Expose the port nginx will listen on
EXPOSE 8080
# Start nginx
CMD ["nginx", "-g", "daemon off;"]
