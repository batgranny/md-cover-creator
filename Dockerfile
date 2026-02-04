# Build the frontend
FROM node:18-alpine AS frontend-builder
WORKDIR /app/web
COPY web/package*.json ./
RUN npm install
COPY web/ ./
RUN npm run build

# Build the backend
FROM golang:1.25-alpine AS backend-builder
WORKDIR /app
COPY go.mod ./
# COPY go.sum ./ # Uncomment when dependencies are added
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o main ./cmd/server

# Final stage
FROM alpine:latest
WORKDIR /app
COPY --from=backend-builder /app/main .
COPY --from=frontend-builder /app/web/dist ./web/dist
EXPOSE 8080
CMD ["./main"]
