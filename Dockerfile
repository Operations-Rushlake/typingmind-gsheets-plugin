# Use Node.js LTS
FROM node:18

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Add dummy build step (Render may run this)
RUN npm run build || echo "Skipping build step"

# Copy the rest of the app
COPY . .

# Expose port (Render will use $PORT)
EXPOSE 10000

# Start your app
CMD ["npm", "start"]

